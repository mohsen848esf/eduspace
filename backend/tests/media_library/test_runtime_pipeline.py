import os
import hashlib
import shutil
import subprocess
import tempfile
from datetime import timedelta
from pathlib import Path
from unittest import skipUnless
from unittest.mock import patch
from urllib.request import Request, urlopen

from django.conf import settings
from django.test import TransactionTestCase, override_settings
from django.utils import timezone

from accounts.models import User
from media_library.models import (
    MediaAsset, MediaRendition, MediaUploadSession,
    ProgressiveMediaChunk, ProgressiveMediaUpload,
)
from media_library.services.progressive_ingest import ProgressiveIngestService
from media_library.services.inspection import MediaInspectionService
from media_library.services.transcoding import MediaTranscodeService
from media_library.storage import S3MultipartUploadStorage


RUN_RUNTIME_PIPELINE = os.getenv('RUN_MEDIA_RUNTIME_TESTS') == '1'


@skipUnless(RUN_RUNTIME_PIPELINE, 'Set RUN_MEDIA_RUNTIME_TESTS=1 inside the media-worker image.')
class RealMediaPipelineRuntimeTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        if not settings.S3_ENABLED:
            self.skipTest('S3-compatible storage is required.')
        if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
            self.skipTest('FFmpeg and ffprobe are required.')
        self.storage = S3MultipartUploadStorage()
        # An old accounts seed migration inserts an explicit low PK without
        # advancing PostgreSQL's sequence. Keep this runtime fixture isolated
        # from that unrelated migration debt.
        self.owner = User.objects.create_user(id=90_001, username='runtime-media-owner')
        self.source_key = f'media-runtime-tests/{self.owner.pk}/source.mp4'
        self.hls_prefix = None
        self.extra_keys = []

    def tearDown(self):
        if self.hls_prefix:
            self.storage.delete_prefix(object_prefix=self.hls_prefix)
        self.storage.delete(object_key=self.source_key)
        for key in self.extra_keys:
            self.storage.delete(object_key=key)

    @staticmethod
    def _generate_source(destination: Path) -> None:
        command = [
            shutil.which('ffmpeg'),
            '-nostdin', '-hide_banner', '-loglevel', 'error',
            '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=24',
            '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=48000',
            '-t', '4',
            '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '96k',
            '-movflags', '+faststart',
            str(destination),
        ]
        result = subprocess.run(command, capture_output=True, check=False, timeout=60)
        if result.returncode != 0:
            raise AssertionError(result.stderr.decode('utf-8', errors='replace'))

    @patch('media_library.tasks.transcode_media_asset_task.delay')
    def test_real_mp4_is_inspected_transcoded_and_published_to_private_s3(self, queued_transcode):
        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / 'runtime.mp4'
            self._generate_source(source)
            self.storage.upload_file(source=source, object_key=self.source_key)
            size_bytes = source.stat().st_size

        asset = MediaAsset.objects.create(
            owner=self.owner,
            uploader=self.owner,
            title='Runtime pipeline sample',
            original_filename='runtime.mp4',
            status=MediaAsset.Status.INSPECTING,
            content_type='video/mp4',
            size_bytes=size_bytes,
        )
        MediaUploadSession.objects.create(
            asset=asset,
            status=MediaUploadSession.Status.COMPLETED,
            provider_upload_id='runtime-direct-put',
            object_key=self.source_key,
            expected_size_bytes=size_bytes,
            uploaded_bytes=size_bytes,
            part_size_bytes=8 * 1024**2,
            content_type='video/mp4',
            expires_at=timezone.now() + timedelta(hours=1),
            completed_at=timezone.now(),
        )

        inspected = MediaInspectionService.inspect(asset_id=asset.pk)
        self.assertEqual(inspected.status, MediaAsset.Status.PROCESSING)
        self.assertEqual(inspected.container, 'mp4')
        self.assertEqual(inspected.video_codec, 'h264')
        self.assertEqual(inspected.audio_codec, 'aac')
        self.assertEqual((inspected.width, inspected.height), (640, 360))
        self.assertGreater(inspected.duration_ms, 3_500)
        queued_transcode.assert_called_once_with(asset.pk)

        ready = MediaTranscodeService.transcode(asset_id=asset.pk)
        self.assertEqual(ready.status, MediaAsset.Status.READY)
        self.assertTrue(ready.master_manifest_path.endswith('/master.m3u8'))
        self.hls_prefix = ready.master_manifest_path.rsplit('/', 1)[0]
        master = self.storage.read_text(object_key=ready.master_manifest_path)
        self.assertIn('360p/index.m3u8', master)

        rendition = ready.renditions.get(label='360p')
        self.assertEqual(rendition.status, MediaRendition.Status.READY)
        self.assertEqual(rendition.published_duration_ms, ready.duration_ms)
        variant = self.storage.read_text(object_key=rendition.manifest_path)
        self.assertIn('URI="init.mp4"', variant)
        self.assertIn('segment_000000.m4s', variant)
        prefix = rendition.manifest_path.rsplit('/', 1)[0]
        self.storage.client.head_object(Bucket=self.storage.bucket, Key=f'{prefix}/init.mp4')
        self.storage.client.head_object(Bucket=self.storage.bucket, Key=f'{prefix}/segment_000000.m4s')

    def test_presigned_multipart_put_exposes_etag_to_browser_origin(self):
        upload_id = self.storage.initiate(
            object_key=self.source_key,
            content_type='video/mp4',
        )
        upload_url = self.storage.sign_part(
            object_key=self.source_key,
            provider_upload_id=upload_id,
            part_number=1,
        )
        origin = 'http://localhost:5173'
        preflight = Request(
            upload_url,
            method='OPTIONS',
            headers={
                'Origin': origin,
                'Access-Control-Request-Method': 'PUT',
                'Access-Control-Request-Headers': 'content-type',
            },
        )
        with urlopen(preflight, timeout=10) as response:
            self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), origin)
            self.assertIn('PUT', response.headers.get('Access-Control-Allow-Methods', ''))

        payload = b'runtime-multipart-part'
        put = Request(
            upload_url,
            data=payload,
            method='PUT',
            headers={'Origin': origin, 'Content-Type': 'video/mp4'},
        )
        with urlopen(put, timeout=10) as response:
            etag = response.headers.get('ETag')
            exposed = response.headers.get('Access-Control-Expose-Headers', '').lower()
            self.assertTrue(etag)
            self.assertIn('etag', exposed)
        actual_size = self.storage.complete(
            object_key=self.source_key,
            provider_upload_id=upload_id,
            parts=[{'PartNumber': 1, 'ETag': etag}],
        )
        self.assertEqual(actual_size, len(payload))

    def test_independent_chunks_are_readable_verified_and_composed_server_side(self):
        first_key = f'media-runtime-tests/{self.owner.pk}/chunks/00000001.bin'
        second_key = f'media-runtime-tests/{self.owner.pk}/chunks/00000002.bin'
        target_key = f'media-runtime-tests/{self.owner.pk}/composed.mp4'
        self.extra_keys.extend([first_key, second_key, target_key])
        first = b'a' * (5 * 1024**2)
        second = b'final-chunk'
        self.storage.client.put_object(Bucket=self.storage.bucket, Key=first_key, Body=first)
        self.storage.client.put_object(Bucket=self.storage.bucket, Key=second_key, Body=second)

        self.assertEqual(self.storage.head(object_key=first_key)['size_bytes'], len(first))
        self.assertEqual(
            self.storage.stream_sha256(object_key=second_key),
            hashlib.sha256(second).hexdigest(),
        )
        self.assertEqual(self.storage.read_prefix(object_key=second_key, max_bytes=5), b'final')

        size = self.storage.compose_objects(
            source_keys=[first_key, second_key],
            target_key=target_key,
            content_type='video/mp4',
        )
        self.assertEqual(size, len(first) + len(second))
        response = self.storage.client.get_object(Bucket=self.storage.bucket, Key=target_key)
        self.assertEqual(response['Body'].read(), first + second)

    @patch('media_library.tasks.ingest_progressive_media_upload_task.delay')
    @patch('media_library.tasks.inspect_media_asset_task.delay')
    @override_settings(
        MEDIA_PROGRESSIVE_INGEST_ENABLED=True,
        MEDIA_PROGRESSIVE_MIN_PLAYABLE_SECONDS=2,
        MEDIA_PROGRESSIVE_INGEST_TIMEOUT_SECONDS=60,
        MEDIA_PROGRESSIVE_INGEST_POLL_SECONDS=0.05,
    )
    def test_verified_mp4_chunk_is_ingested_to_playable_event_hls_before_finalize(
        self, queued_inspection, queued_ingest,
    ):
        del queued_inspection, queued_ingest
        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / 'progressive.mp4'
            self._generate_source(source)
            payload = source.read_bytes()
        asset = MediaAsset.objects.create(
            owner=self.owner,
            uploader=self.owner,
            title='Progressive runtime sample',
            original_filename='progressive.mp4',
            status=MediaAsset.Status.UPLOADING,
            content_type='video/mp4',
            size_bytes=len(payload),
        )
        upload = ProgressiveMediaUpload.objects.create(
            asset=asset,
            status=ProgressiveMediaUpload.Status.VERIFYING,
            compatibility=ProgressiveMediaUpload.Compatibility.ELIGIBLE,
            expected_size_bytes=len(payload),
            uploaded_bytes=len(payload),
            contiguous_uploaded_bytes=len(payload),
            contiguous_verified_bytes=len(payload),
            chunk_size_bytes=len(payload),
            content_type='video/mp4',
            object_prefix=f'media-runtime-tests/{self.owner.pk}/progressive',
            expires_at=timezone.now() + timedelta(hours=1),
        )
        chunk_key = f'{upload.object_prefix}/00000001.bin'
        self.extra_keys.append(chunk_key)
        self.storage.client.put_object(Bucket=self.storage.bucket, Key=chunk_key, Body=payload)
        ProgressiveMediaChunk.objects.create(
            upload=upload,
            sequence=1,
            object_key=chunk_key,
            expected_size_bytes=len(payload),
            status=ProgressiveMediaChunk.Status.VERIFIED,
        )

        result = ProgressiveIngestService.ingest(upload_id=upload.pk, storage=self.storage)
        result.refresh_from_db()
        asset.refresh_from_db()
        rendition = asset.renditions.get(label='progressive')
        self.assertEqual(result.status, ProgressiveMediaUpload.Status.VERIFYING)
        self.assertEqual(result.last_consumed_sequence, 1)
        self.assertEqual(asset.status, MediaAsset.Status.PARTIALLY_PLAYABLE)
        self.assertEqual(rendition.status, MediaRendition.Status.PLAYABLE)
        self.assertGreaterEqual(rendition.published_duration_ms, 2_000)
        self.assertIn('#EXT-X-PLAYLIST-TYPE:EVENT', self.storage.read_text(
            object_key=rendition.manifest_path,
        ))
        self.hls_prefix = result.ingest_prefix

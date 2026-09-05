from datetime import timedelta
from pathlib import Path
import tempfile
from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.models import User
from media_library.models import MediaAsset, MediaRendition, MediaUploadSession
from media_library.services.transcoding import MediaTranscodeError, MediaTranscodeService
from media_library.tasks import transcode_media_asset_task
from media_library.transcoding import HlsProfile, remux_hls_source, transcode_hls_renditions


SOURCE = b'private-inspected-source'


class HlsStorage:
    def __init__(self):
        self.uploaded = []
        self.deleted = []

    def download(self, *, object_key, destination):
        del object_key
        destination.write_bytes(SOURCE)

    def upload_tree(self, *, source_root, object_prefix):
        self.uploaded.extend([
            f'{object_prefix}/{path.relative_to(source_root).as_posix()}'
            for path in source_root.rglob('*')
            if path.is_file()
        ])

    def delete_prefix(self, *, object_prefix):
        self.deleted.append(object_prefix)


def successful_transcoder(*, source, output_root, profiles, has_audio):
    del source, has_audio
    for profile in profiles:
        root = output_root / profile.label
        root.mkdir(parents=True)
        (root / 'index.m3u8').write_text(
            '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:2.0,\nsegment_000000.m4s\n',
            encoding='utf-8',
        )
        (root / 'init.mp4').write_bytes(b'init')
        (root / 'segment_000000.m4s').write_bytes(b'segment')


def successful_remuxer(*, source, output_root, has_audio):
    del source, has_audio
    root = output_root / 'source'
    root.mkdir(parents=True)
    (root / 'index.m3u8').write_text(
        '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:2.0,\nsegment_000000.m4s\n',
        encoding='utf-8',
    )
    (root / 'init.mp4').write_bytes(b'init')
    (root / 'segment_000000.m4s').write_bytes(b'segment')


@override_settings(MEDIA_TRANSCODE_THREADS=2, MEDIA_TRANSCODE_TIMEOUT_SECONDS=120)
class MediaTranscodeServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='transcode-owner')
        self.asset = MediaAsset.objects.create(
            owner=self.owner,
            uploader=self.owner,
            title='Transcode me',
            original_filename='film.mp4',
            status=MediaAsset.Status.PROCESSING,
            content_type='video/mp4',
            container='mp4',
            video_codec='h264',
            audio_codec='aac',
            duration_ms=7_200_000,
            size_bytes=len(SOURCE),
            width=1920,
            height=1080,
            checksum_sha256='a' * 64,
        )
        MediaUploadSession.objects.create(
            asset=self.asset,
            status=MediaUploadSession.Status.COMPLETED,
            provider_upload_id='provider-id',
            object_key='private/source.upload',
            expected_size_bytes=len(SOURCE),
            uploaded_bytes=len(SOURCE),
            part_size_bytes=8 * 1024**2,
            content_type='video/mp4',
            expires_at=timezone.now() + timedelta(hours=1),
            completed_at=timezone.now(),
        )

    def test_1080p_input_produces_a_720p_downscale_rung(self):
        profiles = MediaTranscodeService.profiles_for(self.asset)
        self.assertEqual(
            [(row.label, row.width, row.height) for row in profiles],
            [('720p', 1280, 720)],
        )

    def test_success_publishes_immutable_hls_metadata_atomically(self):
        storage = HlsStorage()
        ready = MediaTranscodeService.transcode(
            asset_id=self.asset.id,
            storage=storage,
            transcoder=successful_transcoder,
            remuxer=successful_remuxer,
        )
        self.assertEqual(ready.status, MediaAsset.Status.READY)
        self.assertIn('/aaaaaaaaaaaaaaaa/master.m3u8', ready.master_manifest_path)
        renditions = list(ready.renditions.order_by('height'))
        self.assertEqual([row.label for row in renditions], ['720p', 'source'])
        self.assertTrue(all(row.status == MediaRendition.Status.READY for row in renditions))
        self.assertEqual(renditions[-1].published_duration_ms, self.asset.duration_ms)
        self.assertTrue(renditions[-1].is_default)
        self.assertFalse(renditions[0].is_default)
        self.assertIn(ready.master_manifest_path, storage.uploaded)

    def test_resolution_at_or_below_downscale_target_gets_no_ladder_rung(self):
        # Original quality (handled separately in transcode()) already covers
        # this resolution, so there's nothing left to downscale to.
        self.asset.width = 426
        self.asset.height = 240
        profiles = MediaTranscodeService.profiles_for(self.asset)
        self.assertEqual(profiles, [])

    def test_incomplete_hls_output_never_becomes_ready(self):
        def incomplete(**kwargs):
            del kwargs

        with self.assertRaisesMessage(MediaTranscodeError, 'HLS_RENDITION_INCOMPLETE'):
            MediaTranscodeService.transcode(
                asset_id=self.asset.id,
                storage=HlsStorage(),
                transcoder=incomplete,
                remuxer=None,
            )
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.status, MediaAsset.Status.PROCESSING)

    def test_compatible_source_is_playable_before_adaptive_encode_starts(self):
        storage = HlsStorage()
        observed = []

        def observing_transcoder(**kwargs):
            current = MediaAsset.objects.get(pk=self.asset.pk)
            observed.append((
                current.status,
                current.renditions.get(label='source').status,
            ))
            successful_transcoder(**kwargs)

        MediaTranscodeService.transcode(
            asset_id=self.asset.id,
            storage=storage,
            transcoder=observing_transcoder,
            remuxer=successful_remuxer,
        )

        self.assertEqual(observed[0], (
            MediaAsset.Status.PARTIALLY_PLAYABLE,
            MediaRendition.Status.PLAYABLE,
        ))

    def test_non_h264_source_gets_original_quality_via_reencode_not_remux(self):
        self.asset.video_codec = 'hevc'
        self.asset.save(update_fields=['video_codec'])
        storage = HlsStorage()
        remuxer_calls = []
        transcoder_labels = []

        def recording_remuxer(**kwargs):
            remuxer_calls.append(kwargs)

        def recording_transcoder(**kwargs):
            transcoder_labels.append(kwargs['profiles'][0].label)
            successful_transcoder(**kwargs)

        ready = MediaTranscodeService.transcode(
            asset_id=self.asset.id,
            storage=storage,
            transcoder=recording_transcoder,
            remuxer=recording_remuxer,
        )
        self.assertEqual(remuxer_calls, [])
        self.assertIn('source', transcoder_labels)
        source_rendition = ready.renditions.get(label='source')
        self.assertEqual(source_rendition.status, MediaRendition.Status.READY)
        self.assertEqual((source_rendition.width, source_rendition.height), (1920, 1080))

    def test_original_failure_is_fatal_when_no_downscale_rung_exists(self):
        self.asset.width = 640
        self.asset.height = 360
        self.asset.save(update_fields=['width', 'height'])

        def failing_remuxer(**kwargs):
            del kwargs
            raise RuntimeError('boom')

        with self.assertRaises(MediaTranscodeError):
            MediaTranscodeService.transcode(
                asset_id=self.asset.id,
                storage=HlsStorage(),
                transcoder=successful_transcoder,
                remuxer=failing_remuxer,
            )
        self.asset.refresh_from_db()
        self.assertEqual(
            self.asset.renditions.get(label='source').status,
            MediaRendition.Status.FAILED,
        )

    @patch('media_library.tasks.MediaTranscodeService.transcode')
    def test_task_marks_asset_and_renditions_failed_after_permanent_error(self, transcode):
        MediaRendition.objects.create(
            asset=self.asset,
            label='720p',
            status=MediaRendition.Status.PROCESSING,
        )
        transcode.side_effect = MediaTranscodeError('HLS_RENDITION_INCOMPLETE')
        result = transcode_media_asset_task(self.asset.id)
        self.asset.refresh_from_db()
        self.assertIn('failed', result)
        self.assertEqual(self.asset.status, MediaAsset.Status.FAILED)
        self.assertEqual(self.asset.failure_code, 'HLS_RENDITION_INCOMPLETE')
        self.assertEqual(self.asset.renditions.get().status, MediaRendition.Status.FAILED)

    @patch('media_library.tasks.MediaTranscodeService.transcode')
    def test_task_records_failure_without_discarding_already_published_rendition(self, transcode):
        # A later rendition (e.g. the 720p rung) can fail after an earlier
        # one (Original) already published. The asset must not be silently
        # stranded, nor should the already-working rendition be discarded.
        self.asset.status = MediaAsset.Status.PARTIALLY_PLAYABLE
        self.asset.save(update_fields=['status'])
        MediaRendition.objects.create(
            asset=self.asset, label='source', status=MediaRendition.Status.READY,
        )
        MediaRendition.objects.create(
            asset=self.asset, label='720p', status=MediaRendition.Status.PROCESSING,
        )
        transcode.side_effect = MediaTranscodeError('FFMPEG_TRANSCODE_FAILED')
        transcode_media_asset_task(self.asset.id)
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.status, MediaAsset.Status.PARTIALLY_PLAYABLE)
        self.assertEqual(self.asset.failure_code, 'FFMPEG_TRANSCODE_FAILED')
        self.assertEqual(
            self.asset.renditions.get(label='source').status, MediaRendition.Status.READY,
        )
        self.assertEqual(
            self.asset.renditions.get(label='720p').status, MediaRendition.Status.FAILED,
        )


@override_settings(MEDIA_TRANSCODE_THREADS=2, MEDIA_TRANSCODE_TIMEOUT_SECONDS=30)
class HlsCommandTests(TestCase):
    @patch('media_library.transcoding.subprocess.run')
    @patch('media_library.transcoding.shutil.which', return_value='/usr/bin/ffmpeg')
    def test_ffmpeg_uses_fixed_argument_list_and_cmaf_hls_options(self, which, run):
        del which
        run.return_value = SimpleNamespace(returncode=0, stderr=b'')
        profile = HlsProfile('360p', 640, 360, 800_000, 96_000)
        with tempfile.TemporaryDirectory() as temp_dir:
            transcode_hls_renditions(
                source=Path(temp_dir) / 'source.upload',
                output_root=Path(temp_dir) / 'output',
                profiles=[profile],
                has_audio=True,
            )
        command = run.call_args.args[0]
        self.assertIsInstance(command, list)
        self.assertNotIn('shell', run.call_args.kwargs)
        self.assertIn('fmp4', command)
        self.assertIn('segment_%06d.m4s', command)
        self.assertEqual(run.call_args.kwargs['timeout'], 30)
        self.assertEqual(run.call_args.kwargs['cwd'].name, '360p')

    @patch('media_library.transcoding.subprocess.run')
    @patch('media_library.transcoding.shutil.which', return_value='/usr/bin/ffmpeg')
    def test_compatible_source_fast_path_remuxes_without_encoding(self, which, run):
        del which
        run.return_value = SimpleNamespace(returncode=0, stderr=b'')
        with tempfile.TemporaryDirectory() as temp_dir:
            remux_hls_source(
                source=Path(temp_dir) / 'source.upload',
                output_root=Path(temp_dir) / 'output',
                has_audio=True,
            )
        command = run.call_args.args[0]
        self.assertIn('copy', command)
        self.assertNotIn('libx264', command)
        self.assertEqual(run.call_args.kwargs['cwd'].name, 'source')

    @patch('media_library.transcoding.subprocess.run')
    @patch('media_library.transcoding.shutil.which', return_value='/usr/bin/ffmpeg')
    def test_remux_transcodes_audio_to_aac_regardless_of_source_audio_codec(self, which, run):
        # The video stream is always copied untouched; only audio needs to
        # become AAC, since that's what HLS delivery requires — this is what
        # lets an Opus/MP3/etc. source still get an original-quality video
        # rendition instead of falling back to a full re-encode.
        del which
        run.return_value = SimpleNamespace(returncode=0, stderr=b'')
        with tempfile.TemporaryDirectory() as temp_dir:
            remux_hls_source(
                source=Path(temp_dir) / 'source.upload',
                output_root=Path(temp_dir) / 'output',
                has_audio=True,
            )
        command = run.call_args.args[0]
        self.assertIn('-c:v', command)
        self.assertEqual(command[command.index('-c:v') + 1], 'copy')
        self.assertIn('-c:a', command)
        self.assertEqual(command[command.index('-c:a') + 1], 'aac')
        self.assertNotIn('libx264', command)

    @patch('media_library.transcoding.subprocess.run')
    @patch('media_library.transcoding.shutil.which', return_value='/usr/bin/ffmpeg')
    def test_remux_skips_audio_args_when_source_has_no_audio(self, which, run):
        del which
        run.return_value = SimpleNamespace(returncode=0, stderr=b'')
        with tempfile.TemporaryDirectory() as temp_dir:
            remux_hls_source(
                source=Path(temp_dir) / 'source.upload',
                output_root=Path(temp_dir) / 'output',
                has_audio=False,
            )
        command = run.call_args.args[0]
        self.assertNotIn('-c:a', command)
        self.assertNotIn('0:a:0', command)

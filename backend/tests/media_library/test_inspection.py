import hashlib
import json
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.models import User
from media_library.inspection import MediaProbeError, MediaProbeResult, probe_media_file
from media_library.models import MediaAsset, MediaUploadSession
from media_library.services.inspection import MediaInspectionError, MediaInspectionService
from media_library.tasks import inspect_media_asset_task


VALID_MP4 = b'\x00\x00\x00\x18ftypisom' + (b'\x00' * 20)


class DownloadStorage:
    def __init__(self, payload=VALID_MP4):
        self.payload = payload

    def download(self, *, object_key, destination):
        del object_key
        destination.write_bytes(self.payload)


@override_settings(
    MEDIA_MAX_DURATION_SECONDS=14_400,
    MEDIA_MAX_WIDTH=7680,
    MEDIA_MAX_HEIGHT=4320,
)
class MediaInspectionServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='inspect-owner')
        self.asset = MediaAsset.objects.create(
            owner=self.owner,
            uploader=self.owner,
            title='Inspect me',
            original_filename='inspect.mp4',
            status=MediaAsset.Status.INSPECTING,
            size_bytes=len(VALID_MP4),
        )
        MediaUploadSession.objects.create(
            asset=self.asset,
            status=MediaUploadSession.Status.COMPLETED,
            provider_upload_id='provider-id',
            object_key='private/source.upload',
            expected_size_bytes=len(VALID_MP4),
            uploaded_bytes=len(VALID_MP4),
            part_size_bytes=8 * 1024**2,
            content_type='video/mp4',
            expires_at=timezone.now() + timedelta(hours=1),
            completed_at=timezone.now(),
        )
        self.probe = MediaProbeResult(
            container='mov',
            duration_ms=7_200_000,
            size_bytes=len(VALID_MP4),
            video_codec='h264',
            audio_codec='aac',
            width=1920,
            height=1080,
        )

    def test_valid_private_source_is_fingerprinted_and_moves_to_processing(self):
        with patch('media_library.tasks.transcode_media_asset_task.delay') as delay:
            with self.captureOnCommitCallbacks(execute=True):
                inspected = MediaInspectionService.inspect(
                    asset_id=self.asset.id,
                    storage=DownloadStorage(),
                    probe=lambda path: self.probe,
                )
        self.assertEqual(inspected.status, MediaAsset.Status.PROCESSING)
        self.assertEqual(inspected.container, 'mp4')
        self.assertEqual(inspected.video_codec, 'h264')
        self.assertEqual(inspected.duration_ms, 7_200_000)
        self.assertEqual(inspected.checksum_sha256, hashlib.sha256(VALID_MP4).hexdigest())
        delay.assert_called_once_with(self.asset.id)

    def test_final_inspection_preserves_already_playable_progressive_asset(self):
        self.asset.status = MediaAsset.Status.PARTIALLY_PLAYABLE
        self.asset.save(update_fields=['status'])
        with patch('media_library.tasks.transcode_media_asset_task.delay') as delay:
            with self.captureOnCommitCallbacks(execute=True):
                inspected = MediaInspectionService.inspect(
                    asset_id=self.asset.id,
                    storage=DownloadStorage(),
                    probe=lambda path: self.probe,
                )
        self.assertEqual(inspected.status, MediaAsset.Status.PARTIALLY_PLAYABLE)
        delay.assert_called_once_with(self.asset.id)

    def test_extension_cannot_override_magic_signature(self):
        with self.assertRaisesMessage(MediaInspectionError, 'UNSUPPORTED_FILE_SIGNATURE'):
            MediaInspectionService.inspect(
                asset_id=self.asset.id,
                storage=DownloadStorage(b'<html>not a video</html>' + b'0' * 8),
                probe=lambda path: self.probe,
            )

    def test_unsupported_codec_is_rejected_before_processing(self):
        invalid = MediaProbeResult(**{**self.probe.__dict__, 'video_codec': 'unknown'})
        with self.assertRaisesMessage(MediaInspectionError, 'UNSUPPORTED_VIDEO_CODEC'):
            MediaInspectionService.inspect(
                asset_id=self.asset.id,
                storage=DownloadStorage(),
                probe=lambda path: invalid,
            )

    def test_ffprobe_container_must_agree_with_magic_signature(self):
        invalid = MediaProbeResult(**{**self.probe.__dict__, 'container': 'matroska'})
        with self.assertRaisesMessage(MediaInspectionError, 'CONTAINER_PROBE_MISMATCH'):
            MediaInspectionService.inspect(
                asset_id=self.asset.id,
                storage=DownloadStorage(),
                probe=lambda path: invalid,
            )

    def test_probe_size_must_match_completed_object(self):
        invalid = MediaProbeResult(**{**self.probe.__dict__, 'size_bytes': 1})
        with self.assertRaisesMessage(MediaInspectionError, 'PROBED_SIZE_MISMATCH'):
            MediaInspectionService.inspect(
                asset_id=self.asset.id,
                storage=DownloadStorage(),
                probe=lambda path: invalid,
            )

    @patch('media_library.tasks.MediaInspectionService.inspect')
    def test_task_persists_stable_failure_code_for_permanent_rejection(self, inspect):
        inspect.side_effect = MediaInspectionError('UNSUPPORTED_VIDEO_CODEC')
        result = inspect_media_asset_task(self.asset.id)
        self.asset.refresh_from_db()
        self.assertIn('rejected', result)
        self.assertEqual(self.asset.status, MediaAsset.Status.FAILED)
        self.assertEqual(self.asset.failure_code, 'UNSUPPORTED_VIDEO_CODEC')


@override_settings(MEDIA_INSPECTION_TIMEOUT_SECONDS=12)
class MediaProbeWrapperTests(TestCase):
    @patch('media_library.inspection.shutil.which', return_value=None)
    def test_missing_ffprobe_has_stable_error(self, which):
        del which
        with self.assertRaisesMessage(MediaProbeError, 'FFPROBE_NOT_AVAILABLE'):
            probe_media_file(Path('source.upload'))

    @patch('media_library.inspection.subprocess.run')
    @patch('media_library.inspection.shutil.which', return_value='/usr/bin/ffprobe')
    def test_ffprobe_uses_argument_list_without_shell_and_bounded_timeout(self, which, run):
        del which
        run.return_value = SimpleNamespace(
            returncode=0,
            stdout=json.dumps({
                'format': {'format_name': 'mov,mp4', 'duration': '10.0', 'size': '32'},
                'streams': [
                    {'codec_type': 'video', 'codec_name': 'h264', 'width': 1280, 'height': 720},
                    {'codec_type': 'audio', 'codec_name': 'aac'},
                ],
            }).encode(),
        )
        result = probe_media_file(Path('source.upload'))
        command = run.call_args.args[0]
        self.assertIsInstance(command, list)
        self.assertEqual(command[0], '/usr/bin/ffprobe')
        self.assertNotIn('shell', run.call_args.kwargs)
        self.assertEqual(run.call_args.kwargs['timeout'], 12)
        self.assertEqual(result.video_codec, 'h264')

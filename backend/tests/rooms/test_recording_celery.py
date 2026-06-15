import shutil
from pathlib import Path
from unittest.mock import patch, MagicMock
from django.conf import settings
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from rooms.models import Room, Recording, RecordingSegment
from rooms.tasks import finalize_client_recording_task, finalize_recording_task
from rooms.recording.ffmpeg_ops import ProbeResult

User = get_user_model()


class RecordingCeleryTasksTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='host_user', password='password')
        from accounts.models import Organization, OrgMember
        self.org = Organization.objects.create(name='Test Org', slug='test-org', owner=self.user)
        self.member = OrgMember.objects.create(organization=self.org, user=self.user)
        
        self.room = Room.objects.create(
            name='Test Room',
            room_code='ROOMXX',
            host=self.user,
            organization=self.org,
        )
        
        self.recording = Recording.objects.create(
            room=self.room,
            owner=self.user,
            quality='1080p',
            status=Recording.Status.PROCESSING,
        )

    def tearDown(self):
        # Clean up any created directories for safety
        rec_dir = Path(settings.RECORDING_OUTPUT_DIR) / self.recording.public_token
        if rec_dir.exists():
            try:
                shutil.rmtree(rec_dir)
            except OSError:
                pass

    @patch('rooms.recording.ffmpeg_ops.concat_webm_to_mp4')
    @patch('rooms.recording.ffmpeg_ops.probe')
    @patch('rooms.recording.ffmpeg_ops.transcode_and_trim')
    @patch('rooms.tasks.upload_recording_to_s3')
    def test_finalize_client_recording_task_success(self, mock_s3, mock_transcode, mock_probe, mock_concat):
        recording_token = self.recording.public_token
        chunks_dir = Path(settings.RECORDING_OUTPUT_DIR) / recording_token / 'chunks'
        chunks_dir.mkdir(parents=True, exist_ok=True)
        
        # Create fake chunks
        (chunks_dir / 'chunk_0.webm').write_text('chunk0')
        (chunks_dir / 'chunk_1.webm').write_text('chunk1')
        
        mock_probe.return_value = ProbeResult(
            duration_seconds=120.0,
            size_bytes=1024000,
            has_audio=True,
            has_video=True
        )

        # Set up side effects to create dummy files
        def side_effect_concat(chunk_files, final_mp4_path):
            final_mp4_path.write_text('fake_final_video')
        mock_concat.side_effect = side_effect_concat

        def side_effect_transcode(source_path, output_path, height, start_seconds):
            output_path.write_text('fake_transcoded_video')
        mock_transcode.side_effect = side_effect_transcode

        with patch('django.conf.settings.S3_ENABLED', True), \
             patch('django.conf.settings.AWS_STORAGE_BUCKET_NAME', 'test-bucket'), \
             patch('django.conf.settings.CDN_URL', 'https://cdn.example.com'):
            
            res = finalize_client_recording_task(self.recording.pk)
            
            self.assertIn("completed", res)
            self.recording.refresh_from_db()
            self.assertEqual(self.recording.status, Recording.Status.COMPLETED)
            self.assertEqual(self.recording.duration_seconds, 120)
            self.assertEqual(self.recording.size_bytes, 1024000)
            self.assertEqual(self.recording.file_path, f"{recording_token}/final.mp4")
            
            # Verify concat & transcode downscale are called
            mock_concat.assert_called_once()
            mock_transcode.assert_called_once() # downscale to 720p because quality='1080p'
            
            # Verify S3 uploads triggered
            self.assertTrue(mock_s3.call_count >= 2)
            
            # Verify chunks folder is deleted
            self.assertFalse(chunks_dir.exists())

    @patch('rooms.recording.ffmpeg_ops.concat_segments')
    @patch('rooms.recording.ffmpeg_ops.probe')
    @patch('rooms.recording.ffmpeg_ops.trim_inplace')
    @patch('rooms.recording.ffmpeg_ops.transcode_and_trim')
    @patch('rooms.tasks.upload_recording_to_s3')
    def test_finalize_recording_task_server_side(self, mock_s3, mock_transcode, mock_trim, mock_probe, mock_concat):
        recording_token = self.recording.public_token
        
        # Create segment DB rows and fake files
        recording_dir = Path(settings.RECORDING_OUTPUT_DIR) / recording_token
        recording_dir.mkdir(parents=True, exist_ok=True)
        
        seg1_file = f"{recording_token}/seg-000.mp4"
        (settings.RECORDING_OUTPUT_DIR / seg1_file).write_text('seg1')
        
        RecordingSegment.objects.create(
            recording=self.recording,
            index=0,
            egress_id='egress1',
            file_path=seg1_file,
            duration_seconds=60.0,
            size_bytes=1000
        )
        
        mock_probe.return_value = ProbeResult(
            duration_seconds=60.0,
            size_bytes=1000,
            has_audio=True,
            has_video=True
        )

        # Set up side effects to create dummy files
        def side_effect_concat(seg_paths, intermediate_path):
            intermediate_path.write_text('fake_intermediate_video')
        mock_concat.side_effect = side_effect_concat

        def side_effect_trim(intermediate_path, final_path, start_seconds, end_seconds):
            final_path.write_text('fake_final_video')
        mock_trim.side_effect = side_effect_trim

        def side_effect_transcode(source_path, output_path, height, start_seconds):
            output_path.write_text('fake_transcoded_video')
        mock_transcode.side_effect = side_effect_transcode

        with patch('django.conf.settings.S3_ENABLED', False):
            finalize_recording_task(self.recording.pk, trim_start=10.0, trim_end=45.0)
            
            self.recording.refresh_from_db()
            self.assertEqual(self.recording.status, Recording.Status.COMPLETED)
            self.assertEqual(self.recording.trim_start_seconds, 10.0)
            self.assertEqual(self.recording.trim_end_seconds, 45.0)
            
            mock_concat.assert_called_once()
            mock_trim.assert_called_once()
            mock_transcode.assert_called_once() # downscale 1080p to 720p
            mock_s3.assert_not_called()

    def test_stream_recording_s3_redirect(self):
        recording_token = self.recording.public_token
        self.recording.status = Recording.Status.COMPLETED
        self.recording.file_path = f"{recording_token}/final.mp4"
        self.recording.save()

        # Share the recording with the user
        self.recording.visible_to.add(self.user)
        self.recording.is_published = True
        self.recording.save()

        self.client.force_authenticate(user=self.user)
        url = reverse('recording_stream', kwargs={'token': recording_token})

        # When S3 is enabled, it should redirect to CDN URL
        with patch('django.conf.settings.S3_ENABLED', True), \
             patch('django.conf.settings.CDN_URL', 'https://cdn.example.com'):
            
            response = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='test-org')
            self.assertEqual(response.status_code, status.HTTP_302_FOUND)
            self.assertEqual(response.url, f"https://cdn.example.com/{recording_token}/final.mp4")

    @patch('pathlib.Path.exists')
    def test_stream_recording_with_quality_options(self, mock_exists):
        # We mock Path.exists to say that the local 720p file exists
        mock_exists.return_value = True


        recording_token = self.recording.public_token
        self.recording.status = Recording.Status.COMPLETED
        self.recording.file_path = f"{recording_token}/final.mp4"
        self.recording.save()

        self.recording.visible_to.add(self.user)
        self.recording.is_published = True
        self.recording.save()

        self.client.force_authenticate(user=self.user)
        url = reverse('recording_stream', kwargs={'token': recording_token})

        with patch('django.conf.settings.S3_ENABLED', False), \
             patch('rooms.recording.views.serve_video_with_range') as mock_serve:
            
            from django.http import HttpResponse
            mock_serve.return_value = HttpResponse("fake video stream content", content_type="video/mp4")

            # Request 720p quality
            self.client.get(f"{url}?quality=720p", HTTP_X_ORGANIZATION_SLUG='test-org')
            
            # Verify serve_video_with_range was called with the 720p file path
            mock_serve.assert_called_once()
            called_path = mock_serve.call_args[0][0]
            self.assertTrue(str(called_path).endswith("final_720p.mp4"))

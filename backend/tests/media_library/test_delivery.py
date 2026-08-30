from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from media_library.models import MediaAsset, MediaRendition
from media_library.services import SharedPlaybackService
from media_library.services.delivery import MediaDeliveryError, MediaDeliveryService
from rooms.models import Room, RoomParticipant


@override_settings(
    MEDIA_PLAYBACK_TICKET_TTL_SECONDS=900,
    MEDIA_PLAYBACK_OBJECT_URL_TTL_SECONDS=300,
    MEDIA_PLAYBACK_DIRECT_OBJECT_URLS=False,
)
class MediaDeliveryTests(TestCase):
    def setUp(self):
        self.host = User.objects.create_user(username='delivery-host')
        self.viewer = User.objects.create_user(username='delivery-viewer')
        self.outsider = User.objects.create_user(username='delivery-outsider')
        self.room = Room.objects.create(
            room_code='HLS001',
            name='HLS room',
            host=self.host,
            status=Room.Status.ACTIVE,
        )
        RoomParticipant.objects.create(room=self.room, user=self.viewer)
        self.asset = MediaAsset.objects.create(
            owner=self.host,
            uploader=self.host,
            title='Ready HLS',
            status=MediaAsset.Status.READY,
            duration_ms=3_600_000,
            width=1280,
            height=720,
            audio_codec='aac',
            master_manifest_path='private/hls/master.m3u8',
        )
        self.rendition = MediaRendition.objects.create(
            asset=self.asset,
            label='720p',
            status=MediaRendition.Status.READY,
            width=1280,
            height=720,
            bitrate_bps=2_928_000,
            manifest_path='private/hls/720p/index.m3u8',
            published_duration_ms=self.asset.duration_ms,
            is_default=True,
        )
        self.playback = SharedPlaybackService.open_session(
            room=self.room,
            asset=self.asset,
            actor=self.host,
        )
        self.ticket = MediaDeliveryService.issue_ticket(self.playback)
        self.client = APIClient()

    def test_active_participant_can_issue_short_lived_delivery_but_outsider_cannot(self):
        url = reverse('shared_playback_delivery', kwargs={'room_code': self.room.room_code})
        self.client.force_authenticate(user=self.viewer)
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['data']['playback_id'], self.playback.id)
        self.assertIn('ticket=', response.data['data']['master_url'])
        self.client.force_authenticate(user=self.outsider)
        self.assertEqual(self.client.post(url).status_code, 403)

    def test_master_manifest_is_no_store_and_contains_only_ticketed_variant_urls(self):
        response = self.client.get(reverse('media_delivery_master'), {'ticket': self.ticket})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Cache-Control'], 'no-store')
        content = response.content.decode()
        self.assertIn('RESOLUTION=1280x720', content)
        self.assertIn('/api/media/playback/720p/index.m3u8?ticket=', content)

    def test_progressive_master_omits_unverified_codec_claim(self):
        self.rendition.label = 'progressive'
        self.rendition.save(update_fields=['label'])
        response = self.client.get(reverse('media_delivery_master'), {'ticket': self.ticket})
        stream_info = next(
            line for line in response.content.decode().splitlines()
            if line.startswith('#EXT-X-STREAM-INF:')
        )
        self.assertNotIn('CODECS=', stream_info)

    def test_ready_master_excludes_temporary_progressive_duplicate(self):
        MediaRendition.objects.create(
            asset=self.asset,
            label='progressive',
            status=MediaRendition.Status.READY,
            width=640,
            height=360,
            bitrate_bps=896_000,
            manifest_path='private/hls/progressive/index.m3u8',
            published_duration_ms=self.asset.duration_ms,
        )
        MediaRendition.objects.create(
            asset=self.asset,
            label='360p',
            status=MediaRendition.Status.READY,
            width=640,
            height=360,
            bitrate_bps=896_000,
            manifest_path='private/hls/360p/index.m3u8',
            published_duration_ms=self.asset.duration_ms,
        )

        response = self.client.get(reverse('media_delivery_master'), {'ticket': self.ticket})
        content = response.content.decode()

        self.assertNotIn('/api/media/playback/progressive/index.m3u8', content)
        self.assertEqual(content.count('RESOLUTION=640x360'), 1)
        self.assertIn('/api/media/playback/360p/index.m3u8', content)

    @patch('media_library.views.S3MultipartUploadStorage')
    def test_variant_rewrites_init_and_segments_to_same_api_origin(self, storage_class):
        storage_class.return_value.read_text.return_value = (
            '#EXTM3U\n'
            '#EXT-X-MAP:URI="init.mp4"\n'
            '#EXTINF:2.0,\n'
            'segment_000000.m4s\n'
        )
        response = self.client.get(
            reverse('media_delivery_variant', kwargs={'label': '720p'}),
            {'ticket': self.ticket},
        )
        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        self.assertIn('/api/media/playback/720p/init.mp4?ticket=', content)
        self.assertIn('/api/media/playback/720p/segment_000000.m4s?ticket=', content)
        self.assertNotIn('\nsegment_000000.m4s\n', content)
        storage_class.return_value.sign_download.assert_not_called()

    @patch('media_library.views.S3MultipartUploadStorage')
    def test_segment_streams_private_object_without_storage_redirect(self, storage_class):
        storage_class.return_value.head.return_value = {
            'size_bytes': 7,
            'etag': 'segment-etag',
        }
        storage_class.return_value.iter_bytes.return_value = iter([b'seg', b'ment'])
        response = self.client.get(
            reverse(
                'media_delivery_segment',
                kwargs={'label': '720p', 'filename': 'segment_000000.m4s'},
            ),
            {'ticket': self.ticket},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(b''.join(response.streaming_content), b'segment')
        self.assertEqual(response['Content-Length'], '7')
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        self.assertNotIn('Location', response)
        storage_class.return_value.iter_bytes.assert_called_once_with(
            object_key='private/hls/720p/segment_000000.m4s',
        )

    @override_settings(MEDIA_PLAYBACK_DIRECT_OBJECT_URLS=True)
    @patch('media_library.views.S3MultipartUploadStorage')
    def test_cdn_mode_rewrites_variant_to_direct_signed_urls(self, storage_class):
        storage_class.return_value.read_text.return_value = (
            '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:2.0,\nsegment_000000.m4s\n'
        )
        storage_class.return_value.sign_download.side_effect = (
            lambda *, object_key: f'https://storage.test/signed/{object_key}'
        )
        response = self.client.get(
            reverse('media_delivery_variant', kwargs={'label': '720p'}),
            {'ticket': self.ticket},
        )
        content = response.content.decode()
        self.assertIn('https://storage.test/signed/private/hls/720p/init.mp4', content)
        self.assertIn('https://storage.test/signed/private/hls/720p/segment_000000.m4s', content)

    def test_ticket_stops_working_as_soon_as_playback_ends(self):
        SharedPlaybackService.apply_command(
            playback=self.playback,
            actor=self.host,
            command='STOP',
            expected_version=1,
        )
        response = self.client.get(reverse('media_delivery_master'), {'ticket': self.ticket})
        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.data['code'], 'PLAYBACK_DELIVERY_NOT_AVAILABLE')

    def test_forged_ticket_and_manifest_path_traversal_are_rejected(self):
        response = self.client.get(reverse('media_delivery_master'), {'ticket': 'forged'})
        self.assertEqual(response.status_code, 401)
        with self.assertRaisesMessage(MediaDeliveryError, 'INVALID_HLS_MANIFEST'):
            MediaDeliveryService.rewrite_variant_playlist(
                playlist='#EXTM3U\n../secret.m4s\n',
                segment_url=lambda value: value,
            )

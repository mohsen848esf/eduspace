from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import Organization, User
from media_library.models import MediaAsset, SharedPlaybackSession
from rooms.models import Room, RoomParticipant
from rooms.services.guest_access import issue_guest_access_token


class SharedMediaApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='cinema-owner')
        self.viewer = User.objects.create_user(username='cinema-viewer')
        self.outsider = User.objects.create_user(username='cinema-outsider')
        self.other_owner = User.objects.create_user(username='other-owner')
        self.organization = Organization.objects.create(
            name='Cinema', slug='cinema', owner=self.owner,
        )
        self.room = Room.objects.create(
            room_code='MOVIE1', name='Movie room', host=self.owner,
            organization=self.organization, status=Room.Status.ACTIVE,
        )
        self.second_room = Room.objects.create(
            room_code='MOVIE2', name='Movie room 2', host=self.owner,
            organization=self.organization, status=Room.Status.ACTIVE,
        )
        RoomParticipant.objects.create(room=self.room, user=self.viewer)
        self.guest = RoomParticipant.objects.create(
            room=self.room,
            is_guest=True,
            guest_identity='guest_movie',
            role=RoomParticipant.Role.GUEST,
        )
        self.asset = MediaAsset.objects.create(
            owner=self.owner,
            uploader=self.owner,
            title='Feature film',
            original_filename='feature.mp4',
            status=MediaAsset.Status.READY,
            duration_ms=7_200_000,
        )
        self.other_asset = MediaAsset.objects.create(
            owner=self.other_owner,
            uploader=self.other_owner,
            title='Private other film',
            status=MediaAsset.Status.READY,
        )
        self.client = APIClient()

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def open_playback(self, **body):
        payload = {'asset_public_token': self.asset.public_token, **body}
        return self.client.post(
            reverse('shared_playback_open', kwargs={'room_code': self.room.room_code}),
            payload,
            format='json',
        )

    def command(self, **body):
        return self.client.post(
            reverse('shared_playback_command', kwargs={'room_code': self.room.room_code}),
            body,
            format='json',
        )

    def snapshot(self, user=None, **headers):
        self.client.force_authenticate(user=user)
        return self.client.get(
            reverse('shared_playback_snapshot', kwargs={'room_code': self.room.room_code}),
            **headers,
        )

    def test_library_is_scoped_to_the_authenticated_media_owner(self):
        self.authenticate(self.owner)
        response = self.client.get(reverse('media_assets'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data']['count'], 1)
        self.assertEqual(
            response.data['data']['results'][0]['public_token'],
            self.asset.public_token,
        )
        for user in (self.viewer, self.outsider, self.other_owner):
            self.authenticate(user)
            hidden = self.client.get(reverse('media_assets'))
            expected = 1 if user == self.other_owner else 0
            self.assertEqual(hidden.data['data']['count'], expected)

    def test_authenticated_user_creates_asset_in_their_personal_media_library(self):
        self.authenticate(self.viewer)
        created = self.client.post(
            reverse('media_assets'),
            {'title': 'Upload', 'original_filename': 'upload.mkv'},
            format='json',
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data['data']['status'], MediaAsset.Status.UPLOADING)
        asset = MediaAsset.objects.get(public_token=created.data['data']['public_token'])
        self.assertEqual(asset.owner, self.viewer)

    def test_unrelated_account_cannot_probe_asset_detail_or_history(self):
        self.authenticate(self.outsider)
        detail = self.client.get(
            reverse('media_asset_detail', kwargs={'public_token': self.asset.public_token}),
        )
        history = self.client.get(
            reverse('media_asset_history', kwargs={'public_token': self.asset.public_token}),
        )
        self.assertEqual(detail.status_code, 404)
        self.assertEqual(history.status_code, 404)

    def test_host_opens_playback_but_cross_tenant_asset_is_hidden(self):
        self.authenticate(self.owner)
        response = self.open_playback()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['data']['room_code'], self.room.room_code)
        self.assertEqual(response.data['data']['version'], 1)
        self.command(command='STOP', expected_version=1, position_ms=12_000)
        denied = self.open_playback(asset_public_token=self.other_asset.public_token)
        self.assertEqual(denied.status_code, 404)

    def test_opening_a_different_asset_reports_an_active_playback_conflict(self):
        self.authenticate(self.owner)
        self.open_playback()
        second = MediaAsset.objects.create(
            owner=self.owner,
            uploader=self.owner,
            title='Another feature film',
            status=MediaAsset.Status.READY,
            duration_ms=3_600_000,
        )
        response = self.client.post(
            reverse('shared_playback_open', kwargs={'room_code': self.room.room_code}),
            {'asset_public_token': second.public_token},
            format='json',
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'ACTIVE_SHARED_PLAYBACK')

    def test_retrying_the_active_asset_returns_the_existing_session(self):
        self.authenticate(self.owner)
        first = self.open_playback()
        retry = self.open_playback()
        self.assertEqual(retry.status_code, 201)
        self.assertEqual(retry.data['data']['id'], first.data['data']['id'])

    def test_commands_use_optimistic_version_and_server_scheduled_play(self):
        self.authenticate(self.owner)
        self.open_playback()
        played = self.command(
            command='PLAY', expected_version=1, position_ms=30_000, lead_time_ms=1500,
        )
        self.assertEqual(played.status_code, 200)
        self.assertEqual(played.data['data']['state'], SharedPlaybackSession.State.PLAYING)
        self.assertEqual(played.data['data']['version'], 2)
        self.assertGreater(
            played.data['data']['effective_at'],
            played.data['data']['server_now'],
        )
        stale = self.command(command='PAUSE', expected_version=1)
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(stale.data['code'], 'STALE_PLAYBACK_VERSION')

    def test_moderator_can_change_sync_policy_and_publish_buffer_reason(self):
        self.authenticate(self.owner)
        opened = self.open_playback()
        self.assertEqual(opened.data['data']['sync_policy'], 'continuous')
        strict = self.command(
            command='SET_SYNC_POLICY', expected_version=1, sync_policy='strict',
        )
        self.assertEqual(strict.status_code, 200)
        self.assertEqual(strict.data['data']['sync_policy'], 'strict')
        buffering = self.command(
            command='BUFFERING', expected_version=2, position_ms=12_000,
            buffer_reason='readiness',
        )
        self.assertEqual(buffering.status_code, 200)
        self.assertEqual(buffering.data['data']['buffer_reason'], 'readiness')
        invalid = self.command(command='SET_SYNC_POLICY', expected_version=3)
        self.assertEqual(invalid.status_code, 400)
        self.assertIn('sync_policy', invalid.data['details'])

    def test_snapshot_allows_participant_and_signed_guest_but_not_outsider(self):
        self.authenticate(self.owner)
        self.open_playback()
        participant = self.snapshot(self.viewer)
        self.assertEqual(participant.status_code, 200)
        self.assertEqual(participant['Cache-Control'], 'no-store')
        self.assertEqual(
            participant.data['data']['playback']['asset']['public_token'],
            self.asset.public_token,
        )
        token = issue_guest_access_token(
            room_code=self.room.room_code,
            guest_identity=self.guest.guest_identity,
        )
        guest = self.snapshot(HTTP_X_GUEST_ACCESS_TOKEN=token)
        self.assertEqual(guest.status_code, 200)
        self.assertEqual(guest.data['data']['playback']['room_code'], self.room.room_code)
        self.assertEqual(self.snapshot(self.outsider).status_code, 403)

    def test_empty_snapshot_is_not_cached(self):
        response = self.snapshot(self.viewer)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['data']['playback'])
        self.assertTrue(response.data['data']['server_now'])
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_closed_session_can_continue_in_another_room_and_remains_in_history(self):
        self.authenticate(self.owner)
        opened = self.open_playback()
        playback_id = opened.data['data']['id']
        stopped = self.command(command='STOP', expected_version=1, position_ms=2_400_000)
        self.assertEqual(stopped.status_code, 200)
        continued = self.client.post(
            reverse('shared_playback_open', kwargs={'room_code': self.second_room.room_code}),
            {
                'asset_public_token': self.asset.public_token,
                'resumed_from_id': playback_id,
            },
            format='json',
        )
        self.assertEqual(continued.status_code, 201)
        self.assertEqual(continued.data['data']['anchor_position_ms'], 2_400_000)
        history = self.client.get(
            reverse('media_asset_history', kwargs={'public_token': self.asset.public_token}),
        )
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.data['data']['count'], 2)

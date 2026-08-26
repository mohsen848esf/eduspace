from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import User
from rooms.models import PresentationDocument, Room, RoomParticipant


class RoomPermissionsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.host = User.objects.create_user(
            username='host_user',
            password='HostPassword123!',
            email='host@test.com',
            full_name='Host User'
        )
        self.participant_user = User.objects.create_user(
            username='student_user',
            password='StudentPassword123!',
            email='student@test.com',
            full_name='Student User'
        )
        self.room = Room.objects.create(
            name='Test Permission Room',
            room_code='TST999',
            host=self.host,
            lock_document_presentation=True,
            lock_screen_share=True,
        )
        self.participant = RoomParticipant.objects.create(
            room=self.room,
            user=self.participant_user,
            role=RoomParticipant.Role.PARTICIPANT,
            can_upload_presentation=False,
            can_share_screen=False,
            can_use_microphone=True,
            can_use_camera=True,
        )
        self.document = PresentationDocument.objects.create(
            room=self.room,
            uploader=self.host,
            file='room_presentations/test.pdf',
            title='Authorization Test Deck',
            file_type=PresentationDocument.FileType.PDF,
            total_pages=5,
        )

    def _join_guest(self, room=None, display_name='Signed Guest'):
        target_room = room or self.room
        response = self.client.post(
            reverse('guest_join_room', kwargs={'room_code': target_room.room_code}),
            {'display_name': display_name},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data['guest_identity'], response.data['guest_access_token']

    def _page_url(self, room=None, document=None):
        target_room = room or self.room
        target_document = document or self.document
        return reverse('set_presentation_page', kwargs={
            'room_code': target_room.room_code,
            'doc_id': target_document.id,
        })

    def test_grant_presentation_permission_success(self):
        self.client.force_authenticate(user=self.host)
        url = reverse('grant_presentation_permission', kwargs={'room_code': self.room.room_code})
        response = self.client.post(url, {
            'username': self.participant_user.username,
            'granted': True,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.participant.refresh_from_db()
        self.assertTrue(self.participant.can_upload_presentation)

    def test_grant_presentation_permission_by_user_id(self):
        self.client.force_authenticate(user=self.host)
        url = reverse('grant_presentation_permission', kwargs={'room_code': self.room.room_code})
        response = self.client.post(url, {
            'user_id': self.participant_user.id,
            'granted': True,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.participant.refresh_from_db()
        self.assertTrue(self.participant.can_upload_presentation)

    def test_grant_media_permission_screen_share(self):
        self.client.force_authenticate(user=self.host)
        url = reverse('grant_media_permission', kwargs={'room_code': self.room.room_code})
        response = self.client.post(url, {
            'username': self.participant_user.username,
            'permission_type': 'screen_share',
            'granted': True,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.participant.refresh_from_db()
        self.assertTrue(self.participant.can_share_screen)

    def test_recording_status_endpoint(self):
        self.client.force_authenticate(user=self.host)
        url = reverse('recording_status', kwargs={'room_code': self.room.room_code})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'idle')

    def test_recording_permission_endpoint(self):
        self.client.force_authenticate(user=self.host)
        url = reverse('recording_permission', kwargs={'room_code': self.room.room_code})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_host'])

    def test_anonymous_guest_identity_cannot_control_presentation(self):
        guest_identity, _ = self._join_guest()

        response = self.client.post(
            self._page_url(),
            {'page': 2, 'guest_identity': guest_identity},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data['code'], 'GUEST_ACCESS_TOKEN_REQUIRED')

    def test_anonymous_guest_can_observe_presentations(self):
        response = self.client.get(
            reverse('list_presentations', kwargs={'room_code': self.room.room_code}),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['presentations'][0]['id'], self.document.id)

    def test_invalid_guest_access_token_is_rejected(self):
        self._join_guest()

        response = self.client.post(
            self._page_url(),
            {'page': 2},
            format='json',
            HTTP_X_GUEST_ACCESS_TOKEN='forged-token',
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data['code'], 'INVALID_GUEST_ACCESS_TOKEN')

    def test_guest_token_is_scoped_to_its_room(self):
        other_room = Room.objects.create(
            name='Other Room',
            room_code='OTH999',
            host=self.host,
        )
        _, other_room_token = self._join_guest(other_room)

        response = self.client.post(
            self._page_url(),
            {'page': 2},
            format='json',
            HTTP_X_GUEST_ACCESS_TOKEN=other_room_token,
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data['code'], 'INVALID_GUEST_ACCESS_TOKEN')

    def test_signed_guest_still_requires_presentation_grant(self):
        guest_identity, guest_token = self._join_guest()

        denied = self.client.post(
            self._page_url(),
            {'page': 2},
            format='json',
            HTTP_X_GUEST_ACCESS_TOKEN=guest_token,
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(denied.data['code'], 'PRESENTATION_PERMISSION_REQUIRED')

        RoomParticipant.objects.filter(
            room=self.room,
            guest_identity=guest_identity,
        ).update(can_upload_presentation=True)
        allowed = self.client.post(
            self._page_url(),
            {'page': 3},
            format='json',
            HTTP_X_GUEST_ACCESS_TOKEN=guest_token,
        )

        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        self.assertEqual(allowed.data['current_page'], 3)

    def test_authenticated_non_participant_cannot_control_presentation(self):
        outsider = User.objects.create_user(
            username='outsider',
            password='OutsiderPassword123!',
        )
        self.client.force_authenticate(user=outsider)

        response = self.client.post(self._page_url(), {'page': 2}, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'ACTIVE_ROOM_PARTICIPANT_REQUIRED')

    def test_granted_authenticated_participant_can_control_presentation(self):
        self.participant.can_upload_presentation = True
        self.participant.save(update_fields=['can_upload_presentation'])
        self.client.force_authenticate(user=self.participant_user)

        response = self.client.post(self._page_url(), {'page': 4}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['current_page'], 4)

    def test_host_and_co_host_can_activate_presentation(self):
        active_url = reverse('set_active_presentation', kwargs={
            'room_code': self.room.room_code,
            'doc_id': self.document.id,
        })
        self.client.force_authenticate(user=self.host)
        host_response = self.client.post(active_url, {'is_active': True}, format='json')
        self.assertEqual(host_response.status_code, status.HTTP_200_OK)

        self.room.co_hosts.add(self.participant_user)
        self.client.force_authenticate(user=self.participant_user)
        co_host_response = self.client.post(active_url, {'is_active': False}, format='json')
        self.assertEqual(co_host_response.status_code, status.HTTP_200_OK)

    def test_unlocked_room_allows_active_participant_control(self):
        self.room.lock_document_presentation = False
        self.room.save(update_fields=['lock_document_presentation'])
        self.client.force_authenticate(user=self.participant_user)

        response = self.client.post(self._page_url(), {'page': 2}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_ended_room_rejects_presentation_mutation(self):
        self.room.status = Room.Status.ENDED
        self.room.save(update_fields=['status'])
        self.client.force_authenticate(user=self.host)

        response = self.client.post(self._page_url(), {'page': 2}, format='json')

        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        self.assertEqual(response.data['code'], 'ROOM_ENDED')

    def test_anonymous_upload_is_rejected_before_file_processing(self):
        response = self.client.post(
            reverse('upload_presentation', kwargs={'room_code': self.room.room_code}),
            {'guest_identity': 'guest_forged'},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data['code'], 'GUEST_ACCESS_TOKEN_REQUIRED')

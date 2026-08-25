from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import User
from rooms.models import Room, RoomParticipant


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

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from rooms.models import Room, RoomParticipant
from rooms.services.guest_access import issue_guest_access_token


class PermissionSyncTests(TestCase):
    def setUp(self):
        self.host = User.objects.create_user(username='host')
        self.student = User.objects.create_user(username='student')
        self.cohost = User.objects.create_user(username='cohost')
        self.room = Room.objects.create(
            room_code='SYNC01', name='Sync', host=self.host,
            lock_screen_share=True, lock_document_presentation=True,
        )
        self.room.co_hosts.add(self.cohost)
        self.participant = RoomParticipant.objects.create(
            room=self.room, user=self.student, can_share_screen=False,
            can_upload_presentation=False,
        )
        self.guest = RoomParticipant.objects.create(
            room=self.room, is_guest=True, guest_identity='guest_sync',
            role=RoomParticipant.Role.GUEST, can_share_screen=False,
            can_upload_presentation=False,
        )
        self.client = APIClient()

    def url(self, name):
        return reverse(name, kwargs={'room_code': self.room.room_code})

    def snapshot(self, user=None, **headers):
        self.client.force_authenticate(user=user)
        return self.client.get(self.url('room_permissions'), **headers)

    def grant(self, name, identity, **data):
        return self.client.post(self.url(name), {'identity': identity, **data}, format='json')

    def test_legacy_screen_share_route_persists_and_snapshot_restores_grant(self):
        self.client.force_authenticate(user=self.host)
        response = self.grant('grant_screen_share', 'student')
        self.assertEqual(response.status_code, 200)
        self.participant.refresh_from_db()
        self.assertTrue(self.participant.can_share_screen)
        response = self.snapshot(self.student)
        self.assertTrue(response.data['lock_screen_share'])
        self.assertTrue(response.data['can_share_screen'])
        self.assertEqual(response.data['participants'], [])
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_cohost_can_grant_guest_on_legacy_and_presentation_routes(self):
        self.client.force_authenticate(user=self.cohost)
        for route in ('grant_screen_share', 'grant_presentation_permission'):
            self.assertEqual(self.grant(route, 'guest_sync').status_code, 200)
        token = issue_guest_access_token(room_code='SYNC01', guest_identity='guest_sync')
        response = self.snapshot(HTTP_X_GUEST_ACCESS_TOKEN=token)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['can_share_screen'])
        self.assertTrue(response.data['can_upload_presentation'])
        self.assertEqual(response.data['identity'], 'guest_sync')

    def test_presentation_grant_and_revoke_are_visible_to_recipient_and_host(self):
        for granted in (True, False):
            self.client.force_authenticate(user=self.host)
            self.assertEqual(self.grant('grant_presentation_permission', 'student', granted=granted).status_code, 200)
            self.assertEqual(self.snapshot(self.student).data['can_upload_presentation'], granted)
            rows = self.snapshot(self.host).data['participants']
            row = next(p for p in rows if p['identity'] == 'student')
            self.assertEqual(row['can_upload_presentation'], granted)

    def test_non_moderator_cannot_grant(self):
        self.client.force_authenticate(user=self.student)
        for route in ('grant_screen_share', 'grant_media_permission', 'grant_presentation_permission'):
            self.assertEqual(self.grant(route, 'student', permission_type='screen_share').status_code, 403)

    def test_grant_requires_active_participant_in_this_room(self):
        self.client.force_authenticate(user=self.host)
        self.assertEqual(self.grant('grant_screen_share', 'unknown').status_code, 404)
        self.participant.is_active = False
        self.participant.save()
        self.assertEqual(self.grant('grant_screen_share', 'student').status_code, 404)

    def test_invalid_permission_or_boolean_does_not_mutate(self):
        self.client.force_authenticate(user=self.host)
        for data in ({'permission_type': []}, {'permission_type': 'invalid'},
                     {'permission_type': 'screen_share', 'granted': 'false'}):
            self.assertEqual(self.grant('grant_media_permission', 'student', **data).status_code, 400)
        self.participant.refresh_from_db()
        self.assertFalse(self.participant.can_share_screen)

    def test_snapshot_requires_authenticated_active_participant_or_signed_guest(self):
        self.assertEqual(self.snapshot().status_code, 401)
        self.assertEqual(self.snapshot(HTTP_X_GUEST_ACCESS_TOKEN='forged').status_code, 401)
        outsider = User.objects.create_user(username='outsider')
        self.assertEqual(self.snapshot(outsider).status_code, 403)
        self.participant.is_active = False
        self.participant.save()
        self.assertEqual(self.snapshot(self.student).status_code, 403)

    def test_snapshot_rejects_cross_room_guest_token_and_inactive_guest(self):
        wrong = issue_guest_access_token(room_code='OTHER1', guest_identity='guest_sync')
        self.assertEqual(self.snapshot(HTTP_X_GUEST_ACCESS_TOKEN=wrong).status_code, 401)
        token = issue_guest_access_token(room_code='SYNC01', guest_identity='guest_sync')
        self.guest.is_active = False
        self.guest.save()
        self.assertEqual(self.snapshot(HTTP_X_GUEST_ACCESS_TOKEN=token).status_code, 403)

    def test_moderator_snapshot_does_not_require_a_participant_row(self):
        for user in (self.host, self.cohost):
            response = self.snapshot(user)
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.data['can_share_screen'])
            self.assertTrue(response.data['can_upload_presentation'])

    def test_lock_unlock_updates_persisted_capabilities(self):
        self.client.force_authenticate(user=self.host)
        for locked in (False, True):
            response = self.client.patch(self.url('room_settings'), {
                'lock_screen_share': locked, 'lock_document_presentation': locked,
            }, format='json')
            self.assertEqual(response.status_code, 200)
            self.participant.refresh_from_db()
            self.assertEqual(self.participant.can_share_screen, not locked)
            self.assertEqual(self.participant.can_upload_presentation, not locked)

    def test_ended_room_rejects_reads_and_grants(self):
        self.room.status = Room.Status.ENDED
        self.room.save()
        self.assertEqual(self.snapshot(self.host).status_code, 410)
        self.assertEqual(self.grant('grant_screen_share', 'student').status_code, 410)

    def test_numeric_username_is_not_mistaken_for_a_user_id(self):
        user = User.objects.create_user(username='12345')
        p = RoomParticipant.objects.create(room=self.room, user=user, can_share_screen=False)
        self.client.force_authenticate(user=self.host)
        self.assertEqual(self.grant('grant_screen_share', user.username).status_code, 200)
        p.refresh_from_db()
        self.assertTrue(p.can_share_screen)

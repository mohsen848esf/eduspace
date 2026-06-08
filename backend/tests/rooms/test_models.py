from django.contrib.auth import get_user_model
from django.test import TestCase
from django.db.models import ProtectedError

from accounts.models import Organization, Course, AcademyClass, Session
from rooms.models import Room, Recording

User = get_user_model()


class RoomRecordingSessionRelationsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='test_user', password='password')
        self.org = Organization.objects.create(name='Org One', slug='org-one', owner=self.user)
        
        self.course = Course.objects.create(organization=self.org, title='Course One', code='C1')
        self.academy_class = AcademyClass.objects.create(course=self.course, teacher=self.user, name='Class A')
        
        self.session = Session.objects.create(
            academy_class=self.academy_class,
            host=self.user,
            title='Lecture 1'
        )

    def test_room_session_and_org_link(self):
        room = Room.objects.create(
            name='Test Room',
            room_code='ROOM101',
            host=self.user,
            session=self.session,
            organization=self.org,
            meeting_type='class_session'
        )
        self.assertEqual(room.session, self.session)
        self.assertEqual(room.organization, self.org)
        self.assertEqual(room.meeting_type, 'class_session')
        
        # Verify defaults
        room_default = Room.objects.create(
            name='Default Room',
            room_code='ROOM102',
            host=self.user
        )
        self.assertIsNone(room_default.session)
        self.assertIsNone(room_default.organization)
        self.assertEqual(room_default.meeting_type, 'ad_hoc')

    def test_recording_session_link(self):
        room = Room.objects.create(
            name='Test Room',
            room_code='ROOM101',
            host=self.user,
            session=self.session
        )
        recording = Recording.objects.create(
            room=room,
            owner=self.user,
            session=self.session
        )
        self.assertEqual(recording.session, self.session)
        self.assertEqual(recording.room, room)

    def test_session_deletion_nullifies_room_and_recording_links(self):
        room = Room.objects.create(
            name='Test Room',
            room_code='ROOM101',
            host=self.user,
            session=self.session,
            organization=self.org
        )
        recording = Recording.objects.create(
            room=room,
            owner=self.user,
            session=self.session
        )
        
        # Capture IDs
        room_id = room.id
        recording_id = recording.id
        
        # Delete session
        self.session.delete()
        
        # Refresh from DB
        updated_room = Room.objects.get(id=room_id)
        updated_recording = Recording.objects.get(id=recording_id)
        
        # Session FK should be nullified (SET_NULL)
        self.assertIsNone(updated_room.session)
        self.assertIsNone(updated_recording.session)
        
        # Room and Recording rows should still exist
        self.assertEqual(updated_room.name, 'Test Room')
        self.assertEqual(updated_recording.owner, self.user)

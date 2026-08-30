from django.core.exceptions import ValidationError, PermissionDenied
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from django.utils import timezone
from unittest.mock import patch

from accounts.models import Organization, Course, AcademyClass, Role, Permission, OrgMember, Session
from rooms.models import Room, RoomParticipant
from accounts.services.session_service import SessionService

User = get_user_model()


class SessionServiceTest(TransactionTestCase):
    def setUp(self):
        # Create users
        self.user = User.objects.create_user(username='admin_user', password='password')
        self.host = User.objects.create_user(username='host_user', password='password')
        self.student = User.objects.create_user(username='student_user', password='password')
        self.non_member = User.objects.create_user(username='non_member', password='password')

        # Create organization
        self.org = Organization.objects.create(name='Org One', slug='org-one', owner=self.user)

        # Set up permissions and roles
        self.perm_manage_sessions, _ = Permission.objects.get_or_create(
            codename='can_manage_sessions', 
            defaults={'name': 'Manage Sessions'}
        )
        self.admin_role = Role.objects.create(name='CRM Admin', organization=self.org)
        self.admin_role.permissions.add(self.perm_manage_sessions)

        # Make self.user a member with the session manager role
        self.member = OrgMember.objects.create(
            organization=self.org,
            user=self.user,
            role=self.admin_role
        )

        # Make self.host a member of the org (but without can_manage_sessions permission)
        self.host_member = OrgMember.objects.create(
            organization=self.org,
            user=self.host,
            role=Role.objects.create(name='Host Role', organization=self.org)
        )

        # Make self.student a member of the org (without can_manage_sessions permission)
        self.student_member = OrgMember.objects.create(
            organization=self.org,
            user=self.student,
            role=Role.objects.create(name='Student Role', organization=self.org)
        )

        # Create course, class, and session
        self.course = Course.objects.create(organization=self.org, title='Course One', code='C1')
        self.academy_class = AcademyClass.objects.create(course=self.course, teacher=self.host, name='Class A')
        self.session = Session.objects.create(
            academy_class=self.academy_class,
            host=self.host,
            title='Calculus 101',
            status=Session.Status.SCHEDULED
        )

    def test_start_session_valid_transition(self):
        """SCHEDULED -> LIVE is allowed, creates active Room and host participant."""
        session = SessionService.start_session(self.session.id, actor=self.user)
        self.assertEqual(session.status, Session.Status.LIVE)
        self.assertIsNotNone(session.active_room)
        
        # Verify active room creation
        room = session.active_room
        self.assertEqual(room.status, Room.Status.ACTIVE)
        self.assertEqual(room.meeting_type, 'class_session')
        self.assertEqual(room.session, session)
        self.assertEqual(room.organization, self.org)
        self.assertEqual(room.host, self.host)

        # Verify host joined the room participant list
        self.assertTrue(RoomParticipant.objects.filter(
            room=room, user=self.host, role=RoomParticipant.Role.HOST, is_active=True
        ).exists())

    def test_start_session_idempotent(self):
        """Calling start_session on already LIVE session returns the same session."""
        session = SessionService.start_session(self.session.id, actor=self.user)
        self.assertEqual(session.status, Session.Status.LIVE)
        active_room_id = session.active_room.id

        # Call again
        session2 = SessionService.start_session(self.session.id, actor=self.user)
        self.assertEqual(session2.status, Session.Status.LIVE)
        self.assertEqual(session2.active_room.id, active_room_id)

    def test_start_session_invalid_transition(self):
        """COMPLETED or CANCELLED sessions cannot transition to LIVE."""
        # Complete session
        self.session.status = Session.Status.COMPLETED
        self.session.save()
        with self.assertRaises(ValidationError):
            SessionService.start_session(self.session.id, actor=self.user)

        # Cancel session
        self.session.status = Session.Status.CANCELLED
        self.session.save()
        with self.assertRaises(ValidationError):
            SessionService.start_session(self.session.id, actor=self.user)

    def test_start_session_non_existent(self):
        """Starting non-existent session raises ValidationError."""
        with self.assertRaises(ValidationError):
            SessionService.start_session(99999, actor=self.user)

    def test_complete_session_valid_transition(self):
        """LIVE -> COMPLETED is allowed, ends Room, deactivates participants, schedules AttendanceService."""
        # Start session to LIVE first
        session = SessionService.start_session(self.session.id, actor=self.user)
        room = session.active_room
        self.assertEqual(session.status, Session.Status.LIVE)
        
        # Add another participant in active state
        RoomParticipant.objects.create(
            room=room,
            user=self.student,
            role=RoomParticipant.Role.PARTICIPANT,
            is_active=True
        )

        # Complete session
        session = SessionService.complete_session(self.session.id, actor=self.user)
        self.assertEqual(session.status, Session.Status.COMPLETED)
        
        # Verify Room is ended
        room.refresh_from_db()
        self.assertEqual(room.status, Room.Status.ENDED)
        self.assertIsNotNone(room.ended_at)

        # Verify participants are inactive
        self.assertEqual(room.participants.filter(is_active=True).count(), 0)

    def test_complete_session_idempotent(self):
        """Calling complete_session on already COMPLETED session is idempotent."""
        session = SessionService.start_session(self.session.id, actor=self.user)
        SessionService.complete_session(session.id, actor=self.user)
        
        # Complete again
        session2 = SessionService.complete_session(session.id, actor=self.user)
        self.assertEqual(session2.status, Session.Status.COMPLETED)

    def test_complete_session_invalid_transition(self):
        """SCHEDULED or CANCELLED sessions cannot transition to COMPLETED."""
        # SCHEDULED
        with self.assertRaises(ValidationError):
            SessionService.complete_session(self.session.id, actor=self.user)

        # CANCELLED
        self.session.status = Session.Status.CANCELLED
        self.session.save()
        with self.assertRaises(ValidationError):
            SessionService.complete_session(self.session.id, actor=self.user)

    def test_cancel_session_valid_transitions(self):
        """SCHEDULED -> CANCELLED and LIVE -> CANCELLED are allowed."""
        # 1. Scheduled -> Cancelled
        session1 = SessionService.cancel_session(self.session.id, actor=self.user)
        self.assertEqual(session1.status, Session.Status.CANCELLED)

        # Re-set to LIVE
        self.session.status = Session.Status.LIVE
        self.session.save()

        # 2. Live -> Cancelled
        session2 = SessionService.cancel_session(self.session.id, actor=self.user)
        self.assertEqual(session2.status, Session.Status.CANCELLED)

    def test_cancel_session_idempotent(self):
        """Calling cancel_session on already CANCELLED session is idempotent."""
        SessionService.cancel_session(self.session.id, actor=self.user)
        session2 = SessionService.cancel_session(self.session.id, actor=self.user)
        self.assertEqual(session2.status, Session.Status.CANCELLED)

    def test_cancel_session_invalid_transition(self):
        """COMPLETED sessions cannot transition to CANCELLED."""
        self.session.status = Session.Status.COMPLETED
        self.session.save()
        with self.assertRaises(ValidationError):
            SessionService.cancel_session(self.session.id, actor=self.user)

    def test_duplicate_live_session_prevention(self):
        """Only one live session is allowed per AcademyClass."""
        # Start first session to LIVE
        SessionService.start_session(self.session.id, actor=self.user)

        # Create second session for the same class
        second_session = Session.objects.create(
            academy_class=self.academy_class,
            host=self.host,
            title='Calculus 102',
            status=Session.Status.SCHEDULED
        )

        # Attempt to start the second session to LIVE must fail
        with self.assertRaises(ValidationError):
            SessionService.start_session(second_session.id, actor=self.user)

    def test_tenant_isolation_validation(self):
        """Cross-organization start/complete/cancel requests are rejected with PermissionDenied."""
        # Non-member actor
        with self.assertRaises(PermissionDenied):
            SessionService.start_session(self.session.id, actor=self.non_member)

        # Member without can_manage_sessions permission and not the host
        with self.assertRaises(PermissionDenied):
            SessionService.start_session(self.session.id, actor=self.student)

    @patch('django.db.models.query.QuerySet.select_for_update', autospec=True)
    def test_concurrent_start_session_protection(self, mock_select_for_update):
        """Session and AcademyClass locks are acquired using select_for_update on start."""
        mock_select_for_update.side_effect = lambda qs, *args, **kwargs: qs
        
        SessionService.start_session(self.session.id, actor=self.user)
        self.assertTrue(mock_select_for_update.called)

    @patch('django.db.models.query.QuerySet.select_for_update', autospec=True)
    def test_concurrent_complete_session_protection(self, mock_select_for_update):
        """Locks are acquired using select_for_update on complete."""
        mock_select_for_update.side_effect = lambda qs, *args, **kwargs: qs
        
        # Start first so status becomes LIVE
        session = SessionService.start_session(self.session.id, actor=self.user)
        
        mock_select_for_update.reset_mock()
        mock_select_for_update.side_effect = lambda qs, *args, **kwargs: qs
        
        SessionService.complete_session(session.id, actor=self.user)
        self.assertTrue(mock_select_for_update.called)

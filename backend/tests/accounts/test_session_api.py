from rest_framework.test import APITransactionTestCase
from rest_framework import status
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
import datetime

from accounts.models import Organization, Course, AcademyClass, Enrollment, Role, Permission, OrgMember, Session, Attendance
from rooms.models import Room, RoomParticipant

User = get_user_model()


class SessionAPITest(APITransactionTestCase):
    def setUp(self):
        # Create users
        self.admin = User.objects.create_user(username='admin_user', password='password')
        self.host = User.objects.create_user(username='host_user', password='password')
        self.student1 = User.objects.create_user(username='student_one', password='password')
        self.student2 = User.objects.create_user(username='student_two', password='password')
        self.non_member = User.objects.create_user(username='non_member', password='password')

        # Create organizations
        self.org1 = Organization.objects.create(name='Org One', slug='org-one', owner=self.admin)
        self.org2 = Organization.objects.create(name='Org Two', slug='org-two', owner=self.admin)

        # Permissions and Roles setup
        self.perm_view_sessions, _ = Permission.objects.get_or_create(
            codename='can_view_sessions', defaults={'name': 'View Sessions'}
        )
        self.perm_manage_sessions, _ = Permission.objects.get_or_create(
            codename='can_manage_sessions', defaults={'name': 'Manage Sessions'}
        )
        self.perm_view_attendance, _ = Permission.objects.get_or_create(
            codename='can_view_attendance', defaults={'name': 'View Attendance'}
        )
        self.perm_manage_attendance, _ = Permission.objects.get_or_create(
            codename='can_manage_attendance', defaults={'name': 'Manage Attendance'}
        )

        self.manager_role = Role.objects.create(name='Session Manager', organization=self.org1)
        self.manager_role.permissions.add(
            self.perm_view_sessions, self.perm_manage_sessions,
            self.perm_view_attendance, self.perm_manage_attendance
        )

        self.student_role = Role.objects.create(name='Student Role', organization=self.org1)
        self.student_role.permissions.add(self.perm_view_sessions)

        # Create memberships
        OrgMember.objects.create(organization=self.org1, user=self.admin, role=self.manager_role)
        OrgMember.objects.create(organization=self.org1, user=self.host, role=self.manager_role)
        OrgMember.objects.create(organization=self.org1, user=self.student1, role=self.student_role)
        OrgMember.objects.create(organization=self.org1, user=self.student2, role=self.student_role)

        # Setup course, class, and enrollments
        self.course = Course.objects.create(organization=self.org1, title='Course One', code='C1')
        self.academy_class = AcademyClass.objects.create(course=self.course, teacher=self.host, name='Class A')
        Enrollment.objects.create(academy_class=self.academy_class, student=self.student1, is_active=True)
        Enrollment.objects.create(academy_class=self.academy_class, student=self.student2, is_active=True)

        # Create base scheduled session
        self.session = Session.objects.create(
            academy_class=self.academy_class,
            host=self.host,
            title='Intro Lesson',
            status=Session.Status.SCHEDULED
        )

    def test_create_scheduled_session(self):
        """Authorized user can create a scheduled session, scoped to organization."""
        self.client.force_authenticate(user=self.admin)
        url = reverse('session-list')
        data = {
            'academy_class': self.academy_class.id,
            'host': self.host.id,
            'title': 'Session Two',
            'scheduled_start': (timezone.now() + datetime.timedelta(days=1)).isoformat(),
            'scheduled_end': (timezone.now() + datetime.timedelta(days=1, hours=2)).isoformat()
        }
        res = self.client.post(url, data, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['status'], Session.Status.SCHEDULED)
        self.assertEqual(res.data['organization'], self.org1.id)

    def test_list_and_filter_sessions(self):
        """Sessions list can be retrieved and filtered by class_id/status."""
        self.client.force_authenticate(user=self.admin)
        url = reverse('session-list')

        # List all sessions for Org One
        res = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

        # Filter by class_id
        res = self.client.get(f"{url}?class_id={self.academy_class.id}", HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

        # Filter by status
        res = self.client.get(f"{url}?status=live", HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)

    def test_lifecycle_action_start(self):
        """Action POST /sessions/{id}/start/ starts the session and creates Room."""
        self.client.force_authenticate(user=self.host)
        url = reverse('session-start', args=[self.session.id])
        res = self.client.post(url, {}, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], Session.Status.LIVE)
        self.assertIsNotNone(res.data['active_room'])

    def test_lifecycle_action_complete(self):
        """Action POST /sessions/{id}/complete/ completes the session and triggers attendance."""
        self.client.force_authenticate(user=self.host)
        
        # Start first
        self.session.start_live()

        url = reverse('session-complete', args=[self.session.id])
        res = self.client.post(url, {}, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], Session.Status.COMPLETED)

        # Verify Attendance auto-generation run post-commit (sync in transaction test case)
        self.assertEqual(Attendance.objects.filter(session=self.session).count(), 2)

    def test_lifecycle_action_cancel(self):
        """Action POST /sessions/{id}/cancel/ cancels the session."""
        self.client.force_authenticate(user=self.host)
        url = reverse('session-cancel', args=[self.session.id])
        res = self.client.post(url, {}, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], Session.Status.CANCELLED)

    def test_tenant_isolation_api(self):
        """Accessing a session belonging to another org returns 403 or 400 validation error."""
        self.client.force_authenticate(user=self.admin)
        url = reverse('session-start', args=[self.session.id])
        
        # Accessing with Org Two context slug
        res = self.client.post(url, {}, HTTP_X_ORGANIZATION_SLUG='org-two')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_isolation_sessions_and_attendance(self):
        """Students cannot modify sessions, view other student attendance, or override records."""
        self.client.force_authenticate(user=self.student1)
        
        # Attempt to start session (expected 403)
        url = reverse('session-start', args=[self.session.id])
        res = self.client.post(url, {}, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Create attendance logs manually for testing overrides
        att1 = Attendance.objects.create(session=self.session, student=self.student1, status=Attendance.Status.ABSENT)
        att2 = Attendance.objects.create(session=self.session, student=self.student2, status=Attendance.Status.ABSENT)

        # Retrieve attendance (student view: only sees their own)
        url_att = reverse('session-attendance', args=[self.session.id])
        res = self.client.get(url_att, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['student'], self.student1.id)

        # Attempt override (expected 403)
        url_override = reverse('session-update-student-attendance', args=[self.session.id, self.student1.id])
        res = self.client.patch(url_override, {'status': 'present'}, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_attendance_override_endpoint(self):
        """Managers can manually override a student's attendance record status and notes."""
        self.client.force_authenticate(user=self.admin)
        att = Attendance.objects.create(session=self.session, student=self.student1, status=Attendance.Status.ABSENT)

        url = reverse('session-update-student-attendance', args=[self.session.id, self.student1.id])
        data = {'status': 'present', 'note': 'Late due to traffic'}
        res = self.client.patch(url, data, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        att.refresh_from_db()
        self.assertEqual(att.status, Attendance.Status.PRESENT)
        self.assertEqual(att.note, 'Late due to traffic')

    def test_attendance_bulk_override_endpoint(self):
        """Managers can bulk override student attendance records."""
        self.client.force_authenticate(user=self.admin)
        att1 = Attendance.objects.create(session=self.session, student=self.student1, status=Attendance.Status.ABSENT)
        att2 = Attendance.objects.create(session=self.session, student=self.student2, status=Attendance.Status.ABSENT)

        url = reverse('session-bulk-update-attendance', args=[self.session.id])
        data = {
            'records': [
                {'student_id': self.student1.id, 'status': 'present', 'note': 'Bulk present'},
                {'student_id': self.student2.id, 'status': 'excused', 'note': 'Bulk excused'}
            ]
        }
        res = self.client.post(url, data, format='json', HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['updated'], 2)

        att1.refresh_from_db()
        att2.refresh_from_db()
        self.assertEqual(att1.status, Attendance.Status.PRESENT)
        self.assertEqual(att1.note, 'Bulk present')
        self.assertEqual(att2.status, Attendance.Status.EXCUSED)
        self.assertEqual(att2.note, 'Bulk excused')

    def test_create_room_with_session_integration(self):
        """POST /api/rooms/create/ with session_id starts the Session, links Room, and registers active state."""
        self.client.force_authenticate(user=self.host)
        url = reverse('create_room')
        data = {
            'session_id': self.session.id,
            'name': 'Live room calculus'
        }
        res = self.client.post(url, data, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('room_code', res.data)
        self.assertEqual(res.data['session_id'], self.session.id)

        # Verify DB changes
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, Session.Status.LIVE)
        self.assertIsNotNone(self.session.active_room)
        self.assertEqual(self.session.active_room.meeting_type, 'class_session')

    def test_leave_room_completes_session_integration(self):
        """Host leaving room triggers automatic completion and attendance generation."""
        self.client.force_authenticate(user=self.host)

        # Setup active session started with Room
        self.session.start_live()
        room = self.session.active_room
        
        # Verify and retrieve host participant (created by start_live)
        participant = RoomParticipant.objects.get(
            room=room,
            user=self.host,
            role=RoomParticipant.Role.HOST
        )
        self.assertTrue(participant.is_active)

        url = reverse('leave_room', args=[room.room_code])
        res = self.client.post(url, {}, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Verify Session is completed
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, Session.Status.COMPLETED)
        
        # Verify Attendance generated
        self.assertEqual(Attendance.objects.filter(session=self.session).count(), 2)

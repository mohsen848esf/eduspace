from django.contrib.auth import get_user_model
from django.utils import timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.db import transaction

from accounts.models import Organization, Course, AcademyClass, Enrollment, Role, Permission, OrgMember, Session, Attendance
from rooms.models import Room, RoomParticipant

User = get_user_model()

class SessionLifecycleTest(APITestCase):
    def setUp(self):
        # Create superuser / admin
        self.admin = User.objects.create_superuser(username='admin_user', password='password')
        self.teacher = User.objects.create_user(username='teacher_user', password='password', full_name='Teacher User')
        self.student1 = User.objects.create_user(username='student_1', password='password', full_name='Student One')
        self.student2 = User.objects.create_user(username='student_2', password='password', full_name='Student Two')

        # Create Org
        self.org = Organization.objects.create(name='Academy Org', slug='academy-org', owner=self.admin)

        # Create Role with manage sessions permissions
        self.perm_view = Permission.objects.get_or_create(codename='can_view_dashboard', name='Can view dashboard')[0]
        self.perm_manage = Permission.objects.get_or_create(codename='can_manage_sessions', name='Can manage sessions')[0]

        self.staff_role = Role.objects.create(name='Staff', organization=self.org)
        self.staff_role.permissions.add(self.perm_view, self.perm_manage)

        self.student_role = Role.objects.create(name='Student', organization=self.org)
        self.student_role.permissions.add(self.perm_view)

        # Create members
        OrgMember.objects.create(organization=self.org, user=self.admin, role=self.staff_role)
        OrgMember.objects.create(organization=self.org, user=self.teacher, role=self.staff_role)
        OrgMember.objects.create(organization=self.org, user=self.student1, role=self.student_role)
        OrgMember.objects.create(organization=self.org, user=self.student2, role=self.student_role)

        # Create course, class, and enrollments
        self.course = Course.objects.create(organization=self.org, title='Math 101', code='MATH101')
        self.academy_class = AcademyClass.objects.create(course=self.course, teacher=self.teacher, name='Class A')
        Enrollment.objects.create(academy_class=self.academy_class, student=self.student1)
        Enrollment.objects.create(academy_class=self.academy_class, student=self.student2)

        # Set up authentication headers
        self.client.force_authenticate(user=self.admin)
        self.headers = {'HTTP_X_ORGANIZATION_SLUG': 'academy-org'}

    def test_session_creation(self):
        url = reverse('session-list')
        data = {
            'academy_class': self.academy_class.id,
            'host': self.teacher.id,
            'title': 'Intro to Calculus',
            'scheduled_start': timezone.now().isoformat(),
            'scheduled_end': (timezone.now() + timezone.timedelta(hours=1)).isoformat(),
        }
        response = self.client.post(url, data, format='json', **self.headers)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'scheduled')
        self.assertEqual(Session.objects.count(), 1)

    def test_session_start(self):
        session = Session.objects.create(
            academy_class=self.academy_class,
            organization=self.org,
            host=self.teacher,
            title='Session math',
            status=Session.Status.SCHEDULED
        )
        url = reverse('session-start', args=[session.id])
        response = self.client.post(url, {}, format='json', **self.headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        session.refresh_from_db()
        self.assertEqual(session.status, 'live')
        
        # Verify Room creation
        room = session.room
        self.assertIsNotNone(room)
        self.assertEqual(room.meeting_type, 'class_session')
        self.assertEqual(room.organization, self.org)
        
        # Verify RoomParticipant created for host
        self.assertTrue(RoomParticipant.objects.filter(room=room, user=self.teacher, role='host').exists())

    def test_session_complete_auto_population(self):
        session = Session.objects.create(
            academy_class=self.academy_class,
            organization=self.org,
            host=self.teacher,
            title='Session complete math',
            status=Session.Status.SCHEDULED
        )
        # Start session to create room
        self.client.post(reverse('session-start', args=[session.id]), {}, format='json', **self.headers)
        session.refresh_from_db()
        room = session.room

        # Simulate student1 joining room
        RoomParticipant.objects.create(
            room=room,
            user=self.student1,
            role=RoomParticipant.Role.PARTICIPANT,
            joined_at=timezone.now()
        )

        # Complete the session
        url = reverse('session-complete', args=[session.id])
        response = self.client.post(url, {}, format='json', **self.headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        session.refresh_from_db()
        self.assertEqual(session.status, 'completed')
        
        # Verify Room status ended
        room.refresh_from_db()
        self.assertEqual(room.status, Room.Status.ENDED)

        # Verify Attendance auto-population
        # Student 1 joined, status should be present
        att1 = Attendance.objects.get(session=session, student=self.student1)
        self.assertEqual(att1.status, Attendance.Status.PRESENT)
        self.assertIsNotNone(att1.joined_at)

        # Student 2 did not join, status should be absent
        att2 = Attendance.objects.get(session=session, student=self.student2)
        self.assertEqual(att2.status, Attendance.Status.ABSENT)
        self.assertIsNone(att2.joined_at)

    def test_session_cancel(self):
        session = Session.objects.create(
            academy_class=self.academy_class,
            organization=self.org,
            host=self.teacher,
            title='Cancel class',
            status=Session.Status.SCHEDULED
        )
        url = reverse('session-cancel', args=[session.id])
        response = self.client.post(url, {}, format='json', **self.headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertEqual(session.status, 'cancelled')

    def test_attendance_manual_override_and_bulk_update(self):
        session = Session.objects.create(
            academy_class=self.academy_class,
            organization=self.org,
            host=self.teacher,
            title='Manual Attendance Test',
            status=Session.Status.COMPLETED
        )
        att1 = Attendance.objects.create(session=session, student=self.student1, status=Attendance.Status.ABSENT)
        att2 = Attendance.objects.create(session=session, student=self.student2, status=Attendance.Status.ABSENT)

        # Single student manual override (PATCH)
        url = reverse('session-update-student-attendance', args=[session.id, self.student1.id])
        data = {'status': 'late', 'note': 'Late due to traffic'}
        response = self.client.patch(url, data, format='json', **self.headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        att1.refresh_from_db()
        self.assertEqual(att1.status, 'late')
        self.assertEqual(att1.note, 'Late due to traffic')

        # Bulk update
        url = reverse('session-bulk-update-attendance', args=[session.id])
        data = {
            'updates': [
                {'student_id': self.student1.id, 'status': 'present', 'note': 'Updated'},
                {'student_id': self.student2.id, 'status': 'excused', 'note': 'Sick leave'}
            ]
        }
        response = self.client.post(url, data, format='json', **self.headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        att1.refresh_from_db()
        att2.refresh_from_db()
        self.assertEqual(att1.status, 'present')
        self.assertEqual(att2.status, 'excused')

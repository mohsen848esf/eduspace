from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from django.utils import timezone
import datetime

from accounts.models import Organization, Course, AcademyClass, Enrollment, Session, Attendance, AuditLog
from rooms.models import Room, RoomParticipant
from accounts.services.attendance_service import AttendanceService

User = get_user_model()


class AttendanceServiceTest(TransactionTestCase):
    def setUp(self):
        # Create users
        self.user = User.objects.create_user(username='admin_user', password='password')
        self.host = User.objects.create_user(username='host_user', password='password')
        self.student1 = User.objects.create_user(username='student_one', password='password')
        self.student2 = User.objects.create_user(username='student_two', password='password')
        self.student3 = User.objects.create_user(username='student_three', password='password')  # Not enrolled
        self.student_other_org = User.objects.create_user(username='student_other', password='password')

        # Create organizations
        self.org1 = Organization.objects.create(name='Org One', slug='org-one', owner=self.user)
        self.org2 = Organization.objects.create(name='Org Two', slug='org-two', owner=self.user)

        # Create course, class, and session for Org 1
        self.course1 = Course.objects.create(organization=self.org1, title='Calculus', code='MATH101')
        self.class1 = AcademyClass.objects.create(course=self.course1, teacher=self.host, name='Section A')
        self.session1 = Session.objects.create(
            academy_class=self.class1,
            host=self.host,
            title='Intro to Limits',
            status=Session.Status.COMPLETED  # Complete state
        )

        # Create active enrollments in Class 1 for student1 and student2
        Enrollment.objects.create(academy_class=self.class1, student=self.student1, is_active=True)
        Enrollment.objects.create(academy_class=self.class1, student=self.student2, is_active=True)

        # Create room and participants
        self.room = Room.objects.create(
            name=self.session1.title,
            room_code='ABC123',
            host=self.host,
            session=self.session1,
            organization=self.org1,
            meeting_type='class_session',
            status=Room.Status.ENDED,
            ended_at=timezone.now()
        )
        self.session1.active_room = self.room
        self.session1.save()

    def test_attendance_generation_flow(self):
        """Attendance generation correctly maps connections, marks absent/present, and records audit logs."""
        now = timezone.now()
        joined = now - datetime.timedelta(minutes=30)
        left = now - datetime.timedelta(minutes=5)

        # student1 participated in the class room call
        p1 = RoomParticipant.objects.create(
            room=self.room,
            user=self.student1,
            role=RoomParticipant.Role.PARTICIPANT,
            is_active=False,
            left_at=left
        )
        RoomParticipant.objects.filter(pk=p1.pk).update(joined_at=joined)

        # student3 (not enrolled) participated in the class room call
        p3 = RoomParticipant.objects.create(
            room=self.room,
            user=self.student3,
            role=RoomParticipant.Role.PARTICIPANT,
            is_active=False,
            left_at=left
        )
        RoomParticipant.objects.filter(pk=p3.pk).update(joined_at=joined)

        # Call AttendanceService
        AttendanceService.on_session_completed(self.session1.id)

        # Verify Attendance records:
        # student1: enrolled and participated -> PRESENT
        att1 = Attendance.objects.get(session=self.session1, student=self.student1)
        self.assertEqual(att1.status, Attendance.Status.PRESENT)
        self.assertEqual(att1.joined_at, joined)
        self.assertEqual(att1.left_at, left)

        # student2: enrolled and did not participate -> ABSENT
        att2 = Attendance.objects.get(session=self.session1, student=self.student2)
        self.assertEqual(att2.status, Attendance.Status.ABSENT)
        self.assertIsNone(att2.joined_at)
        self.assertIsNone(att2.left_at)

        # student3: not enrolled -> No attendance record created
        self.assertFalse(Attendance.objects.filter(session=self.session1, student=self.student3).exists())

        # Verify audit logging
        audit = AuditLog.objects.filter(action='attendance.generated', entity_id=self.session1.id).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.organization, self.org1)
        self.assertEqual(audit.after_state['created_count'], 2)
        self.assertEqual(audit.after_state['updated_count'], 0)

    def test_attendance_hybrid_update_flow(self):
        """AttendanceService updates existing records and creates missing ones without raising unique constraint violations."""
        # Pre-create attendance for student1 (who starts as absent)
        att_existing = Attendance.objects.create(
            session=self.session1,
            student=self.student1,
            status=Attendance.Status.ABSENT
        )

        now = timezone.now()
        joined = now - datetime.timedelta(minutes=10)

        # student1 participated in the session
        p1 = RoomParticipant.objects.create(
            room=self.room,
            user=self.student1,
            role=RoomParticipant.Role.PARTICIPANT,
            is_active=False,
            left_at=now
        )
        RoomParticipant.objects.filter(pk=p1.pk).update(joined_at=joined)

        # Call AttendanceService
        AttendanceService.on_session_completed(self.session1.id)

        # Verify student1 (existing) is updated to PRESENT
        att_existing.refresh_from_db()
        self.assertEqual(att_existing.status, Attendance.Status.PRESENT)
        self.assertEqual(att_existing.joined_at, joined)
        self.assertEqual(att_existing.left_at, now)

        # Verify student2 (new) is created as ABSENT
        att2 = Attendance.objects.get(session=self.session1, student=self.student2)
        self.assertEqual(att2.status, Attendance.Status.ABSENT)

        # Verify audit logs show 1 created and 1 updated record
        audit = AuditLog.objects.filter(action='attendance.generated', entity_id=self.session1.id).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.after_state['created_count'], 1)  # student2
        self.assertEqual(audit.after_state['updated_count'], 1)  # student1

    def test_tenant_isolation_attendance(self):
        """Attendance generation is strictly scoped to the class/enrollments of that session's course/organization."""
        # Create enrollment for student_other_org in Org 2
        course2 = Course.objects.create(organization=self.org2, title='History', code='HIST101')
        class2 = AcademyClass.objects.create(course=course2, name='Section B')
        Enrollment.objects.create(academy_class=class2, student=self.student_other_org, is_active=True)

        # Call AttendanceService on session1 (belonging to Org 1)
        AttendanceService.on_session_completed(self.session1.id)

        # Assert no cross-tenant attendance records are created
        self.assertFalse(Attendance.objects.filter(student=self.student_other_org).exists())

    def test_attendance_generation_idempotence(self):
        """AttendanceService can be run repeatedly without duplicating rows."""
        # Run first time
        AttendanceService.on_session_completed(self.session1.id)
        count_first = Attendance.objects.filter(session=self.session1).count()
        self.assertEqual(count_first, 2)

        # Run second time
        AttendanceService.on_session_completed(self.session1.id)
        count_second = Attendance.objects.filter(session=self.session1).count()
        self.assertEqual(count_second, 2)

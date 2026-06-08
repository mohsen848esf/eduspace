from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.test import TestCase

from accounts.models import Organization, Course, AcademyClass, Enrollment, Role, Permission, OrgMember, Session, Attendance

User = get_user_model()

class SessionModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='test_user', password='password')
        self.host = User.objects.create_user(username='host_user', password='password')
        self.student = User.objects.create_user(username='student_user', password='password')
        
        self.org1 = Organization.objects.create(name='Org One', slug='org-one', owner=self.user)
        self.org2 = Organization.objects.create(name='Org Two', slug='org-two', owner=self.user)
        
        self.course = Course.objects.create(organization=self.org1, title='Course One', code='C1')
        self.academy_class = AcademyClass.objects.create(course=self.course, teacher=self.host, name='Class A')
        
        # Enroll the student in academy_class
        Enrollment.objects.create(academy_class=self.academy_class, student=self.student)

    def test_session_clean_populates_organization_from_class(self):
        session = Session(
            academy_class=self.academy_class,
            host=self.host,
            title='Intro Session'
        )
        # clean should populate organization from academy_class course org
        session.clean()
        self.assertEqual(session.organization, self.org1)

    def test_session_clean_raises_validation_error_on_organization_mismatch(self):
        session = Session(
            academy_class=self.academy_class,
            organization=self.org2, # Mismatched organization
            host=self.host,
            title='Intro Session'
        )
        with self.assertRaises(ValidationError) as context:
            session.clean()
        self.assertIn('organization', context.exception.message_dict)

    def test_session_clean_requires_organization_for_adhoc_session(self):
        session = Session(
            academy_class=None,
            organization=None,
            host=self.host,
            title='Ad-hoc Session'
        )
        with self.assertRaises(ValidationError) as context:
            session.clean()
        self.assertIn('organization', context.exception.message_dict)

    def test_session_clean_validates_scheduled_start_and_end(self):
        now = timezone.now()
        session = Session(
            academy_class=self.academy_class,
            host=self.host,
            title='Calculus Class',
            scheduled_start=now,
            scheduled_end=now - timezone.timedelta(hours=1) # End before start
        )
        with self.assertRaises(ValidationError) as context:
            session.clean()
        self.assertIn('scheduled_end', context.exception.message_dict)

    def test_only_one_live_session_per_class(self):
        # Create a live session first
        live_session = Session.objects.create(
            academy_class=self.academy_class,
            host=self.host,
            title='Live Class 1',
            status=Session.Status.LIVE
        )
        
        # Try to clean/create a second live session for same class
        second_live = Session(
            academy_class=self.academy_class,
            host=self.host,
            title='Live Class 2',
            status=Session.Status.LIVE
        )
        with self.assertRaises(ValidationError) as context:
            second_live.clean()
        self.assertIn('status', context.exception.message_dict)

    def test_only_one_live_session_per_class_db_level(self):
        # Create a live session first
        Session.objects.create(
            academy_class=self.academy_class,
            host=self.host,
            title='Live Class 1',
            status=Session.Status.LIVE
        )
        
        second_live = Session(
            academy_class=self.academy_class,
            host=self.host,
            title='Live Class 2',
            status=Session.Status.LIVE
        )
        from django.db import IntegrityError
        # Bypass custom save() validation by calling Django's base save
        with self.assertRaises(IntegrityError):
            super(Session, second_live).save()

    def test_get_organization(self):
        session = Session.objects.create(
            academy_class=self.academy_class,
            host=self.host,
            title='Session A'
        )
        self.assertEqual(session.get_organization(), self.org1)

    def test_get_enrolled_students(self):
        session = Session.objects.create(
            academy_class=self.academy_class,
            host=self.host,
            title='Session A'
        )
        students = list(session.get_enrolled_students())
        self.assertEqual(len(students), 1)
        self.assertEqual(students[0], self.student)

    def test_start_live(self):
        session = Session.objects.create(
            academy_class=self.academy_class,
            host=self.host,
            title='Session A'
        )
        self.assertEqual(session.status, Session.Status.SCHEDULED)
        session.start_live()
        self.assertEqual(session.status, Session.Status.LIVE)

    def test_attendance_creation_unique_constraint(self):
        session = Session.objects.create(
            academy_class=self.academy_class,
            host=self.host,
            title='Session A'
        )
        # Create first attendance
        Attendance.objects.create(session=session, student=self.student, status=Attendance.Status.ABSENT)
        
        # Try creating second attendance for same student and session
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            Attendance.objects.create(session=session, student=self.student, status=Attendance.Status.PRESENT)

    def test_session_deletion_cascades_to_attendance(self):
        session = Session.objects.create(
            academy_class=self.academy_class,
            host=self.host,
            title='Session B'
        )
        Attendance.objects.create(session=session, student=self.student, status=Attendance.Status.ABSENT)
        self.assertEqual(Attendance.objects.filter(session=session).count(), 1)
        
        # Deleting session should delete attendance records
        session_id = session.id
        session.delete()
        self.assertEqual(Attendance.objects.filter(session_id=session_id).count(), 0)

    def test_host_deletion_raises_protected_error(self):
        Session.objects.create(
            academy_class=self.academy_class,
            host=self.host,
            title='Session C'
        )
        # Deleting the host user should raise ProtectedError
        from django.db.models import ProtectedError
        with self.assertRaises(ProtectedError):
            self.host.delete()


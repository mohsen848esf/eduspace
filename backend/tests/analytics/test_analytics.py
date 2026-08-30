from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from accounts.models import User, Organization, Course, AcademyClass, Enrollment, Role, OrgMember, TuitionInvoice, Attendance
from accounts.services.privacy_services import PrivacyService

class AnalyticsTestCase(APITestCase):
    def setUp(self):
        # Owners & Org
        self.owner = User.objects.create_user(
            username='orgowner',
            email='owner@acme.edu',
            password='securepassword123',
            full_name='Org Owner'
        )
        self.org = Organization.objects.create(
            name='Acme Academy',
            slug='acme-academy',
            owner=self.owner
        )
        
        # Admin Role Mapping
        owner_role = Role.objects.create(
            name='Admin',
            description='Admin',
            organization=self.org
        )
        from accounts.models import Permission
        perm_view, _ = Permission.objects.get_or_create(codename='can_view_dashboard', defaults={'name': 'View Dashboard'})
        owner_role.permissions.add(perm_view)
        
        OrgMember.objects.create(
            organization=self.org,
            user=self.owner,
            role=owner_role,
            is_active=True
        )

        # Standard User
        self.student = User.objects.create_user(
            username='student1',
            email='student1@acme.edu',
            password='securepassword123',
            full_name='Regular Student'
        )
        
        student_role = Role.objects.create(
            name='Student',
            description='Student',
            organization=self.org
        )
        
        OrgMember.objects.create(
            organization=self.org,
            user=self.student,
            role=student_role,
            is_active=True
        )

        # Course and Classes
        self.course = Course.objects.create(
            organization=self.org,
            title='Intro to Science',
            code='SCI101',
            price=150.00
        )
        
        self.class_instance = AcademyClass.objects.create(
            course=self.course,
            teacher=self.owner,
            name='Science Class Section A'
        )
        
        Enrollment.objects.create(
            academy_class=self.class_instance,
            student=self.student
        )

    def test_gdpr_data_compilation(self):
        """
        Verify that PrivacyService compiles personal profile data correctly.
        """
        data = PrivacyService.compile_user_personal_data(self.student)
        self.assertEqual(data['profile']['username'], 'student1')
        self.assertEqual(data['profile']['email'], 'student1@acme.edu')
        self.assertEqual(data['profile']['full_name'], 'Regular Student')
        
        # Check enrollments
        self.assertEqual(len(data['enrollments']), 1)
        self.assertEqual(data['enrollments'][0]['course_title'], 'Intro to Science')

    def test_gdpr_anonymization_purge(self):
        """
        Verify that GDPR purge anonymizes the user record and releases links.
        """
        # Purge student
        PrivacyService.anonymize_and_purge_user(self.student)
        
        self.student.refresh_from_db()
        self.assertFalse(self.student.is_active)
        self.assertEqual(self.student.full_name, 'Anonymized GDPR User')
        self.assertEqual(self.student.email, f"deleted_user_{self.student.id}@deleted.eduspace.com")
        self.assertEqual(self.student.username, f"deleted_user_{self.student.id}")
        self.assertFalse(self.student.has_usable_password())

        # Check OrgMember status
        member = OrgMember.objects.get(organization=self.org, user=self.student)
        self.assertFalse(member.is_active)

    def test_api_gdpr_export(self):
        """
        Verify the privacy request-export REST API view.
        """
        self.client.force_authenticate(user=self.student)
        url = reverse('privacy_request_export')
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['profile']['username'], 'student1')

    def test_api_gdpr_purge_with_password(self):
        """
        Verify the delete-account API enforces password validation and deactivates the user.
        """
        self.client.force_authenticate(user=self.student)
        url = reverse('privacy_delete_account')
        
        # Wrong password
        response = self.client.post(url, {'password': 'wrongpassword', 'confirmText': 'delete my account'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Correct password
        response = self.client.post(url, {'password': 'securepassword123', 'confirmText': 'delete my account'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.student.refresh_from_db()
        self.assertFalse(self.student.is_active)

    def test_csv_academic_reports_export(self):
        """
        Verify that CSV reports generate StreamingHttpResponse downloads.
        """
        # Create some financial entries
        TuitionInvoice.objects.create(
            organization=self.org,
            student=self.student,
            amount=120.00,
            status=TuitionInvoice.Status.PAID
        )

        self.client.force_authenticate(user=self.owner)
        url = reverse('academic-reports-export')
        
        # Financials CSV download
        response = self.client.get(url, {'type': 'financials'}, HTTP_X_ORGANIZATION_SLUG='acme-academy')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/csv')
        self.assertIn('attachment', response['Content-Disposition'])
        
        # Read streaming lines
        content = b"".join(response.streaming_content).decode('utf-8')
        self.assertIn('INV-', content)
        self.assertIn('Tuition Invoice', content)

    def test_unauthorized_report_download_block(self):
        """
        Ensure non-admin/non-teacher roles are blocked from downloading organizational reports.
        """
        # student has NO can_view_dashboard permission mapping
        self.client.force_authenticate(user=self.student)
        url = reverse('academic-reports-export')
        
        response = self.client.get(url, {'type': 'grades'}, HTTP_X_ORGANIZATION_SLUG='acme-academy')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_analytics_summary_detailed_metrics(self):
        """
        Verify AnalyticsSummaryView returns the H.7 detailed metrics:
        course_averages, staff_session_counts, and class_progress_rates.
        """
        from assessments.models import Assignment, AssignmentSubmission

        # Create an assignment in the existing class
        assignment = Assignment.objects.create(
            organization=self.org,
            academy_class=self.class_instance,
            title='Test Assignment H7',
            description='A test assignment for H.7 analytics.',
        )

        # Submit and grade it
        AssignmentSubmission.objects.create(
            assignment=assignment,
            student=self.student,
            grade=88.0,
        )

        self.client.force_authenticate(user=self.owner)
        url = reverse('analytics-summary')
        response = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='acme-academy')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify new top-level keys exist
        self.assertIn('course_averages', response.data)
        self.assertIn('staff_session_counts', response.data)
        self.assertIn('class_progress_rates', response.data)

        # course_averages: SCI101 should have avg of 88.0
        averages = response.data['course_averages']
        self.assertGreaterEqual(len(averages), 1, "Expected at least one course_average entry")
        sci_avg = next((c for c in averages if c['code'] == 'SCI101'), None)
        self.assertIsNotNone(sci_avg, "SCI101 not found in course_averages")
        self.assertEqual(float(sci_avg['avg_grade']), 88.0)
        self.assertEqual(sci_avg['graded_count'], 1)

        # class_progress_rates: 1 submission / (1 assignment × 1 enrolled student) = 100%
        rates = response.data['class_progress_rates']
        self.assertGreaterEqual(len(rates), 1, "Expected at least one class_progress_rate entry")
        cls_rate = next((r for r in rates if r['id'] == self.class_instance.id), None)
        self.assertIsNotNone(cls_rate, "Class rate entry not found")
        self.assertEqual(float(cls_rate['completion_rate']), 100.0)
        self.assertEqual(cls_rate['total_submitted'], 1)

    def test_analytics_summary_kpis_completeness(self):
        """
        Verify that AnalyticsSummaryView returns the extended H.7 complete KPIs:
        org_kpis, academic_kpis, at_risk_students, teacher_analytics,
        mentor_analytics, course_analytics, class_analytics.
        """
        from assessments.models import Assignment, AssignmentSubmission
        
        # Add another student
        student2 = User.objects.create_user(
            username='student2',
            email='student2@acme.edu',
            password='securepassword123',
            full_name='Second Student'
        )
        student_role = Role.objects.get(name='Student', organization=self.org)
        OrgMember.objects.create(
            organization=self.org,
            user=student2,
            role=student_role,
            is_active=True
        )
        Enrollment.objects.create(
            academy_class=self.class_instance,
            student=student2
        )
        
        # Create teacher member
        teacher_role = Role.objects.create(
            name='Teacher',
            description='Teacher role',
            organization=self.org
        )
        teacher_user = User.objects.create_user(
            username='teacher_u',
            email='teacher@acme.edu',
            password='securepassword123',
            full_name='Teacher Name'
        )
        OrgMember.objects.create(
            organization=self.org,
            user=teacher_user,
            role=teacher_role,
            is_active=True
        )
        # Assign to class
        self.class_instance.teacher = teacher_user
        self.class_instance.save()
        
        # Create assignment
        assignment = Assignment.objects.create(
            organization=self.org,
            academy_class=self.class_instance,
            title='H7 Assignment Completeness',
            description='Test description'
        )
        
        # Student 1 submits (grade 55.0 - poor grade)
        AssignmentSubmission.objects.create(
            assignment=assignment,
            student=self.student,
            grade=55.0
        )
        # Student 2 does not submit (missing assignment)

        self.client.force_authenticate(user=self.owner)
        url = reverse('analytics-summary')
        response = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='acme-academy')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Assert keys exist
        self.assertIn('org_kpis', response.data)
        self.assertIn('academic_kpis', response.data)
        self.assertIn('at_risk_students', response.data)
        self.assertIn('teacher_analytics', response.data)
        self.assertIn('mentor_analytics', response.data)
        self.assertIn('course_analytics', response.data)
        self.assertIn('class_analytics', response.data)
        
        # Org KPIs assertions
        self.assertEqual(response.data['org_kpis']['total_students'], 2)
        self.assertEqual(response.data['org_kpis']['total_teachers'], 1)
        self.assertEqual(response.data['org_kpis']['total_courses'], 1)
        
        # At-Risk Students assertions:
        # Student 1 is at-risk (poor_grades = 55.0)
        # Student 2 is at-risk (missing_assignments)
        at_risk = response.data['at_risk_students']
        self.assertEqual(len(at_risk), 2)
        
        # Teacher Analytics assertions: teacher_u has 1 class, 2 students
        teachers = response.data['teacher_analytics']
        teacher_u_data = next((t for t in teachers if t['user_id'] == teacher_user.id), None)
        self.assertIsNotNone(teacher_u_data)
        self.assertEqual(teacher_u_data['classes_count'], 1)
        self.assertEqual(teacher_u_data['students_count'], 2)


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

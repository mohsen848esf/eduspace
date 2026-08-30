from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase
from accounts.models import (
    Organization, OrgMember, Role, Permission, Course, AcademyClass, Enrollment, Certificate
)

User = get_user_model()


class CertificateTestCase(APITestCase):
    def setUp(self):
        cache.clear()

        # Users
        self.admin = User.objects.create_superuser(username='admin_user', password='password')
        self.teacher = User.objects.create_user(username='teacher_user', password='password')
        self.student = User.objects.create_user(username='student_user', password='password')
        self.other_student = User.objects.create_user(username='other_student', password='password')

        # Organizations
        self.org_a = Organization.objects.create(name='Org A', slug='org-a', owner=self.admin)
        self.org_b = Organization.objects.create(name='Org B', slug='org-b', owner=self.admin)

        # Roles and permissions
        self.teacher_role = Role.objects.create(name='Teacher', organization=self.org_a)
        self.student_role = Role.objects.create(name='Student', organization=self.org_a)

        self.view_perm, _ = Permission.objects.get_or_create(codename='can_view_dashboard', defaults={'name': 'View Dashboard'})
        self.teach_perm, _ = Permission.objects.get_or_create(codename='can_teach_class', defaults={'name': 'Teach Class'})
        
        self.teacher_role.permissions.add(self.view_perm, self.teach_perm)
        self.student_role.permissions.add(self.view_perm)

        # Org Memberships
        OrgMember.objects.create(organization=self.org_a, user=self.teacher, role=self.teacher_role)
        OrgMember.objects.create(organization=self.org_a, user=self.student, role=self.student_role)
        OrgMember.objects.create(organization=self.org_a, user=self.other_student, role=self.student_role)

        # Course & Class
        self.course = Course.objects.create(organization=self.org_a, title='Course A', code='CA101', price='100.00')
        self.academy_class = AcademyClass.objects.create(course=self.course, name='Class A', teacher=self.teacher)

        # Enrollment (Starts In Progress)
        self.enrollment = Enrollment.objects.create(
            academy_class=self.academy_class,
            student=self.student,
            completion_status=Enrollment.CompletionStatus.IN_PROGRESS
        )

        self.list_url = reverse('certificate-list')

    def test_certificate_generated_on_completion(self):
        """Test that changing completion_status to completed triggers certificate generation."""
        self.assertEqual(Certificate.objects.count(), 0)

        # Complete enrollment
        self.enrollment.completion_status = Enrollment.CompletionStatus.COMPLETED
        self.enrollment.save()

        # Check certificate is created
        self.assertEqual(Certificate.objects.count(), 1)
        cert = Certificate.objects.first()
        self.assertEqual(cert.student, self.student)
        self.assertEqual(cert.academy_class, self.academy_class)
        self.assertEqual(cert.organization, self.org_a)
        self.assertTrue(cert.certificate_number.startswith('CERT-'))
        
        # Verify enrollment completion date set
        self.enrollment.refresh_from_db()
        self.assertIsNotNone(self.enrollment.completion_date)

    def test_certificate_generation_idempotency(self):
        """Test that completing multiple times does not duplicate certificates."""
        self.enrollment.completion_status = Enrollment.CompletionStatus.COMPLETED
        self.enrollment.save()
        self.assertEqual(Certificate.objects.count(), 1)

        # Edit and save again
        self.enrollment.save()
        self.assertEqual(Certificate.objects.count(), 1)

        # Explicitly update back to complete (simulation)
        self.enrollment.completion_status = Enrollment.CompletionStatus.COMPLETED
        self.enrollment.save()
        self.assertEqual(Certificate.objects.count(), 1)

    def test_certificate_visibility_permissions(self):
        """Test that students can see only their own, while teachers and admins can see all."""
        # Generate certificate
        self.enrollment.completion_status = Enrollment.CompletionStatus.COMPLETED
        self.enrollment.save()

        # Authenticate as student
        self.client.force_authenticate(user=self.student)
        response = self.client.get(self.list_url, HTTP_X_ORGANIZATION_SLUG='org-a')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        # Authenticate as other student
        self.client.force_authenticate(user=self.other_student)
        response = self.client.get(self.list_url, HTTP_X_ORGANIZATION_SLUG='org-a')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

        # Authenticate as teacher
        self.client.force_authenticate(user=self.teacher)
        response = self.client.get(self.list_url, HTTP_X_ORGANIZATION_SLUG='org-a')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_certificate_multi_tenant_isolation(self):
        """Test that Organization A cannot access certificates from Organization B."""
        # Generate certificate in Org A
        self.enrollment.completion_status = Enrollment.CompletionStatus.COMPLETED
        self.enrollment.save()

        # Authenticate as admin
        self.client.force_authenticate(user=self.admin)
        
        # Access with Org A slug
        response = self.client.get(self.list_url, HTTP_X_ORGANIZATION_SLUG='org-a')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        # Access with Org B slug
        response = self.client.get(self.list_url, HTTP_X_ORGANIZATION_SLUG='org-b')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should be isolated to Org B, which has no certificates
        self.assertEqual(len(response.data), 0)

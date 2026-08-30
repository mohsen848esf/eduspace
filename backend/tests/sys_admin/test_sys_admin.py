from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.cache import cache
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Organization, OrgMember, Role, Course, Session, Permission
from sys_admin.models import SystemConfig, OperatorAuditLog, OrganizationQuota, OrganizationUsage
from sys_admin.services import GlobalConfigService, QuotaService
from sys_admin.tasks import daily_usage_recalculation

User = get_user_model()

class SysAdminTestCase(APITestCase):
    def setUp(self):
        cache.clear()

        # Users
        self.super_user = User.objects.create_superuser(
            username='superuser', email='super@eduspace.com', password='password123'
        )
        self.regular_user = User.objects.create_user(
            username='regularuser', email='regular@eduspace.com', password='password123'
        )

        # Organizations
        self.org1 = Organization.objects.create(
            name='Org One', slug='org-one', owner=self.regular_user
        )
        # Add regular user as manager/admin of org1
        self.role_admin = Role.objects.create(name='Admin', organization=self.org1)
        
        # Add required permissions to admin role
        perm_manage, _ = Permission.objects.get_or_create(codename='can_manage_members', defaults={'name': 'Manage Members'})
        perm_view, _ = Permission.objects.get_or_create(codename='can_view_dashboard', defaults={'name': 'View Dashboard'})
        self.role_admin.permissions.add(perm_manage, perm_view)

        OrgMember.objects.create(
            organization=self.org1, user=self.regular_user, role=self.role_admin, is_active=True
        )

    def test_superuser_endpoint_protection(self):
        """
        Verify that non-superusers receive 403 Forbidden on sys-admin urls.
        """
        url = reverse('sys-admin-dashboard-metrics')
        
        # Unauthorized check
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Regular user check
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Superuser check
        self.client.force_authenticate(user=self.super_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_organization_suspension_login_block(self):
        """
        Verify that suspending an organization prevents its users from logging in.
        """
        # Initially login works
        login_url = reverse('login')
        response = self.client.post(login_url, {'username': 'regularuser', 'password': 'password123'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Suspend org
        self.org1.is_suspended = True
        self.org1.save()

        # Login now fails
        response = self.client.post(login_url, {'username': 'regularuser', 'password': 'password123'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('suspended', response.data['error'])

    def test_organization_suspension_middleware_block(self):
        """
        Verify that suspension middleware blocks requests matching organization slug.
        """
        self.org1.is_suspended = True
        self.org1.save()

        self.client.force_authenticate(user=self.regular_user)
        url = reverse('course-list')
        
        # Request with suspended organization header should fail
        response = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_global_config_registry_caching(self):
        """
        Verify that SystemConfig updates successfully write to database and cache.
        """
        GlobalConfigService.set('TEST_CONFIG_KEY', '1234', 'A test variable')
        
        # Test cache check
        cache_val = cache.get('sys_config:TEST_CONFIG_KEY')
        self.assertEqual(cache_val, '1234')

        # Retrieve value
        val = GlobalConfigService.get('TEST_CONFIG_KEY')
        self.assertEqual(val, '1234')

        # Clean up
        GlobalConfigService.delete('TEST_CONFIG_KEY')
        self.assertIsNone(GlobalConfigService.get('TEST_CONFIG_KEY'))

    def test_quota_limits_enforcement(self):
        """
        Verify that QuotaService enforces and updates limits correctly.
        """
        # Set quota for courses to 1
        quota = QuotaService.get_quota(self.org1)
        quota.max_courses = 1
        quota.save()

        # Recalculate usage
        QuotaService.recalculate_usage(self.org1)

        # Create one course
        self.client.force_authenticate(user=self.regular_user)
        url = reverse('course-list')
        response = self.client.post(url, {
            'title': 'Course A',
            'code': 'CS-A',
            'price': 100,
            'is_active': True
        }, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Trying to create second course should fail
        response = self.client.post(url, {
            'title': 'Course B',
            'code': 'CS-B',
            'price': 100,
            'is_active': True
        }, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Should contain quota error
        self.assertIn('Quota limit for courses exceeded', str(response.data))

    def test_daily_usage_recalculation_task(self):
        """
        Verify the Celery task recalculates metrics for organizations.
        """
        # Create a course to make sure usage is not zero
        Course.objects.create(organization=self.org1, title='Course Test', code='TST101', price=50)
        
        # Run Celery task
        result = daily_usage_recalculation()
        self.assertTrue(result.startswith("Recalculated"))
        self.assertTrue("organizations" in result)

        # Check OrgUsage has courses_count=1
        usage = OrganizationUsage.objects.get(organization=self.org1)
        self.assertEqual(usage.courses_count, 1)

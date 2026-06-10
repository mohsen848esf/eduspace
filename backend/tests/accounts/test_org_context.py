from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase
from accounts.models import Organization, OrgMember, Role, Permission

User = get_user_model()


class OrgContextIntegrationTest(APITestCase):
    def setUp(self):
        # Clear cache to prevent stale permission context leaks from other test suites
        cache.clear()

        # Create standard user and superuser
        self.user = User.objects.create_user(username='test_user', password='password')
        self.superuser = User.objects.create_superuser(username='super_user', password='password')
        
        # Create organizations
        self.org1 = Organization.objects.create(name='Org One', slug='org-one', owner=self.superuser)
        self.org2 = Organization.objects.create(name='Org Two', slug='org-two', owner=self.superuser)
        
        # Create permissions and roles
        self.perm1, _ = Permission.objects.get_or_create(codename='can_view_dashboard', defaults={'name': 'View Dashboard'})
        self.perm2, _ = Permission.objects.get_or_create(codename='can_manage_members', defaults={'name': 'Manage Members'})
        
        self.role = Role.objects.create(name='Teacher', organization=self.org1)
        self.role.permissions.add(self.perm1)
        
        # Create standard membership in org1
        self.member1 = OrgMember.objects.create(
            organization=self.org1,
            user=self.user,
            role=self.role,
            is_active=True
        )
        
        self.url = reverse('org_context')

    def test_org_context_success(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url, HTTP_X_ORGANIZATION_SLUG='org-one')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['organization']['slug'], 'org-one')
        self.assertEqual(response.data['role'], 'Teacher')
        self.assertIn('can_view_dashboard', response.data['permissions'])
        self.assertNotIn('can_manage_members', response.data['permissions'])

    def test_org_context_superuser(self):
        self.client.force_authenticate(user=self.superuser)
        response = self.client.get(self.url, HTTP_X_ORGANIZATION_SLUG='org-one')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['organization']['slug'], 'org-one')
        self.assertEqual(response.data['role'], 'Superuser')
        # Superuser gets all permissions in the system
        self.assertIn('can_view_dashboard', response.data['permissions'])
        self.assertIn('can_manage_members', response.data['permissions'])

    def test_org_context_missing_org(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_org_context_not_member(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url, HTTP_X_ORGANIZATION_SLUG='org-two')
        
        # Standard user is not a member of org2
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['detail'], 'You are not an active member of this organization.')

    def test_org_context_inactive_member(self):
        self.member1.is_active = False
        self.member1.save()
        
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url, HTTP_X_ORGANIZATION_SLUG='org-one')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['detail'], 'You are not an active member of this organization.')

    def test_org_context_expired_member(self):
        self.member1.expires_at = timezone.now() - timezone.timedelta(days=1)
        self.member1.save()
        
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url, HTTP_X_ORGANIZATION_SLUG='org-one')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['detail'], 'Your membership in this organization has expired.')

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

    def test_org_context_fallback_missing_org(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url)
        
        # Falls back to their first active membership (org-one)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['organization']['slug'], 'org-one')

    def test_org_context_fallback_not_member(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url, HTTP_X_ORGANIZATION_SLUG='org-two')
        
        # Standard user is not a member of org2, falls back to org-one
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['organization']['slug'], 'org-one')

    def test_org_context_no_memberships(self):
        # Create standard user with no memberships
        guest = User.objects.create_user(username='guest_user', password='password')
        self.client.force_authenticate(user=guest)
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['organization'])
        self.assertIsNone(response.data['role'])
        self.assertEqual(response.data['permissions'], [])

    def test_org_context_inactive_member(self):
        self.member1.is_active = False
        self.member1.save()
        
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url, HTTP_X_ORGANIZATION_SLUG='org-one')
        
        # Inactive member with no other memberships returns empty context
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['organization'])

    def test_org_context_expired_member(self):
        self.member1.expires_at = timezone.now() - timezone.timedelta(days=1)
        self.member1.save()
        
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url, HTTP_X_ORGANIZATION_SLUG='org-one')
        
        # Expired member with no other memberships returns empty context
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['organization'])

    def test_org_context_anonymous_denied(self):
        self.client.logout()
        response = self.client.get(self.url, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class OrganizationActionsIntegrationTest(APITestCase):
    def setUp(self):
        cache.clear()
        self.guest = User.objects.create_user(username='guest_user', password='password')
        self.org_owner = User.objects.create_user(username='org_owner', password='password')
        self.org = Organization.objects.create(name='Test Org', slug='test-org', owner=self.org_owner)
        
        # Set up default roles
        self.student_role = Role.objects.create(name='Student', organization=self.org)
        self.admin_role = Role.objects.create(name='Admin', organization=self.org)
        
        # Ensure permissions exist
        Permission.objects.get_or_create(codename='can_view_dashboard', defaults={'name': 'View Dashboard'})
        Permission.objects.get_or_create(codename='can_attend_class', defaults={'name': 'Attend Class'})

    def test_create_organization(self):
        self.client.force_authenticate(user=self.guest)
        url = reverse('organization-list')
        response = self.client.post(url, {'name': 'New Academy'})
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_org = Organization.objects.get(name='New Academy')
        self.assertEqual(new_org.owner, self.guest)
        self.assertEqual(new_org.slug, 'new-academy')
        
        # Check default roles created for new org
        roles = Role.objects.filter(organization=new_org)
        self.assertTrue(roles.filter(name='Admin').exists())
        self.assertTrue(roles.filter(name='Teacher').exists())
        self.assertTrue(roles.filter(name='Mentor').exists())
        self.assertTrue(roles.filter(name='Student').exists())
        
        # Check guest is now active owner OrgMember
        self.assertTrue(OrgMember.objects.filter(organization=new_org, user=self.guest, is_active=True, role__name='Admin').exists())

    def test_join_organization(self):
        self.client.force_authenticate(user=self.guest)
        url = reverse('organization-join', kwargs={'pk': 'test-org'})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(OrgMember.objects.filter(organization=self.org, user=self.guest, is_active=True, role=self.student_role).exists())

    def test_invitations_list(self):
        # Create inactive membership (invitation)
        OrgMember.objects.create(organization=self.org, user=self.guest, role=self.student_role, is_active=False, invited_by=self.org_owner)
        
        self.client.force_authenticate(user=self.guest)
        url = reverse('organization-invitations')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['organization']['slug'], 'test-org')
        self.assertEqual(response.data[0]['invited_by'], 'org_owner')

    def test_respond_invitation_accept(self):
        invite = OrgMember.objects.create(organization=self.org, user=self.guest, role=self.student_role, is_active=False)
        
        self.client.force_authenticate(user=self.guest)
        url = reverse('organization-respond-invitation', kwargs={'pk': 'test-org'})
        response = self.client.post(url, {'action': 'accept'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        invite.refresh_from_db()
        self.assertTrue(invite.is_active)

    def test_respond_invitation_decline(self):
        invite = OrgMember.objects.create(organization=self.org, user=self.guest, role=self.student_role, is_active=False)
        
        self.client.force_authenticate(user=self.guest)
        url = reverse('organization-respond-invitation', kwargs={'pk': 'test-org'})
        response = self.client.post(url, {'action': 'decline'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(OrgMember.objects.filter(id=invite.id).exists())



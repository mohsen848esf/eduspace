from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase
from accounts.models import Organization, OrgMember, Role, Permission

User = get_user_model()


class GlobalSearchTestCase(APITestCase):
    def setUp(self):
        cache.clear()

        # Users
        self.superuser = User.objects.create_superuser(username='super_user', password='password')
        self.user_a = User.objects.create_user(username='user_a', password='password')
        self.user_b = User.objects.create_user(username='user_b', password='password')

        # Organizations
        self.org_a = Organization.objects.create(name='Org A', slug='org-a', owner=self.superuser)
        self.org_b = Organization.objects.create(name='Org B', slug='org-b', owner=self.superuser)

        # Roles and permissions
        self.view_perm, _ = Permission.objects.get_or_create(codename='can_view_dashboard', defaults={'name': 'View Dashboard'})
        self.role_a = Role.objects.create(name='Student', organization=self.org_a)
        self.role_a.permissions.add(self.view_perm)

        self.role_b = Role.objects.create(name='Student', organization=self.org_b)
        self.role_b.permissions.add(self.view_perm)

        # Org memberships
        OrgMember.objects.create(organization=self.org_a, user=self.user_a, role=self.role_a)
        OrgMember.objects.create(organization=self.org_b, user=self.user_b, role=self.role_b)

        self.url = reverse('global_search')

    def test_org_a_member_cannot_search_org_b(self):
        """Test that a member of Org A is forbidden from searching Org B."""
        self.client.force_authenticate(user=self.user_a)
        
        # Request search context Org B
        response = self.client.get(f"{self.url}?q=test", HTTP_X_ORGANIZATION_SLUG='org-b')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_org_b_member_cannot_search_org_a(self):
        """Test that a member of Org B is forbidden from searching Org A."""
        self.client.force_authenticate(user=self.user_b)
        
        # Request search context Org A
        response = self.client.get(f"{self.url}?q=test", HTTP_X_ORGANIZATION_SLUG='org-a')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_member_can_search_own_org(self):
        """Test that a member can search their own organization."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(f"{self.url}?q=user", HTTP_X_ORGANIZATION_SLUG='org-a')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should have paginated format
        self.assertIn('count', response.data)
        self.assertIn('results', response.data)

    def test_superuser_can_search_any_org(self):
        """Test that a superuser can bypass membership checks and search any organization."""
        self.client.force_authenticate(user=self.superuser)
        
        response_a = self.client.get(f"{self.url}?q=user", HTTP_X_ORGANIZATION_SLUG='org-a')
        self.assertEqual(response_a.status_code, status.HTTP_200_OK)

        response_b = self.client.get(f"{self.url}?q=user", HTTP_X_ORGANIZATION_SLUG='org-b')
        self.assertEqual(response_b.status_code, status.HTTP_200_OK)

    def test_search_pagination_parameters(self):
        """Test pagination and configurable page size works as expected."""
        # Create some students in Org A to search
        for i in range(10):
            u = User.objects.create_user(username=f"student_{i}", password='password')
            OrgMember.objects.create(organization=self.org_a, user=u, role=self.role_a)

        self.client.force_authenticate(user=self.user_a)
        
        # page_size = 3, page = 1
        response = self.client.get(f"{self.url}?q=student&page_size=3&page=1", HTTP_X_ORGANIZATION_SLUG='org-a')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 10)  # maximum items in the category list
        self.assertEqual(len(response.data['results']['students']), 3)
        self.assertIsNotNone(response.data['next'])
        self.assertIsNone(response.data['previous'])

        # page_size = 3, page = 2
        response_p2 = self.client.get(f"{self.url}?q=student&page_size=3&page=2", HTTP_X_ORGANIZATION_SLUG='org-a')
        self.assertEqual(response_p2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_p2.data['results']['students']), 3)
        self.assertIsNotNone(response_p2.data['previous'])

    def test_search_pagination_multi_category(self):
        """Test search pagination with multiple categories (Students and Courses)."""
        from accounts.models import Course
        # Create 10 students (already created 10 in previous tests, but database clears or runs in sandbox?setUp clears cache, but TransactionTestCase starts fresh per test)
        for i in range(10):
            u = User.objects.create_user(username=f"student_x_{i}", password='password')
            OrgMember.objects.create(organization=self.org_a, user=u, role=self.role_a)
        
        # Create 5 courses matching name 'student_x'
        for i in range(5):
            Course.objects.create(organization=self.org_a, title=f"student_x course {i}", code=f"SC-{i}")
            
        self.client.force_authenticate(user=self.user_a)
        
        response = self.client.get(f"{self.url}?q=student_x&page_size=4&page=1", HTTP_X_ORGANIZATION_SLUG='org-a')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 10)
        self.assertEqual(len(response.data['results']['students']), 4)
        self.assertEqual(len(response.data['results']['courses']), 4)
        
        response_p2 = self.client.get(f"{self.url}?q=student_x&page_size=4&page=2", HTTP_X_ORGANIZATION_SLUG='org-a')
        self.assertEqual(response_p2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_p2.data['results']['students']), 4)
        self.assertEqual(len(response_p2.data['results']['courses']), 1)

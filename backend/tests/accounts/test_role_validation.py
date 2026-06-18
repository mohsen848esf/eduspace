from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from accounts.models import Organization, Role, OrgMember

User = get_user_model()

class RoleValidationTest(APITestCase):
    def setUp(self):
        # 1. Create Organization
        self.org = Organization.objects.create(
            name='Test Academy',
            slug='test-academy',
            owner=User.objects.create_user(username='org_owner', password='password123')
        )
        
        # 2. Get/Create Default Roles
        self.admin_role, _ = Role.objects.get_or_create(
            name='Admin',
            defaults={'description': 'Admin role'}
        )
        
        # 3. Create admin user
        self.admin_user = User.objects.create_user(
            username='admin_user',
            email='admin@test.com',
            password='password123',
            full_name='Admin User'
        )
        
        # 4. Create Org Member with Admin role
        OrgMember.objects.create(
            organization=self.org,
            user=self.admin_user,
            role=self.admin_role
        )
        
        self.roles_url = reverse('role-list')

    def test_cannot_create_role_with_default_name(self):
        self.client.force_authenticate(user=self.admin_user)
        
        # Try to create a role named "Admin" (case-insensitive, with spacing)
        for name in ["Admin", "admin", "  ADMIN  ", "Teacher", "teacher", "Student", "student", "Mentor", "mentor"]:
            res = self.client.post(
                self.roles_url,
                {
                    'name': name,
                    'description': 'Custom role name override test'
                },
                HTTP_X_ORGANIZATION_SLUG='test-academy',
                format='json'
            )
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, f"Allowed creating role with name '{name}'")
            self.assertIn('name', res.data['errors'])

    def test_can_create_role_with_non_default_name(self):
        self.client.force_authenticate(user=self.admin_user)
        
        res = self.client.post(
            self.roles_url,
            {
                'name': 'Teaching Assistant',
                'description': 'Helps teacher in class'
            },
            HTTP_X_ORGANIZATION_SLUG='test-academy',
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['name'], 'Teaching Assistant')

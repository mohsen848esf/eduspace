from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.models import UserSession, Organization, Role, Permission, OrgMember

User = get_user_model()

class SessionsAndRolesTest(APITestCase):
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
        self.student_role, _ = Role.objects.get_or_create(
            name='Student',
            defaults={'description': 'Student role'}
        )
        
        # 3. Create Users
        self.admin_user = User.objects.create_user(
            username='admin_user',
            email='admin@test.com',
            password='password123',
            full_name='Admin User'
        )
        self.student_user = User.objects.create_user(
            username='student_user',
            email='student@test.com',
            password='password123',
            full_name='Student User'
        )
        self.stranger_user = User.objects.create_user(
            username='stranger_user',
            email='stranger@test.com',
            password='password123',
            full_name='Stranger User'
        )
        
        # 4. Create Org Members
        OrgMember.objects.create(
            organization=self.org,
            user=self.admin_user,
            role=self.admin_role
        )
        OrgMember.objects.create(
            organization=self.org,
            user=self.student_user,
            role=self.student_role
        )
        
        self.login_url = reverse('login')
        self.logout_url = reverse('logout')
        self.me_url = reverse('me')
        self.refresh_url = reverse('token_refresh')
        self.sessions_url = reverse('user-session-list')
        self.roles_url = reverse('role-list')

    def test_login_creates_session(self):
        data = {
            'username': 'student_user',
            'password': 'password123'
        }
        res = self.client.post(self.login_url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        
        # Verify UserSession is created
        sessions = UserSession.objects.filter(user=self.student_user, is_active=True)
        self.assertEqual(sessions.count(), 1)
        session = sessions.first()
        self.assertEqual(session.user_agent, '')
        
        # Verify access token has session_id claim
        from rest_framework_simplejwt.tokens import AccessToken
        access_token = AccessToken(res.data['access'])
        self.assertEqual(access_token['session_id'], session.id)

    def test_authenticated_request_with_revoked_session_fails(self):
        data = {
            'username': 'student_user',
            'password': 'password123'
        }
        res = self.client.post(self.login_url, data, format='json')
        access_token = res.data['access']
        
        # Verify request works initially
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        res_me = self.client.get(self.me_url)
        self.assertEqual(res_me.status_code, status.HTTP_200_OK)
        
        # Revoke the session
        session = UserSession.objects.get(user=self.student_user)
        session.is_active = False
        session.save()
        
        # Verify request now fails with 401
        res_me_failed = self.client.get(self.me_url)
        self.assertEqual(res_me_failed.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_token_revoked_session_fails(self):
        data = {
            'username': 'student_user',
            'password': 'password123'
        }
        res = self.client.post(self.login_url, data, format='json')
        refresh_token = res.data['refresh']
        
        # Revoke the session
        session = UserSession.objects.get(user=self.student_user)
        session.is_active = False
        session.save()
        
        # Try to refresh
        res_refresh = self.client.post(self.refresh_url, {'refresh': refresh_token}, format='json')
        self.assertEqual(res_refresh.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_deactivates_session(self):
        data = {
            'username': 'student_user',
            'password': 'password123'
        }
        res = self.client.post(self.login_url, data, format='json')
        access = res.data['access']
        refresh = res.data['refresh']
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        
        # Logout
        res_logout = self.client.post(self.logout_url, {'refresh': refresh}, format='json')
        self.assertEqual(res_logout.status_code, status.HTTP_200_OK)
        
        # Verify session is deactivated
        session = UserSession.objects.get(user=self.student_user)
        self.assertFalse(session.is_active)

    def test_list_sessions_user(self):
        # Create a session for student
        refresh_student = RefreshToken.for_user(self.student_user)
        UserSession.objects.create(user=self.student_user, refresh_token_jti=refresh_student['jti'])
        
        # Create a session for admin
        refresh_admin = RefreshToken.for_user(self.admin_user)
        UserSession.objects.create(user=self.admin_user, refresh_token_jti=refresh_admin['jti'])
        
        # Student lists sessions
        self.client.force_authenticate(user=self.student_user)
        res = self.client.get(self.sessions_url, HTTP_X_ORGANIZATION_SLUG='test-academy')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Student should only see their own sessions
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['username'], 'student_user')

    def test_list_sessions_admin(self):
        # Create a session for student
        refresh_student = RefreshToken.for_user(self.student_user)
        UserSession.objects.create(user=self.student_user, refresh_token_jti=refresh_student['jti'])
        
        # Create a session for admin
        refresh_admin = RefreshToken.for_user(self.admin_user)
        UserSession.objects.create(user=self.admin_user, refresh_token_jti=refresh_admin['jti'])
        
        # Admin lists sessions
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get(self.sessions_url, HTTP_X_ORGANIZATION_SLUG='test-academy')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Admin should see both sessions because both belong to members of the org
        self.assertEqual(len(res.data), 2)

    def test_revoke_session_permission(self):
        # Create session for student
        refresh_student = RefreshToken.for_user(self.student_user)
        session = UserSession.objects.create(user=self.student_user, refresh_token_jti=refresh_student['jti'])
        
        # Stranger tries to revoke student's session -> Not Found (isolated)
        self.client.force_authenticate(user=self.stranger_user)
        res_stranger = self.client.delete(reverse('user-session-detail', args=[session.id]), HTTP_X_ORGANIZATION_SLUG='test-academy')
        self.assertEqual(res_stranger.status_code, status.HTTP_404_NOT_FOUND)
        
        # Student revokes own session -> Success
        self.client.force_authenticate(user=self.student_user)
        res_student = self.client.delete(reverse('user-session-detail', args=[session.id]), HTTP_X_ORGANIZATION_SLUG='test-academy')
        self.assertEqual(res_student.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertFalse(session.is_active)
        
        # Re-activate and let admin revoke it
        session.is_active = True
        session.save()
        
        # Admin revokes student's session -> Success
        self.client.force_authenticate(user=self.admin_user)
        res_admin = self.client.delete(reverse('user-session-detail', args=[session.id]), HTTP_X_ORGANIZATION_SLUG='test-academy')
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertFalse(session.is_active)

    def test_protect_system_roles(self):
        self.client.force_authenticate(user=self.admin_user)
        
        # Try to modify system Admin role -> HTTP 400 Bad Request
        res_update = self.client.patch(
            reverse('role-detail', args=[self.admin_role.id]),
            {'name': 'Super Admin'},
            HTTP_X_ORGANIZATION_SLUG='test-academy',
            format='json'
        )
        self.assertEqual(res_update.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Try to delete system Admin role -> HTTP 400 Bad Request
        res_delete = self.client.delete(
            reverse('role-detail', args=[self.admin_role.id]),
            HTTP_X_ORGANIZATION_SLUG='test-academy'
        )
        self.assertEqual(res_delete.status_code, status.HTTP_400_BAD_REQUEST)

    def test_custom_roles(self):
        self.client.force_authenticate(user=self.admin_user)
        
        # 1. Create a custom permission
        p1 = Permission.objects.create(codename='can_test', name='Can Test')
        p2 = Permission.objects.create(codename='can_debug', name='Can Debug')
        
        # 2. Create custom role
        res_create = self.client.post(
            self.roles_url,
            {
                'name': 'Tester',
                'description': 'Software tester',
                'permissions': ['can_test']
            },
            HTTP_X_ORGANIZATION_SLUG='test-academy',
            format='json'
        )
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        role_id = res_create.data['id']
        self.assertEqual(res_create.data['permissions'], ['can_test'])
        
        # Verify role has organization set
        role = Role.objects.get(id=role_id)
        self.assertEqual(role.organization, self.org)
        
        # 3. Update custom role permissions
        res_update = self.client.patch(
            reverse('role-detail', args=[role_id]),
            {
                'permissions': ['can_test', 'can_debug']
            },
            HTTP_X_ORGANIZATION_SLUG='test-academy',
            format='json'
        )
        self.assertEqual(res_update.status_code, status.HTTP_200_OK)
        self.assertEqual(set(res_update.data['permissions']), {'can_test', 'can_debug'})
        
        # 4. List all available system permissions
        res_perms = self.client.get(
            reverse('role-permissions'),
            HTTP_X_ORGANIZATION_SLUG='test-academy'
        )
        self.assertEqual(res_perms.status_code, status.HTTP_200_OK)
        codenames = [p['codename'] for p in res_perms.data]
        self.assertIn('can_test', codenames)
        self.assertIn('can_debug', codenames)
        
        # 5. Delete custom role
        res_delete = self.client.delete(
            reverse('role-detail', args=[role_id]),
            HTTP_X_ORGANIZATION_SLUG='test-academy'
        )
        self.assertEqual(res_delete.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Role.objects.filter(id=role_id).exists())

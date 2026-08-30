from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase, APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.models import UserSession

User = get_user_model()

class AuthViewsTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='auth_user', 
            email='auth@test.com', 
            password='password123',
            full_name='Auth Test User'
        )
        self.register_url = reverse('register')
        self.login_url = reverse('login')
        self.me_url = reverse('me')
        self.logout_url = reverse('logout')
        self.refresh_url = reverse('token_refresh')
        self.change_password_url = reverse('change_password')
        self.search_url = reverse('search_users')

    def test_register_success(self):
        data = {
            'username': 'new_user',
            'email': 'new@test.com',
            'password': 'strongpassword123',
            'full_name': 'New User'
        }
        res = self.client.post(self.register_url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)
        self.assertEqual(res.data['user']['username'], 'new_user')
        self.assertTrue(User.objects.filter(username='new_user').exists())

    def test_register_validation_failure(self):
        data = {
            'username': 'new_user',
            'email': 'invalid-email',
            'password': 'short' # too short, min length is 8
        }
        res = self.client.post(self.register_url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', res.data)
        self.assertIn('email', res.data)

    def test_login_success(self):
        data = {
            'username': 'auth_user',
            'password': 'password123'
        }
        res = self.client.post(self.login_url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        self.assertEqual(res.data['user']['username'], 'auth_user')

    def test_login_failure(self):
        data = {
            'username': 'auth_user',
            'password': 'wrongpassword'
        }
        res = self.client.post(self.login_url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res.data['error'], 'Invalid credentials')

    def test_me_authenticated(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.get(self.me_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['username'], 'auth_user')

    def test_me_unauthenticated(self):
        res = self.client.get(self.me_url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_change_password_requires_authentication(self):
        res = self.client.post(self.change_password_url, {
            'current_password': 'password123',
            'new_password': 'NewSecurePassword123!',
            'confirm_password': 'NewSecurePassword123!',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_change_password_rejects_wrong_current_password(self):
        login_response = self.client.post(self.login_url, {
            'username': 'auth_user',
            'password': 'password123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        res = self.client.post(self.change_password_url, {
            'current_password': 'wrong-password',
            'new_password': 'NewSecurePassword123!',
            'confirm_password': 'NewSecurePassword123!',
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('current_password', res.data)
        self.assertTrue(self.user.check_password('password123'))

    def test_change_password_rejects_weak_password_and_mismatch(self):
        login_response = self.client.post(self.login_url, {
            'username': 'auth_user',
            'password': 'password123',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        weak_response = self.client.post(self.change_password_url, {
            'current_password': 'password123',
            'new_password': '123',
            'confirm_password': '123',
        }, format='json')
        self.assertEqual(weak_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('new_password', weak_response.data)

        mismatch_response = self.client.post(self.change_password_url, {
            'current_password': 'password123',
            'new_password': 'NewSecurePassword123!',
            'confirm_password': 'DifferentSecurePassword123!',
        }, format='json')
        self.assertEqual(mismatch_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('confirm_password', mismatch_response.data)

    def test_change_password_rotates_current_session_and_revokes_old_tokens(self):
        first_client = APIClient()
        first_login = first_client.post(self.login_url, {
            'username': 'auth_user',
            'password': 'password123',
        }, format='json')
        old_access = first_login.data['access']
        old_refresh = first_login.data['refresh']

        # A second login represents another active device/session.
        second_client = APIClient()
        second_login = second_client.post(self.login_url, {
            'username': 'auth_user',
            'password': 'password123',
        }, format='json')
        other_access = second_login.data['access']

        first_client.credentials(HTTP_AUTHORIZATION=f"Bearer {old_access}")
        response = first_client.post(self.change_password_url, {
            'current_password': 'password123',
            'new_password': 'NewSecurePassword123!',
            'confirm_password': 'NewSecurePassword123!',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertNotEqual(response.data['access'], old_access)
        self.assertEqual(UserSession.objects.filter(user=self.user, is_active=True).count(), 1)

        # Both the old access token and the other device are revoked by the
        # UserSession check in SessionJWTAuthentication.
        old_access_response = APIClient()
        old_access_response.credentials(HTTP_AUTHORIZATION=f"Bearer {old_access}")
        self.assertEqual(old_access_response.get(self.me_url).status_code, status.HTTP_401_UNAUTHORIZED)
        other_access_response = APIClient()
        other_access_response.credentials(HTTP_AUTHORIZATION=f"Bearer {other_access}")
        self.assertEqual(other_access_response.get(self.me_url).status_code, status.HTTP_401_UNAUTHORIZED)

        old_refresh_response = APIClient().post(self.refresh_url, {'refresh': old_refresh}, format='json')
        self.assertEqual(old_refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

        new_access_response = APIClient()
        new_access_response.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        self.assertEqual(new_access_response.get(self.me_url).status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewSecurePassword123!'))
        self.assertFalse(self.user.check_password('password123'))

    def test_logout_success(self):
        self.client.force_authenticate(user=self.user)
        refresh = RefreshToken.for_user(self.user)
        res = self.client.post(self.logout_url, {'refresh': str(refresh)}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['message'], 'Logged out')

    def test_logout_invalid(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post(self.logout_url, {'refresh': 'invalid_token'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK) # catches exception and returns Logged out

    def test_search_users_query_too_short(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.get(f"{self.search_url}?q=a")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, [])

    def test_search_users_success(self):
        from django.core.cache import cache
        cache.clear()
        from accounts.models import Organization, OrgMember, Role, Permission
        self.user.is_superuser = True
        self.user.save()

        org = Organization.objects.create(name="Search Org", slug="search-org", owner=self.user)
        student_role, _ = Role.objects.get_or_create(name="Student", organization=org)
        OrgMember.objects.create(user=self.user, organization=org, role=student_role)

        # Create matching users
        for i in range(12):
            u = User.objects.create_user(username=f"search_test_{i}", password='password123', full_name=f"Match Name {i}")
            OrgMember.objects.create(user=u, organization=org, role=student_role)
        
        self.client.force_authenticate(user=self.user)
        res = self.client.get(f"{self.search_url}?q=search_test", HTTP_X_ORGANIZATION_SLUG=org.slug)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        # Max results should be capped at 10
        self.assertEqual(len(res.data), 10)
        
        # Excluding non-matching query
        res2 = self.client.get(f"{self.search_url}?q=nonexistent_xyz", HTTP_X_ORGANIZATION_SLUG=org.slug)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res2.data), 0)

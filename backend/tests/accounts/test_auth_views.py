from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

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
        # Create matching users
        for i in range(12):
            User.objects.create_user(username=f"search_test_{i}", password='password123', full_name=f"Match Name {i}")
        
        self.client.force_authenticate(user=self.user)
        res = self.client.get(f"{self.search_url}?q=search_test")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        # Max results should be capped at 10
        self.assertEqual(len(res.data), 10)
        
        # Excluding current user
        res2 = self.client.get(f"{self.search_url}?q=auth_user")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res2.data), 0)

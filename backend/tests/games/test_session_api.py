from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase
from accounts.models import Organization, OrgMember, Role, Permission
from games.models import Game, GameSession, GameParticipant

User = get_user_model()


class GameSessionAPITestCase(APITestCase):
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

        # Create a Game
        self.game = Game.objects.create(title='Word Game', game_type=Game.GameType.WORD_GUESS)

        # Create a Game Session in Org A
        self.session_a = GameSession.objects.create(
            game=self.game,
            organization=self.org_a,
            host=self.user_a,
            room_code='ROOMAA'
        )

    def test_create_session_success(self):
        """Test creating a session successfully as a member of Org A."""
        self.client.force_authenticate(user=self.user_a)
        url = reverse('create_session', args=[self.game.id])
        response = self.client.post(url, {}, HTTP_X_ORGANIZATION_SLUG='org-a')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('room_code', response.data)

    def test_create_session_unauthorized(self):
        """Test that a user not in Org A cannot create a session in Org A."""
        self.client.force_authenticate(user=self.user_b)
        url = reverse('create_session', args=[self.game.id])
        response = self.client.post(url, {}, HTTP_X_ORGANIZATION_SLUG='org-a')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_session_success(self):
        """Test retrieving session details successfully by Org A member."""
        self.client.force_authenticate(user=self.user_a)
        url = reverse('get_session', args=['ROOMAA'])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['room_code'], 'ROOMAA')

    def test_get_session_not_found_other_org(self):
        """Test that retrieving session details returns 404 for non-member of Org A."""
        self.client.force_authenticate(user=self.user_b)
        url = reverse('get_session', args=['ROOMAA'])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_join_session_success(self):
        """Test joining session successfully by Org A member."""
        self.client.force_authenticate(user=self.user_a)
        url = reverse('join_session', args=['ROOMAA'])
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_join_session_not_found_other_org(self):
        """Test that joining session returns 404 for non-member of Org A."""
        self.client.force_authenticate(user=self.user_b)
        url = reverse('join_session', args=['ROOMAA'])
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

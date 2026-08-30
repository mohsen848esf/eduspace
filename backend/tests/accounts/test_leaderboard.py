from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from rest_framework import status
from rest_framework.test import APITestCase
from accounts.models import Organization, OrgMember, Role, Permission
from games.models import Game, GameSession, GameParticipant
from assessments.models import Assessment, Submission

User = get_user_model()


class LeaderboardTestCase(APITestCase):
    def setUp(self):
        cache.clear()

        # Users
        self.admin = User.objects.create_superuser(username='admin_user', password='password')
        self.student1 = User.objects.create_user(username='student_one', password='password', full_name='Student One')
        self.student2 = User.objects.create_user(username='student_two', password='password', full_name='Student Two')
        self.student3 = User.objects.create_user(username='student_three', password='password', full_name='Student Three')
        self.student_org_b = User.objects.create_user(username='student_b', password='password', full_name='Student Org B')

        # Organizations
        self.org_a = Organization.objects.create(name='Org A', slug='org-a', owner=self.admin)
        self.org_b = Organization.objects.create(name='Org B', slug='org-b', owner=self.admin)

        # Roles
        self.student_role = Role.objects.create(name='Student', organization=self.org_a)
        self.student_role.permissions.add(Permission.objects.get(codename='can_view_dashboard'))

        self.student_role_b = Role.objects.create(name='Student', organization=self.org_b)
        self.student_role_b.permissions.add(Permission.objects.get(codename='can_view_dashboard'))

        # Members
        OrgMember.objects.create(organization=self.org_a, user=self.admin)
        OrgMember.objects.create(organization=self.org_b, user=self.admin)
        OrgMember.objects.create(organization=self.org_a, user=self.student1, role=self.student_role)
        OrgMember.objects.create(organization=self.org_a, user=self.student2, role=self.student_role)
        OrgMember.objects.create(organization=self.org_a, user=self.student3, role=self.student_role)
        OrgMember.objects.create(organization=self.org_b, user=self.student_org_b, role=self.student_role_b)

        # Create a Game
        self.game = Game.objects.create(title='Grammar Game', game_type=Game.GameType.GRAMMAR)

        # Game Sessions (hosted by admin in respective orgs)
        self.session_a = GameSession.objects.create(game=self.game, organization=self.org_a, host=self.admin, room_code='ROOMAA')
        self.session_b = GameSession.objects.create(game=self.game, organization=self.org_b, host=self.admin, room_code='ROOMBB')

        # Game Scores
        GameParticipant.objects.create(session=self.session_a, user=self.student1, score=15)
        GameParticipant.objects.create(session=self.session_a, user=self.student2, score=25)
        GameParticipant.objects.create(session=self.session_a, user=self.student3, score=10)
        GameParticipant.objects.create(session=self.session_b, user=self.student_org_b, score=50)

        # Assessments
        self.assessment_a = Assessment.objects.create(organization=self.org_a, title='Midterm A')
        self.assessment_b = Assessment.objects.create(organization=self.org_b, title='Midterm B')

        # Submissions
        Submission.objects.create(assessment=self.assessment_a, student=self.student1, status='graded', score=12.5)
        Submission.objects.create(assessment=self.assessment_a, student=self.student2, status='graded', score=2.5)
        Submission.objects.create(assessment=self.assessment_a, student=self.student3, status='graded', score=10.0)
        Submission.objects.create(assessment=self.assessment_b, student=self.student_org_b, status='graded', score=30.0)

        self.url = reverse('leaderboard')

    def test_leaderboard_aggregation_and_ranking(self):
        """Test points aggregation, grand total, and true dense ranking logic."""
        self.client.force_authenticate(user=self.student1)
        response = self.client.get(self.url, HTTP_X_ORGANIZATION_SLUG='org-a')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only contain students from Org A
        self.assertEqual(len(response.data['results']), 3)

        # student1 total = 15 (game) + 12.5 (assess) = 27.5
        # student2 total = 25 (game) + 2.5 (assess) = 27.5
        # student3 total = 10 (game) + 10.0 (assess) = 20.0
        # student1 and student2 should tie at Rank 1. student3 should be Rank 2 under true dense ranking (1, 1, 2)
        
        first = response.data['results'][0]
        second = response.data['results'][1]
        third = response.data['results'][2]

        self.assertEqual(first['username'], 'student_one')
        self.assertEqual(first['total_score'], 27.5)
        self.assertEqual(first['rank'], 1)

        self.assertEqual(second['username'], 'student_two')
        self.assertEqual(second['total_score'], 27.5)
        self.assertEqual(second['rank'], 1)  # Dense ranking tie!

        self.assertEqual(third['username'], 'student_three')
        self.assertEqual(third['total_score'], 20.0)
        self.assertEqual(third['rank'], 2)  # Dense ranking next position (2 instead of 3)!

    def test_leaderboard_multi_tenant_isolation(self):
        """Test that leaderboard query is strictly isolated to the active organization."""
        # student_org_b requests Org B leaderboard
        self.client.force_authenticate(user=self.student_org_b)
        response = self.client.get(self.url, HTTP_X_ORGANIZATION_SLUG='org-b')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)

        entry = response.data['results'][0]
        self.assertEqual(entry['username'], 'student_b')
        # Org B total = 50 (game) + 30 (assess) = 80.0
        self.assertEqual(entry['total_score'], 80.0)
        self.assertEqual(entry['rank'], 1)

    def test_leaderboard_access_denied_other_org(self):
        """Test that an Org A member cannot fetch the leaderboard of Org B."""
        self.client.force_authenticate(user=self.student1)
        response = self.client.get(self.url, HTTP_X_ORGANIZATION_SLUG='org-b')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Non-member teacher
        teacher = User.objects.create_user(username='teacher_only_a', password='password')
        teacher_role = Role.objects.create(name='Teacher', organization=self.org_a)
        teacher_role.permissions.add(Permission.objects.get(codename='can_view_dashboard'))
        OrgMember.objects.create(organization=self.org_a, user=teacher, role=teacher_role)
        
        self.client.force_authenticate(user=teacher)
        response2 = self.client.get(self.url, HTTP_X_ORGANIZATION_SLUG='org-b')
        self.assertEqual(response2.status_code, status.HTTP_403_FORBIDDEN)

        # Non-member admin/manager
        manager = User.objects.create_user(username='manager_only_a', password='password')
        manager_role = Role.objects.create(name='Manager', organization=self.org_a)
        manager_role.permissions.add(Permission.objects.get(codename='can_view_dashboard'))
        OrgMember.objects.create(organization=self.org_a, user=manager, role=manager_role)

        self.client.force_authenticate(user=manager)
        response3 = self.client.get(self.url, HTTP_X_ORGANIZATION_SLUG='org-b')
        self.assertEqual(response3.status_code, status.HTTP_403_FORBIDDEN)

    def test_leaderboard_query_optimization(self):
        """Verify that leaderboard score aggregation executes a constant number of database queries (O(1) complexity)."""
        self.client.force_authenticate(user=self.student1)
        
        # Measure base query count
        connection.queries_log.clear()
        self.client.get(self.url, HTTP_X_ORGANIZATION_SLUG='org-a')
        base_query_count = len(connection.queries)
        
        # Add 5 more students
        for i in range(5):
            u = User.objects.create_user(username=f"query_student_{i}", password='password')
            OrgMember.objects.create(organization=self.org_a, user=u, role=self.student_role)
            
        # Measure query count with more students
        connection.queries_log.clear()
        self.client.get(self.url, HTTP_X_ORGANIZATION_SLUG='org-a')
        new_query_count = len(connection.queries)
        
        # Query counts must be identical, proving constant query execution complexity
        self.assertEqual(base_query_count, new_query_count)

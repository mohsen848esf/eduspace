from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from config.asgi import application
from accounts.models import Organization, OrgMember, Role, Permission
from games.models import Game, GameSession, GameParticipant, Question

User = get_user_model()


class GameConsumerTests(TransactionTestCase):
    def setUp(self):
        # Users
        self.superuser = User.objects.create_superuser(username='super', password='password')
        self.teacher = User.objects.create_user(username='teacher', password='password')
        self.student_a = User.objects.create_user(username='student_a', password='password', full_name='Student A')
        self.student_b = User.objects.create_user(username='student_b', password='password', full_name='Student B')

        # Organizations
        self.org_a = Organization.objects.create(name='Org A', slug='org-a', owner=self.superuser)
        self.org_b = Organization.objects.create(name='Org B', slug='org-b', owner=self.superuser)

        # Roles
        view_perm, _ = Permission.objects.get_or_create(codename='can_view_dashboard', defaults={'name': 'View Dashboard'})
        self.student_role_a = Role.objects.create(name='Student', organization=self.org_a)
        self.student_role_a.permissions.add(view_perm)

        self.student_role_b = Role.objects.create(name='Student', organization=self.org_b)
        self.student_role_b.permissions.add(view_perm)

        # Memberships (Teacher is made member of Org A to host)
        OrgMember.objects.create(organization=self.org_a, user=self.teacher, role=self.student_role_a)
        OrgMember.objects.create(organization=self.org_a, user=self.student_a, role=self.student_role_a)
        OrgMember.objects.create(organization=self.org_b, user=self.student_b, role=self.student_role_b)

        # Game & Session
        self.game = Game.objects.create(title='Word Game', game_type=Game.GameType.WORD_GUESS)
        self.question = Question.objects.create(
            game=self.game,
            word='test',
            description='A simple test word',
            hint='T',
            order=0
        )
        self.session_a = GameSession.objects.create(
            game=self.game,
            organization=self.org_a,
            host=self.teacher,
            room_code='ROOMAA'
        )

    async def test_anonymous_connection_rejection(self):
        """Anonymous user connection must be rejected immediately."""
        from django.contrib.auth.models import AnonymousUser
        communicator = WebsocketCommunicator(application, "/ws/game/ROOMAA/")
        communicator.scope['user'] = AnonymousUser()
        
        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()

    async def test_authenticated_connection_success(self):
        """Authenticated organization member can connect successfully."""
        communicator = WebsocketCommunicator(application, "/ws/game/ROOMAA/")
        communicator.scope['user'] = self.student_a
        
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        # Check initial connection payload
        response = await communicator.receive_json_from()
        self.assertEqual(response['type'], 'connected')
        self.assertEqual(response['status'], 'waiting')
        
        await communicator.disconnect()

    async def test_unauthorized_org_connection_rejection(self):
        """User from Org B cannot connect to Org A's session."""
        communicator = WebsocketCommunicator(application, "/ws/game/ROOMAA/")
        communicator.scope['user'] = self.student_b
        
        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()

    async def test_invalid_room_code_rejection(self):
        """Rejects connections to non-existent game sessions."""
        communicator = WebsocketCommunicator(application, "/ws/game/INVALID/")
        communicator.scope['user'] = self.student_a
        
        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()

    async def test_join_and_answer_logic(self):
        """Test user joining the session, starting, answering, and scores updating."""
        # Student A joins
        communicator = WebsocketCommunicator(application, "/ws/game/ROOMAA/")
        communicator.scope['user'] = self.student_a
        await communicator.connect()
        await communicator.receive_json_from()  # Connected message

        # Join action
        await communicator.send_json_to({"action": "join"})
        response = await communicator.receive_json_from()
        self.assertEqual(response['type'], 'player_joined')
        self.assertEqual(response['username'], self.student_a.username)

        # Host (Teacher) connects and starts the game
        host_comm = WebsocketCommunicator(application, "/ws/game/ROOMAA/")
        host_comm.scope['user'] = self.teacher
        await host_comm.connect()
        await host_comm.receive_json_from()  # Connected message

        # Try non-host starting (should fail)
        await communicator.send_json_to({"action": "start"})
        err = await communicator.receive_json_from()
        self.assertEqual(err['type'], 'error')
        self.assertEqual(err['message'], 'Only host can start the game')

        # Host starts the game
        await host_comm.send_json_to({"action": "start"})
        start_res = await host_comm.receive_json_from()
        self.assertEqual(start_res['type'], 'game_started')
        self.assertEqual(start_res['question']['description'], 'A simple test word')

        # Receive game_started message on student connection
        await communicator.receive_json_from()

        # Student answers incorrectly (no score increment, no broadcast)
        await communicator.send_json_to({"action": "answer", "answer": "wrong"})
        await communicator.receive_nothing()

        # Student answers correctly
        await communicator.send_json_to({"action": "answer", "answer": "test"})
        ans_res = await communicator.receive_json_from()
        self.assertEqual(ans_res['type'], 'answer_result')
        self.assertEqual(ans_res['is_correct'], True)
        self.assertEqual(ans_res['score'], 10)

        await communicator.disconnect()
        await host_comm.disconnect()

    async def test_player_left_broadcast_on_disconnect(self):
        """When a user disconnects, remaining users receive a player_left event."""
        # Connect Student A
        student_comm = WebsocketCommunicator(application, "/ws/game/ROOMAA/")
        student_comm.scope['user'] = self.student_a
        await student_comm.connect()
        await student_comm.receive_json_from()  # Connected message

        # Connect Host (Teacher)
        host_comm = WebsocketCommunicator(application, "/ws/game/ROOMAA/")
        host_comm.scope['user'] = self.teacher
        await host_comm.connect()
        await host_comm.receive_json_from()  # Connected message

        # Disconnect Student A
        await student_comm.disconnect()

        # Host should receive player_left broadcast
        broadcast = await host_comm.receive_json_from()
        self.assertEqual(broadcast['type'], 'player_left')
        self.assertEqual(broadcast['username'], self.student_a.username)

        # Cleanup
        await host_comm.disconnect()


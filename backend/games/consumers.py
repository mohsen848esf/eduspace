import json
import random
import string
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from .models import GameSession, GameParticipant, Question, Answer
from accounts.models import User


def generate_room_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


class GameConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.room_code = self.scope['url_route']['kwargs']['room_code']
        self.room_group = f'game_{self.room_code}'
        self.user = self.scope['user']

        if not self.user.is_authenticated:
            await self.close()
            return

        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.accept()

        session = await self.get_session()
        if session:
            participants = await self.get_participants(session)
            await self.send(text_data=json.dumps({
                'type': 'connected',
                'participants': participants,
                'status': session.status,
            }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group, self.channel_name)
        await self.channel_layer.group_send(self.room_group, {
            'type': 'player_left',
            'username': self.user.username,
        })

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get('action')

        handlers = {
            'join': self.handle_join,
            'start': self.handle_start,
            'answer': self.handle_answer,
            'hint': self.handle_hint,
            'next_question': self.handle_next_question,
        }

        handler = handlers.get(action)
        if handler:
            await handler(data)

    async def handle_join(self, data):
        session = await self.get_session()
        if not session or session.status != 'waiting':
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Cannot join this session',
            }))
            return

        await self.add_participant(session)
        participants = await self.get_participants(session)

        await self.channel_layer.group_send(self.room_group, {
            'type': 'player_joined',
            'username': self.user.username,
            'full_name': self.user.full_name,
            'participants': participants,
        })

    async def handle_start(self, data):
        session = await self.get_session()
        if not session:
            return

        is_host = await self.is_host(session)
        if not is_host:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Only host can start the game',
            }))
            return

        question = await self.get_question(session, 0)
        if not question:
            return

        await self.update_session_status(session, 'playing')

        await self.channel_layer.group_send(self.room_group, {
            'type': 'game_started',
            'question': {
                'index': 0,
                'description': question['description'],
                'word_length': question['word_length'],
                'time': session.time_per_question,
            }
        })

    async def handle_answer(self, data):
        answer = data.get('answer', '').strip().upper()
        session = await self.get_session()
        if not session or session.status != 'playing':
            return

        question = await self.get_question(session, session.current_question)
        if not question:
            return

        is_correct = answer == question['word'].upper()
        await self.save_answer(session, question['id'], is_correct)

        if is_correct:
            score = await self.update_score(session)
            await self.channel_layer.group_send(self.room_group, {
                'type': 'answer_result',
                'username': self.user.username,
                'is_correct': True,
                'score': score,
            })

    async def handle_hint(self, data):
        session = await self.get_session()
        participant = await self.get_participant(session)

        if participant['hints_used'] >= session.max_hints:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'No hints remaining',
            }))
            return

        question = await self.get_question(session, session.current_question)
        await self.use_hint(session)

        await self.send(text_data=json.dumps({
            'type': 'hint',
            'hint': question['hint'],
            'hints_remaining': session.max_hints - participant['hints_used'] - 1,
        }))

    async def handle_next_question(self, data):
        session = await self.get_session()
        is_host = await self.is_host(session)

        if not is_host:
            return

        next_index = session.current_question + 1
        question = await self.get_question(session, next_index)

        if not question:
            await self.update_session_status(session, 'finished')
            scores = await self.get_final_scores(session)
            await self.channel_layer.group_send(self.room_group, {
                'type': 'game_finished',
                'scores': scores,
            })
            return

        await self.update_current_question(session, next_index)
        await self.channel_layer.group_send(self.room_group, {
            'type': 'next_question',
            'question': {
                'index': next_index,
                'description': question['description'],
                'word_length': question['word_length'],
                'time': session.time_per_question,
            }
        })

    # --- Event Handlers ---

    async def player_joined(self, event):
        await self.send(text_data=json.dumps(event))

    async def player_left(self, event):
        await self.send(text_data=json.dumps(event))

    async def game_started(self, event):
        await self.send(text_data=json.dumps(event))

    async def answer_result(self, event):
        await self.send(text_data=json.dumps(event))

    async def next_question(self, event):
        await self.send(text_data=json.dumps(event))

    async def game_finished(self, event):
        await self.send(text_data=json.dumps(event))

    # --- DB Helpers ---

    @database_sync_to_async
    def get_session(self):
        try:
            return GameSession.objects.get(room_code=self.room_code)
        except GameSession.DoesNotExist:
            return None

    @database_sync_to_async
    def get_participants(self, session):
        return list(session.participants.values('user__username', 'user__full_name', 'score'))

    @database_sync_to_async
    def add_participant(self, session):
        GameParticipant.objects.get_or_create(session=session, user=self.user)

    @database_sync_to_async
    def is_host(self, session):
        return session.host == self.user

    @database_sync_to_async
    def get_question(self, session, index):
        try:
            q = session.game.questions.all()[index]
            return {
                'id': q.id,
                'word': q.word,
                'word_length': len(q.word),
                'description': q.description,
                'hint': q.hint,
            }
        except IndexError:
            return None

    @database_sync_to_async
    def get_participant(self, session):
        p = GameParticipant.objects.get(session=session, user=self.user)
        return {'hints_used': p.hints_used, 'score': p.score}

    @database_sync_to_async
    def update_session_status(self, session, status):
        session.status = status
        if status == 'playing':
            session.started_at = timezone.now()
        elif status == 'finished':
            session.finished_at = timezone.now()
        session.save()

    @database_sync_to_async
    def update_current_question(self, session, index):
        session.current_question = index
        session.save()

    @database_sync_to_async
    def save_answer(self, session, question_id, is_correct):
        participant = GameParticipant.objects.get(session=session, user=self.user)
        question = Question.objects.get(id=question_id)
        Answer.objects.get_or_create(
            participant=participant,
            question=question,
            defaults={'is_correct': is_correct}
        )

    @database_sync_to_async
    def update_score(self, session):
        participant = GameParticipant.objects.get(session=session, user=self.user)
        participant.score += 10
        participant.save()
        return participant.score

    @database_sync_to_async
    def use_hint(self, session):
        participant = GameParticipant.objects.get(session=session, user=self.user)
        participant.hints_used += 1
        participant.save()

    @database_sync_to_async
    def get_final_scores(self, session):
        return list(session.participants.values(
            'user__username', 'user__full_name', 'score'
        ).order_by('-score'))
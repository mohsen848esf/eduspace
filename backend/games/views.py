import random
import string
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Game, GameSession, GameParticipant


def generate_room_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def game_list(request):
    games = Game.objects.all().values(
        'id', 'title', 'game_type', 'description', 'thumbnail', 'is_free'
    )
    return Response(list(games))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_session(request, game_id):
    try:
        game = Game.objects.get(id=game_id)
    except Game.DoesNotExist:
        return Response({'error': 'Game not found'}, status=status.HTTP_404_NOT_FOUND)

    room_code = generate_room_code()
    while GameSession.objects.filter(room_code=room_code).exists():
        room_code = generate_room_code()

    session = GameSession.objects.create(
        game=game,
        host=request.user,
        room_code=room_code,
        time_per_question=request.data.get('time_per_question', 30),
        max_hints=request.data.get('max_hints', 2),
        is_teacher_mode=request.data.get('is_teacher_mode', False),
    )

    GameParticipant.objects.create(session=session, user=request.user)

    return Response({
        'room_code': session.room_code,
        'game': game.title,
        'is_teacher_mode': session.is_teacher_mode,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_session(request, room_code):
    try:
        session = GameSession.objects.get(room_code=room_code)
    except GameSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    participants = list(session.participants.values(
        'user__username', 'user__full_name', 'score', 'current_question'
    ))

    return Response({
        'room_code': session.room_code,
        'game': session.game.title,
        'status': session.status,
        'current_question': session.current_question,
        'is_teacher_mode': session.is_teacher_mode,
        'host': session.host.username,
        'participants': participants,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_session(request, room_code):
    try:
        session = GameSession.objects.get(room_code=room_code)
    except GameSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    if session.status != 'waiting':
        return Response({'error': 'Game already started'}, status=status.HTTP_400_BAD_REQUEST)

    GameParticipant.objects.get_or_create(session=session, user=request.user)

    return Response({'message': 'Joined successfully', 'room_code': room_code})
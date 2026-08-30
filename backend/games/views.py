import random
import string
from collections import OrderedDict
from django.db import models
from django.db.models import Sum, Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from accounts.permissions import resolve_organization, has_org_permission, require_org_permission
from accounts.models import User, OrgMember
from .models import Game, GameSession, GameParticipant

def generate_room_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def game_list(request):
    games = Game.objects.all().values(
        'id', 'title', 'game_type', 'description', 'thumbnail',
        'is_free', 'is_in_call_only',
    )
    return Response(list(games))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_session(request, game_id):
    try:
        game = Game.objects.get(id=game_id)
    except Game.DoesNotExist:
        return Response({'error': 'Game not found'}, status=status.HTTP_404_NOT_FOUND)

    org = resolve_organization(request)
    if not org:
        return Response({'error': 'Organization context required'}, status=status.HTTP_400_BAD_REQUEST)

    # Check that requesting user belongs to organization
    if not request.user.is_superuser and not has_org_permission(request.user, org, 'can_view_dashboard'):
        return Response({'error': 'Required permission missing: can_view_dashboard'}, status=status.HTTP_403_FORBIDDEN)

    room_code = generate_room_code()
    while GameSession.objects.filter(room_code=room_code).exists():
        room_code = generate_room_code()

    session = GameSession.objects.create(
        game=game,
        organization=org,
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
        session = GameSession.objects.select_related('game', 'host', 'organization').get(room_code=room_code)
    except GameSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    org = session.organization
    # Cross-tenant read protection: return 404 to avoid room code enumeration
    if not org or (not request.user.is_superuser and not has_org_permission(request.user, org, 'can_view_dashboard')):
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
        session = GameSession.objects.select_related('organization').get(room_code=room_code)
    except GameSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    org = session.organization
    # Cross-tenant join protection: return 404 to avoid room code enumeration
    if not org or (not request.user.is_superuser and not has_org_permission(request.user, org, 'can_view_dashboard')):
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    if session.status != 'waiting':
        return Response({'error': 'Game already started'}, status=status.HTTP_400_BAD_REQUEST)

    GameParticipant.objects.get_or_create(session=session, user=request.user)

    return Response({'message': 'Joined successfully', 'room_code': room_code})


class LeaderboardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_org_permission('can_view_dashboard')
def leaderboard(request):
    from assessments.models import Submission
    
    org = request.organization

    # Fetch active students in the organization
    students = User.objects.filter(
        Q(org_memberships__organization=org, org_memberships__is_active=True, org_memberships__role__name__iexact='Student') |
        Q(enrollments__academy_class__course__organization=org, enrollments__is_active=True)
    ).distinct()

    # CONSTANT QUERY AGGREGATION (Part 5 - O(1) database aggregation count)
    # Query 1: sum score from GameParticipant grouped by user_id
    game_points_query = GameParticipant.objects.filter(
        session__organization=org
    ).values('user_id').annotate(total=Sum('score'))
    game_scores = {x['user_id']: x['total'] for x in game_points_query}

    # Query 2: sum score from Submission for graded assessments in this org grouped by student_id
    assessment_points_query = Submission.objects.filter(
        assessment__organization=org,
        status='graded'
    ).values('student_id').annotate(total=Sum('score'))
    assessment_scores = {x['student_id']: x['total'] for x in assessment_points_query}

    leaderboard_data = []
    for student in students:
        gp = game_scores.get(student.id, 0)
        ap = float(assessment_scores.get(student.id, 0.0))
        total_score = float(gp) + ap

        leaderboard_data.append({
            'username': student.username,
            'full_name': student.full_name or student.username,
            'game_points': gp,
            'assessment_points': ap,
            'total_score': total_score,
        })

    # Sort descending by total score, then alphabetically by username
    leaderboard_data.sort(key=lambda x: (-x['total_score'], x['username']))

    # True dense ranking (Part 7 - Dense ranking ties, e.g. 1, 1, 2, 3)
    ranked_data = []
    rank = 0
    prev_score = None
    for entry in leaderboard_data:
        if prev_score is None or entry['total_score'] < prev_score:
            rank += 1
            prev_score = entry['total_score']
        entry['rank'] = rank
        ranked_data.append(entry)

    # Leaderboard pagination (Part 8)
    paginator = LeaderboardPagination()
    page = paginator.paginate_queryset(ranked_data, request)
    if page is not None:
        return paginator.get_paginated_response(page)
    return Response(ranked_data)
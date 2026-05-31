import asyncio
import random
import string

from django.conf import settings
from django.utils import timezone
from livekit import api
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Room, RoomParticipant


def generate_room_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def generate_livekit_token(room_code: str, user, is_host: bool) -> str:
    """
    Mint a short-lived LiveKit room token for `user`.

    Identity is the username (unique) so that re-joining the same room
    cleanly replaces the stale session instead of creating a duplicate.
    """
    token = api.AccessToken(
        api_key=settings.LIVEKIT_API_KEY,
        api_secret=settings.LIVEKIT_API_SECRET,
    )
    token.with_identity(user.username)
    token.with_name(user.full_name or user.username)
    token.with_grants(api.VideoGrants(
        room_join=True,
        room=room_code,
        can_publish=True,
        can_subscribe=True,
        can_publish_data=True,
        room_admin=is_host,
    ))
    return token.to_jwt()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_room(request):
    room_code = generate_room_code()
    while Room.objects.filter(room_code=room_code).exists():
        room_code = generate_room_code()

    name = request.data.get('name', '').strip()

    room = Room.objects.create(
        name=name,
        room_code=room_code,
        host=request.user,
        max_participants=request.data.get('max_participants', 20),
        is_recorded=request.data.get('is_recorded', False),
    )

    RoomParticipant.objects.create(
        room=room,
        user=request.user,
        role=RoomParticipant.Role.HOST,
    )

    token = generate_livekit_token(room_code, request.user, is_host=True)

    return Response({
        'room_code': room.room_code,
        'name': room.name,
        'token': token,
        'livekit_url': settings.LIVEKIT_WS_URL,
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_room(request, room_code):
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if room.status == Room.Status.ENDED:
        return Response({'error': 'Room has ended'}, status=status.HTTP_400_BAD_REQUEST)

    active_count = room.participants.filter(is_active=True).count()
    if active_count >= room.max_participants:
        return Response({'error': 'Room is full'}, status=status.HTTP_400_BAD_REQUEST)

    participant, created = RoomParticipant.objects.get_or_create(
        room=room,
        user=request.user,
        defaults={'role': RoomParticipant.Role.PARTICIPANT},
    )

    if not created:
        participant.is_active = True
        participant.left_at = None
        participant.save()

    is_host = room.host == request.user
    token = generate_livekit_token(room_code, request.user, is_host=is_host)

    return Response({
        'room_code': room.room_code,
        'name': room.name,
        'token': token,
        'livekit_url': settings.LIVEKIT_WS_URL,
        'is_host': is_host,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def leave_room(request, room_code):
    try:
        participant = RoomParticipant.objects.get(
            room__room_code=room_code,
            user=request.user,
        )
    except RoomParticipant.DoesNotExist:
        return Response({'error': 'Not in room'}, status=status.HTTP_404_NOT_FOUND)

    participant.is_active = False
    participant.left_at = timezone.now()
    participant.save()

    room = participant.room
    if room.host == request.user:
        room.status = Room.Status.ENDED
        room.ended_at = timezone.now()
        room.save()
        RoomParticipant.objects.filter(room=room).update(is_active=False)

    return Response({'message': 'Left room successfully'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_room(request, room_code):
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    participants = room.participants.filter(is_active=True).values(
        'user__username', 'user__full_name', 'role'
    )

    return Response({
        'room_code': room.room_code,
        'name': room.name,
        'status': room.status,
        'host': room.host.username,
        'participants': list(participants),
        'max_participants': room.max_participants,
        'is_recorded': room.is_recorded,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def room_participants_history(request, room_code):
    """
    Return everyone who ever joined this room (active or left), so the
    host can target them when publishing a recording. Host-only.
    """
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if room.host_id != request.user.id and not request.user.is_superuser:
        return Response(
            {'error': 'Only the host can view the full participant history'},
            status=status.HTTP_403_FORBIDDEN,
        )

    rows = (
        room.participants
        .select_related('user')
        .order_by('joined_at')
    )
    seen = set()
    items = []
    for row in rows:
        if row.user_id == room.host_id:
            continue  # host is implicit
        if row.user_id in seen:
            continue
        seen.add(row.user_id)
        items.append({
            'id': row.user_id,
            'username': row.user.username,
            'full_name': row.user.full_name or row.user.username,
            'is_active': row.is_active,
            'joined_at': row.joined_at.isoformat(),
            'left_at': row.left_at.isoformat() if row.left_at else None,
        })
    return Response({'count': len(items), 'results': items})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invite_to_room(request, room_code):
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if room.host != request.user:
        return Response({'error': 'Only host can invite'}, status=status.HTTP_403_FORBIDDEN)

    user_id = request.data.get('user_id')
    try:
        from accounts.models import User
        invited_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    # Persist + push the notification through the user's
    # notifications channel group. record_and_dispatch handles the WS
    # group_send and writes a Notification row so a user who logs in
    # later still sees the invite in their inbox.
    from accounts.notifications import record_and_dispatch
    try:
        record_and_dispatch(
            invited_user.id,
            'ROOM_INVITE',
            {
                'type': 'ROOM_INVITE',
                'room_code': room_code,
                'room_name': room.name or room_code,
                'from': request.user.full_name or request.user.username,
                'invite_link': f'/room/{room_code}',
            },
        )
    except Exception:
        # Notification delivery is best-effort: don't fail the invite API.
        import traceback
        traceback.print_exc()

    return Response({
        'message': f'Invited {invited_user.username}',
        'invite_link': f'/room/{room_code}',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def kick_participant(request, room_code):
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if room.host != request.user:
        return Response({'error': 'Only host can kick'}, status=status.HTTP_403_FORBIDDEN)

    identity = request.data.get('identity')
    if not identity:
        return Response({'error': 'Identity required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        from livekit import api as lk_api

        async def remove():
            lk = lk_api.LiveKitAPI(
                url=settings.LIVEKIT_HOST_URL,
                api_key=settings.LIVEKIT_API_KEY,
                api_secret=settings.LIVEKIT_API_SECRET,
            )
            await lk.room.remove_participant(
                lk_api.RoomParticipantIdentity(
                    room=room_code,
                    identity=identity,
                )
            )
            await lk.aclose()

        asyncio.run(remove())
        return Response({'message': f'Kicked {identity}'})

    except Exception as e:
        import traceback
        print('KICK ERROR:', traceback.format_exc())
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def grant_screen_share(request, room_code):
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if room.host != request.user:
        return Response({'error': 'Only host can grant permissions'}, status=status.HTTP_403_FORBIDDEN)

    identity = request.data.get('identity')
    if not identity:
        return Response({'error': 'Identity required'}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'message': f'Permission granted to {identity}'})

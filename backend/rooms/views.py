import asyncio
import json
import random
import secrets
import string

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone
from livekit import api
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Room, RoomParticipant, LobbyRequest, PresentationDocument


def generate_room_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def generate_livekit_token(
    room_code: str,
    user=None,
    is_host: bool = False,
    is_co_host: bool = False,
    guest_identity: str = None,
    guest_name: str = None
) -> str:
    """
    Mint a short-lived LiveKit room token for `user` or guest.

    For authenticated users, identity is the username (unique).
    For guest users, identity is guest_identity (unique prefix).
    """
    token = api.AccessToken(
        api_key=settings.LIVEKIT_API_KEY,
        api_secret=settings.LIVEKIT_API_SECRET,
    )
    if user and user.is_authenticated:
        token.with_identity(user.username)
        token.with_name(user.full_name or user.username)
    else:
        ident = guest_identity or f"guest_{secrets.token_hex(6)}"
        name = (guest_name or "Guest").strip()
        token.with_identity(ident)
        token.with_name(name)

    token.with_metadata(json.dumps({
        'is_host': bool(is_host),
        'is_co_host': bool(is_co_host),
    }))

    token.with_grants(api.VideoGrants(
        room_join=True,
        room=room_code,
        can_publish=True,
        can_subscribe=True,
        can_publish_data=True,
        room_admin=(is_host or is_co_host) if (user and user.is_authenticated) else False,
    ))
    return token.to_jwt()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_room(request):
    from accounts.permissions import resolve_organization, has_org_permission
    from accounts.models import Session
    from accounts.services.session_service import SessionService
    from django.core.exceptions import ValidationError

    session_id = request.data.get('session_id')
    if session_id:
        try:
            session = Session.objects.get(pk=session_id)
        except Session.DoesNotExist:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        org = resolve_organization(request)
        if not org or org != session.get_organization():
            return Response({'error': 'Organization context mismatch or required'}, status=status.HTTP_400_BAD_REQUEST)

        if not has_org_permission(request.user, org, 'can_manage_sessions'):
            return Response({'error': 'Permission denied to manage sessions in this organization'}, status=status.HTTP_403_FORBIDDEN)

        try:
            session = SessionService.start_session(session_id, actor=request.user)
        except ValidationError as e:
            return Response({'error': e.message_dict if hasattr(e, 'message_dict') else e.messages}, status=status.HTTP_400_BAD_REQUEST)

        room = session.active_room
        token = generate_livekit_token(room.room_code, request.user, is_host=True)
        return Response({
            'room_code': room.room_code,
            'name': room.name,
            'token': token,
            'livekit_url': settings.LIVEKIT_WS_URL,
            'session_id': session.id
        }, status=status.HTTP_201_CREATED)

    else:
        org = resolve_organization(request)
        room_code = generate_room_code()
        while Room.objects.filter(room_code=room_code).exists():
            room_code = generate_room_code()

        name = request.data.get('name', '').strip()

        # Quotas based on subscription tier
        max_parts = 25
        duration_limit = 60
        is_duration_limited = True

        if org and hasattr(org, 'subscription') and org.subscription and org.subscription.plan:
            plan = org.subscription.plan
            max_parts = plan.max_meeting_participants or 100
            duration_limit = plan.max_group_duration_minutes
            is_duration_limited = bool(duration_limit and 0 < duration_limit < 1440)

        requested_max = request.data.get('max_participants')
        if requested_max:
            try:
                requested_max = int(requested_max)
                if requested_max > 0:
                    max_parts = min(requested_max, max_parts)
            except (ValueError, TypeError):
                pass

        room = Room.objects.create(
            name=name,
            room_code=room_code,
            host=request.user,
            organization=org,
            meeting_type='ad_hoc',
            is_recorded=request.data.get('is_recorded', False),
            max_participants=max_parts,
            duration_limit_minutes=duration_limit,
            is_duration_limited=is_duration_limited,
            mute_mic_on_join=bool(request.data.get('mute_mic_on_join', False)),
            mute_cam_on_join=bool(request.data.get('mute_cam_on_join', False)),
            lock_screen_share=bool(request.data.get('lock_screen_share', False)),
            lock_microphone=bool(request.data.get('lock_microphone', False)),
            lock_camera=bool(request.data.get('lock_camera', False)),
            lock_document_presentation=bool(request.data.get('lock_document_presentation', True)),
            started_at=timezone.now(),
        )

        RoomParticipant.objects.create(
            room=room,
            user=request.user,
            role=RoomParticipant.Role.HOST,
            can_upload_presentation=True,
        )

        token = generate_livekit_token(room_code, request.user, is_host=True)

        return Response({
            'room_code': room.room_code,
            'name': room.name,
            'token': token,
            'livekit_url': settings.LIVEKIT_WS_URL,
            'max_participants': room.max_participants,
            'duration_limit_minutes': room.duration_limit_minutes,
            'is_duration_limited': room.is_duration_limited,
            'mute_mic_on_join': room.mute_mic_on_join,
            'mute_cam_on_join': room.mute_cam_on_join,
            'lock_screen_share': room.lock_screen_share,
            'lock_microphone': room.lock_microphone,
            'lock_camera': room.lock_camera,
            'lock_document_presentation': room.lock_document_presentation,
        }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_room(request, room_code):
    """
    Authenticated join. If the room has require_approval=True and the caller
    is not the host, a LobbyRequest is created and 202 is returned.
    The client polls /lobby/status/{request_id}/ until admitted or denied.
    """
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    # If room was marked ended, allow the host of an instant/standalone room to reopen it on rejoin
    if room.status == Room.Status.ENDED:
        if room.host == request.user and not room.session_id:
            room.status = Room.Status.ACTIVE
            room.ended_at = None
            room.save()
        else:
            return Response({'error': 'Room has ended'}, status=status.HTTP_410_GONE)

    # Room is completely locked — no new joins.
    if room.is_locked:
        return Response(
            {'error': 'Room is locked', 'code': 'ROOM_LOCKED'},
            status=status.HTTP_423_LOCKED,
        )

    active_count = room.participants.filter(is_active=True).count()
    if active_count >= room.max_participants:
        return Response(
            {
                'error': f'ظرفیت اتاق تکمیل شده است (حداکثر {room.max_participants} نفر).',
                'code': 'ROOM_FULL',
                'max_participants': room.max_participants,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    is_host = room.host == request.user
    is_co_host = room.co_hosts.filter(pk=request.user.pk).exists()

    # Host and Co-Hosts always bypass the lobby.
    if not (is_host or is_co_host) and room.require_approval:
        # Check if there's already a pending/admitted request for this user.
        existing = LobbyRequest.objects.filter(
            room=room,
            user=request.user,
            status__in=[LobbyRequest.Status.PENDING, LobbyRequest.Status.ADMITTED],
        ).first()
        if not existing:
            display_name = request.user.full_name or request.user.username
            existing = LobbyRequest.objects.create(
                room=room,
                user=request.user,
                display_name=display_name,
                is_guest=False,
                status=LobbyRequest.Status.PENDING,
            )
        return Response(
            {
                'waiting': True,
                'request_id': existing.id,
                'room_code': room.room_code,
                'name': room.name,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    target_role = (
        RoomParticipant.Role.HOST
        if is_host
        else (RoomParticipant.Role.CO_HOST if is_co_host else RoomParticipant.Role.PARTICIPANT)
    )
    participant, created = RoomParticipant.objects.get_or_create(
        room=room,
        user=request.user,
        defaults={'role': target_role, 'can_upload_presentation': (is_host or is_co_host)},
    )

    if not created:
        participant.is_active = True
        participant.left_at = None
        participant.role = target_role
        if is_host or is_co_host:
            participant.can_upload_presentation = True
        participant.save()

    token = generate_livekit_token(
        room_code,
        request.user,
        is_host=is_host,
        is_co_host=is_co_host,
    )

    return Response({
        'room_code': room.room_code,
        'name': room.name,
        'token': token,
        'livekit_url': settings.LIVEKIT_WS_URL,
        'is_host': is_host,
        'is_co_host': is_co_host,
        'is_guest': False,
        'max_participants': room.max_participants,
        'duration_limit_minutes': room.duration_limit_minutes,
        'is_duration_limited': room.is_duration_limited,
        'mute_mic_on_join': room.mute_mic_on_join,
        'mute_cam_on_join': room.mute_cam_on_join,
        'lock_screen_share': room.lock_screen_share,
        'lock_microphone': room.lock_microphone,
        'lock_camera': room.lock_camera,
        'lock_document_presentation': room.lock_document_presentation,
        'can_share_screen': participant.can_share_screen,
        'can_use_camera': participant.can_use_camera,
        'can_use_microphone': participant.can_use_microphone,
        'can_upload_presentation': participant.can_upload_presentation,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def guest_join_room(request, room_code):
    """
    Allow unauthenticated guests to join an active room by specifying
    a display name. If the room has require_approval=True, a LobbyRequest
    is created and 202 is returned; the client polls for the result.
    """
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if room.status == Room.Status.ENDED:
        return Response({'error': 'Room has ended'}, status=status.HTTP_410_GONE)

    if room.is_locked:
        return Response(
            {'error': 'Room is locked', 'code': 'ROOM_LOCKED'},
            status=status.HTTP_423_LOCKED,
        )

    active_count = room.participants.filter(is_active=True).count()
    if active_count >= room.max_participants:
        return Response(
            {
                'error': f'ظرفیت اتاق تکمیل شده است (حداکثر {room.max_participants} نفر).',
                'code': 'ROOM_FULL',
                'max_participants': room.max_participants,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    display_name = str(request.data.get('display_name', '')).strip()
    if not display_name or len(display_name) < 2:
        return Response(
            {'error': 'Display name must be at least 2 characters'},
            status=status.HTTP_400_BAD_REQUEST
        )
    if len(display_name) > 60:
        return Response(
            {'error': 'Display name cannot exceed 60 characters'},
            status=status.HTTP_400_BAD_REQUEST
        )

    guest_identity = f"guest_{secrets.token_hex(6)}"

    # If approval required, create a lobby request and wait.
    if room.require_approval:
        lobby_req = LobbyRequest.objects.create(
            room=room,
            user=None,
            guest_identity=guest_identity,
            guest_name=display_name,
            display_name=display_name,
            is_guest=True,
            status=LobbyRequest.Status.PENDING,
        )
        return Response(
            {
                'waiting': True,
                'request_id': lobby_req.id,
                'guest_identity': guest_identity,
                'room_code': room.room_code,
                'name': room.name,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    participant = RoomParticipant.objects.create(
        room=room,
        user=None,
        guest_name=display_name,
        guest_identity=guest_identity,
        is_guest=True,
        role=RoomParticipant.Role.GUEST,
        is_active=True,
        can_upload_presentation=False,
    )

    token = generate_livekit_token(
        room_code,
        user=None,
        is_host=False,
        guest_identity=guest_identity,
        guest_name=display_name,
    )

    return Response({
        'room_code': room.room_code,
        'name': room.name,
        'token': token,
        'livekit_url': settings.LIVEKIT_WS_URL,
        'is_host': False,
        'is_co_host': False,
        'is_guest': True,
        'guest_identity': guest_identity,
        'max_participants': room.max_participants,
        'duration_limit_minutes': room.duration_limit_minutes,
        'is_duration_limited': room.is_duration_limited,
        'mute_mic_on_join': room.mute_mic_on_join,
        'mute_cam_on_join': room.mute_cam_on_join,
        'lock_screen_share': room.lock_screen_share,
        'lock_microphone': room.lock_microphone,
        'lock_camera': room.lock_camera,
        'lock_document_presentation': room.lock_document_presentation,
        'can_share_screen': participant.can_share_screen,
        'can_use_camera': participant.can_use_camera,
        'can_use_microphone': participant.can_use_microphone,
        'can_upload_presentation': participant.can_upload_presentation,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def leave_room(request, room_code):
    guest_identity = request.data.get('guest_identity')

    if request.user and request.user.is_authenticated:
        try:
            participant = RoomParticipant.objects.get(
                room__room_code=room_code,
                user=request.user,
            )
        except RoomParticipant.DoesNotExist:
            return Response({'error': 'Not in room'}, status=status.HTTP_404_NOT_FOUND)
    elif guest_identity:
        try:
            participant = RoomParticipant.objects.get(
                room__room_code=room_code,
                guest_identity=guest_identity,
            )
        except RoomParticipant.DoesNotExist:
            return Response({'error': 'Not in room'}, status=status.HTTP_404_NOT_FOUND)
    else:
        return Response(
            {'error': 'Authentication or guest_identity required'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    participant.is_active = False
    participant.left_at = timezone.now()
    participant.save()

    room = participant.room
    # Only automatically terminate scheduled course sessions with a session_id on host leave.
    # Standalone/instant rooms remain open and reusable (Google Meet style).
    if request.user and request.user.is_authenticated and room.host == request.user and room.session_id:
        room.status = Room.Status.ENDED
        room.ended_at = timezone.now()
        room.save()
        RoomParticipant.objects.filter(room=room).update(is_active=False, left_at=timezone.now())

        from accounts.services.session_service import SessionService
        try:
            SessionService.complete_session(room.session_id, actor=request.user)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to complete session {room.session_id} on room leave: {e}", exc_info=True)

    return Response({'message': 'Left room successfully'})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_room(request, room_code):
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    participants_qs = room.participants.filter(is_active=True).select_related('user')
    participants = []
    for p in participants_qs:
        if p.is_guest:
            participants.append({
                'user__username': p.guest_identity,
                'user__full_name': p.guest_name,
                'role': 'guest',
                'is_guest': True,
                'can_share_screen': p.can_share_screen,
                'can_use_camera': p.can_use_camera,
                'can_use_microphone': p.can_use_microphone,
                'can_upload_presentation': p.can_upload_presentation,
            })
        elif p.user:
            participants.append({
                'user__username': p.user.username,
                'user__full_name': p.user.full_name or p.user.username,
                'role': p.role,
                'is_guest': False,
                'can_share_screen': p.can_share_screen,
                'can_use_camera': p.can_use_camera,
                'can_use_microphone': p.can_use_microphone,
                'can_upload_presentation': p.can_upload_presentation,
            })

    return Response({
        'room_code': room.room_code,
        'name': room.name,
        'status': room.status,
        'host': room.host.username if room.host else 'Host',
        'co_hosts': list(room.co_hosts.values_list('username', flat=True)),
        'participants': participants,
        'max_participants': room.max_participants,
        'duration_limit_minutes': room.duration_limit_minutes,
        'is_duration_limited': room.is_duration_limited,
        'started_at': room.started_at.isoformat() if room.started_at else (room.created_at.isoformat() if room.created_at else None),
        'is_recorded': room.is_recorded,
        'require_approval': room.require_approval,
        'is_locked': room.is_locked,
        'mute_mic_on_join': room.mute_mic_on_join,
        'mute_cam_on_join': room.mute_cam_on_join,
        'lock_screen_share': room.lock_screen_share,
        'lock_microphone': room.lock_microphone,
        'lock_camera': room.lock_camera,
        'lock_document_presentation': room.lock_document_presentation,
        'active_presentation': (
            {
                'id': room.presentations.filter(is_active_on_stage=True).first().id,
                'title': room.presentations.filter(is_active_on_stage=True).first().title,
                'file_url': request.build_absolute_uri(room.presentations.filter(is_active_on_stage=True).first().file.url) if room.presentations.filter(is_active_on_stage=True).first().file else '',
                'file_type': room.presentations.filter(is_active_on_stage=True).first().file_type,
                'file_size_bytes': room.presentations.filter(is_active_on_stage=True).first().file_size_bytes,
                'total_pages': room.presentations.filter(is_active_on_stage=True).first().total_pages,
                'current_page': room.presentations.filter(is_active_on_stage=True).first().current_page,
                'uploader_name': room.presentations.filter(is_active_on_stage=True).first().uploader_name,
                'is_active_on_stage': True,
                'created_at': room.presentations.filter(is_active_on_stage=True).first().created_at.isoformat(),
            }
            if room.presentations.filter(is_active_on_stage=True).exists()
            else None
        ),
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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def raise_hand(request, room_code):
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    raised = request.data.get('raised')
    if raised is None:
        return Response({'error': 'raised (boolean) is required'}, status=status.HTTP_400_BAD_REQUEST)

    identity = request.data.get('identity')
    
    # If a host wants to lower another user's hand:
    if identity and identity != request.user.username:
        if room.host != request.user:
            return Response({'error': 'Only host can change other participants hand raise state'}, status=status.HTTP_403_FORBIDDEN)
        target_identity = identity
    else:
        target_identity = request.user.username

    try:
        from livekit import api as lk_api
        import json

        async def update_meta():
            lk = lk_api.LiveKitAPI(
                url=settings.LIVEKIT_HOST_URL,
                api_key=settings.LIVEKIT_API_KEY,
                api_secret=settings.LIVEKIT_API_SECRET,
            )
            # Fetch the participant from list to retrieve current metadata
            res = await lk.room.list_participants(
                lk_api.ListParticipantsRequest(room=room_code)
            )
            participant = next((p for p in res.participants if p.identity == target_identity), None)
            
            meta = {}
            if participant and participant.metadata:
                try:
                    meta = json.loads(participant.metadata)
                except Exception:
                    pass
            
            meta['handRaised'] = raised
            meta['handRaisedAt'] = int(timezone.now().timestamp() * 1000) if raised else 0

            await lk.room.update_participant(
                lk_api.UpdateParticipantRequest(
                    room=room_code,
                    identity=target_identity,
                    metadata=json.dumps(meta)
                )
            )
            await lk.aclose()

        asyncio.run(update_meta())
        return Response({'message': f'Hand raise state updated for {target_identity}', 'raised': raised})

    except Exception as e:
        import traceback
        print('HAND RAISE ERROR:', traceback.format_exc())
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def lower_all_hands(request, room_code):
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if room.host != request.user:
        return Response({'error': 'Only host can lower all hands'}, status=status.HTTP_403_FORBIDDEN)

    try:
        from livekit import api as lk_api
        import json

        async def lower_all():
            lk = lk_api.LiveKitAPI(
                url=settings.LIVEKIT_HOST_URL,
                api_key=settings.LIVEKIT_API_KEY,
                api_secret=settings.LIVEKIT_API_SECRET,
            )
            res = await lk.room.list_participants(
                lk_api.ListParticipantsRequest(room=room_code)
            )
            for p in res.participants:
                meta = {}
                if p.metadata:
                    try:
                        meta = json.loads(p.metadata)
                    except Exception:
                        pass
                
                if meta.get('handRaised'):
                    meta['handRaised'] = False
                    meta['handRaisedAt'] = 0
                    await lk.room.update_participant(
                        lk_api.UpdateParticipantRequest(
                            room=room_code,
                            identity=p.identity,
                            metadata=json.dumps(meta)
                        )
                    )
            await lk.aclose()

        asyncio.run(lower_all())
        return Response({'message': 'All hands lowered successfully'})

    except Exception as e:
        import traceback
        print('LOWER ALL HANDS ERROR:', traceback.format_exc())
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ---------------------------------------------------------------------------
# Lobby / Admit System
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def lobby_list(request, room_code):
    """
    Returns pending lobby requests for the room. Host-only.
    Also expires stale requests so the host sees a clean list.
    """
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if not room.can_manage_room(request.user):
        return Response({'error': 'Only host or co-host can view lobby'}, status=status.HTTP_403_FORBIDDEN)

    # Expire stale pending requests.
    from datetime import timedelta
    cutoff = timezone.now() - timedelta(minutes=LobbyRequest.EXPIRE_MINUTES)
    LobbyRequest.objects.filter(
        room=room,
        status=LobbyRequest.Status.PENDING,
        created_at__lt=cutoff,
    ).update(status=LobbyRequest.Status.EXPIRED)

    pending = LobbyRequest.objects.filter(
        room=room,
        status=LobbyRequest.Status.PENDING,
    ).select_related('user')

    results = []
    for req in pending:
        results.append({
            'id': req.id,
            'display_name': req.display_name,
            'is_guest': req.is_guest,
            'waiting_since': req.created_at.isoformat(),
        })

    return Response({'count': len(results), 'requests': results})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def lobby_admit(request, room_code, request_id):
    """Admit a single lobby request. Host or Co-Host."""
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if not room.can_manage_room(request.user):
        return Response({'error': 'Only host or co-host can admit'}, status=status.HTTP_403_FORBIDDEN)

    try:
        lobby_req = LobbyRequest.objects.get(id=request_id, room=room)
    except LobbyRequest.DoesNotExist:
        return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)

    if lobby_req.status != LobbyRequest.Status.PENDING:
        return Response({'error': f'Request is already {lobby_req.status}'}, status=status.HTTP_400_BAD_REQUEST)

    # Mint the token and store it so the polling endpoint can return it.
    if lobby_req.is_guest:
        token = generate_livekit_token(
            room_code,
            user=None,
            is_host=False,
            guest_identity=lobby_req.guest_identity,
            guest_name=lobby_req.guest_name,
        )
        # Create participant record now that they're admitted.
        RoomParticipant.objects.get_or_create(
            room=room,
            guest_identity=lobby_req.guest_identity,
            defaults={
                'user': None,
                'guest_name': lobby_req.guest_name,
                'is_guest': True,
                'role': RoomParticipant.Role.GUEST,
                'is_active': True,
            },
        )
    else:
        token = generate_livekit_token(room_code, lobby_req.user, is_host=False)
        RoomParticipant.objects.get_or_create(
            room=room,
            user=lobby_req.user,
            defaults={'role': RoomParticipant.Role.PARTICIPANT, 'is_active': True},
        )

    lobby_req.status = LobbyRequest.Status.ADMITTED
    lobby_req.livekit_token = token
    lobby_req.responded_at = timezone.now()
    lobby_req.save()

    return Response({'message': f'Admitted {lobby_req.display_name}'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def lobby_deny(request, room_code, request_id):
    """Deny a single lobby request. Host or Co-Host."""
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if not room.can_manage_room(request.user):
        return Response({'error': 'Only host or co-host can deny'}, status=status.HTTP_403_FORBIDDEN)

    try:
        lobby_req = LobbyRequest.objects.get(id=request_id, room=room)
    except LobbyRequest.DoesNotExist:
        return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)

    if lobby_req.status != LobbyRequest.Status.PENDING:
        return Response({'error': f'Request is already {lobby_req.status}'}, status=status.HTTP_400_BAD_REQUEST)

    lobby_req.status = LobbyRequest.Status.DENIED
    lobby_req.responded_at = timezone.now()
    lobby_req.save()

    return Response({'message': f'Denied {lobby_req.display_name}'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def lobby_admit_all(request, room_code):
    """Admit all pending lobby requests at once. Host or Co-Host."""
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if not room.can_manage_room(request.user):
        return Response({'error': 'Only host or co-host can admit all'}, status=status.HTTP_403_FORBIDDEN)

    pending = LobbyRequest.objects.filter(room=room, status=LobbyRequest.Status.PENDING)
    count = 0
    for lobby_req in pending:
        if lobby_req.is_guest:
            token = generate_livekit_token(
                room_code,
                user=None,
                is_host=False,
                guest_identity=lobby_req.guest_identity,
                guest_name=lobby_req.guest_name,
            )
            RoomParticipant.objects.get_or_create(
                room=room,
                guest_identity=lobby_req.guest_identity,
                defaults={
                    'user': None,
                    'guest_name': lobby_req.guest_name,
                    'is_guest': True,
                    'role': RoomParticipant.Role.GUEST,
                    'is_active': True,
                },
            )
        else:
            token = generate_livekit_token(room_code, lobby_req.user, is_host=False)
            RoomParticipant.objects.get_or_create(
                room=room,
                user=lobby_req.user,
                defaults={'role': RoomParticipant.Role.PARTICIPANT, 'is_active': True},
            )

        lobby_req.status = LobbyRequest.Status.ADMITTED
        lobby_req.livekit_token = token
        lobby_req.responded_at = timezone.now()
        lobby_req.save()
        count += 1

    return Response({'message': f'Admitted {count} participants'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def lobby_deny_all(request, room_code):
    """Deny all pending lobby requests at once. Host or Co-Host."""
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if not room.can_manage_room(request.user):
        return Response({'error': 'Only host or co-host can deny all'}, status=status.HTTP_403_FORBIDDEN)

    count = LobbyRequest.objects.filter(
        room=room,
        status=LobbyRequest.Status.PENDING,
    ).update(
        status=LobbyRequest.Status.DENIED,
        responded_at=timezone.now(),
    )

    return Response({'message': f'Denied {count} participants'})


@api_view(['GET'])
@permission_classes([AllowAny])
def lobby_status(request, room_code, request_id):
    """
    Polling endpoint for a waiting participant.
    Returns the current status of their lobby request.
    When admitted, includes the LiveKit token so they can connect.
    No authentication required (guests are unauthenticated).
    """
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    # Check if the room ended while they were waiting.
    if room.status == Room.Status.ENDED:
        return Response({'status': 'room_ended'}, status=status.HTTP_200_OK)

    try:
        lobby_req = LobbyRequest.objects.get(id=request_id, room=room)
    except LobbyRequest.DoesNotExist:
        return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)

    # Auto-expire if too old.
    if lobby_req.is_expired:
        lobby_req.status = LobbyRequest.Status.EXPIRED
        lobby_req.save()

    response_data = {
        'status': lobby_req.status,
        'room_code': room.room_code,
        'name': room.name,
    }

    if lobby_req.status == LobbyRequest.Status.ADMITTED:
        response_data['token'] = lobby_req.livekit_token
        response_data['livekit_url'] = settings.LIVEKIT_WS_URL
        response_data['is_guest'] = lobby_req.is_guest
        if lobby_req.is_guest:
            response_data['guest_identity'] = lobby_req.guest_identity

    return Response(response_data)


# ---------------------------------------------------------------------------
# Room Access Settings
# ---------------------------------------------------------------------------

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def room_settings(request, room_code):
    """
    Allows host or co-hosts to toggle access control settings:
      - require_approval: bool
      - is_locked: bool
    """
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if not room.can_manage_room(request.user):
        return Response({'error': 'Only host or co-hosts can change room settings'}, status=status.HTTP_403_FORBIDDEN)

    updated = []
    if 'require_approval' in request.data:
        room.require_approval = bool(request.data['require_approval'])
        updated.append('require_approval')
    if 'is_locked' in request.data:
        room.is_locked = bool(request.data['is_locked'])
        updated.append('is_locked')
    if 'mute_mic_on_join' in request.data:
        room.mute_mic_on_join = bool(request.data['mute_mic_on_join'])
        updated.append('mute_mic_on_join')
    if 'mute_cam_on_join' in request.data:
        room.mute_cam_on_join = bool(request.data['mute_cam_on_join'])
        updated.append('mute_cam_on_join')
    if 'lock_screen_share' in request.data:
        room.lock_screen_share = bool(request.data['lock_screen_share'])
        updated.append('lock_screen_share')
    if 'lock_microphone' in request.data:
        room.lock_microphone = bool(request.data['lock_microphone'])
        updated.append('lock_microphone')
    if 'lock_camera' in request.data:
        room.lock_camera = bool(request.data['lock_camera'])
        updated.append('lock_camera')
    if 'lock_document_presentation' in request.data:
        room.lock_document_presentation = bool(request.data['lock_document_presentation'])
        updated.append('lock_document_presentation')

    if updated:
        room.save(update_fields=updated)

    return Response({
        'room_code': room.room_code,
        'require_approval': room.require_approval,
        'is_locked': room.is_locked,
        'mute_mic_on_join': room.mute_mic_on_join,
        'mute_cam_on_join': room.mute_cam_on_join,
        'lock_screen_share': room.lock_screen_share,
        'lock_microphone': room.lock_microphone,
        'lock_camera': room.lock_camera,
        'lock_document_presentation': room.lock_document_presentation,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def grant_media_permission(request, room_code):
    """
    Host or Co-Host grants or revokes a specific media permission (screen_share, microphone, camera)
    for a participant.
    """
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if not room.can_manage_room(request.user):
        return Response({'error': 'Only host or co-hosts can grant media permissions'}, status=status.HTTP_403_FORBIDDEN)

    user_identifier = request.data.get('user_id') or request.data.get('username') or request.data.get('identity')
    permission_type = request.data.get('permission_type')  # 'screen_share', 'microphone', 'camera'
    granted = request.data.get('granted', True)

    if not user_identifier or not permission_type:
        return Response({'error': 'user_identifier and permission_type are required'}, status=status.HTTP_400_BAD_REQUEST)

    participant_qs = RoomParticipant.objects.filter(room=room)
    if isinstance(user_identifier, int) or str(user_identifier).isdigit():
        participant_qs = participant_qs.filter(models.Q(user_id=int(user_identifier)) | models.Q(guest_identity=str(user_identifier)))
    else:
        participant_qs = participant_qs.filter(models.Q(user__username=user_identifier) | models.Q(guest_identity=user_identifier))

    participant = participant_qs.first()
    if not participant:
        return Response({'error': 'Participant not found'}, status=status.HTTP_404_NOT_FOUND)

    if permission_type == 'screen_share':
        participant.can_share_screen = bool(granted)
        participant.save(update_fields=['can_share_screen'])
    elif permission_type == 'microphone':
        participant.can_use_microphone = bool(granted)
        participant.save(update_fields=['can_use_microphone'])
    elif permission_type == 'camera':
        participant.can_use_camera = bool(granted)
        participant.save(update_fields=['can_use_camera'])
    else:
        return Response({'error': f'Invalid permission type: {permission_type}'}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        'message': f'Permission {permission_type} set to {granted} for {user_identifier}',
        'participant': user_identifier,
        'permission_type': permission_type,
        'granted': bool(granted),
    })


# ---------------------------------------------------------------------------
# Co-Host Delegation Views
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def grant_co_host(request, room_code):
    """
    Host delegates co-host / moderator permissions to a participant.
    """
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if room.host_id != request.user.id:
        return Response({'error': 'Only the primary host can appoint co-hosts'}, status=status.HTTP_403_FORBIDDEN)

    user_identifier = request.data.get('user_id') or request.data.get('username') or request.data.get('identity')
    if not user_identifier:
        return Response({'error': 'User identifier is required'}, status=status.HTTP_400_BAD_REQUEST)

    from accounts.models import User
    try:
        if isinstance(user_identifier, int) or str(user_identifier).isdigit():
            target_user = User.objects.get(id=int(user_identifier))
        else:
            target_user = User.objects.get(username=user_identifier)
    except User.DoesNotExist:
        return Response({'error': 'Target user not found'}, status=status.HTTP_404_NOT_FOUND)

    room.co_hosts.add(target_user)
    RoomParticipant.objects.filter(room=room, user=target_user).update(role=RoomParticipant.Role.CO_HOST)

    return Response({
        'message': f'User {target_user.username} appointed as Co-Host.',
        'co_hosts': list(room.co_hosts.values_list('username', flat=True)),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def revoke_co_host(request, room_code):
    """
    Host revokes co-host permissions from a participant.
    """
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if room.host_id != request.user.id:
        return Response({'error': 'Only the primary host can revoke co-hosts'}, status=status.HTTP_403_FORBIDDEN)

    user_identifier = request.data.get('user_id') or request.data.get('username') or request.data.get('identity')
    if not user_identifier:
        return Response({'error': 'User identifier is required'}, status=status.HTTP_400_BAD_REQUEST)

    from accounts.models import User
    try:
        if isinstance(user_identifier, int) or str(user_identifier).isdigit():
            target_user = User.objects.get(id=int(user_identifier))
        else:
            target_user = User.objects.get(username=user_identifier)
    except User.DoesNotExist:
        return Response({'error': 'Target user not found'}, status=status.HTTP_404_NOT_FOUND)

    room.co_hosts.remove(target_user)
    RoomParticipant.objects.filter(room=room, user=target_user).update(role=RoomParticipant.Role.PARTICIPANT)

    return Response({
        'message': f'Co-Host permissions revoked from {target_user.username}.',
        'co_hosts': list(room.co_hosts.values_list('username', flat=True)),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_co_hosts(request, room_code):
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    co_hosts = [
        {
            'id': u.id,
            'username': u.username,
            'full_name': u.full_name or u.username,
        }
        for u in room.co_hosts.all()
    ]
    return Response({'co_hosts': co_hosts})


# ---------------------------------------------------------------------------
# Presentation & Document Stage Views
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([AllowAny])
def upload_presentation(request, room_code):
    """
    Upload a presentation file (PDF, Image, Slide) for in-call presentation.
    Allowed if user is Host/Co-Host, OR room.lock_document_presentation is False,
    OR participant has can_upload_presentation=True.
    """
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if room.status == Room.Status.ENDED:
        return Response({'error': 'Room has ended'}, status=status.HTTP_410_GONE)

    user = request.user if request.user and request.user.is_authenticated else None
    guest_identity = request.data.get('guest_identity')

    participant = None
    if user:
        participant = RoomParticipant.objects.filter(room=room, user=user, is_active=True).first()
    elif guest_identity:
        participant = RoomParticipant.objects.filter(room=room, guest_identity=guest_identity, is_active=True).first()

    # Permission check
    can_moderate = room.can_manage_room(user) if user else False
    if not can_moderate:
        if room.lock_document_presentation:
            if not participant or not participant.can_upload_presentation:
                return Response({
                    'error': 'امکان آپلود و ارائه فایل توسط برگزارکننده قفل است.',
                    'code': 'PRESENTATION_LOCKED',
                }, status=status.HTTP_403_FORBIDDEN)

    uploaded_file = request.FILES.get('file')
    if not uploaded_file:
        return Response({'error': 'فایلی برای آپلود ارسال نشده است.'}, status=status.HTTP_400_BAD_REQUEST)

    # 50MB max file size
    if uploaded_file.size > 50 * 1024 * 1024:
        return Response({'error': 'حداکثر حجم مجاز فایل ۵۰ مگابایت است.'}, status=status.HTTP_400_BAD_REQUEST)

    filename = uploaded_file.name.lower()
    file_type = PresentationDocument.FileType.OTHER
    if filename.endswith(('.pdf',)):
        file_type = PresentationDocument.FileType.PDF
    elif filename.endswith(('.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif')):
        file_type = PresentationDocument.FileType.IMAGE
    elif filename.endswith(('.ppt', '.pptx', '.odp', '.key')):
        file_type = PresentationDocument.FileType.SLIDE

    title = request.data.get('title') or uploaded_file.name
    guest_name = request.data.get('guest_name') or (participant.guest_name if participant else 'مهمان')

    total_pages = int(request.data.get('total_pages', 1))

    doc = PresentationDocument.objects.create(
        room=room,
        uploader=user,
        guest_uploader_name=guest_name if not user else None,
        file=uploaded_file,
        title=title,
        file_type=file_type,
        file_size_bytes=uploaded_file.size,
        total_pages=max(1, total_pages),
        current_page=1,
    )

    file_url = request.build_absolute_uri(doc.file.url) if doc.file else ''

    return Response({
        'id': doc.id,
        'title': doc.title,
        'file_url': file_url,
        'file_type': doc.file_type,
        'file_size_bytes': doc.file_size_bytes,
        'total_pages': doc.total_pages,
        'current_page': doc.current_page,
        'uploader_name': doc.uploader_name,
        'is_active_on_stage': doc.is_active_on_stage,
        'created_at': doc.created_at.isoformat(),
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([AllowAny])
def list_presentations(request, room_code):
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    docs = room.presentations.all()
    results = []
    for d in docs:
        file_url = request.build_absolute_uri(d.file.url) if d.file else ''
        results.append({
            'id': d.id,
            'title': d.title,
            'file_url': file_url,
            'file_type': d.file_type,
            'file_size_bytes': d.file_size_bytes,
            'total_pages': d.total_pages,
            'current_page': d.current_page,
            'uploader_name': d.uploader_name,
            'is_active_on_stage': d.is_active_on_stage,
            'created_at': d.created_at.isoformat(),
        })

    return Response({'presentations': results})


@api_view(['POST'])
@permission_classes([AllowAny])
def set_active_presentation(request, room_code, doc_id):
    """
    Set a presentation as active/inactive on the room stage.
    """
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    is_active = request.data.get('is_active', True)

    if not is_active or doc_id == 0 or str(doc_id) == '0':
        room.presentations.update(is_active_on_stage=False)
        return Response({'message': 'Presentation stopped', 'is_active': False})

    try:
        doc = room.presentations.get(id=doc_id)
    except PresentationDocument.DoesNotExist:
        return Response({'error': 'Presentation not found'}, status=status.HTTP_404_NOT_FOUND)

    room.presentations.update(is_active_on_stage=False)
    doc.is_active_on_stage = True
    doc.save(update_fields=['is_active_on_stage'])

    file_url = request.build_absolute_uri(doc.file.url) if doc.file else ''
    return Response({
        'id': doc.id,
        'title': doc.title,
        'file_url': file_url,
        'file_type': doc.file_type,
        'total_pages': doc.total_pages,
        'current_page': doc.current_page,
        'uploader_name': doc.uploader_name,
        'is_active_on_stage': True,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def set_presentation_page(request, room_code, doc_id):
    try:
        room = Room.objects.get(room_code=room_code)
        doc = room.presentations.get(id=doc_id)
    except (Room.DoesNotExist, PresentationDocument.DoesNotExist):
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    page = int(request.data.get('page', 1))
    doc.current_page = max(1, min(doc.total_pages, page))
    doc.save(update_fields=['current_page'])

    return Response({
        'id': doc.id,
        'current_page': doc.current_page,
        'total_pages': doc.total_pages,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def grant_presentation_permission(request, room_code):
    """
    Host or Co-Host grants or revokes individual document upload/present permission.
    """
    try:
        room = Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)

    if not room.can_manage_room(request.user):
        return Response({'error': 'Only host or co-hosts can grant presentation permissions'}, status=status.HTTP_403_FORBIDDEN)

    user_identifier = request.data.get('user_id') or request.data.get('username') or request.data.get('identity')
    granted = request.data.get('granted', True)

    if not user_identifier:
        return Response({'error': 'user_identifier is required'}, status=status.HTTP_400_BAD_REQUEST)

    participant_qs = RoomParticipant.objects.filter(room=room)
    if isinstance(user_identifier, int) or str(user_identifier).isdigit():
        participant_qs = participant_qs.filter(models.Q(user_id=int(user_identifier)) | models.Q(guest_identity=str(user_identifier)))
    else:
        participant_qs = participant_qs.filter(models.Q(user__username=user_identifier) | models.Q(guest_identity=user_identifier))

    participant = participant_qs.first()
    if not participant:
        return Response({'error': 'Participant not found'}, status=status.HTTP_404_NOT_FOUND)

    participant.can_upload_presentation = bool(granted)
    participant.save(update_fields=['can_upload_presentation'])

    return Response({
        'message': f'Presentation upload permission set to {granted} for {user_identifier}',
        'participant': user_identifier,
        'granted': bool(granted),
    })

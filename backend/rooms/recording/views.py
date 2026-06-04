"""
Recording endpoints.

Host-only control plane:
    POST /api/rooms/<code>/recording/start/
    POST /api/rooms/<code>/recording/stop/
    POST /api/rooms/<code>/recording/pause/
    POST /api/rooms/<code>/recording/resume/
    GET  /api/rooms/<code>/recording/status/

Recording library (read-side):
    GET    /api/recordings/                      list user's accessible recordings
    GET    /api/recordings/<token>/              detail for one recording
    GET    /api/recordings/<token>/stream/       streamed MP4 (HTTP Range support)
    DELETE /api/recordings/<token>/              owner-only soft delete + on-disk cleanup

Owner editing & sharing:
    POST   /api/recordings/<token>/finalize/     concat segments + optional trim
    POST   /api/recordings/<token>/publish/      publish to specified users
    POST   /api/recordings/<token>/unpublish/    revoke publish

Watch tracking:
    POST   /api/recordings/<token>/heartbeat/    viewer ping with current position
    GET    /api/recordings/<token>/views/        host-only: who watched, how far
    POST   /api/recordings/<token>/unpublish/    revoke publish

LiveKit webhook:
    POST /api/recordings/webhook/                HMAC-verified

Auth model:
    * start/stop/pause/resume: only the host of the room
    * status: any participant of the room
    * list/detail/stream: Recording.can_be_viewed_by(user)
    * delete/finalize/publish/unpublish: owner only
    * webhook: HMAC-verified by livekit.api.WebhookReceiver
"""

from __future__ import annotations

import logging
import shutil
from pathlib import Path

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.http import Http404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status as http
from rest_framework.decorators import (
    api_view, authentication_classes, permission_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from rooms.models import Recording, RecordingSegment, Room, RoomParticipant

from . import ffmpeg_ops, service
from .streaming import serve_video_with_range
from .webhook import WebhookError, handle_event, parse_event

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_room_or_404(room_code: str):
    try:
        return Room.objects.get(room_code=room_code)
    except Room.DoesNotExist:
        return None


def _require_host(request, room) -> Response | None:
    if room.host_id != request.user.id:
        return Response(
            {'error': 'Only the host can control recording'},
            status=http.HTTP_403_FORBIDDEN,
        )
    return None


def _require_recording_controller(request, room) -> Response | None:
    """
    Allow access when the user is the host OR has been explicitly granted
    recording control by the host (Room.recording_grants).

    Used by the start/stop/pause/resume endpoints so a designated
    co-host can drive the recording without becoming a full host.
    """
    if room.can_control_recording(request.user):
        return None
    return Response(
        {'error': 'You are not allowed to control recording in this room'},
        status=http.HTTP_403_FORBIDDEN,
    )


def _require_participant(request, room) -> Response | None:
    if room.host_id == request.user.id:
        return None
    is_participant = RoomParticipant.objects.filter(
        room=room, user=request.user,
    ).exists()
    if not is_participant:
        return Response(
            {'error': 'You are not a participant of this room'},
            status=http.HTTP_403_FORBIDDEN,
        )
    return None


def _serialize(recording: Recording, *, detail: bool = False, viewer=None) -> dict:
    """
    Build the JSON payload for a recording.

    `viewer` is the requesting user when known. When supplied:
      * non-owner viewers get back their `last_position_seconds`
        so the player can resume where they stopped last time;
      * the owner gets back `viewer_count` (number of distinct
        non-owner users who have heartbeated at least once).
    """
    payload = {
        'public_token': recording.public_token,
        'status': recording.status,
        'quality': recording.quality,
        'duration_seconds': recording.duration_seconds,
        'size_bytes': recording.size_bytes,
        'started_at': recording.started_at.isoformat(),
        'completed_at': (
            recording.completed_at.isoformat() if recording.completed_at else None
        ),
        'is_published': recording.is_published,
        'is_link_shared': recording.is_link_shared,
        'segment_count': recording.segments.count(),
    }
    if detail:
        payload.update({
            'room_code': recording.room.room_code,
            'room_name': recording.room.name,
            'owner_username': recording.owner.username,
            'owner_full_name': recording.owner.full_name or recording.owner.username,
            'is_owner': False,  # caller fills this in
            'published_at': (
                recording.published_at.isoformat()
                if recording.published_at else None
            ),
            'trim_start_seconds': recording.trim_start_seconds,
            'trim_end_seconds': recording.trim_end_seconds,
        })
        if viewer is not None and getattr(viewer, 'is_authenticated', False):
            from rooms.models import RecordingView
            if viewer.id == recording.owner_id:
                payload['viewer_count'] = recording.views.count()
                payload['last_position_seconds'] = 0
            else:
                view = RecordingView.objects.filter(
                    recording=recording, user=viewer,
                ).first()
                payload['last_position_seconds'] = (
                    view.last_position_seconds if view else 0
                )
    return payload


def _active_recording(room: Room) -> Recording | None:
    return (
        Recording.objects
        .filter(
            room=room,
            is_deleted=False,
            status__in=[
                Recording.Status.STARTING,
                Recording.Status.RECORDING,
                Recording.Status.PAUSED,
                Recording.Status.PROCESSING,
            ],
        )
        .order_by('-started_at')
        .first()
    )


# ---------------------------------------------------------------------------
# Control endpoints (host only)
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_recording(request, room_code: str):
    room = _get_room_or_404(room_code)
    if not room:
        return Response({'error': 'Room not found'}, status=http.HTTP_404_NOT_FOUND)
    forbidden = _require_recording_controller(request, room)
    if forbidden:
        return forbidden

    if room.status == Room.Status.ENDED:
        return Response(
            {'error': 'Cannot record an ended room'},
            status=http.HTTP_400_BAD_REQUEST,
        )

    if _active_recording(room):
        return Response(
            {'error': 'A recording is already in progress for this room'},
            status=http.HTTP_409_CONFLICT,
        )

    quality = (request.data.get('quality') or '').strip().lower()
    if quality not in {'720p', '1080p'}:
        from django.conf import settings as dj_settings
        quality = dj_settings.RECORDING_DEFAULT_QUALITY

    with transaction.atomic():
        recording = Recording.objects.create(
            room=room,
            owner=request.user,
            quality=quality,
            status=Recording.Status.STARTING,
        )
        segment = RecordingSegment.objects.create(
            recording=recording,
            index=0,
            egress_id='',  # filled in below once LiveKit responds
        )

    try:
        launch = service.start_room_composite(
            room_code=room.room_code,
            recording_token=recording.public_token,
            segment_index=segment.index,
            quality=quality,
        )
    except Exception as exc:
        logger.exception('start_room_composite failed for %s', room.room_code)
        recording.status = Recording.Status.FAILED
        recording.save(update_fields=['status'])
        return Response(
            {'error': f'Failed to start recording: {exc}'},
            status=http.HTTP_502_BAD_GATEWAY,
        )

    segment.egress_id = launch.egress_id
    segment.file_path = launch.file_path_relative
    segment.save(update_fields=['egress_id', 'file_path'])

    recording.status = Recording.Status.RECORDING
    recording.save(update_fields=['status'])

    return Response(_serialize(recording), status=http.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stop_recording(request, room_code: str):
    room = _get_room_or_404(room_code)
    if not room:
        return Response({'error': 'Room not found'}, status=http.HTTP_404_NOT_FOUND)
    forbidden = _require_recording_controller(request, room)
    if forbidden:
        return forbidden

    recording = _active_recording(room)
    if not recording:
        return Response(
            {'error': 'No active recording'},
            status=http.HTTP_404_NOT_FOUND,
        )

    # Reject stop if egress hasn't had time to bootstrap. RoomCompositeEgress
    # spins up an internal headless browser which takes ~3s; stopping before
    # then aborts the run with no file produced.
    last_segment = recording.segments.order_by('-index').first()
    if last_segment and last_segment.started_at:
        elapsed = (timezone.now() - last_segment.started_at).total_seconds()
        if elapsed < 3.0:
            return Response(
                {'error': 'Recording is still starting; please try again in a moment'},
                status=http.HTTP_409_CONFLICT,
            )

    if last_segment and last_segment.egress_id and recording.status != Recording.Status.PAUSED:
        service.stop_egress(last_segment.egress_id)

    # Webhook will flip to COMPLETED when the worker confirms ENDED, but we
    # mark PROCESSING here so the UI can react immediately.
    recording.status = Recording.Status.PROCESSING
    recording.save(update_fields=['status'])

    return Response(_serialize(recording))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pause_recording(request, room_code: str):
    room = _get_room_or_404(room_code)
    if not room:
        return Response({'error': 'Room not found'}, status=http.HTTP_404_NOT_FOUND)
    forbidden = _require_recording_controller(request, room)
    if forbidden:
        return forbidden

    recording = _active_recording(room)
    if not recording or recording.status != Recording.Status.RECORDING:
        return Response(
            {'error': 'No active recording to pause'},
            status=http.HTTP_409_CONFLICT,
        )

    last_segment = recording.segments.order_by('-index').first()
    # Same bootstrap guard as stop_recording — see comment there.
    if last_segment and last_segment.started_at:
        elapsed = (timezone.now() - last_segment.started_at).total_seconds()
        if elapsed < 3.0:
            return Response(
                {'error': 'Recording is still starting; please try again in a moment'},
                status=http.HTTP_409_CONFLICT,
            )

    if last_segment and last_segment.egress_id:
        service.stop_egress(last_segment.egress_id)

    recording.status = Recording.Status.PAUSED
    recording.save(update_fields=['status'])

    return Response(_serialize(recording))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resume_recording(request, room_code: str):
    room = _get_room_or_404(room_code)
    if not room:
        return Response({'error': 'Room not found'}, status=http.HTTP_404_NOT_FOUND)
    forbidden = _require_recording_controller(request, room)
    if forbidden:
        return forbidden

    recording = _active_recording(room)
    if not recording or recording.status != Recording.Status.PAUSED:
        return Response(
            {'error': 'No paused recording to resume'},
            status=http.HTTP_409_CONFLICT,
        )

    next_index = (recording.segments.order_by('-index').first().index + 1)
    segment = RecordingSegment.objects.create(
        recording=recording,
        index=next_index,
        egress_id='',
    )

    try:
        launch = service.start_room_composite(
            room_code=room.room_code,
            recording_token=recording.public_token,
            segment_index=next_index,
            quality=recording.quality,
        )
    except Exception as exc:
        logger.exception('resume failed for %s', room.room_code)
        # Roll back the placeholder segment so the next resume picks the
        # same index without leaving an orphan row.
        segment.delete()
        return Response(
            {'error': f'Failed to resume recording: {exc}'},
            status=http.HTTP_502_BAD_GATEWAY,
        )

    segment.egress_id = launch.egress_id
    segment.file_path = launch.file_path_relative
    segment.save(update_fields=['egress_id', 'file_path'])

    recording.status = Recording.Status.RECORDING
    recording.save(update_fields=['status'])
    return Response(_serialize(recording))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recording_status(request, room_code: str):
    room = _get_room_or_404(room_code)
    if not room:
        return Response({'error': 'Room not found'}, status=http.HTTP_404_NOT_FOUND)
    forbidden = _require_participant(request, room)
    if forbidden:
        return forbidden

    recording = _active_recording(room)
    if recording is None:
        return Response({'status': 'idle', 'recording': None})
    return Response({'status': recording.status, 'recording': _serialize(recording)})


def _finalize_client_recording_bg(recording_pk: int):
    from django.db import connection
    connection.close()

    try:
        recording = Recording.objects.get(pk=recording_pk)
        chunks_dir = Path(settings.RECORDING_OUTPUT_DIR) / recording.public_token / 'chunks'
        if not chunks_dir.exists():
            logger.error("Chunks directory %s does not exist", chunks_dir)
            recording.status = Recording.Status.FAILED
            recording.save(update_fields=['status'])
            return

        # Find and sort chunks by index
        chunk_files = sorted(chunks_dir.glob('chunk_*.webm'), key=lambda p: int(p.name.split('_')[1].split('.')[0]))
        if not chunk_files:
            logger.error("No chunks found in %s", chunks_dir)
            recording.status = Recording.Status.FAILED
            recording.save(update_fields=['status'])
            return

        final_path = Path(settings.RECORDING_OUTPUT_DIR) / recording.public_token / 'final.mp4'
        final_path.parent.mkdir(parents=True, exist_ok=True)

        ffmpeg_ops.concat_webm_to_mp4(chunk_files, final_path)

        probe_result = ffmpeg_ops.probe(final_path)

        recording.file_path = f'{recording.public_token}/final.mp4'
        recording.duration_seconds = int(round(probe_result.duration_seconds))
        recording.size_bytes = probe_result.size_bytes
        recording.status = Recording.Status.COMPLETED
        recording.completed_at = timezone.now()
        recording.save(update_fields=['file_path', 'duration_seconds', 'size_bytes', 'status', 'completed_at'])

        # Clean up chunks
        try:
            shutil.rmtree(chunks_dir)
        except OSError:
            logger.exception('failed to remove chunks dir %s', chunks_dir)

        logger.info("Successfully finalized client-side recording %s", recording.public_token)
    except Exception:
        logger.exception("Failed to finalize client-side recording in background")
        try:
            recording = Recording.objects.get(pk=recording_pk)
            recording.status = Recording.Status.FAILED
            recording.save(update_fields=['status'])
        except Exception:
            pass


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_client_recording(request, room_code: str):
    """
    Initialize a client-side recording session.
    """
    room = _get_room_or_404(room_code)
    if not room:
        return Response({'error': 'Room not found'}, status=http.HTTP_404_NOT_FOUND)
    forbidden = _require_recording_controller(request, room)
    if forbidden:
        return forbidden

    if room.status == Room.Status.ENDED:
        return Response(
            {'error': 'Cannot record an ended room'},
            status=http.HTTP_400_BAD_REQUEST,
        )

    if _active_recording(room):
        return Response(
            {'error': 'A recording is already in progress for this room'},
            status=http.HTTP_409_CONFLICT,
        )

    quality = (request.data.get('quality') or '').strip().lower()
    if quality not in {'720p', '1080p'}:
        from django.conf import settings as dj_settings
        quality = dj_settings.RECORDING_DEFAULT_QUALITY

    with transaction.atomic():
        recording = Recording.objects.create(
            room=room,
            owner=request.user,
            quality=quality,
            status=Recording.Status.RECORDING,
        )

    logger.info('client_recording.start room=%s token=%s', room.room_code, recording.public_token)
    return Response(_serialize(recording), status=http.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_recording_chunk(request, token: str):
    """
    Upload a single 10-second WebM recording chunk.
    """
    recording = _get_recording_or_404(token)
    if recording is None:
        return Response({'error': 'Recording not found'}, status=http.HTTP_404_NOT_FOUND)

    if recording.owner_id != request.user.id and not request.user.is_superuser:
        return Response(
            {'error': 'Only the owner can upload chunks to this recording'},
            status=http.HTTP_403_FORBIDDEN,
        )

    chunk_file = request.FILES.get('chunk')
    if not chunk_file:
        return Response({'error': 'No chunk file provided'}, status=http.HTTP_400_BAD_REQUEST)

    try:
        index = int(request.data.get('index'))
    except (TypeError, ValueError):
        return Response({'error': 'Invalid chunk index'}, status=http.HTTP_400_BAD_REQUEST)

    chunks_dir = Path(settings.RECORDING_OUTPUT_DIR) / recording.public_token / 'chunks'
    chunks_dir.mkdir(parents=True, exist_ok=True)
    chunk_path = chunks_dir / f'chunk_{index}.webm'

    try:
        with open(chunk_path, 'wb+') as destination:
            for block in chunk_file.chunks():
                destination.write(block)
    except Exception as exc:
        logger.exception("Failed to write chunk %d for recording %s", index, token)
        return Response({'error': f'Failed to write chunk: {exc}'}, status=http.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({'success': True, 'index': index})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_client_recording(request, token: str):
    """
    Mark a client-side recording session as complete and trigger background concatenation.
    """
    recording = _get_recording_or_404(token)
    if recording is None:
        return Response({'error': 'Recording not found'}, status=http.HTTP_404_NOT_FOUND)

    if recording.owner_id != request.user.id and not request.user.is_superuser:
        return Response(
            {'error': 'Only the owner can finalize this recording'},
            status=http.HTTP_403_FORBIDDEN,
        )

    if recording.status != Recording.Status.RECORDING:
        return Response(
            {'error': 'Recording is not in recording state'},
            status=http.HTTP_409_CONFLICT,
        )

    recording.status = Recording.Status.PROCESSING
    recording.save(update_fields=['status'])

    import threading
    thread = threading.Thread(target=_finalize_client_recording_bg, args=(recording.pk,))
    thread.daemon = True
    thread.start()

    logger.info('client_recording.complete token=%s triggered background processing', token)
    return Response(_serialize(recording))



# ---------------------------------------------------------------------------
# Recording control grants (host delegating control to a participant)
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recording_permission(request, room_code: str):
    """
    Returns whether the requesting user is allowed to control recording
    in this room, plus (host-only) the list of currently authorized
    non-host participants. Endpoint is participant-readable so each
    user's own UI can decide whether to surface the record buttons.

    Response shape:
        {
            "can_control": <bool>,
            "is_host":     <bool>,
            "grants":      [{user_id, username, full_name}, ...] | null
        }
    `grants` is null for non-hosts (they don't need to know who else
    is allowed; their own permission is in `can_control`).
    """
    room = _get_room_or_404(room_code)
    if not room:
        return Response({'error': 'Room not found'}, status=http.HTTP_404_NOT_FOUND)

    forbidden = _require_participant(request, room)
    if forbidden:
        return forbidden

    is_host = room.host_id == request.user.id
    can_control = room.can_control_recording(request.user)

    grants = None
    if is_host:
        grants = [
            {
                'user_id': u.id,
                'username': u.username,
                'full_name': u.full_name or u.username,
            }
            for u in room.recording_grants.all()
        ]

    return Response({
        'can_control': can_control,
        'is_host': is_host,
        'grants': grants,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_recording_permission(request, room_code: str):
    """
    Host grants or revokes recording-control permission for one of the
    room's participants.

    Body: { "user_id": <int>, "granted": <bool> }
    """
    room = _get_room_or_404(room_code)
    if not room:
        return Response({'error': 'Room not found'}, status=http.HTTP_404_NOT_FOUND)
    forbidden = _require_host(request, room)
    if forbidden:
        return forbidden

    raw_id = request.data.get('user_id')
    raw_username = request.data.get('username')
    granted = bool(request.data.get('granted'))

    # Accept either user_id (preferred) or username (LiveKit identity ==
    # username, so the participants panel can pass it through directly).
    target: User | None = None
    if raw_id is not None:
        try:
            user_id = int(raw_id)
        except (TypeError, ValueError):
            return Response(
                {'error': 'user_id must be an integer'},
                status=http.HTTP_400_BAD_REQUEST,
            )
        try:
            target = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=http.HTTP_404_NOT_FOUND,
            )
    elif raw_username:
        try:
            target = User.objects.get(username=str(raw_username))
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=http.HTTP_404_NOT_FOUND,
            )
    else:
        return Response(
            {'error': 'user_id or username is required'},
            status=http.HTTP_400_BAD_REQUEST,
        )

    if target.id == room.host_id:
        return Response(
            {'error': 'The host already controls recording'},
            status=http.HTTP_400_BAD_REQUEST,
        )

    is_participant = RoomParticipant.objects.filter(
        room=room, user=target,
    ).exists()
    if not is_participant:
        return Response(
            {'error': 'Target user is not a participant of this room'},
            status=http.HTTP_400_BAD_REQUEST,
        )

    if granted:
        room.recording_grants.add(target)
    else:
        room.recording_grants.remove(target)

    # Persist + push the notification so the grantee's UI flips
    # immediately AND they have a record of the grant/revoke even if
    # they were offline.
    from accounts.notifications import record_and_dispatch
    try:
        record_and_dispatch(
            target.id,
            (
                'RECORDING_PERMISSION_GRANTED'
                if granted
                else 'RECORDING_PERMISSION_REVOKED'
            ),
            {
                'type': (
                    'RECORDING_PERMISSION_GRANTED'
                    if granted
                    else 'RECORDING_PERMISSION_REVOKED'
                ),
                'room_code': room.room_code,
                'room_name': room.name or room.room_code,
                'from': (
                    request.user.full_name or request.user.username
                ),
            },
        )
    except Exception:
        logger.exception(
            'failed to notify recording-permission change to user=%s',
            target.id,
        )

    logger.info(
        'recording permission %s for user=%s room=%s',
        'granted' if granted else 'revoked',
        target.username,
        room.room_code,
    )

    return Response({
        'user_id': target.id,
        'username': target.username,
        'full_name': target.full_name or target.username,
        'granted': granted,
    })


# ---------------------------------------------------------------------------
# LiveKit egress webhook (no DRF auth; HMAC verified)
# ---------------------------------------------------------------------------

@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def egress_webhook(request):
    auth_header = (
        request.META.get('HTTP_AUTHORIZATION')
        or request.headers.get('Authorization')
        or ''
    )
    raw_body = request.body
    logger.info(
        'webhook received: %d bytes, auth-header=%s',
        len(raw_body), 'present' if auth_header else 'MISSING',
    )

    try:
        event = parse_event(raw_body, auth_header)
    except WebhookError as exc:
        logger.warning(
            'webhook rejected: %s | first 200 chars of body: %s',
            exc, raw_body[:200],
        )
        return Response({'error': str(exc)}, status=http.HTTP_401_UNAUTHORIZED)

    logger.info(
        'webhook event=%s id=%s egressId=%s',
        event.get('event'),
        event.get('id'),
        (event.get('egressInfo') or {}).get('egressId'),
    )

    try:
        handle_event(event)
    except Exception:
        logger.exception('webhook handler crashed for event=%s', event.get('event'))
        # Always 200 once auth passes — we don't want LiveKit retrying
        # forever on a code bug. The exception is captured in logs.

    return Response({'ok': True})


# ---------------------------------------------------------------------------
# Library endpoints (read-side)
# ---------------------------------------------------------------------------

def _accessible_recordings_qs(user):
    """
    Recordings the user can see in their library: their own (any status),
    plus published recordings shared with them.
    """
    return (
        Recording.objects
        .filter(is_deleted=False)
        .filter(
            Q(owner=user) | Q(is_published=True, visible_to=user)
        )
        .select_related('room', 'owner')
        .distinct()
        .order_by('-started_at')
    )


def _get_recording_or_404(token: str) -> Recording | None:
    try:
        return Recording.objects.select_related('room', 'owner').get(
            public_token=token, is_deleted=False,
        )
    except Recording.DoesNotExist:
        return None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_recordings(request):
    """
    Return the authenticated user's accessible recordings.

    Query params:
        room_code   filter to a single room (e.g. for the room dashboard widget)
        status      filter by status (e.g. completed)
        published   "true" / "false" filter
    """
    qs = _accessible_recordings_qs(request.user)

    room_code = request.query_params.get('room_code')
    if room_code:
        qs = qs.filter(room__room_code=room_code)

    status_filter = request.query_params.get('status')
    if status_filter:
        qs = qs.filter(status=status_filter)

    published = request.query_params.get('published')
    if published is not None:
        qs = qs.filter(is_published=str(published).lower() == 'true')

    items = []
    for rec in qs[:200]:  # cap to avoid runaway responses
        payload = _serialize(rec, detail=True, viewer=request.user)
        payload['is_owner'] = rec.owner_id == request.user.id
        items.append(payload)

    return Response({'count': len(items), 'results': items})


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def recording_detail_or_delete(request, token: str):
    """
    GET    /api/recordings/<token>/   detail
    DELETE /api/recordings/<token>/   owner-only soft delete + on-disk cleanup
    """
    rec = _get_recording_or_404(token)
    if rec is None:
        return Response({'error': 'Recording not found'}, status=http.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        if not rec.can_be_viewed_by(request.user):
            return Response(
                {'error': 'You do not have permission to view this recording'},
                status=http.HTTP_403_FORBIDDEN,
            )
        payload = _serialize(rec, detail=True, viewer=request.user)
        payload['is_owner'] = rec.owner_id == request.user.id
        response = Response(payload)
        # Authorization can change at any moment (publish/unpublish, removal
        # from visible_to, soft delete). Disabling caching keeps the access
        # guard polling honest — clients always hit the live state.
        response['Cache-Control'] = 'no-store, no-cache, must-revalidate, private'
        response['Pragma'] = 'no-cache'
        return response

    # DELETE
    if rec.owner_id != request.user.id and not request.user.is_superuser:
        return Response(
            {'error': 'Only the owner can delete a recording'},
            status=http.HTTP_403_FORBIDDEN,
        )
    if rec.is_active:
        return Response(
            {'error': 'Cannot delete a recording that is still in progress'},
            status=http.HTTP_409_CONFLICT,
        )

    rec_dir: Path = settings.RECORDING_OUTPUT_DIR / rec.public_token
    if rec_dir.exists():
        try:
            shutil.rmtree(rec_dir)
        except OSError:
            logger.exception('failed to remove %s', rec_dir)

    rec.is_deleted = True
    rec.deleted_at = timezone.now()
    rec.file_path = ''
    rec.save(update_fields=['is_deleted', 'deleted_at', 'file_path'])
    rec.segments.update(file_path='')

    logger.info(
        'recording deleted token=%s by user=%s',
        rec.public_token, request.user.username,
    )
    return Response(status=http.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stream_recording(request, token: str):
    """
    Stream the playable file for a recording.

    The opaque public_token in the URL is necessary but not sufficient —
    every request is re-authorized via Recording.can_be_viewed_by so a
    leaked URL alone can't be used by a logged-out attacker.
    """
    rec = _get_recording_or_404(token)
    if rec is None:
        raise Http404

    if not rec.can_be_viewed_by(request.user):
        return Response(
            {'error': 'You do not have permission to stream this recording'},
            status=http.HTTP_403_FORBIDDEN,
        )

    if not rec.file_path:
        return Response(
            {'error': 'Recording is not ready yet'},
            status=http.HTTP_409_CONFLICT,
        )

    abs_path: Path = settings.RECORDING_OUTPUT_DIR / rec.file_path
    if not abs_path.exists():
        logger.error(
            'recording %s missing on disk: expected %s',
            rec.public_token, abs_path,
        )
        return Response(
            {'error': 'Recording file is missing on the server'},
            status=http.HTTP_410_GONE,
        )

    # File name surfaced to the browser. Title-cased on the server side
    # so the user sees something sensible if they save the file.
    filename = f'eduspace-{rec.room.room_code}-{rec.public_token}.mp4'
    return serve_video_with_range(
        abs_path,
        range_header=request.META.get('HTTP_RANGE', ''),
        if_modified_since=request.META.get('HTTP_IF_MODIFIED_SINCE'),
        content_type='video/mp4',
        filename=filename,
    )


# ---------------------------------------------------------------------------
# Owner editing & sharing
# ---------------------------------------------------------------------------

def _finalize_path(recording: Recording) -> Path:
    return settings.RECORDING_OUTPUT_DIR / recording.public_token / 'final.mp4'


def _send_publish_notifications(recording: Recording, target_user_ids: list[int]) -> None:
    """
    Notify each target user via the existing NotificationConsumer group
    AND persist a Notification row so a recipient who was offline still
    sees the share when they next log in. Best-effort: failures are
    logged but don't fail the publish.
    """
    if not target_user_ids:
        return

    from accounts.notifications import record_and_dispatch_many

    sender = recording.owner
    data = {
        'type': 'RECORDING_PUBLISHED',
        'recording_token': recording.public_token,
        'room_code': recording.room.room_code,
        'room_name': recording.room.name or recording.room.room_code,
        'from': sender.full_name or sender.username,
        'duration_seconds': recording.duration_seconds,
        'watch_link': f'/recordings/{recording.public_token}',
    }
    try:
        record_and_dispatch_many(target_user_ids, 'RECORDING_PUBLISHED', data)
    except Exception:
        logger.exception(
            'failed to deliver RECORDING_PUBLISHED batch to %d users',
            len(target_user_ids),
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def finalize_recording(request, token: str):
    """
    Stitch all segments into a single final.mp4 and (optionally) trim
    its boundaries. Owner only. The original segment files are kept on
    disk so the host can re-run finalize with different bounds later.

    Request body (all optional):
        {
            "trim_start_seconds": 0.0,
            "trim_end_seconds":   180.0
        }
    """
    rec = _get_recording_or_404(token)
    if rec is None:
        return Response({'error': 'Recording not found'}, status=http.HTTP_404_NOT_FOUND)

    if rec.owner_id != request.user.id and not request.user.is_superuser:
        return Response(
            {'error': 'Only the owner can finalize a recording'},
            status=http.HTTP_403_FORBIDDEN,
        )

    if rec.is_active:
        return Response(
            {'error': 'Recording is still in progress'},
            status=http.HTTP_409_CONFLICT,
        )

    # Validate trim bounds.
    try:
        trim_start = float(request.data.get('trim_start_seconds') or 0.0)
    except (TypeError, ValueError):
        return Response({'error': 'Invalid trim_start_seconds'}, status=http.HTTP_400_BAD_REQUEST)
    raw_end = request.data.get('trim_end_seconds')
    trim_end: float | None
    if raw_end in (None, ''):
        trim_end = None
    else:
        try:
            trim_end = float(raw_end)
        except (TypeError, ValueError):
            return Response({'error': 'Invalid trim_end_seconds'}, status=http.HTTP_400_BAD_REQUEST)

    # Collect segment paths (in order) from MEDIA_ROOT.
    segments = list(rec.segments.exclude(file_path='').order_by('index'))
    if not segments:
        return Response(
            {'error': 'No segment files available to finalize'},
            status=http.HTTP_409_CONFLICT,
        )
    seg_paths = [
        settings.RECORDING_OUTPUT_DIR / s.file_path for s in segments
    ]
    missing = [str(p) for p in seg_paths if not p.exists()]
    if missing:
        logger.error('finalize: segment files missing: %s', missing)
        return Response(
            {'error': 'Some segment files are missing on the server'},
            status=http.HTTP_410_GONE,
        )

    final_path = _finalize_path(rec)
    final_path.parent.mkdir(parents=True, exist_ok=True)
    intermediate_path = final_path.with_suffix('.concat.mp4')

    try:
        # 1. Concatenate (or copy if a single segment).
        ffmpeg_ops.concat_segments(seg_paths, intermediate_path)

        # 2. Sanity-check trim bounds against the actual concat duration.
        probe = ffmpeg_ops.probe(intermediate_path)
        if trim_end is not None and trim_end > probe.duration_seconds:
            trim_end = probe.duration_seconds
        if trim_start >= probe.duration_seconds:
            return Response(
                {'error': f'trim_start_seconds ({trim_start}) is past the recording end '
                          f'({probe.duration_seconds:.2f}s)'},
                status=http.HTTP_400_BAD_REQUEST,
            )

        # 3. Apply trim (or copy if no trim requested).
        ffmpeg_ops.trim_inplace(
            intermediate_path,
            final_path,
            start_seconds=trim_start,
            end_seconds=trim_end,
        )
    except ffmpeg_ops.FFmpegError as exc:
        logger.exception('finalize failed for token=%s', rec.public_token)
        return Response(
            {'error': f'Finalize failed: {exc}'},
            status=http.HTTP_502_BAD_GATEWAY,
        )
    finally:
        # Drop the intermediate concat file unless it's the final destination
        # (single-segment edge case where trim was a no-op and concat == final).
        if intermediate_path.exists() and intermediate_path != final_path:
            try:
                intermediate_path.unlink()
            except OSError:
                logger.exception('failed to remove intermediate %s', intermediate_path)

    # Re-probe the final file so duration/size reflect the trimmed result.
    final_probe = ffmpeg_ops.probe(final_path)

    rec.file_path = f'{rec.public_token}/final.mp4'
    rec.duration_seconds = int(round(final_probe.duration_seconds))
    rec.size_bytes = final_probe.size_bytes
    rec.trim_start_seconds = trim_start
    rec.trim_end_seconds = trim_end
    rec.save(update_fields=[
        'file_path', 'duration_seconds', 'size_bytes',
        'trim_start_seconds', 'trim_end_seconds',
    ])

    logger.info(
        'finalized token=%s trim=[%.2f, %s] duration=%ds size=%dB',
        rec.public_token, trim_start,
        f'{trim_end:.2f}' if trim_end is not None else 'end',
        rec.duration_seconds, rec.size_bytes,
    )

    payload = _serialize(rec, detail=True, viewer=request.user)
    payload['is_owner'] = True
    return Response(payload)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def publish_recording(request, token: str):
    """
    Owner publishes the recording to a list of users. Each target gets a
    real-time notification via the existing notifications WebSocket.

    Request body:
        { "user_ids": [ 1, 2, 3 ] }
    Empty list publishes the recording with no specific viewers (still
    flips is_published=True so the owner can share via direct URL later).
    """
    rec = _get_recording_or_404(token)
    if rec is None:
        return Response({'error': 'Recording not found'}, status=http.HTTP_404_NOT_FOUND)

    if rec.owner_id != request.user.id and not request.user.is_superuser:
        return Response(
            {'error': 'Only the owner can publish'},
            status=http.HTTP_403_FORBIDDEN,
        )
    if rec.is_active:
        return Response(
            {'error': 'Recording is still in progress'},
            status=http.HTTP_409_CONFLICT,
        )
    if not rec.file_path:
        return Response(
            {'error': 'Recording must be finalized before publishing'},
            status=http.HTTP_409_CONFLICT,
        )

    raw_ids = request.data.get('user_ids') or []
    if not isinstance(raw_ids, list):
        return Response({'error': 'user_ids must be a list'}, status=http.HTTP_400_BAD_REQUEST)
    try:
        user_ids = [int(x) for x in raw_ids]
    except (TypeError, ValueError):
        return Response({'error': 'user_ids must contain integers'}, status=http.HTTP_400_BAD_REQUEST)

    # Optional shareable-link toggle (defaults to keeping current value).
    raw_link = request.data.get('is_link_shared')
    if raw_link is None:
        link_shared = rec.is_link_shared
    else:
        link_shared = bool(raw_link)

    # Resolve to real user rows; silently drop any that don't exist or are the
    # owner themselves (they always have access).
    users = list(
        User.objects.filter(pk__in=user_ids).exclude(pk=rec.owner_id)
    )

    with transaction.atomic():
        rec.is_published = True
        rec.published_at = timezone.now()
        rec.is_link_shared = link_shared
        rec.save(update_fields=['is_published', 'published_at', 'is_link_shared'])
        rec.visible_to.set(users)

    _send_publish_notifications(rec, [u.id for u in users])

    logger.info(
        'recording published token=%s targets=%d',
        rec.public_token, len(users),
    )

    payload = _serialize(rec, detail=True, viewer=request.user)
    payload['is_owner'] = True
    payload['shared_with'] = [
        {'id': u.id, 'username': u.username, 'full_name': u.full_name}
        for u in users
    ]
    return Response(payload)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unpublish_recording(request, token: str):
    """Owner revokes the publish. visible_to is cleared."""
    rec = _get_recording_or_404(token)
    if rec is None:
        return Response({'error': 'Recording not found'}, status=http.HTTP_404_NOT_FOUND)
    if rec.owner_id != request.user.id and not request.user.is_superuser:
        return Response(
            {'error': 'Only the owner can unpublish'},
            status=http.HTTP_403_FORBIDDEN,
        )

    with transaction.atomic():
        rec.is_published = False
        rec.published_at = None
        rec.is_link_shared = False
        rec.save(update_fields=['is_published', 'published_at', 'is_link_shared'])
        rec.visible_to.clear()

    logger.info('recording unpublished token=%s', rec.public_token)

    payload = _serialize(rec, detail=True, viewer=request.user)
    payload['is_owner'] = True
    return Response(payload)


# ---------------------------------------------------------------------------
# Watch tracking (viewer heartbeats + host-side analytics)
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def recording_heartbeat(request, token: str):
    """
    Viewer ping with their current playback position.

    Body: { "position_seconds": <float> }

    The owner's heartbeats are intentionally not stored — they're not the
    audience and we don't want their playthrough showing up in their own
    analytics. Anonymous / unauthenticated users can't reach this view
    (IsAuthenticated).
    """
    rec = _get_recording_or_404(token)
    if rec is None:
        return Response({'error': 'Recording not found'}, status=http.HTTP_404_NOT_FOUND)

    if not rec.can_be_viewed_by(request.user):
        return Response(
            {'error': 'You do not have permission to view this recording'},
            status=http.HTTP_403_FORBIDDEN,
        )
    if rec.owner_id == request.user.id:
        # Owner watching their own recording — silently no-op so the
        # frontend doesn't have to special-case the request.
        return Response({'ignored': 'owner'}, status=http.HTTP_200_OK)

    try:
        position = float(request.data.get('position_seconds') or 0)
    except (TypeError, ValueError):
        return Response(
            {'error': 'position_seconds must be a number'},
            status=http.HTTP_400_BAD_REQUEST,
        )

    # Clamp to the recording's known duration so a misbehaving client
    # can't store nonsense numbers.
    if rec.duration_seconds:
        position = max(0.0, min(position, float(rec.duration_seconds)))
    else:
        position = max(0.0, position)

    from rooms.models import RecordingView

    view, created = RecordingView.objects.get_or_create(
        recording=rec,
        user=request.user,
    )

    now = timezone.now()
    is_new_session = (
        created
        or (now - view.last_watched_at).total_seconds()
        > RecordingView.NEW_SESSION_GAP_SECONDS
    )

    view.last_position_seconds = position
    if position > view.furthest_position_seconds:
        view.furthest_position_seconds = position
    if is_new_session:
        view.view_count += 1
    view.save()

    return Response(
        {
            'last_position_seconds': view.last_position_seconds,
            'furthest_position_seconds': view.furthest_position_seconds,
            'view_count': view.view_count,
        },
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recording_views(request, token: str):
    """
    Host-only analytics: who has watched and how far.

    Returns:
        {
            "count": <int>,
            "results": [
                {
                    "user_id": ...,
                    "username": ...,
                    "full_name": ...,
                    "last_position_seconds": ...,
                    "furthest_position_seconds": ...,
                    "view_count": ...,
                    "first_watched_at": ...,
                    "last_watched_at": ...,
                    "completion_ratio": <float 0..1>
                }
            ]
        }
    """
    rec = _get_recording_or_404(token)
    if rec is None:
        return Response({'error': 'Recording not found'}, status=http.HTTP_404_NOT_FOUND)

    if rec.owner_id != request.user.id and not request.user.is_superuser:
        return Response(
            {'error': 'Only the owner can see who watched a recording'},
            status=http.HTTP_403_FORBIDDEN,
        )

    duration = float(rec.duration_seconds or 0)
    items = []
    for view in rec.views.select_related('user').order_by('-last_watched_at'):
        completion = 0.0
        if duration > 0:
            completion = min(1.0, view.furthest_position_seconds / duration)
        items.append({
            'user_id': view.user_id,
            'username': view.user.username,
            'full_name': view.user.full_name or view.user.username,
            'last_position_seconds': view.last_position_seconds,
            'furthest_position_seconds': view.furthest_position_seconds,
            'view_count': view.view_count,
            'first_watched_at': view.first_watched_at.isoformat(),
            'last_watched_at': view.last_watched_at.isoformat(),
            'completion_ratio': completion,
        })

    return Response({'count': len(items), 'results': items})


# ---------------------------------------------------------------------------
# Re-exports
# ---------------------------------------------------------------------------

# Re-export for convenience so the wiring in rooms/urls.py stays small.
__all__ = [
    'start_recording',
    'stop_recording',
    'pause_recording',
    'resume_recording',
    'recording_status',
    'recording_permission',
    'set_recording_permission',
    'egress_webhook',
    'list_recordings',
    'recording_detail_or_delete',
    'stream_recording',
    'finalize_recording',
    'publish_recording',
    'unpublish_recording',
    'recording_heartbeat',
    'recording_views',
    'start_client_recording',
    'upload_recording_chunk',
    'complete_client_recording',
]

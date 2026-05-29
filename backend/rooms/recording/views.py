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

LiveKit webhook:
    POST /api/recordings/webhook/                HMAC-verified

Auth model:
    * start/stop/pause/resume: only the host of the room
    * status: any participant of the room
    * list/detail/stream: Recording.can_be_viewed_by(user)
    * delete: owner only
    * webhook: HMAC-verified by livekit.api.WebhookReceiver
"""

from __future__ import annotations

import logging
import shutil
from pathlib import Path

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

from rooms.models import Recording, RecordingSegment, Room, RoomParticipant

from . import service
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


def _serialize(recording: Recording, *, detail: bool = False) -> dict:
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
    forbidden = _require_host(request, room)
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
    forbidden = _require_host(request, room)
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
    forbidden = _require_host(request, room)
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
    forbidden = _require_host(request, room)
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
        payload = _serialize(rec, detail=True)
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
        payload = _serialize(rec, detail=True)
        payload['is_owner'] = rec.owner_id == request.user.id
        return Response(payload)

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
# Re-exports
# ---------------------------------------------------------------------------

# Re-export for convenience so the wiring in rooms/urls.py stays small.
__all__ = [
    'start_recording',
    'stop_recording',
    'pause_recording',
    'resume_recording',
    'recording_status',
    'egress_webhook',
    'list_recordings',
    'recording_detail_or_delete',
    'stream_recording',
]

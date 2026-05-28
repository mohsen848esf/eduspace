"""
Host-only recording control endpoints + LiveKit egress webhook.

POST /api/rooms/<code>/recording/start/
POST /api/rooms/<code>/recording/stop/
POST /api/rooms/<code>/recording/pause/
POST /api/rooms/<code>/recording/resume/
GET  /api/rooms/<code>/recording/status/
POST /api/recordings/webhook/

Auth model:
    * start/stop/pause/resume: only the host of the room
    * status: any active room participant
    * webhook: HMAC-verified by livekit.api.WebhookReceiver
"""

from __future__ import annotations

import logging

from django.db import transaction
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


def _serialize(recording: Recording) -> dict:
    return {
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

    # Stop the most recent segment (the one that's actually running).
    last_segment = recording.segments.order_by('-index').first()
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
    try:
        event = parse_event(request.body, auth_header)
    except WebhookError as exc:
        logger.warning('webhook rejected: %s', exc)
        return Response({'error': str(exc)}, status=http.HTTP_401_UNAUTHORIZED)

    try:
        handle_event(event)
    except Exception:
        logger.exception('webhook handler crashed for event=%s', event.get('event'))
        # Always 200 once auth passes — we don't want LiveKit retrying
        # forever on a code bug. The exception is captured in logs.

    return Response({'ok': True})


# Re-export for convenience so the wiring in rooms/urls.py stays small.
__all__ = [
    'start_recording',
    'stop_recording',
    'pause_recording',
    'resume_recording',
    'recording_status',
    'egress_webhook',
]

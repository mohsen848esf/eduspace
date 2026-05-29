"""
LiveKit Egress webhook receiver.

LiveKit POSTs egress lifecycle events here as JSON, signed with the
api secret in an Authorization JWT. We verify the signature using the
SDK's WebhookReceiver (so a forged event can't flip a recording to
`completed`), then translate the event into Recording / RecordingSegment
state changes.

Events we care about:
    * EGRESS_STARTED   -> ensure segment row reflects active state
    * EGRESS_ENDING    -> noop (transitional)
    * EGRESS_ENDED     -> finalize segment, recompute parent recording
    * EGRESS_FAILED    -> mark segment + parent as FAILED, log details

Anything else is logged and acked with 200 so LiveKit doesn't retry.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone as dt_timezone
from typing import Optional

from django.conf import settings
from django.utils import timezone
from livekit.api import TokenVerifier, WebhookReceiver

from rooms.models import Recording, RecordingSegment

from .service import file_size_bytes

logger = logging.getLogger(__name__)

# Built once per process. WebhookReceiver is stateless after construction.
_verifier = TokenVerifier(
    api_key=settings.LIVEKIT_API_KEY,
    api_secret=settings.LIVEKIT_API_SECRET,
)
_receiver = WebhookReceiver(_verifier)


class WebhookError(Exception):
    """Raised when the webhook payload is invalid or unauthenticated."""


def parse_event(raw_body: bytes, auth_header: str) -> dict:
    """
    Verify the signature and return the decoded event payload as a
    plain dict. Raises WebhookError on any failure.
    """
    if not auth_header:
        raise WebhookError('missing authorization header')

    body_text = raw_body.decode('utf-8') if isinstance(raw_body, bytes) else raw_body
    try:
        event = _receiver.receive(body_text, auth_header)
    except Exception as exc:
        raise WebhookError(f'signature verification failed: {exc}') from exc

    # WebhookEvent is a protobuf object; convert to dict for ergonomic access.
    # The SDK exposes the raw json under .json if available, otherwise we
    # fall back to MessageToDict-style attribute access.
    try:
        return json.loads(body_text)
    except json.JSONDecodeError as exc:
        raise WebhookError(f'invalid json: {exc}') from exc


def handle_event(event: dict) -> None:
    """
    Dispatch a verified webhook event to the right handler.
    Unknown events are ignored.
    """
    event_type = event.get('event')
    egress_info = event.get('egressInfo') or {}
    egress_id = egress_info.get('egressId')
    if not event_type or not egress_id:
        logger.info('webhook ignored: type=%r egress_id=%r', event_type, egress_id)
        return

    segment = (
        RecordingSegment.objects
        .select_related('recording')
        .filter(egress_id=egress_id)
        .first()
    )
    if not segment:
        logger.warning('webhook for unknown egress_id=%s event=%s', egress_id, event_type)
        return

    if event_type == 'egress_started':
        _on_egress_started(segment)
    elif event_type == 'egress_ended':
        _on_egress_ended(segment, egress_info)
    elif event_type == 'egress_failed':
        _on_egress_failed(segment, egress_info)
    else:
        logger.info('webhook ignored event_type=%s egress_id=%s', event_type, egress_id)


# ---------------------------------------------------------------------------
# Per-event handlers
# ---------------------------------------------------------------------------

def _on_egress_started(segment: RecordingSegment) -> None:
    recording = segment.recording
    if recording.status == Recording.Status.STARTING:
        recording.status = Recording.Status.RECORDING
        recording.save(update_fields=['status'])
    logger.info(
        'egress_started: recording=%s segment=%d',
        recording.public_token, segment.index,
    )


def _on_egress_ended(segment: RecordingSegment, egress_info: dict) -> None:
    """
    Worker finished writing the segment file. Persist its size/duration
    and, if this was the final segment, flip the parent recording to
    PROCESSING -> COMPLETED (or FAILED if egress aborted).
    """
    recording = segment.recording

    # Detect aborted/failed egress. Egress can end with status EGRESS_ABORTED
    # or EGRESS_FAILED + a non-empty `error`. We treat both as a hard failure
    # for the *segment*, but only fail the parent if there are no successful
    # segments alongside this one.
    egress_status = (egress_info.get('status') or '').upper()
    egress_error = egress_info.get('error') or ''
    is_failed_egress = (
        egress_status in {'EGRESS_ABORTED', 'EGRESS_FAILED'}
        or bool(egress_error)
    )

    # Finalize the segment row.
    segment.ended_at = _ts_from_egress(egress_info, key='endedAt') or timezone.now()
    duration = _segment_duration_seconds(egress_info)
    if duration:
        segment.duration_seconds = duration
    if segment.file_path and not is_failed_egress:
        segment.size_bytes = file_size_bytes(segment.file_path)
    segment.save(update_fields=['ended_at', 'duration_seconds', 'size_bytes'])

    if is_failed_egress:
        logger.warning(
            'egress aborted: token=%s segment=%d status=%s error=%s',
            recording.public_token, segment.index, egress_status, egress_error,
        )

    # If the parent recording is still PAUSED we leave it alone — the host
    # will resume into a new segment. Anything else means this was the
    # final segment of a stop() call.
    if recording.status == Recording.Status.PAUSED:
        logger.info(
            'segment %d ended while parent paused, awaiting resume/stop',
            segment.index,
        )
        return

    # Aggregate totals across all successful segments.
    successful_segments = [
        s for s in recording.segments.all() if s.size_bytes > 0
    ]
    total_duration = sum(s.duration_seconds for s in successful_segments)
    total_size = sum(s.size_bytes for s in successful_segments)
    last_segment = next(
        (s for s in sorted(successful_segments, key=lambda x: x.index, reverse=True)),
        None,
    )

    recording.duration_seconds = int(round(total_duration))
    recording.size_bytes = total_size
    if last_segment and last_segment.file_path:
        recording.file_path = last_segment.file_path

    if successful_segments:
        recording.status = Recording.Status.COMPLETED
    else:
        recording.status = Recording.Status.FAILED
    recording.completed_at = timezone.now()
    recording.save(
        update_fields=[
            'duration_seconds', 'size_bytes', 'file_path',
            'status', 'completed_at',
        ],
    )
    logger.info(
        'recording finalized token=%s status=%s segments=%d duration=%ds size=%dB',
        recording.public_token,
        recording.status,
        recording.segments.count(),
        recording.duration_seconds,
        recording.size_bytes,
    )


def _on_egress_failed(segment: RecordingSegment, egress_info: dict) -> None:
    recording = segment.recording
    error = egress_info.get('error') or 'unknown'
    logger.error(
        'egress_failed token=%s segment=%d: %s',
        recording.public_token, segment.index, error,
    )
    segment.ended_at = timezone.now()
    segment.save(update_fields=['ended_at'])
    recording.status = Recording.Status.FAILED
    recording.completed_at = timezone.now()
    recording.save(update_fields=['status', 'completed_at'])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ts_from_egress(egress_info: dict, key: str) -> Optional[datetime]:
    """LiveKit timestamps are protobuf int64 nanoseconds-since-epoch."""
    raw = egress_info.get(key)
    if not raw:
        return None
    try:
        return datetime.fromtimestamp(int(raw) / 1e9, tz=dt_timezone.utc)
    except (TypeError, ValueError):
        return None


def _segment_duration_seconds(egress_info: dict) -> float:
    """
    Try to extract duration from the egress info. Prefer the file's own
    metadata when present; otherwise compute from started/ended timestamps.
    """
    file_results = egress_info.get('fileResults') or []
    if file_results:
        duration_ns = file_results[0].get('duration')
        if duration_ns:
            try:
                return int(duration_ns) / 1e9
            except (TypeError, ValueError):
                pass

    started = _ts_from_egress(egress_info, key='startedAt')
    ended = _ts_from_egress(egress_info, key='endedAt')
    if started and ended:
        return max(0.0, (ended - started).total_seconds())
    return 0.0

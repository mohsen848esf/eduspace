"""
Persisted notifications — list, mark-read, delete.

Every realtime WebSocket push from `notifications_<user_id>` is also
recorded as a Notification row by `record_and_dispatch()` so users can
catch up on anything that arrived while they were offline.

The list endpoint is the source of truth for the inbox; the WebSocket
remains the live channel that fires toasts and pushes updates into the
already-mounted inbox.
"""

from __future__ import annotations

import logging
from typing import Iterable

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status as http
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------

def _serialize(n: Notification) -> dict:
    """
    Frontend-shaped notification entry.

    The legacy WebSocket payload was a flat dict like
    ``{type, room_code, room_name, ...}``. We preserve that shape for
    backwards compatibility — the keys on the inbox row are the same
    keys the WS handler already knows how to render.
    """
    return {
        'id': n.id,
        'kind': n.kind,
        'data': n.payload,
        'created_at': n.created_at.isoformat(),
        'delivered_at': n.delivered_at.isoformat() if n.delivered_at else None,
        'read_at': n.read_at.isoformat() if n.read_at else None,
    }


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_notifications(request):
    """
    GET /api/auth/notifications/?unread_only=true

    Returns the latest 100 notifications for the requesting user,
    most recent first. Pass ``unread_only=true`` to filter to entries
    where ``read_at IS NULL``.
    """
    qs = Notification.objects.filter(user=request.user)
    if request.query_params.get('unread_only', '').lower() in ('1', 'true', 'yes'):
        qs = qs.filter(read_at__isnull=True)

    items = [_serialize(n) for n in qs[:100]]
    unread = (
        Notification.objects
        .filter(user=request.user, read_at__isnull=True)
        .count()
    )
    return Response({
        'count': len(items),
        'unread_count': unread,
        'results': items,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, pk: int):
    """POST /api/auth/notifications/<id>/read/ — flag a single entry."""
    n = get_object_or_404(Notification, pk=pk, user=request.user)
    n.mark_read()
    return Response(_serialize(n))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    """POST /api/auth/notifications/read-all/ — flag everything."""
    now = timezone.now()
    Notification.objects.filter(user=request.user, read_at__isnull=True).update(
        read_at=now,
    )
    return Response({'ok': True, 'read_at': now.isoformat()})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_notification(request, pk: int):
    """DELETE /api/auth/notifications/<id>/ — remove a single entry."""
    n = get_object_or_404(Notification, pk=pk, user=request.user)
    n.delete()
    return Response(status=http.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Helper used by views that broadcast notifications
# ---------------------------------------------------------------------------

def record_and_dispatch(user_id: int, kind: str, data: dict) -> Notification | None:
    """
    Persist the notification, then push it over the WebSocket to any
    live session for the user.

    Callers used to call ``layer.group_send(...)`` directly. Switching
    to this helper guarantees the row is durable so a user who logs
    in later still sees it in their inbox.

    The WebSocket payload now carries the same fields as the persisted
    serializer (``id``, ``kind``, ``data``, ``created_at``, ``read_at``,
    ``delivered_at``). Older clients that just look at ``data.type``
    keep working because ``type`` is still in the data blob.
    """
    if not user_id:
        return None

    notif = Notification.objects.create(
        user_id=user_id,
        kind=kind,
        payload=data or {},
    )

    layer = get_channel_layer()
    if layer is None:
        # No channel layer configured (test runs, scripts). The row is
        # already persisted, so the user will see it on their next
        # inbox refresh.
        return notif

    payload = _serialize(notif)
    try:
        async_to_sync(layer.group_send)(
            f'notifications_{user_id}',
            {
                'type': 'send_notification',
                # Older WS clients look at the inner ``data`` object;
                # newer ones can read the wrapping fields too.
                'data': {**payload['data'], **{
                    'id': payload['id'],
                    'kind': payload['kind'],
                    'created_at': payload['created_at'],
                    'read_at': payload['read_at'],
                }},
            },
        )
        notif.delivered_at = timezone.now()
        notif.save(update_fields=['delivered_at'])
    except Exception:
        logger.exception(
            'failed to deliver realtime notification id=%s to user=%s',
            notif.id, user_id,
        )

    return notif


def record_and_dispatch_many(user_ids: Iterable[int], kind: str, data: dict) -> None:
    """Convenience wrapper for fan-out cases (recording publish)."""
    for uid in user_ids:
        record_and_dispatch(uid, kind, data)

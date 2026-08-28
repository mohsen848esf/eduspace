"""Server-owned participant capabilities shared by both grant entry points."""

from django.db.models import Q

from rooms.models import Room
from rooms.services.guest_access import (
    InvalidGuestAccessToken,
    decode_guest_access_token,
)


PERMISSION_FIELDS = {
    'screen_share': 'can_share_screen',
    'microphone': 'can_use_microphone',
    'camera': 'can_use_camera',
    'presentation_upload': 'can_upload_presentation',
}


class RoomPermissionError(Exception):
    def __init__(self, message, code, status_code):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def grant_permission(*, room, user, data, permission_type):
    if not room.can_manage_room(user):
        raise RoomPermissionError(
            'Only host or co-hosts can grant permissions', 'FORBIDDEN', 403,
        )
    if room.status == Room.Status.ENDED:
        raise RoomPermissionError('Room has ended', 'ROOM_ENDED', 410)
    field = (
        PERMISSION_FIELDS.get(permission_type)
        if isinstance(permission_type, str) else None
    )
    granted = data.get('granted', True)
    if field is None or not isinstance(granted, bool):
        raise RoomPermissionError(
            'Invalid permission or granted value', 'INVALID_PERMISSION', 400,
        )

    participants = room.participants.filter(is_active=True).select_related('user')
    if 'user_id' in data:
        try:
            participants = participants.filter(user_id=int(data['user_id']))
        except (TypeError, ValueError):
            raise RoomPermissionError(
                'Invalid user_id', 'INVALID_IDENTITY', 400,
            ) from None
    else:
        identity = data.get('identity') or data.get('username')
        if not isinstance(identity, str) or not identity:
            raise RoomPermissionError(
                'Identity required', 'INVALID_IDENTITY', 400,
            )
        participants = participants.filter(
            Q(user__username=identity) | Q(guest_identity=identity),
        )
    participant = participants.first()
    if participant is None:
        raise RoomPermissionError(
            'Active participant not found', 'PARTICIPANT_NOT_FOUND', 404,
        )
    setattr(participant, field, granted)
    participant.save(update_fields=[field])
    identity = (
        participant.guest_identity if participant.is_guest
        else participant.user.username
    )
    return {
        'message': 'Permission updated',
        'participant': identity,
        'permission_type': permission_type,
        'granted': granted,
    }


def permission_snapshot(*, room, user, guest_access_token):
    if room.status == Room.Status.ENDED:
        raise RoomPermissionError('Room has ended', 'ROOM_ENDED', 410)
    if guest_access_token:
        try:
            identity = decode_guest_access_token(
                token=guest_access_token, room_code=room.room_code,
            )
        except InvalidGuestAccessToken:
            raise RoomPermissionError(
                'Invalid guest token', 'INVALID_GUEST_ACCESS_TOKEN', 401,
            ) from None
        participant = room.participants.filter(
            guest_identity=identity, is_guest=True, is_active=True,
        ).first()
        is_host = is_co_host = False
    elif user.is_authenticated:
        identity = user.username
        is_host = room.host_id == user.pk
        is_co_host = room.co_hosts.filter(pk=user.pk).exists()
        participant = room.participants.filter(user=user, is_active=True).first()
    else:
        raise RoomPermissionError(
            'Authentication required', 'AUTHENTICATION_REQUIRED', 401,
        )
    moderator = is_host or is_co_host
    if participant is None and not moderator:
        raise RoomPermissionError(
            'Active participant required', 'ACTIVE_ROOM_PARTICIPANT_REQUIRED', 403,
        )

    def capabilities(p, is_moderator=False):
        return {
            field: is_moderator or bool(getattr(p, field, False))
            for field in PERMISSION_FIELDS.values()
        }

    return {
        'room_code': room.room_code,
        'identity': identity,
        'host_identity': room.host.username if room.host else '',
        'co_hosts': list(room.co_hosts.values_list('username', flat=True)),
        'is_host': is_host,
        'is_co_host': is_co_host,
        'lock_screen_share': room.lock_screen_share,
        'lock_microphone': room.lock_microphone,
        'lock_camera': room.lock_camera,
        'lock_document_presentation': room.lock_document_presentation,
        **capabilities(participant, moderator),
        # Only moderators need everyone's grant state for member menus.
        'participants': [
            {
                'identity': p.guest_identity if p.is_guest else p.user.username,
                **capabilities(p),
            }
            for p in room.participants.filter(
                is_active=True,
            ).select_related('user')
            if p.is_guest or p.user_id
        ] if moderator else [],
    }

from dataclasses import dataclass

from django.db import transaction

from rooms.models import PresentationDocument, Room, RoomParticipant
from rooms.services.guest_access import (
    InvalidGuestAccessToken,
    decode_guest_access_token,
)


class PresentationAccessError(Exception):
    def __init__(self, *, message: str, code: str, status_code: int):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


@dataclass(frozen=True)
class PresentationActor:
    participant: RoomParticipant | None
    is_moderator: bool


class PresentationService:
    @staticmethod
    def authorize_control(*, room: Room, user, guest_access_token: str | None) -> PresentationActor:
        if room.status == Room.Status.ENDED:
            raise PresentationAccessError(
                message='Room has ended',
                code='ROOM_ENDED',
                status_code=410,
            )

        if user and user.is_authenticated:
            if room.can_manage_room(user):
                return PresentationActor(participant=None, is_moderator=True)
            participant = RoomParticipant.objects.filter(
                room=room,
                user=user,
                is_active=True,
            ).first()
        else:
            if not guest_access_token:
                raise PresentationAccessError(
                    message='A signed guest access token is required',
                    code='GUEST_ACCESS_TOKEN_REQUIRED',
                    status_code=401,
                )
            try:
                guest_identity = decode_guest_access_token(
                    token=guest_access_token,
                    room_code=room.room_code,
                )
            except InvalidGuestAccessToken as exc:
                raise PresentationAccessError(
                    message='Invalid or expired guest access token',
                    code='INVALID_GUEST_ACCESS_TOKEN',
                    status_code=401,
                ) from exc
            participant = RoomParticipant.objects.filter(
                room=room,
                guest_identity=guest_identity,
                is_guest=True,
                is_active=True,
            ).first()

        if participant is None:
            raise PresentationAccessError(
                message='Only active room participants can control presentations',
                code='ACTIVE_ROOM_PARTICIPANT_REQUIRED',
                status_code=403,
            )

        if room.lock_document_presentation and not participant.can_upload_presentation:
            raise PresentationAccessError(
                message='Presentation control requires permission from a host or co-host',
                code='PRESENTATION_PERMISSION_REQUIRED',
                status_code=403,
            )

        return PresentationActor(participant=participant, is_moderator=False)

    @staticmethod
    @transaction.atomic
    def set_active(*, room: Room, document_id: int, is_active: bool) -> PresentationDocument | None:
        locked_room = Room.objects.select_for_update().get(pk=room.pk)
        if not is_active or document_id == 0:
            locked_room.presentations.update(is_active_on_stage=False)
            return None

        document = PresentationDocument.objects.select_for_update().get(
            room=locked_room,
            pk=document_id,
        )
        locked_room.presentations.exclude(pk=document.pk).update(is_active_on_stage=False)
        if not document.is_active_on_stage:
            document.is_active_on_stage = True
            document.save(update_fields=['is_active_on_stage'])
        return document

    @staticmethod
    @transaction.atomic
    def set_page(*, room: Room, document_id: int, page: int) -> PresentationDocument:
        document = PresentationDocument.objects.select_for_update().get(
            room=room,
            pk=document_id,
        )
        document.current_page = max(1, min(document.total_pages, page))
        document.save(update_fields=['current_page'])
        return document

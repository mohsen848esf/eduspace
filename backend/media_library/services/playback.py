from decimal import Decimal

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from media_library.models import MediaAsset, SharedPlaybackSession


class ActiveSharedPlaybackError(ValidationError):
    """Raised when a room is already playing a different media asset."""

    code = 'ACTIVE_SHARED_PLAYBACK'
    default_message = 'This room already has an open shared playback session.'

    def __init__(self):
        super().__init__(self.default_message, code=self.code)


class MediaAssetService:
    @staticmethod
    @transaction.atomic
    def mark_deleted(*, asset: MediaAsset, actor) -> MediaAsset:
        locked = MediaAsset.objects.select_for_update().get(pk=asset.pk)
        if locked.is_deleted:
            return locked
        if not actor or not actor.is_authenticated:
            raise PermissionDenied('Authentication is required.')
        if actor.id not in {locked.uploader_id, locked.owner_id}:
            raise PermissionDenied('Only the media owner or uploader can delete this media.')
        if locked.playback_sessions.filter(ended_at__isnull=True).exists():
            raise ValidationError('Media cannot be deleted while it is active in a room.')
        locked.is_deleted = True
        locked.deleted_at = timezone.now()
        locked.save(update_fields=['is_deleted', 'deleted_at', 'updated_at'])
        return locked


class SharedPlaybackService:
    @staticmethod
    def _validate_controller(room, actor) -> None:
        if not room.can_manage_room(actor):
            raise PermissionDenied('Only the host or a co-host can control shared playback.')

    @classmethod
    @transaction.atomic
    def open_session(
        cls,
        *,
        room,
        asset: MediaAsset,
        actor,
        resumed_from: SharedPlaybackSession | None = None,
        start_position_ms: int | None = None,
    ) -> SharedPlaybackSession:
        room = room.__class__.objects.select_for_update().get(pk=room.pk)
        asset = MediaAsset.objects.select_for_update().get(pk=asset.pk)
        cls._validate_controller(room, actor)
        if room.status == room.Status.ENDED:
            raise ValidationError('Shared playback cannot start in an ended room.')
        if asset.owner_id not in {room.host_id, actor.id}:
            raise PermissionDenied('This media is not available to the room controller.')
        if not asset.can_start_playback:
            raise ValidationError('Media asset is not currently playable.')
        active_playback = (
            SharedPlaybackSession.objects.select_for_update()
            .filter(room=room, ended_at__isnull=True)
            .first()
        )
        if active_playback:
            # Opening the currently active asset is safe to retry. This is
            # important after a reconnect or a modal that outlived the room
            # snapshot; it must not create a second session or surface a
            # misleading validation error.
            if active_playback.asset_id == asset.id:
                return active_playback
            raise ActiveSharedPlaybackError()
        if resumed_from:
            if resumed_from.asset_id != asset.id:
                raise ValidationError('Continuation must reference the same media asset.')
            if resumed_from.ended_at is None:
                raise ValidationError('Only a closed playback session can be continued.')
        position_ms = start_position_ms
        if position_ms is None:
            position_ms = resumed_from.anchor_position_ms if resumed_from else 0
        if position_ms < 0 or position_ms > asset.seekable_until_ms:
            raise ValidationError('Start position is outside the media duration.')
        return SharedPlaybackSession.objects.create(
            room=room,
            asset=asset,
            controller=actor,
            resumed_from=resumed_from,
            anchor_position_ms=position_ms,
            effective_at=timezone.now(),
        )

    @classmethod
    @transaction.atomic
    def apply_command(
        cls,
        *,
        playback: SharedPlaybackSession,
        actor,
        command: str,
        expected_version: int,
        position_ms: int | None = None,
        effective_at=None,
        playback_rate: Decimal | float | str = Decimal('1.00'),
        sync_policy: str | None = None,
        buffer_reason: str = SharedPlaybackSession.BufferReason.NONE,
    ) -> SharedPlaybackSession:
        locked = (
            SharedPlaybackSession.objects.select_for_update()
            .select_related('room', 'asset')
            .get(pk=playback.pk)
        )
        cls._validate_controller(locked.room, actor)
        if locked.ended_at is not None:
            raise ValidationError('Playback session has already ended.')
        if locked.version != expected_version:
            raise ValidationError('Playback command is stale; refresh the authoritative snapshot.')
        command = command.upper()
        now = timezone.now()
        current_position = locked.expected_position_ms(now)
        target_position = current_position if position_ms is None else position_ms
        position_limit = (
            locked.asset.seekable_until_ms
            if command in {'PLAY', 'SEEK'}
            else locked.asset.published_duration_ms
        )
        if target_position < 0 or target_position > position_limit:
            raise ValidationError('Playback position is outside the media duration.')
        rate = Decimal(str(playback_rate))
        if rate < Decimal('0.25') or rate > Decimal('4.00'):
            raise ValidationError('Playback rate is outside the supported range.')
        if command == 'PLAY':
            locked.state = SharedPlaybackSession.State.PLAYING
            locked.buffer_reason = SharedPlaybackSession.BufferReason.NONE
        elif command == 'PAUSE':
            locked.state = SharedPlaybackSession.State.PAUSED
            locked.buffer_reason = SharedPlaybackSession.BufferReason.NONE
        elif command == 'SEEK':
            # A seek is a timeline mutation, not an implicit pause. Preserve
            # active playback so a host can jump ahead without a second PLAY.
            locked.state = (
                SharedPlaybackSession.State.PLAYING
                if locked.state == SharedPlaybackSession.State.PLAYING
                else SharedPlaybackSession.State.PAUSED
            )
            locked.buffer_reason = SharedPlaybackSession.BufferReason.NONE
        elif command == 'BUFFERING':
            if buffer_reason not in {
                SharedPlaybackSession.BufferReason.FRONTIER,
                SharedPlaybackSession.BufferReason.READINESS,
            }:
                raise ValidationError('Unsupported buffering reason.')
            locked.state = SharedPlaybackSession.State.BUFFERING
            locked.buffer_reason = buffer_reason
        elif command == 'STOP':
            locked.state = SharedPlaybackSession.State.ENDED
            locked.buffer_reason = SharedPlaybackSession.BufferReason.NONE
            locked.ended_at = now
        elif command == 'SET_SYNC_POLICY':
            if sync_policy not in SharedPlaybackSession.SyncPolicy.values:
                raise ValidationError('Unsupported synchronization policy.')
            locked.sync_policy = sync_policy
        else:
            raise ValidationError('Unsupported playback command.')
        locked.anchor_position_ms = target_position
        locked.effective_at = effective_at or now
        locked.playback_rate = rate
        locked.version += 1
        locked.controller = actor
        locked.save(update_fields=[
            'state', 'sync_policy', 'buffer_reason', 'anchor_position_ms', 'effective_at', 'playback_rate',
            'version', 'controller', 'ended_at', 'updated_at',
        ])
        return locked

import secrets
import uuid
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.conf import settings
from django.db import models
from django.utils import timezone


def _make_public_token() -> str:
    return secrets.token_urlsafe(16)


def media_source_upload_path(instance, filename: str) -> str:
    suffix = ''
    if '.' in filename:
        suffix = f'.{filename.rsplit(".", 1)[-1].lower()[:10]}'
    return f'media_library/{instance.owner_id}/source/{uuid.uuid4().hex}{suffix}'


class MediaAsset(models.Model):
    class Status(models.TextChoices):
        UPLOADING = 'uploading', 'Uploading'
        UPLOADED = 'uploaded', 'Uploaded'
        INSPECTING = 'inspecting', 'Inspecting'
        PROBING = 'probing', 'Probing'
        PROCESSING = 'processing', 'Processing'
        PARTIALLY_PLAYABLE = 'partially_playable', 'Partially playable'
        READY = 'ready', 'Ready'
        FAILED = 'failed', 'Failed'

    class RetentionPolicy(models.TextChoices):
        MANUAL = 'manual', 'Manual deletion only'
        SCHEDULED = 'scheduled', 'Scheduled expiry'

    owner = models.ForeignKey(
        'accounts.User',
        on_delete=models.PROTECT,
        related_name='owned_media_assets',
    )
    uploader = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_media_assets',
    )
    public_token = models.CharField(
        max_length=32,
        unique=True,
        default=_make_public_token,
        editable=False,
    )
    title = models.CharField(max_length=255)
    original_filename = models.CharField(max_length=255, blank=True, default='')
    source_file = models.FileField(
        upload_to=media_source_upload_path,
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.UPLOADING,
    )
    content_type = models.CharField(max_length=100, blank=True, default='')
    container = models.CharField(max_length=32, blank=True, default='')
    video_codec = models.CharField(max_length=32, blank=True, default='')
    audio_codec = models.CharField(max_length=32, blank=True, default='')
    duration_ms = models.PositiveBigIntegerField(default=0)
    size_bytes = models.PositiveBigIntegerField(default=0)
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    checksum_sha256 = models.CharField(max_length=64, blank=True, default='')
    master_manifest_path = models.CharField(max_length=500, blank=True, default='')
    failure_code = models.CharField(max_length=64, blank=True, default='')
    retention_policy = models.CharField(
        max_length=16,
        choices=RetentionPolicy.choices,
        default=RetentionPolicy.MANUAL,
    )
    expires_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    # Celery task id of the currently running inspect/transcode task, if any.
    # Deletion looks this up to revoke a still-queued task before it starts.
    active_task_id = models.CharField(max_length=155, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['owner', 'is_deleted', '-created_at']),
            models.Index(fields=['owner', 'status']),
        ]

    def __str__(self) -> str:
        return f'{self.title} ({self.public_token})'

    @property
    def can_start_playback(self) -> bool:
        return (
            not self.is_deleted
            and self.status in {self.Status.PARTIALLY_PLAYABLE, self.Status.READY}
            and self.published_duration_ms > 0
        )

    @property
    def published_duration_ms(self) -> int:
        playable = [
            rendition.published_duration_ms
            for rendition in self.renditions.all()
            if rendition.status in {
                MediaRendition.Status.PLAYABLE,
                MediaRendition.Status.READY,
            }
        ]
        if playable:
            return max(playable)
        return self.duration_ms if self.status == self.Status.READY else 0

    @property
    def is_progressively_growing(self) -> bool:
        if not (
            settings.MEDIA_PROGRESSIVE_UPLOAD_ENABLED
            and settings.MEDIA_PROGRESSIVE_INGEST_ENABLED
        ):
            return False
        return self.progressive_uploads.filter(
            status__in=[
                ProgressiveMediaUpload.Status.INGESTING,
                ProgressiveMediaUpload.Status.FINALIZING,
            ],
            ingest_finished_at__isnull=True,
        ).exists()

    @property
    def seekable_until_ms(self) -> int:
        published = self.published_duration_ms
        if self.is_progressively_growing:
            return max(0, published - settings.MEDIA_PROGRESSIVE_SEEK_GUARD_MS)
        return published


class MediaRendition(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PROCESSING = 'processing', 'Processing'
        PLAYABLE = 'playable', 'Playable'
        READY = 'ready', 'Ready'
        FAILED = 'failed', 'Failed'

    asset = models.ForeignKey(
        MediaAsset,
        on_delete=models.CASCADE,
        related_name='renditions',
    )
    label = models.CharField(max_length=32)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    bitrate_bps = models.PositiveIntegerField(default=0)
    manifest_path = models.CharField(max_length=500, blank=True, default='')
    published_duration_ms = models.PositiveBigIntegerField(default=0)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['asset', 'label'],
                name='unique_media_rendition_label_per_asset',
            ),
        ]
        indexes = [models.Index(fields=['asset', 'status'])]

    def __str__(self) -> str:
        return f'{self.asset_id}:{self.label}'


class MediaUploadSession(models.Model):
    class Status(models.TextChoices):
        INITIATED = 'initiated', 'Initiated'
        UPLOADING = 'uploading', 'Uploading'
        COMPLETED = 'completed', 'Completed'
        ABORTED = 'aborted', 'Aborted'
        FAILED = 'failed', 'Failed'

    asset = models.ForeignKey(
        MediaAsset,
        on_delete=models.CASCADE,
        related_name='upload_sessions',
    )
    public_token = models.CharField(
        max_length=32,
        unique=True,
        default=_make_public_token,
        editable=False,
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.INITIATED)
    provider_upload_id = models.CharField(max_length=500)
    object_key = models.CharField(max_length=500)
    expected_size_bytes = models.PositiveBigIntegerField()
    uploaded_bytes = models.PositiveBigIntegerField(default=0)
    part_size_bytes = models.PositiveIntegerField()
    content_type = models.CharField(max_length=100)
    expires_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['asset', 'status', '-created_at'])]
        constraints = [
            models.UniqueConstraint(
                fields=['asset'],
                condition=models.Q(status__in=['initiated', 'uploading']),
                name='one_active_upload_per_media_asset',
            ),
        ]


class ProgressiveMediaUpload(models.Model):
    """Provider-neutral upload made of independently readable private objects."""

    class Status(models.TextChoices):
        INITIATED = 'initiated', 'Initiated'
        UPLOADING = 'uploading', 'Uploading'
        VERIFYING = 'verifying', 'Verifying chunks'
        INGESTING = 'ingesting', 'Progressive ingest'
        FINALIZING = 'finalizing', 'Finalizing source'
        COMPLETED = 'completed', 'Completed'
        FALLBACK_REQUIRED = 'fallback_required', 'Fallback required'
        ABORTED = 'aborted', 'Aborted'
        FAILED = 'failed', 'Failed'

    class Compatibility(models.TextChoices):
        PENDING = 'pending', 'Pending verification'
        ELIGIBLE = 'eligible', 'Eligible for progressive ingest'
        INELIGIBLE = 'ineligible', 'Requires complete-upload fallback'

    asset = models.ForeignKey(
        MediaAsset,
        on_delete=models.CASCADE,
        related_name='progressive_uploads',
    )
    public_token = models.CharField(
        max_length=32,
        unique=True,
        default=_make_public_token,
        editable=False,
    )
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.INITIATED,
    )
    compatibility = models.CharField(
        max_length=16,
        choices=Compatibility.choices,
        default=Compatibility.PENDING,
    )
    expected_size_bytes = models.PositiveBigIntegerField()
    uploaded_bytes = models.PositiveBigIntegerField(default=0)
    contiguous_uploaded_bytes = models.PositiveBigIntegerField(default=0)
    contiguous_verified_bytes = models.PositiveBigIntegerField(default=0)
    chunk_size_bytes = models.PositiveIntegerField()
    content_type = models.CharField(max_length=100)
    object_prefix = models.CharField(max_length=500, unique=True)
    fallback_code = models.CharField(max_length=64, blank=True, default='')
    ingest_prefix = models.CharField(max_length=500, blank=True, default='')
    ingest_failure_code = models.CharField(max_length=64, blank=True, default='')
    ingest_attempt = models.PositiveIntegerField(default=0)
    last_consumed_sequence = models.PositiveIntegerField(default=0)
    ingest_started_at = models.DateTimeField(null=True, blank=True)
    ingest_heartbeat_at = models.DateTimeField(null=True, blank=True)
    ingest_finished_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['asset', 'status', '-created_at']),
            models.Index(fields=['status', 'expires_at']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['asset'],
                condition=models.Q(
                    status__in=[
                        'initiated', 'uploading', 'verifying', 'ingesting',
                        'finalizing', 'fallback_required',
                    ],
                ),
                name='one_active_progressive_upload_per_asset',
            ),
        ]


class ProgressiveMediaChunk(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending upload'
        UPLOADED = 'uploaded', 'Uploaded'
        VERIFIED = 'verified', 'Checksum verified'
        CONSUMED = 'consumed', 'Consumed by ingest'
        FAILED = 'failed', 'Verification failed'

    upload = models.ForeignKey(
        ProgressiveMediaUpload,
        on_delete=models.CASCADE,
        related_name='chunks',
    )
    sequence = models.PositiveIntegerField()
    object_key = models.CharField(max_length=500, unique=True)
    expected_size_bytes = models.PositiveIntegerField()
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    etag = models.CharField(max_length=200, blank=True, default='')
    checksum_sha256 = models.CharField(max_length=64, blank=True, default='')
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sequence']
        constraints = [
            models.UniqueConstraint(
                fields=['upload', 'sequence'],
                name='unique_progressive_chunk_sequence',
            ),
        ]
        indexes = [
            models.Index(fields=['upload', 'status', 'sequence']),
        ]


class SharedPlaybackSession(models.Model):
    class State(models.TextChoices):
        IDLE = 'idle', 'Idle'
        PLAYING = 'playing', 'Playing'
        PAUSED = 'paused', 'Paused'
        BUFFERING = 'buffering', 'Buffering'
        ENDED = 'ended', 'Ended'

    class SyncPolicy(models.TextChoices):
        CONTINUOUS = 'continuous', 'Continuous playback'
        STRICT = 'strict', 'Strict synchronization'

    class BufferReason(models.TextChoices):
        NONE = '', 'None'
        FRONTIER = 'frontier', 'Upload frontier'
        READINESS = 'readiness', 'Participant readiness'

    room = models.ForeignKey(
        'rooms.Room',
        on_delete=models.CASCADE,
        related_name='shared_playback_sessions',
    )
    asset = models.ForeignKey(
        MediaAsset,
        on_delete=models.PROTECT,
        related_name='playback_sessions',
    )
    controller = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='controlled_media_playbacks',
    )
    resumed_from = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='continuations',
    )
    state = models.CharField(
        max_length=16,
        choices=State.choices,
        default=State.IDLE,
    )
    sync_policy = models.CharField(
        max_length=16,
        choices=SyncPolicy.choices,
        default=SyncPolicy.CONTINUOUS,
    )
    buffer_reason = models.CharField(
        max_length=16,
        choices=BufferReason.choices,
        default=BufferReason.NONE,
        blank=True,
    )
    version = models.PositiveBigIntegerField(default=1)
    anchor_position_ms = models.PositiveBigIntegerField(default=0)
    effective_at = models.DateTimeField(default=timezone.now)
    playback_rate = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=Decimal('1.00'),
        validators=[MinValueValidator(Decimal('0.25'))],
    )
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-started_at']
        constraints = [
            models.UniqueConstraint(
                fields=['room'],
                condition=models.Q(ended_at__isnull=True),
                name='one_open_shared_playback_per_room',
            ),
        ]
        indexes = [
            models.Index(fields=['asset', '-started_at']),
            models.Index(fields=['room', 'ended_at']),
        ]

    def __str__(self) -> str:
        return f'Playback {self.pk} / {self.asset_id} / {self.room_id}'

    def expected_position_ms(self, at=None) -> int:
        if self.state != self.State.PLAYING:
            return self.anchor_position_ms
        at = at or timezone.now()
        elapsed_ms = max(0, int((at - self.effective_at).total_seconds() * 1000))
        projected = self.anchor_position_ms + int(elapsed_ms * float(self.playback_rate))
        if self.asset.published_duration_ms:
            return min(projected, self.asset.published_duration_ms)
        return projected

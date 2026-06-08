import secrets

from django.conf import settings
from django.db import models

from accounts.models import User


class Room(models.Model):
    class Status(models.TextChoices):
        WAITING = 'waiting', 'Waiting'
        ACTIVE = 'active', 'Active'
        ENDED = 'ended', 'Ended'

    name = models.CharField(max_length=255)
    room_code = models.CharField(max_length=10, unique=True)
    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hosted_rooms')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.WAITING)
    max_participants = models.PositiveIntegerField(default=20)
    is_recorded = models.BooleanField(default=False)
    session = models.OneToOneField('accounts.Session', null=True, blank=True, on_delete=models.SET_NULL, related_name='room')
    organization = models.ForeignKey('accounts.Organization', null=True, blank=True, on_delete=models.SET_NULL, related_name='rooms')
    meeting_type = models.CharField(max_length=20, choices=[('class_session', 'Class Session'), ('ad_hoc', 'Ad-hoc')], default='ad_hoc')

    # Per-room set of non-host users the host has explicitly authorized
    # to start / stop / pause / resume recording during the call. The
    # host themselves is implicitly always allowed and does NOT need to
    # be in this set.
    recording_grants = models.ManyToManyField(
        User,
        blank=True,
        related_name='rooms_with_recording_grant',
        help_text=(
            'Non-host participants the host has authorized to control '
            'recording in this specific room.'
        ),
    )

    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.room_code})"

    def can_control_recording(self, user) -> bool:
        """
        True if `user` may start/stop/pause/resume recording in this
        room. The host always passes; other users pass when they're in
        ``recording_grants``.
        """
        if not user or not user.is_authenticated:
            return False
        if user.id == self.host_id:
            return True
        return self.recording_grants.filter(pk=user.pk).exists()


class RoomParticipant(models.Model):
    class Role(models.TextChoices):
        HOST = 'host', 'Host'
        PARTICIPANT = 'participant', 'Participant'

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.PARTICIPANT)
    joined_at = models.DateTimeField(auto_now_add=True)
    left_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('room', 'user')

    def __str__(self):
        return f"{self.user.username} in {self.room.room_code}"


def _make_recording_token() -> str:
    """
    Opaque, URL-safe, 22-char identifier used in stream URLs.
    Decouples public-facing URLs from primary keys so an attacker can't
    enumerate recordings.
    """
    return secrets.token_urlsafe(16)


class Recording(models.Model):
    """
    Server-side capture of a Room produced by LiveKit Egress.

    A single Recording row may be composed of multiple Segment rows
    (one per pause/resume cycle). When the host stops, segments are
    stitched into a single MP4 referenced by `file_path`.
    """

    class Status(models.TextChoices):
        # Egress was requested but the worker hasn't acknowledged it yet.
        STARTING = 'starting', 'Starting'
        # Egress is actively writing a segment.
        RECORDING = 'recording', 'Recording'
        # Egress was paused (host requested). A new segment will start on resume.
        PAUSED = 'paused', 'Paused'
        # Worker is muxing/finalizing segments into the final file.
        PROCESSING = 'processing', 'Processing'
        # Final file is ready to stream.
        COMPLETED = 'completed', 'Completed'
        # Egress failed; file_path may be empty.
        FAILED = 'failed', 'Failed'

    class Quality(models.TextChoices):
        HD = '720p', '720p'
        FHD = '1080p', '1080p'

    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name='recordings',
    )
    session = models.ForeignKey(
        'accounts.Session',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='recordings',
    )
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='recordings',
        help_text='Host who started this recording.',
    )

    # Public, opaque identifier used in URLs (/api/recordings/<token>/).
    public_token = models.CharField(
        max_length=32,
        unique=True,
        default=_make_recording_token,
        editable=False,
    )

    quality = models.CharField(
        max_length=10,
        choices=Quality.choices,
        default=Quality.HD,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.STARTING,
    )

    # File on disk (relative to MEDIA_ROOT) once muxing is done.
    file_path = models.CharField(max_length=500, blank=True, default='')

    # Filled in by ffprobe after muxing.
    duration_seconds = models.PositiveIntegerField(default=0)
    size_bytes = models.PositiveBigIntegerField(default=0)

    # Lifecycle timestamps.
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Trim bounds applied at publish time. Stored separately from the raw
    # capture so the original is preserved if the host re-edits later.
    trim_start_seconds = models.FloatField(default=0)
    trim_end_seconds = models.FloatField(null=True, blank=True)

    # Publish state.
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    visible_to = models.ManyToManyField(
        User,
        blank=True,
        related_name='visible_recordings',
        help_text='Participants the host shared the published recording with.',
    )

    # If True, any authenticated user with the URL can watch.
    # The owner sets this with the "shareable link" toggle in publish UI.
    is_link_shared = models.BooleanField(default=False)

    # Soft delete: hide from listings but keep the row for audit.
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['room', '-started_at']),
            models.Index(fields=['owner', '-started_at']),
        ]

    def __str__(self):
        return f'Recording {self.public_token} for {self.room.room_code}'

    @property
    def is_active(self) -> bool:
        """True while the egress worker is still capturing or muxing."""
        return self.status in {
            self.Status.STARTING,
            self.Status.RECORDING,
            self.Status.PAUSED,
            self.Status.PROCESSING,
        }

    def can_be_viewed_by(self, user) -> bool:
        """
        Authorization rule for streaming the file.

        Authorization tiers, in order:
          1. The owner always passes — even on unpublished or soft-deleted
             recordings (so the editor surface keeps working).
          2. Anonymous users and soft-deleted recordings always fail.
          3. For published recordings:
             a. `visible_to` members pass.
             b. If the link-share flag is on, any authenticated user passes.
          4. Unpublished, non-owner: fail.

        Note: superusers are NOT granted blanket access here. The previous
        implementation let any superuser stream any recording, which broke
        unpublish-revokes-access expectations during testing (a superuser
        viewer could keep watching after the host unpublished). Superuser
        access still works through the Django admin where appropriate.
        """
        if not user.is_authenticated:
            return False
        if user.id == self.owner_id:
            return True
        if not self.is_published or self.is_deleted:
            return False
        if self.is_link_shared:
            return True
        return self.visible_to.filter(pk=user.pk).exists()


class RecordingSegment(models.Model):
    """
    A single contiguous capture chunk produced by one egress run.
    A Recording with no pauses has exactly one segment; pause/resume
    appends additional segments which are concatenated at stop time.
    """

    recording = models.ForeignKey(
        Recording,
        on_delete=models.CASCADE,
        related_name='segments',
    )
    # Sequential index within a recording (0, 1, 2, ...).
    index = models.PositiveIntegerField()
    # LiveKit egress identifier — used to stop/poll a specific run.
    egress_id = models.CharField(max_length=128, db_index=True)

    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    # Path the egress worker wrote (relative to MEDIA_ROOT).
    file_path = models.CharField(max_length=500, blank=True, default='')
    duration_seconds = models.FloatField(default=0)
    size_bytes = models.PositiveBigIntegerField(default=0)

    class Meta:
        unique_together = ('recording', 'index')
        ordering = ['index']


class RecordingView(models.Model):
    """
    Tracks how far each viewer has watched a recording.

    The frontend player heartbeats current playback position every
    few seconds; we keep both the most recent position (so the player
    can resume from there next time) and the furthest position seen
    (so the host's analytics shows the high-water-mark of engagement).

    One row per (recording, user) pair. Owners are excluded because the
    host already has detailed access via the editor; this table is
    about *audience* engagement.
    """

    recording = models.ForeignKey(
        Recording,
        on_delete=models.CASCADE,
        related_name='views',
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='recording_views',
    )

    # Where the viewer paused / stopped during their last session.
    last_position_seconds = models.FloatField(default=0)
    # Furthest point they've reached across all sessions; never decreases.
    furthest_position_seconds = models.FloatField(default=0)
    # Number of distinct sessions: incremented when a heartbeat arrives
    # more than RecordingView.NEW_SESSION_GAP_SECONDS after the last one.
    view_count = models.PositiveIntegerField(default=0)

    first_watched_at = models.DateTimeField(auto_now_add=True)
    last_watched_at = models.DateTimeField(auto_now=True)

    NEW_SESSION_GAP_SECONDS = 30 * 60  # 30 minutes

    class Meta:
        unique_together = ('recording', 'user')
        indexes = [
            models.Index(fields=['recording', '-last_watched_at']),
        ]

    def __str__(self):
        return f'{self.user.username} -> {self.recording.public_token}'

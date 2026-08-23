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
    max_participants = models.PositiveIntegerField(default=25)
    duration_limit_minutes = models.PositiveIntegerField(default=60, null=True, blank=True)
    is_duration_limited = models.BooleanField(default=True)
    warning_sent_at = models.DateTimeField(null=True, blank=True)
    is_recorded = models.BooleanField(default=False)
    session = models.ForeignKey(
        'accounts.Session',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rooms'
    )
    occurrence = models.ForeignKey(
        'accounts.ClassOccurrence',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rooms'
    )
    organization = models.ForeignKey(
        'accounts.Organization',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rooms'
    )
    meeting_type = models.CharField(
        max_length=20,
        choices=[('class_session', 'Class Session'), ('ad_hoc', 'Ad-hoc')],
        default='ad_hoc'
    )

    # Co-hosts explicitly delegated by host with moderator privileges (lobby, mute, locks)
    co_hosts = models.ManyToManyField(
        User,
        blank=True,
        related_name='co_hosted_rooms',
        help_text='Participants authorized as Co-Hosts with room moderator privileges.'
    )

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

    # --- Lobby / Access Control ---
    # When True, any participant joining via invite link must wait in the
    # lobby until the host explicitly admits them. Users invited directly
    # by the host (via InviteModal search) bypass this requirement.
    require_approval = models.BooleanField(
        default=False,
        help_text='Joining via invite link requires host approval.',
    )
    # When True, no new participants can join the room at all.
    is_locked = models.BooleanField(
        default=False,
        help_text='Completely block new participants from joining.',
    )

    # --- Media Policies & Permission Locks ---
    mute_mic_on_join = models.BooleanField(
        default=False,
        help_text='Mute participant microphones by default upon entry.'
    )
    mute_cam_on_join = models.BooleanField(
        default=False,
        help_text='Turn off participant cameras by default upon entry.'
    )
    lock_screen_share = models.BooleanField(
        default=False,
        help_text='Lock screen sharing for regular participants unless permission is granted.'
    )
    lock_microphone = models.BooleanField(
        default=False,
        help_text='Lock microphones for regular participants unless permission is granted.'
    )
    lock_camera = models.BooleanField(
        default=False,
        help_text='Lock cameras for regular participants unless permission is granted.'
    )
    lock_document_presentation = models.BooleanField(
        default=True,
        help_text='Lock document upload and presentation for regular members unless host unlocks or grants individually.'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.room_code})"

    def can_manage_room(self, user) -> bool:
        """
        True if user is host or one of the delegated co-hosts with moderator privileges.
        """
        if not user or not user.is_authenticated:
            return False
        if user.id == self.host_id:
            return True
        return self.co_hosts.filter(pk=user.pk).exists()

    def can_control_recording(self, user) -> bool:
        """
        True if `user` may start/stop/pause/resume recording in this
        room. The host always passes; other users pass when they're in
        ``recording_grants`` or ``co_hosts``.
        """
        if not user or not user.is_authenticated:
            return False
        if user.id == self.host_id:
            return True
        if self.co_hosts.filter(pk=user.pk).exists():
            return True
        return self.recording_grants.filter(pk=user.pk).exists()


class LobbyRequest(models.Model):
    """
    Represents a pending request to join a room that has `require_approval=True`.

    Lifecycle:
      PENDING  → host sees it in the lobby panel
      ADMITTED → host clicked "Admit"; the guest can now exchange the request_id
                 for a real LiveKit token via the join endpoint
      DENIED   → host clicked "Deny"; guest receives a rejection message
      EXPIRED  → the request was not acted upon within EXPIRE_MINUTES minutes

    Identity fields:
      - For authenticated users: `user` is set, `guest_*` are null.
      - For unauthenticated guests: `user` is null, `guest_identity` and
        `guest_name` are set.
    """

    EXPIRE_MINUTES = 5

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ADMITTED = 'admitted', 'Admitted'
        DENIED = 'denied', 'Denied'
        EXPIRED = 'expired', 'Expired'

    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name='lobby_requests',
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='lobby_requests',
    )
    # For guest (unauthenticated) participants
    guest_identity = models.CharField(max_length=100, null=True, blank=True)
    guest_name = models.CharField(max_length=100, null=True, blank=True)

    # Resolved display name for the host UI (full_name or guest_name)
    display_name = models.CharField(max_length=150)
    # Whether this is a guest (unauthenticated) request
    is_guest = models.BooleanField(default=False)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    # Once admitted, this token is minted and returned to the waiting client.
    # Stored here so the polling endpoint can return it without minting again.
    livekit_token = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['room', 'status']),
        ]

    def __str__(self):
        return f'LobbyRequest({self.display_name}) → {self.room.room_code} [{self.status}]'

    @property
    def is_expired(self) -> bool:
        from django.utils import timezone
        from datetime import timedelta
        return (
            self.status == self.Status.PENDING
            and timezone.now() > self.created_at + timedelta(minutes=self.EXPIRE_MINUTES)
        )


class RoomParticipant(models.Model):
    class Role(models.TextChoices):
        HOST = 'host', 'Host'
        CO_HOST = 'co_host', 'Co-Host'
        PARTICIPANT = 'participant', 'Participant'
        GUEST = 'guest', 'Guest'

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    guest_name = models.CharField(max_length=100, null=True, blank=True)
    guest_identity = models.CharField(max_length=100, null=True, blank=True)
    is_guest = models.BooleanField(default=False)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.PARTICIPANT)
    can_share_screen = models.BooleanField(default=True)
    can_use_camera = models.BooleanField(default=True)
    can_use_microphone = models.BooleanField(default=True)
    can_upload_presentation = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)
    left_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['room', 'user'],
                condition=models.Q(user__isnull=False),
                name='unique_authenticated_user_per_room'
            )
        ]

    def __str__(self):
        if self.is_guest:
            return f"{self.guest_name or self.guest_identity} (Guest) in {self.room.room_code}"
        return f"{self.user.username if self.user else 'Unknown'} in {self.room.room_code}"


class PresentationDocument(models.Model):
    class FileType(models.TextChoices):
        PDF = 'pdf', 'PDF Document'
        IMAGE = 'image', 'Image'
        SLIDE = 'slide', 'Presentation Slide'
        OTHER = 'other', 'Other Document'

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='presentations')
    uploader = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    guest_uploader_name = models.CharField(max_length=100, null=True, blank=True)
    file = models.FileField(upload_to='room_presentations/%Y/%m/')
    title = models.CharField(max_length=255)
    file_type = models.CharField(max_length=20, choices=FileType.choices, default=FileType.PDF)
    file_size_bytes = models.PositiveIntegerField(default=0)
    total_pages = models.PositiveIntegerField(default=1)
    current_page = models.PositiveIntegerField(default=1)
    is_active_on_stage = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} in {self.room.room_code}"

    @property
    def uploader_name(self) -> str:
        if self.uploader:
            return self.uploader.full_name or self.uploader.username
        return self.guest_uploader_name or "Guest"


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
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recordings'
    )
    occurrence = models.ForeignKey(
        'accounts.ClassOccurrence',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recordings'
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

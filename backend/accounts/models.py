from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = 'student', 'Student'
        TEACHER = 'teacher', 'Teacher'
        ADMIN = 'admin', 'Admin'

    full_name = models.CharField(max_length=255, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    is_online = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.username} ({self.role})"



class Notification(models.Model):
    """
    Persistent record of a notification delivered to a user.

    Every WebSocket push (room invites, recording publishes, recording
    permission changes, etc.) also creates one of these so the user can
    catch up on anything they missed while offline.

    ``payload`` is the same JSON blob sent over the WS, minus runtime
    bookkeeping fields. It includes ``type`` so the frontend renders
    the correct row.

    ``read_at`` is the timestamp when the user marked the entry as
    read; null until then. ``delivered_at`` is when the push was
    attempted in real time — useful as a tie-breaker if a user has
    multiple sessions and we ever want per-session read state, but
    today it's mostly informational.
    """

    class Kind(models.TextChoices):
        ROOM_INVITE = 'ROOM_INVITE', 'Room invite'
        RECORDING_PUBLISHED = 'RECORDING_PUBLISHED', 'Recording published'
        RECORDING_PERMISSION_GRANTED = (
            'RECORDING_PERMISSION_GRANTED', 'Recording permission granted'
        )
        RECORDING_PERMISSION_REVOKED = (
            'RECORDING_PERMISSION_REVOKED', 'Recording permission revoked'
        )

    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    kind = models.CharField(max_length=64, choices=Kind.choices)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        # Inbox is rendered most-recent-first, and we filter by user
        # heavily — this index is the only one the inbox endpoint
        # touches.
        indexes = [
            models.Index(fields=['user', '-created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification({self.kind} -> {self.user.username})"

    def mark_read(self):
        if self.read_at is None:
            from django.utils import timezone
            self.read_at = timezone.now()
            self.save(update_fields=['read_at'])

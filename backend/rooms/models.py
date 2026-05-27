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
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.room_code})"


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
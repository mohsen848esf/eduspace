from django.contrib import admin

from .models import Recording, RecordingSegment, Room, RoomParticipant


class RoomParticipantInline(admin.TabularInline):
    model = RoomParticipant
    extra = 0


class RecordingSegmentInline(admin.TabularInline):
    model = RecordingSegment
    extra = 0
    readonly_fields = (
        'index', 'egress_id', 'started_at', 'ended_at',
        'duration_seconds', 'size_bytes', 'file_path',
    )
    can_delete = False


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('name', 'room_code', 'host', 'status', 'max_participants', 'created_at')
    list_filter = ('status',)
    inlines = [RoomParticipantInline]


@admin.register(RoomParticipant)
class RoomParticipantAdmin(admin.ModelAdmin):
    list_display = ('user', 'room', 'role', 'is_active', 'joined_at')


@admin.register(Recording)
class RecordingAdmin(admin.ModelAdmin):
    list_display = (
        'public_token', 'room', 'owner', 'status', 'quality',
        'duration_seconds', 'size_bytes', 'is_published', 'is_deleted',
        'started_at',
    )
    list_filter = ('status', 'quality', 'is_published', 'is_deleted')
    search_fields = ('public_token', 'room__room_code', 'owner__username')
    readonly_fields = (
        'public_token', 'started_at', 'completed_at', 'published_at',
        'duration_seconds', 'size_bytes', 'file_path',
    )
    inlines = [RecordingSegmentInline]

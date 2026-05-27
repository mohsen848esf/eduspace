from django.contrib import admin
from .models import Room, RoomParticipant


class RoomParticipantInline(admin.TabularInline):
    model = RoomParticipant
    extra = 0


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('name', 'room_code', 'host', 'status', 'max_participants', 'created_at')
    list_filter = ('status',)
    inlines = [RoomParticipantInline]


@admin.register(RoomParticipant)
class RoomParticipantAdmin(admin.ModelAdmin):
    list_display = ('user', 'room', 'role', 'is_active', 'joined_at')
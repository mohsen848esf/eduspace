from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Notification, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'full_name', 'role', 'is_online')
    list_filter = ('role',)
    fieldsets = UserAdmin.fieldsets + (
        ('Extra', {'fields': ('full_name', 'role', 'avatar', 'is_online')}),
    )


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'kind', 'created_at', 'delivered_at', 'read_at')
    list_filter = ('kind', 'read_at')
    search_fields = ('user__username', 'kind')
    readonly_fields = ('created_at', 'delivered_at')
    ordering = ('-created_at',)
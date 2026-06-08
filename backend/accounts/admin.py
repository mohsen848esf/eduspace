from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Notification, User, AuditLog


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


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'entity_type', 'entity_id', 'actor', 'organization', 'created_at')
    list_filter = ('action', 'entity_type', 'organization')
    search_fields = ('action', 'entity_type', 'actor__username')
    readonly_fields = ('actor', 'organization', 'action', 'entity_type', 'entity_id', 'before_state', 'after_state', 'ip_address', 'user_agent', 'created_at')
    ordering = ('-created_at',)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
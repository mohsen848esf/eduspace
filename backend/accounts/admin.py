from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'full_name', 'role', 'is_online')
    list_filter = ('role',)
    fieldsets = UserAdmin.fieldsets + (
        ('Extra', {'fields': ('full_name', 'role', 'avatar', 'is_online')}),
    )
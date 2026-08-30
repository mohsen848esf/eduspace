from django.db import models
from django.conf import settings

class OrganizationQuota(models.Model):
    organization = models.OneToOneField(
        'accounts.Organization',
        on_delete=models.CASCADE,
        related_name='quota'
    )
    max_students = models.PositiveIntegerField(default=100)
    max_teachers = models.PositiveIntegerField(default=10)
    max_courses = models.PositiveIntegerField(default=10)
    max_storage_gb = models.FloatField(default=5.0)
    max_active_sessions = models.PositiveIntegerField(default=5)
    max_recording_minutes = models.PositiveIntegerField(default=120)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Quota for {self.organization.name}"


class OrganizationUsage(models.Model):
    organization = models.OneToOneField(
        'accounts.Organization',
        on_delete=models.CASCADE,
        related_name='usage'
    )
    students_count = models.PositiveIntegerField(default=0)
    teachers_count = models.PositiveIntegerField(default=0)
    courses_count = models.PositiveIntegerField(default=0)
    storage_used_gb = models.FloatField(default=0.0)
    active_sessions_count = models.PositiveIntegerField(default=0)
    recording_minutes_used = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Usage for {self.organization.name}"


class SystemConfig(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()
    description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.key} = {self.value}"


class OperatorAuditLog(models.Model):
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='operator_audit_logs'
    )
    action = models.CharField(max_length=100)
    organization = models.ForeignKey(
        'accounts.Organization',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='operator_audit_logs'
    )
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Operator {self.operator.username} - {self.action} - {self.created_at}"

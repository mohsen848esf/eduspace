from django.db import models
from django.conf import settings

class NotificationPreference(models.Model):
    class Category(models.TextChoices):
        SESSION_REMINDERS = 'session_reminders', 'Session Reminders'
        ASSESSMENT_REMINDERS = 'assessment_reminders', 'Assessment Reminders'
        FINANCIAL_NOTIFICATIONS = 'financial_notifications', 'Financial Notifications'
        MARKETING_NOTIFICATIONS = 'marketing_notifications', 'Marketing Notifications'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_preferences'
    )
    organization = models.ForeignKey(
        'accounts.Organization',
        on_delete=models.CASCADE,
        related_name='notification_preferences'
    )
    category = models.CharField(
        max_length=50,
        choices=Category.choices
    )
    email_enabled = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=True)
    in_app_enabled = models.BooleanField(default=True)

    class Meta:
        unique_together = ('user', 'organization', 'category')
        indexes = [
            models.Index(fields=['user', 'organization', 'category']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.category} Preferences"


class NotificationTemplate(models.Model):
    class Channel(models.TextChoices):
        EMAIL = 'EMAIL', 'Email'
        SMS = 'SMS', 'SMS'
        IN_APP = 'IN_APP', 'In-App'

    organization = models.ForeignKey(
        'accounts.Organization',
        on_delete=models.CASCADE,
        related_name='notification_templates'
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100)
    channel = models.CharField(
        max_length=20,
        choices=Channel.choices
    )
    subject = models.CharField(max_length=255, blank=True, default='')
    body = models.TextField()
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('organization', 'slug', 'channel')
        indexes = [
            models.Index(fields=['organization', 'slug']),
        ]

    def __str__(self):
        return f"{self.name} ({self.channel}) - {self.organization.name}"


class Notification(models.Model):
    class Channel(models.TextChoices):
        EMAIL = 'EMAIL', 'Email'
        SMS = 'SMS', 'SMS'
        IN_APP = 'IN_APP', 'In-App'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        QUEUED = 'QUEUED', 'Queued'
        SENT = 'SENT', 'Sent'
        FAILED = 'FAILED', 'Failed'
        READ = 'READ', 'Read'

    organization = models.ForeignKey(
        'accounts.Organization',
        on_delete=models.CASCADE,
        related_name='app_notifications'
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='app_notifications'
    )
    channel = models.CharField(
        max_length=20,
        choices=Channel.choices
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['recipient', 'organization', '-created_at']),
            models.Index(fields=['recipient', 'status']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification {self.id} ({self.channel}) to {self.recipient.username}"

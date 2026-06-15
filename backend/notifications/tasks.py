import logging
from django.utils import timezone
from celery import shared_task
from notifications.celery_utils import BaseTaskWithRetry
from notifications.models import Notification, NotificationPreference
from notifications.providers import SMTPProvider, TwilioProvider
from accounts.models import User, Enrollment

logger = logging.getLogger(__name__)

@shared_task(bind=True, base=BaseTaskWithRetry, name="notifications.tasks.dispatch_notification_task")
def dispatch_notification_task(self, notification_id: int):
    try:
        notification = Notification.objects.get(id=notification_id)
        
        # Check if organization is suspended
        if notification.organization and notification.organization.is_suspended:
            logger.warning("Aborting dispatch_notification_task because organization %s is suspended", notification.organization_id)
            notification.status = Notification.Status.FAILED
            notification.save(update_fields=['status'])
            return
    except Notification.DoesNotExist:
        logger.error("Notification with ID %s does not exist", notification_id)
        return

    # If the status is already SENT or READ, do not process
    if notification.status in [Notification.Status.SENT, Notification.Status.READ]:
        return

    channel = notification.channel
    recipient = notification.recipient

    try:
        if channel == Notification.Channel.EMAIL:
            if not recipient.email:
                raise ValueError(f"User {recipient.username} has no email address.")
            SMTPProvider().send_email(
                to_email=recipient.email,
                subject=notification.title,
                body=notification.message
            )
        elif channel == Notification.Channel.SMS:
            to_phone = getattr(recipient, 'phone_number', None) or getattr(recipient, 'phone', None)
            if not to_phone:
                # Fallback to a default format or log for local/mock settings
                to_phone = "+15555555555"
            TwilioProvider().send_sms(
                to_phone=to_phone,
                message=notification.message
            )
        elif channel == Notification.Channel.IN_APP:
            # In-app notifications do not require external transmission
            pass
        else:
            raise ValueError(f"Unsupported channel: {channel}")

        notification.status = Notification.Status.SENT
        notification.sent_at = timezone.now()
        notification.save(update_fields=['status', 'sent_at'])

    except Exception as exc:
        notification.status = Notification.Status.FAILED
        notification.save(update_fields=['status'])
        raise exc


@shared_task(name="notifications.tasks.class_broadcast_task")
def class_broadcast_task(sender_id: int, class_id: int, channels: list[str], title: str, message: str, organization_id: int):
    # Check if organization is suspended
    from accounts.models import Organization
    try:
        org = Organization.objects.get(id=organization_id)
        if org.is_suspended:
            logger.warning("Aborting class_broadcast_task because organization %s is suspended", organization_id)
            return
    except Organization.DoesNotExist:
        pass

    # Enumerate enrolled class members
    enrollments = Enrollment.objects.filter(
        academy_class_id=class_id,
        academy_class__course__organization_id=organization_id,
        is_active=True
    ).select_related('student')

    recipients = {enrollment.student for enrollment in enrollments}

    for recipient in recipients:
        # Resolve preferences (default to True if not set)
        try:
            pref = NotificationPreference.objects.get(
                user=recipient,
                organization_id=organization_id,
                category=NotificationPreference.Category.SESSION_REMINDERS
            )
            email_ok = pref.email_enabled
            sms_ok = pref.sms_enabled
            in_app_ok = pref.in_app_enabled
        except NotificationPreference.DoesNotExist:
            email_ok = True
            sms_ok = True
            in_app_ok = True

        pref_channels = []
        if email_ok:
            pref_channels.append('EMAIL')
        if sms_ok:
            pref_channels.append('SMS')
        if in_app_ok:
            pref_channels.append('IN_APP')

        # Intersect requested channels with preferred channels
        final_channels = [c for c in channels if c in pref_channels]

        for chan in final_channels:
            notification = Notification.objects.create(
                organization_id=organization_id,
                recipient=recipient,
                channel=chan,
                title=title,
                message=message,
                status=Notification.Status.QUEUED
            )
            dispatch_notification_task.delay(notification.id)

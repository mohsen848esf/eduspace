import logging
from django.utils import timezone
from django.template import Template, Context
from notifications.models import Notification, NotificationPreference, NotificationTemplate
from accounts.models import User, AcademyClass, Enrollment

logger = logging.getLogger(__name__)

class NotificationService:

    @classmethod
    def render_template(cls, template_body: str, context: dict) -> str:
        """
        Safely render a template string using Django's template engine.
        Handles missing variables by rendering them as empty string.
        """
        try:
            t = Template(template_body)
            c = Context(context or {})
            return t.render(c)
        except Exception as e:
            logger.error("Failed to render notification template: %s", e)
            return template_body

    @classmethod
    def send(
        cls,
        recipient_id: int,
        category: str,
        title: str,
        message: str,
        organization_id: int,
        template_slug: str = None,
        context: dict = None
    ) -> list[Notification]:
        """
        Main entry point for dispatching notifications.
        Resolves preferences, templates, renders them, creates persistent logs,
        and queues Celery tasks for delivery.
        """
        from notifications.tasks import dispatch_notification_task

        # Resolve preferences (default to True for all channels if not set)
        try:
            pref = NotificationPreference.objects.get(
                user_id=recipient_id,
                organization_id=organization_id,
                category=category
            )
            email_ok = pref.email_enabled
            sms_ok = pref.sms_enabled
            in_app_ok = pref.in_app_enabled
        except NotificationPreference.DoesNotExist:
            email_ok = True
            sms_ok = True
            in_app_ok = True

        channels = []
        if email_ok:
            channels.append('EMAIL')
        if sms_ok:
            channels.append('SMS')
        if in_app_ok:
            channels.append('IN_APP')

        created_notifications = []

        for channel in channels:
            # 1. Resolve template if slug is provided
            rendered_title = title
            rendered_message = message

            if template_slug:
                tmpl = NotificationTemplate.objects.filter(
                    organization_id=organization_id,
                    slug=template_slug,
                    channel=channel,
                    is_active=True
                ).first()
                if tmpl:
                    rendered_message = cls.render_template(tmpl.body, context)
                    if channel == 'EMAIL' and tmpl.subject:
                        rendered_title = cls.render_template(tmpl.subject, context)
                    else:
                        rendered_title = cls.render_template(tmpl.name, context)

            # 2. Render normal text if no template was resolved but context is provided
            elif context:
                rendered_title = cls.render_template(title, context)
                rendered_message = cls.render_template(message, context)

            # 3. Create persistent log
            notification = Notification.objects.create(
                organization_id=organization_id,
                recipient_id=recipient_id,
                channel=channel,
                title=rendered_title,
                message=rendered_message,
                status=Notification.Status.QUEUED
            )
            created_notifications.append(notification)

            # 4. Asynchronously dispatch Celery task
            dispatch_notification_task.delay(notification.id)

        return created_notifications

    @classmethod
    def broadcast(
        cls,
        sender_id: int,
        class_id: int,
        channels: list[str],
        title: str,
        message: str,
        organization_id: int
    ) -> None:
        """
        Asynchronously broadcast a message to all active class members.
        """
        from notifications.tasks import class_broadcast_task
        class_broadcast_task.delay(
            sender_id=sender_id,
            class_id=class_id,
            channels=channels,
            title=title,
            message=message,
            organization_id=organization_id
        )

    @classmethod
    def mark_read(cls, notification_id: int, user) -> bool:
        """
        Mark a single notification as read.
        """
        try:
            notification = Notification.objects.get(
                id=notification_id,
                recipient=user
            )
            notification.read_at = timezone.now()
            notification.status = Notification.Status.READ
            notification.save(update_fields=['read_at', 'status'])
            return True
        except Notification.DoesNotExist:
            return False

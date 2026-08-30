from celery import shared_task
from django.utils import timezone
from accounts.models import UserSession, AuditLog
from accounts.metrics import CELERY_TASKS_TOTAL

@shared_task(name="accounts.tasks.send_email_task")
def send_email_task(recipient, subject, body):
    try:
        # Placeholder logic for email delivery
        # We can log structured info or call django.core.mail in the future
        CELERY_TASKS_TOTAL.labels(task_name="send_email_task", status="success").inc()
        return f"Email sent to {recipient}"
    except Exception as e:
        CELERY_TASKS_TOTAL.labels(task_name="send_email_task", status="failure").inc()
        raise e

@shared_task(name="accounts.tasks.send_sms_task")
def send_sms_task(phone_number, message):
    try:
        # Placeholder logic for SMS delivery
        CELERY_TASKS_TOTAL.labels(task_name="send_sms_task", status="success").inc()
        return f"SMS sent to {phone_number}"
    except Exception as e:
        CELERY_TASKS_TOTAL.labels(task_name="send_sms_task", status="failure").inc()
        raise e

@shared_task(name="accounts.tasks.export_audit_logs_task")
def export_audit_logs_task(organization_id, recipient_email):
    try:
        # Logic to compile audit logs and email them to the recipient
        logs = AuditLog.objects.filter(organization=organization_id)
        count = logs.count()
        # In a real scenario, generate CSV/PDF and email it
        CELERY_TASKS_TOTAL.labels(task_name="export_audit_logs_task", status="success").inc()
        return f"Exported {count} logs for org {organization_id} to {recipient_email}"
    except Exception as e:
        CELERY_TASKS_TOTAL.labels(task_name="export_audit_logs_task", status="failure").inc()
        raise e

@shared_task(name="accounts.tasks.daily_cleanup_expired_sessions_and_drafts")
def daily_cleanup_expired_sessions_and_drafts():
    try:
        now = timezone.now()
        # Deactivate expired sessions
        sessions_deactivated = UserSession.objects.filter(is_active=True, expires_at__lt=now).update(is_active=False)
        
        # Recalculate/clean up drafts if any (e.g. older than 30 days)
        # Placeholder or assessment started submissions cleanup
        from assessments.models import Submission
        stale_threshold = now - timezone.timedelta(days=30)
        drafts_cleaned = Submission.objects.filter(status='started', started_at__lt=stale_threshold).delete()
        
        CELERY_TASKS_TOTAL.labels(task_name="daily_cleanup_expired_sessions_and_drafts", status="success").inc()
        return f"Deactivated {sessions_deactivated} sessions, cleaned {drafts_cleaned[0] if drafts_cleaned else 0} drafts"
    except Exception as e:
        CELERY_TASKS_TOTAL.labels(task_name="daily_cleanup_expired_sessions_and_drafts", status="failure").inc()
        raise e

@shared_task(name="accounts.tasks.weekly_recalculate_reports_and_storage")
def weekly_recalculate_reports_and_storage():
    try:
        # Recalculate weekly storage logic / stats recalculation placeholder
        CELERY_TASKS_TOTAL.labels(task_name="weekly_recalculate_reports_and_storage", status="success").inc()
        return "Weekly recalculation completed"
    except Exception as e:
        CELERY_TASKS_TOTAL.labels(task_name="weekly_recalculate_reports_and_storage", status="failure").inc()
        raise e

@shared_task(name="accounts.tasks.monthly_generate_billing_and_usage_reports")
def monthly_generate_billing_and_usage_reports():
    try:
        # Recalculate monthly organization usage reports & billing placeholder
        CELERY_TASKS_TOTAL.labels(task_name="monthly_generate_billing_and_usage_reports", status="success").inc()
        return "Monthly reports generated"
    except Exception as e:
        CELERY_TASKS_TOTAL.labels(task_name="monthly_generate_billing_and_usage_reports", status="failure").inc()
        raise e

@shared_task(name="accounts.tasks.send_upcoming_class_reminders")
def send_upcoming_class_reminders():
    try:
        from accounts.models import Session, ClassOccurrence
        from django.utils import timezone
        
        now = timezone.now()
        intervals = [
            (24 * 60, "24 hours"),
            (60, "1 hour"),
            (15, "15 minutes")
        ]
        
        sent_count = 0
        for minutes, label in intervals:
            start_range = now + timezone.timedelta(minutes=minutes - 7)
            end_range = now + timezone.timedelta(minutes=minutes + 7)
            
            # 1. Remind for manual sessions
            sessions = Session.objects.filter(
                status=Session.Status.SCHEDULED,
                scheduled_start__range=(start_range, end_range)
            )
            for s in sessions:
                print(f"Reminder: Class session '{s.title}' is starting in {label}!")
                sent_count += 1
                
            # 2. Remind for automatic occurrences
            occurrences = ClassOccurrence.objects.filter(
                status=ClassOccurrence.Status.SCHEDULED,
                scheduled_start__range=(start_range, end_range)
            )
            for o in occurrences:
                print(f"Reminder: Class '{o.academy_class.name}' session is starting in {label}!")
                sent_count += 1
                
        CELERY_TASKS_TOTAL.labels(task_name="send_upcoming_class_reminders", status="success").inc()
        return f"Dispatched {sent_count} reminders."
    except Exception as e:
        CELERY_TASKS_TOTAL.labels(task_name="send_upcoming_class_reminders", status="failure").inc()
        raise e

import logging
from celery import shared_task
from django.utils import timezone
from django.db import transaction
from billing.models import OrganizationSubscription, SubscriptionPlan
from billing.services import SubscriptionService
from accounts.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

@shared_task(name='billing.tasks.payment_recovery_task')
def payment_recovery_task():
    """
    Daily check of past due subscriptions to execute progressive degradation recovery timeline.
    Day 0: Payment failure notification
    Day 3: Reminder
    Day 7: Escalation warning
    Day 14: Downgrade to Free Plan (automatically switch org to Free plan, enforcing Free limits)
    Day 30: Read Only mode (set status to read_only)
    Day 180: Archive eligibility review (Canceled status)
    """
    logger.info("Starting progressive payment recovery check...")
    
    # Query past_due, downgraded, or read_only subscriptions
    past_due_subs = OrganizationSubscription.objects.filter(
        payment_failed_at__isnull=False
    ).exclude(status=OrganizationSubscription.Status.CANCELED)

    now = timezone.now()
    count = 0

    for sub in past_due_subs:
        days_elapsed = (now - sub.payment_failed_at).days
        org = sub.organization
        owner = org.owner

        logger.info(f"Subscription for {org.slug} has failed payment {days_elapsed} days ago.")

        # Progressive Degradation Actions
        if days_elapsed == 0:
            NotificationService.send(
                recipient_id=owner.id,
                category='BILLING',
                title="Payment Failed — EduSpace Subscription",
                message=f"EduSpace was unable to process your payment for {org.name}. We will retry automatically. Grace period of 14 days is active.",
                organization_id=org.id
            )
        elif days_elapsed == 3:
            NotificationService.send(
                recipient_id=owner.id,
                category='BILLING',
                title="Reminder: Action Required — EduSpace Payment Failed",
                message=f"This is a reminder that the payment for your EduSpace organization ({org.name}) failed. Please update your payment card.",
                organization_id=org.id
            )
        elif days_elapsed == 7:
            NotificationService.send(
                recipient_id=owner.id,
                category='BILLING',
                title="Urgent: Payment Failed Escalation Warning",
                message=f"EduSpace payment for {org.name} remains unpaid. If not resolved by day 14, your organization will be automatically downgraded to the Free Plan.",
                organization_id=org.id
            )
        elif days_elapsed == 14:
            if sub.plan.slug != 'free':
                free_plan = SubscriptionPlan.objects.filter(slug='free').first()
                if free_plan:
                    with transaction.atomic():
                        sub.plan = free_plan
                        sub.status = OrganizationSubscription.Status.DOWNGRADED
                        sub.save()
                        SubscriptionService.sync_quota_limits(org, free_plan)

                    NotificationService.send(
                        recipient_id=owner.id,
                        category='BILLING',
                        title="Organization Downgraded to Free Plan",
                        message=f"Your subscription for {org.name} was downgraded to the Free Plan due to unpaid invoices. Free plan quotas are now actively enforced.",
                        organization_id=org.id
                    )
        elif days_elapsed == 30:
            with transaction.atomic():
                sub.status = OrganizationSubscription.Status.READ_ONLY
                sub.save()
            
            NotificationService.send(
                recipient_id=owner.id,
                category='BILLING',
                title="Organization Suspended: Read Only Mode Active",
                message=f"Your organization {org.name} is now restricted to Read-Only mode due to non-payment. Access is limited to viewing and exporting data.",
                organization_id=org.id
            )
        elif days_elapsed >= 180:
            with transaction.atomic():
                sub.status = OrganizationSubscription.Status.CANCELED
                sub.save()
                
            NotificationService.send(
                recipient_id=owner.id,
                category='BILLING',
                title="Subscription Terminated",
                message=f"Your subscription for {org.name} has been terminated. The organization is now queued for system archival review.",
                organization_id=org.id
            )
        count += 1
        
    logger.info(f"Progressive payment recovery task finished. Audited {count} subscriptions.")
    return count

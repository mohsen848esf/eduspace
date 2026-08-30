import logging
from celery import shared_task
from accounts.models import Organization
from sys_admin.services import QuotaService

logger = logging.getLogger(__name__)

@shared_task(name="sys_admin.tasks.daily_usage_recalculation")
def daily_usage_recalculation():
    logger.info("Starting daily usage recalculation for all active organizations")
    orgs = Organization.objects.filter(is_active=True)
    count = 0
    for org in orgs:
        try:
            QuotaService.recalculate_usage(org)
            count += 1
        except Exception as e:
            logger.exception("Failed to recalculate usage for organization %s", org.id)
    
    logger.info("Completed usage recalculation for %s organizations", count)
    return f"Recalculated {count} organizations"

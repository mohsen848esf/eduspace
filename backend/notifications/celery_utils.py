import logging
from celery import Task

logger = logging.getLogger(__name__)

class BaseTaskWithRetry(Task):
    """
    Standardized retry task with failure logging, exponential backoff, and jitter.
    """
    autoretry_for = (Exception,)
    max_retries = 5
    retry_backoff = True
    retry_backoff_max = 600
    retry_jitter = True

    def on_retry(self, exc, task_id, args, kwargs, einfo):
        logger.warning(
            "Task %s[%s] retrying due to temporary failure: %s. Args: %s, Kwargs: %s",
            self.name, task_id, exc, args, kwargs
        )
        super().on_retry(exc, task_id, args, kwargs, einfo)

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(
            "Task %s[%s] failed permanently after max retries: %s. Args: %s, Kwargs: %s",
            self.name, task_id, exc, args, kwargs,
            exc_info=exc
        )
        super().on_failure(exc, task_id, args, kwargs, einfo)

from django.core.cache import cache
import logging

logger = logging.getLogger(__name__)

class AnalyticsCacheService:
    DEFAULT_TTL = 300  # 5 minutes

    @classmethod
    def get_class_averages(cls, organization_slug: str, class_id: int):
        key = f"analytics:{organization_slug}:class_averages:{class_id}"
        try:
            return cache.get(key)
        except Exception as e:
            logger.error("Failed to get class averages from cache: %s", e)
            return None

    @classmethod
    def set_class_averages(cls, organization_slug: str, class_id: int, data, ttl=DEFAULT_TTL):
        key = f"analytics:{organization_slug}:class_averages:{class_id}"
        try:
            cache.set(key, data, timeout=ttl)
        except Exception as e:
            logger.error("Failed to set class averages in cache: %s", e)

    @classmethod
    def invalidate_class_averages(cls, organization_slug: str, class_id: int):
        key = f"analytics:{organization_slug}:class_averages:{class_id}"
        try:
            cache.delete(key)
        except Exception as e:
            logger.error("Failed to delete class averages from cache: %s", e)

    @classmethod
    def get_class_high_scores(cls, organization_slug: str, class_id: int):
        key = f"analytics:{organization_slug}:class_high_scores:{class_id}"
        try:
            return cache.get(key)
        except Exception as e:
            logger.error("Failed to get class high scores from cache: %s", e)
            return None

    @classmethod
    def set_class_high_scores(cls, organization_slug: str, class_id: int, data, ttl=DEFAULT_TTL):
        key = f"analytics:{organization_slug}:class_high_scores:{class_id}"
        try:
            cache.set(key, data, timeout=ttl)
        except Exception as e:
            logger.error("Failed to set class high scores in cache: %s", e)

    @classmethod
    def invalidate_class_high_scores(cls, organization_slug: str, class_id: int):
        key = f"analytics:{organization_slug}:class_high_scores:{class_id}"
        try:
            cache.delete(key)
        except Exception as e:
            logger.error("Failed to delete class high scores from cache: %s", e)

    @classmethod
    def get_active_students(cls, organization_slug: str):
        key = f"analytics:{organization_slug}:active_students"
        try:
            return cache.get(key)
        except Exception as e:
            logger.error("Failed to get active students from cache: %s", e)
            return None

    @classmethod
    def set_active_students(cls, organization_slug: str, data, ttl=DEFAULT_TTL):
        key = f"analytics:{organization_slug}:active_students"
        try:
            cache.set(key, data, timeout=ttl)
        except Exception as e:
            logger.error("Failed to set active students in cache: %s", e)

    @classmethod
    def invalidate_active_students(cls, organization_slug: str):
        key = f"analytics:{organization_slug}:active_students"
        try:
            cache.delete(key)
        except Exception as e:
            logger.error("Failed to delete active students from cache: %s", e)

    @classmethod
    def get_active_sessions(cls, organization_slug: str):
        key = f"analytics:{organization_slug}:active_sessions"
        try:
            return cache.get(key)
        except Exception as e:
            logger.error("Failed to get active sessions from cache: %s", e)
            return None

    @classmethod
    def set_active_sessions(cls, organization_slug: str, data, ttl=DEFAULT_TTL):
        key = f"analytics:{organization_slug}:active_sessions"
        try:
            cache.set(key, data, timeout=ttl)
        except Exception as e:
            logger.error("Failed to set active sessions in cache: %s", e)

    @classmethod
    def invalidate_active_sessions(cls, organization_slug: str):
        key = f"analytics:{organization_slug}:active_sessions"
        try:
            cache.delete(key)
        except Exception as e:
            logger.error("Failed to delete active sessions from cache: %s", e)

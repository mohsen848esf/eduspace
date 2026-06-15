import logging
from django.core.cache import cache
from django.db import models
from django.core.exceptions import ValidationError
from sys_admin.models import SystemConfig, OrganizationQuota, OrganizationUsage

logger = logging.getLogger(__name__)

class GlobalConfigService:
    @staticmethod
    def get(key, default=None):
        cache_key = f"sys_config:{key}"
        val = cache.get(cache_key)
        if val is not None:
            return val
        
        try:
            config = SystemConfig.objects.get(key=key)
            val = config.value
            cache.set(cache_key, val, timeout=86400) # cache for 24h
            return val
        except SystemConfig.DoesNotExist:
            return default

    @staticmethod
    def set(key, value, description=""):
        config, created = SystemConfig.objects.update_or_create(
            key=key,
            defaults={'value': str(value), 'description': description}
        )
        cache_key = f"sys_config:{key}"
        cache.set(cache_key, str(value), timeout=86400)
        return config

    @staticmethod
    def delete(key):
        SystemConfig.objects.filter(key=key).delete()
        cache_key = f"sys_config:{key}"
        cache.delete(cache_key)


class QuotaService:
    DEFAULT_LIMITS = {
        'max_students': 100,
        'max_teachers': 10,
        'max_courses': 10,
        'max_storage_gb': 5.0,
        'max_active_sessions': 5,
        'max_recording_minutes': 120,
    }

    @classmethod
    def get_quota(cls, organization):
        quota, created = OrganizationQuota.objects.get_or_create(
            organization=organization,
            defaults=cls.DEFAULT_LIMITS
        )
        return quota

    @classmethod
    def get_usage(cls, organization):
        usage, created = OrganizationUsage.objects.get_or_create(
            organization=organization
        )
        return usage

    @classmethod
    def check_quota(cls, organization, quota_type, increment=1):
        """
        Validates if adding `increment` to the `quota_type` exceeds the quota limit.
        Raises ValidationError if exceeded.
        quota_type can be: 'students', 'teachers', 'courses', 'storage', 'active_sessions', 'recording_minutes'
        """
        quota = cls.get_quota(organization)
        usage = cls.get_usage(organization)

        if quota_type == 'students':
            limit = quota.max_students
            current = usage.students_count
            name = "students"
        elif quota_type == 'teachers':
            limit = quota.max_teachers
            current = usage.teachers_count
            name = "teachers"
        elif quota_type == 'courses':
            limit = quota.max_courses
            current = usage.courses_count
            name = "courses"
        elif quota_type == 'storage':
            limit = quota.max_storage_gb
            current = usage.storage_used_gb
            name = "storage (GB)"
        elif quota_type == 'active_sessions':
            limit = quota.max_active_sessions
            current = usage.active_sessions_count
            name = "active sessions"
        elif quota_type == 'recording_minutes':
            limit = quota.max_recording_minutes
            current = usage.recording_minutes_used
            name = "recording minutes"
        else:
            raise ValueError(f"Unknown quota type: {quota_type}")

        if current + increment > limit:
            raise ValidationError(
                f"Quota limit for {name} exceeded. Limit: {limit}, Current: {current}, Requested: {increment}."
            )

    @classmethod
    def recalculate_usage(cls, organization):
        """
        Recalculates actual usage for an organization and saves it to OrganizationUsage.
        """
        from accounts.models import OrgMember, Course, Session
        from rooms.models import Recording

        usage = cls.get_usage(organization)

        # 1. Students Count
        usage.students_count = OrgMember.objects.filter(
            organization=organization,
            role__name='Student',
            is_active=True
        ).count()

        # 2. Teachers Count (includes Admin + Teacher roles)
        usage.teachers_count = OrgMember.objects.filter(
            organization=organization,
            role__name__in=['Teacher', 'Admin'],
            is_active=True
        ).count()

        # 3. Courses Count
        c_count = Course.objects.filter(
            organization=organization,
            is_active=True
        ).count()
        usage.courses_count = c_count

        # 4. Active Sessions Count
        usage.active_sessions_count = Session.objects.filter(
            organization=organization,
            status=Session.Status.LIVE
        ).count()

        # 5. Recording Minutes Used
        rec_seconds = Recording.objects.filter(
            room__organization=organization,
            status=Recording.Status.COMPLETED
        ).aggregate(total_sec=models.Sum('duration_seconds'))['total_sec'] or 0
        usage.recording_minutes_used = int(rec_seconds / 60)

        # 6. Storage Used in GB
        total_bytes = Recording.objects.filter(
            room__organization=organization
        ).aggregate(total_bytes=models.Sum('size_bytes'))['total_bytes'] or 0
        usage.storage_used_gb = round(total_bytes / (1024 ** 3), 4)

        usage.save()
        return usage

import logging
import redis
from django.conf import settings
from django.utils import timezone
from django.db import models
from rest_framework import viewsets, status, filters
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from accounts.models import Organization, User, Session
from rooms.models import Recording
from sys_admin.models import SystemConfig, OperatorAuditLog, OrganizationQuota, OrganizationUsage
from sys_admin.serializers import (
    SystemConfigSerializer,
    OrganizationAdminSerializer,
    OperatorAuditLogSerializer
)
from sys_admin.services import GlobalConfigService, QuotaService

logger = logging.getLogger(__name__)


class IsSuperUser(BasePermission):
    """
    Allows access only to superusers.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_superuser


@api_view(['GET'])
@permission_classes([IsSuperUser])
def sys_admin_dashboard_metrics(request):
    """
    Returns platform-wide metrics for the super admin dashboard.
    """
    # 1. Organization Stats
    total_orgs = Organization.objects.count()
    suspended_orgs = Organization.objects.filter(is_suspended=True).count()
    active_orgs = Organization.objects.filter(is_suspended=False, is_active=True).count()

    # 2. User Stats
    total_users = User.objects.count()

    # 3. Active Sessions Count
    live_sessions = Session.objects.filter(status=Session.Status.LIVE).count()

    # 4. Storage Consumption in GB
    total_bytes = Recording.objects.aggregate(total_bytes=models.Sum('size_bytes'))['total_bytes'] or 0
    storage_gb = round(total_bytes / (1024 ** 3), 4)

    # 5. Recording Minutes Used
    total_seconds = Recording.objects.filter(status=Recording.Status.COMPLETED).aggregate(total_sec=models.Sum('duration_seconds'))['total_sec'] or 0
    recording_minutes = int(total_seconds / 60)

    # 6. Celery queue backlogs (Redis LLEN)
    queues = ['default', 'notifications', 'recordings', 'media', 'compliance', 'finance']
    backlogs = {}
    try:
        r = redis.Redis.from_url(settings.CELERY_BROKER_URL)
        for q in queues:
            backlogs[q] = r.llen(q)
    except Exception as e:
        logger.exception("Failed to connect to Redis for Celery queue checks")
        for q in queues:
            backlogs[q] = 0

    return Response({
        'organizations': {
            'total': total_orgs,
            'suspended': suspended_orgs,
            'active': active_orgs,
        },
        'users': {
            'total': total_users,
        },
        'sessions': {
            'live': live_sessions,
        },
        'storage': {
            'used_gb': storage_gb,
        },
        'recordings': {
            'minutes_used': recording_minutes,
        },
        'celery_backlog': backlogs
    })


class OrganizationAdminViewSet(viewsets.ModelViewSet):
    """
    Super Admin viewset for managing organizations, quotas and suspensions.
    """
    serializer_class = OrganizationAdminSerializer
    permission_classes = [IsSuperUser]
    queryset = Organization.objects.all().select_related('owner').prefetch_related('quota', 'usage')
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'slug']
    ordering_fields = ['created_at', 'name']

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Ensure usage is recalculate-on-fetch so that the details page shows actual current data
        QuotaService.recalculate_usage(instance)
        # Reload
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def perform_update(self, serializer):
        instance = serializer.save()
        OperatorAuditLog.objects.create(
            operator=self.request.user,
            action='update_organization',
            organization=instance,
            metadata={'changes': self.request.data}
        )

    @action(detail=True, methods=['POST'], url_path='suspend')
    def suspend(self, request, pk=None):
        org = self.get_object()
        reason = request.data.get('reason', '')
        
        org.is_suspended = True
        org.suspended_at = timezone.now()
        org.suspension_reason = reason
        org.save(update_fields=['is_suspended', 'suspended_at', 'suspension_reason'])

        # Log operator action
        OperatorAuditLog.objects.create(
            operator=request.user,
            action='suspend_organization',
            organization=org,
            metadata={'reason': reason}
        )

        # Invalidate active user sessions of the suspended organization immediately
        # (This forces logout / prevents calls to APIs)
        from accounts.models import UserSession
        members_user_ids = org.members.values_list('user_id', flat=True)
        UserSession.objects.filter(user_id__in=members_user_ids).update(is_active=False)

        serializer = self.get_serializer(org)
        return Response(serializer.data)

    @action(detail=True, methods=['POST'], url_path='restore')
    def restore(self, request, pk=None):
        org = self.get_object()
        
        org.is_suspended = False
        org.suspended_at = None
        org.suspension_reason = ''
        org.save(update_fields=['is_suspended', 'suspended_at', 'suspension_reason'])

        # Log operator action
        OperatorAuditLog.objects.create(
            operator=request.user,
            action='restore_organization',
            organization=org
        )

        serializer = self.get_serializer(org)
        return Response(serializer.data)


class SystemConfigViewSet(viewsets.ModelViewSet):
    """
    Super Admin viewset for viewing and editing global registry configs.
    """
    serializer_class = SystemConfigSerializer
    permission_classes = [IsSuperUser]
    queryset = SystemConfig.objects.all()
    filter_backends = [filters.SearchFilter]
    search_fields = ['key']

    def perform_create(self, serializer):
        key = serializer.validated_data['key']
        value = serializer.validated_data['value']
        description = serializer.validated_data.get('description', '')
        
        GlobalConfigService.set(key, value, description)
        
        OperatorAuditLog.objects.create(
            operator=self.request.user,
            action='create_config',
            metadata={'key': key, 'value': value}
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        key = instance.key
        value = serializer.validated_data.get('value', instance.value)
        description = serializer.validated_data.get('description', instance.description)
        
        GlobalConfigService.set(key, value, description)
        
        OperatorAuditLog.objects.create(
            operator=self.request.user,
            action='update_config',
            metadata={'key': key, 'value': value}
        )

    def perform_destroy(self, instance):
        key = instance.key
        GlobalConfigService.delete(key)
        
        OperatorAuditLog.objects.create(
            operator=self.request.user,
            action='delete_config',
            metadata={'key': key}
        )


class OperatorAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Super Admin viewset to view operator action audit logs.
    """
    serializer_class = OperatorAuditLogSerializer
    permission_classes = [IsSuperUser]
    queryset = OperatorAuditLog.objects.all().select_related('operator', 'organization')
    filter_backends = [filters.SearchFilter]
    search_fields = ['action', 'operator__username', 'organization__name']

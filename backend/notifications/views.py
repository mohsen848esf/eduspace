from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from accounts.permissions import resolve_organization, has_org_permission, HasOrgPermission
from accounts.services.notification_service import NotificationService
from notifications.models import Notification, NotificationPreference, NotificationTemplate
from notifications.serializers import (
    NotificationSerializer,
    NotificationPreferenceSerializer,
    NotificationTemplateSerializer
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_in_app_notifications(request):
    org = resolve_organization(request)
    if not org:
        return Response({'error': 'Organization context required'}, status=status.HTTP_400_BAD_REQUEST)

    notifications = Notification.objects.filter(
        recipient=request.user,
        organization=org,
        channel=Notification.Channel.IN_APP
    )
    serializer = NotificationSerializer(notifications, many=True)
    return Response(serializer.data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def mark_notifications_read(request):
    org = resolve_organization(request)
    if not org:
        return Response({'error': 'Organization context required'}, status=status.HTTP_400_BAD_REQUEST)

    notification_id = request.data.get('id')
    mark_all = request.data.get('all', False)

    if notification_id:
        try:
            notification = Notification.objects.get(
                id=notification_id,
                recipient=request.user,
                organization=org
            )
            notification.read_at = timezone.now()
            notification.status = Notification.Status.READ
            notification.save(update_fields=['read_at', 'status'])
            return Response({'success': True})
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)
    elif mark_all or notification_id is None:
        Notification.objects.filter(
            recipient=request.user,
            organization=org,
            channel=Notification.Channel.IN_APP,
            read_at__isnull=True
        ).update(
            read_at=timezone.now(),
            status=Notification.Status.READ
        )
        return Response({'success': True})
    else:
        return Response({'error': 'Invalid request parameters'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def notifications_preferences(request):
    org = resolve_organization(request)
    if not org:
        return Response({'error': 'Organization context required'}, status=status.HTTP_400_BAD_REQUEST)

    categories = [choice[0] for choice in NotificationPreference.Category.choices]

    if request.method == 'GET':
        prefs = []
        for cat in categories:
            pref, created = NotificationPreference.objects.get_or_create(
                user=request.user,
                organization=org,
                category=cat,
                defaults={
                    'email_enabled': True,
                    'sms_enabled': True,
                    'in_app_enabled': True
                }
            )
            prefs.append(pref)
        serializer = NotificationPreferenceSerializer(prefs, many=True)
        return Response(serializer.data)

    elif request.method == 'PATCH':
        data = request.data
        if isinstance(data, dict):
            data = [data]

        for item in data:
            cat = item.get('category')
            if cat not in categories:
                continue

            pref, created = NotificationPreference.objects.get_or_create(
                user=request.user,
                organization=org,
                category=cat
            )

            if 'email_enabled' in item:
                pref.email_enabled = bool(item['email_enabled'])
            if 'sms_enabled' in item:
                pref.sms_enabled = bool(item['sms_enabled'])
            if 'in_app_enabled' in item:
                pref.in_app_enabled = bool(item['in_app_enabled'])

            pref.save()

        # Return full updated preferences
        all_prefs = []
        for cat in categories:
            pref, created = NotificationPreference.objects.get_or_create(
                user=request.user,
                organization=org,
                category=cat
            )
            all_prefs.append(pref)
        serializer = NotificationPreferenceSerializer(all_prefs, many=True)
        return Response(serializer.data)


class TemplateViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationTemplateSerializer
    permission_classes = [IsAuthenticated, HasOrgPermission]
    required_org_permission = 'can_manage_members'

    def get_queryset(self):
        org = resolve_organization(self.request)
        if not org:
            return NotificationTemplate.objects.none()
        return NotificationTemplate.objects.filter(organization=org)

    def perform_create(self, serializer):
        org = resolve_organization(self.request)
        serializer.save(organization=org)

    @action(detail=True, methods=['post'])
    def preview(self, request, pk=None):
        template = self.get_object()
        context = request.data.get('context', {})
        from accounts.services.notification_service import NotificationService
        rendered_body = NotificationService.render_template(template.body, context)
        rendered_subject = ""
        if template.channel == 'EMAIL' and template.subject:
            rendered_subject = NotificationService.render_template(template.subject, context)
        return Response({
            'body': rendered_body,
            'subject': rendered_subject
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def class_broadcast(request, class_id):
    from accounts.models import AcademyClass

    org = resolve_organization(request)
    if not org:
        return Response({'error': 'Organization context required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        academy_class = AcademyClass.objects.get(id=class_id, course__organization=org)
    except AcademyClass.DoesNotExist:
        return Response({'error': 'Class not found'}, status=status.HTTP_404_NOT_FOUND)

    # Authorization checks
    is_teacher = (academy_class.teacher == request.user)
    has_teach_perm = has_org_permission(request.user, org, 'can_teach_class')
    has_manage_perm = has_org_permission(request.user, org, 'can_manage_members')

    if not request.user.is_superuser and not has_manage_perm:
        if not (has_teach_perm and is_teacher):
            return Response({'error': 'You do not have permission to broadcast to this class'}, status=status.HTTP_403_FORBIDDEN)

    channels = request.data.get('channels', ['EMAIL', 'IN_APP'])
    title = request.data.get('title')
    message = request.data.get('message')

    if not title or not message:
        return Response({'error': 'Title and message are required'}, status=status.HTTP_400_BAD_REQUEST)

    NotificationService.broadcast(
        sender_id=request.user.id,
        class_id=academy_class.id,
        channels=channels,
        title=title,
        message=message,
        organization_id=org.id
    )

    return Response({'success': True, 'message': 'Broadcast queued successfully'})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_notification(request, pk):
    org = resolve_organization(request)
    if not org:
        return Response({'error': 'Organization context required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        notification = Notification.objects.get(
            id=pk,
            recipient=request.user,
            organization=org
        )
        notification.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except Notification.DoesNotExist:
        return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)


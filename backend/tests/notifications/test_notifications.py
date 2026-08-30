from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.cache import cache
from django.conf import settings
from rest_framework import status
from rest_framework.test import APITestCase
from accounts.models import Organization, OrgMember, Role, Permission, Course, AcademyClass, Enrollment
from notifications.models import Notification, NotificationPreference, NotificationTemplate
from notifications.celery_utils import BaseTaskWithRetry
from accounts.services.notification_service import NotificationService

User = get_user_model()

class NotificationsIntegrationTest(APITestCase):
    def setUp(self):
        cache.clear()

        # Users
        self.admin = User.objects.create_superuser(username='admin', email='admin@eduspace.com', password='password')
        self.teacher = User.objects.create_user(username='teacher', email='teacher@eduspace.com', password='password')
        self.student = User.objects.create_user(username='student', email='student@eduspace.com', password='password')
        self.other_user = User.objects.create_user(username='other', email='other@eduspace.com', password='password')

        # Organizations
        self.org1 = Organization.objects.create(name='Org One', slug='org-one', owner=self.admin)
        self.org2 = Organization.objects.create(name='Org Two', slug='org-two', owner=self.admin)

        # Roles & Permissions
        self.perm_teach, _ = Permission.objects.get_or_create(codename='can_teach_class', defaults={'name': 'Teach Class'})
        self.perm_manage, _ = Permission.objects.get_or_create(codename='can_manage_members', defaults={'name': 'Manage Members'})
        self.perm_view, _ = Permission.objects.get_or_create(codename='can_view_dashboard', defaults={'name': 'View Dashboard'})

        self.role_teacher = Role.objects.create(name='Teacher', organization=self.org1)
        self.role_teacher.permissions.add(self.perm_teach, self.perm_view)

        self.role_manager = Role.objects.create(name='Manager', organization=self.org1)
        self.role_manager.permissions.add(self.perm_manage, self.perm_view)

        # Memberships
        OrgMember.objects.create(organization=self.org1, user=self.teacher, role=self.role_teacher, is_active=True)
        OrgMember.objects.create(organization=self.org1, user=self.student, is_active=True)
        OrgMember.objects.create(organization=self.org1, user=self.admin, role=self.role_manager, is_active=True)

        # Academy Setup
        self.course = Course.objects.create(organization=self.org1, title='Science 101', code='SCI101', price=100.0)
        self.academy_class = AcademyClass.objects.create(
            course=self.course,
            teacher=self.teacher,
            name='Class Science A',
            is_active=True
        )
        Enrollment.objects.create(academy_class=self.academy_class, student=self.student, is_active=True)

    def test_celery_queue_segregation_config(self):
        """Verify Celery task routing configurations exist in settings."""
        self.assertTrue(hasattr(settings, 'CELERY_TASK_ROUTES'))
        routes = settings.CELERY_TASK_ROUTES
        self.assertEqual(routes.get('notifications.tasks.dispatch_notification_task'), {'queue': 'notifications'})
        self.assertEqual(routes.get('rooms.tasks.finalize_recording_task'), {'queue': 'recordings'})

    def test_base_task_with_retry_properties(self):
        """Verify attributes of BaseTaskWithRetry."""
        from celery import Task
        self.assertTrue(issubclass(BaseTaskWithRetry, Task))
        task_instance = BaseTaskWithRetry()
        self.assertEqual(task_instance.max_retries, 5)
        self.assertTrue(task_instance.retry_backoff)
        self.assertTrue(task_instance.retry_jitter)

    def test_template_rendering(self):
        """Test template variable rendering and fallback behavior."""
        template_body = "Hello {{ username }}, welcome to {{ course_title }}!"
        context = {'username': 'Alice', 'course_title': 'Math 101'}
        rendered = NotificationService.render_template(template_body, context)
        self.assertEqual(rendered, "Hello Alice, welcome to Math 101!")

        # Test missing variable behavior (renders as empty)
        rendered_missing = NotificationService.render_template(template_body, {'username': 'Bob'})
        self.assertEqual(rendered_missing, "Hello Bob, welcome to !")

    def test_preference_filtering(self):
        """Verify that user notification preferences block excluded channels."""
        # 1. Turn off email, keep SMS and In-App
        pref = NotificationPreference.objects.create(
            user=self.student,
            organization=self.org1,
            category=NotificationPreference.Category.SESSION_REMINDERS,
            email_enabled=False,
            sms_enabled=True,
            in_app_enabled=True
        )

        notifications = NotificationService.send(
            recipient_id=self.student.id,
            category=NotificationPreference.Category.SESSION_REMINDERS,
            title="Session starting",
            message="Your session is starting now.",
            organization_id=self.org1.id
        )

        channels = [n.channel for n in notifications]
        self.assertIn('SMS', channels)
        self.assertIn('IN_APP', channels)
        self.assertNotIn('EMAIL', channels)

    def test_multi_tenant_isolation(self):
        """Test multi-tenant isolation of templates and notifications."""
        # Create a template in Org 1
        t1 = NotificationTemplate.objects.create(
            organization=self.org1,
            name="Org1 Template",
            slug="welcome",
            channel=NotificationTemplate.Channel.IN_APP,
            body="Welcome to Org 1"
        )
        # Create a template in Org 2
        t2 = NotificationTemplate.objects.create(
            organization=self.org2,
            name="Org2 Template",
            slug="welcome",
            channel=NotificationTemplate.Channel.IN_APP,
            body="Welcome to Org 2"
        )

        # Retrieve templates for Org 1 and Org 2
        self.client.force_authenticate(user=self.admin)
        response1 = self.client.get(reverse('template-list'), HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response1.data), 1)
        self.assertEqual(response1.data[0]['name'], "Org1 Template")

        response2 = self.client.get(reverse('template-list'), HTTP_X_ORGANIZATION_SLUG='org-two')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response2.data), 1)
        self.assertEqual(response2.data[0]['name'], "Org2 Template")

    def test_rbac_broadcast_announcements(self):
        """Test RBAC rules for broadcasting class messages."""
        url = reverse('class-broadcast-scoped', kwargs={'class_id': self.academy_class.id})

        # 1. Other user tries (Forbidden)
        self.client.force_authenticate(user=self.other_user)
        response = self.client.post(url, {'title': 'Alert', 'message': 'Hi'}, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Teacher (permitted)
        self.client.force_authenticate(user=self.teacher)
        response = self.client.post(url, {'title': 'Alert', 'message': 'Hi'}, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 3. Org Admin (permitted)
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(url, {'title': 'Alert', 'message': 'Hi'}, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_sms_preference_validation_without_phone_number(self):
        """Verify SMS notifications cannot be enabled if the user has no phone number."""
        self.client.force_authenticate(user=self.student)
        self.student.phone_number = ''
        self.student.save()

        # Try to enable SMS
        url = reverse('notification-preferences')
        payload = {
            'category': NotificationPreference.Category.SESSION_REMINDERS.value,
            'sms_enabled': True
        }
        response = self.client.patch(url, payload, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Add a phone number', response.data['error'])

        # Now set phone number and try again
        self.student.phone_number = '+1234567890'
        self.student.save()
        response = self.client.patch(url, payload, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

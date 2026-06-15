import uuid
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch
from accounts.tasks import send_email_task, send_sms_task

User = get_user_model()

class SystemInfrastructureTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='infra_admin', password='password')
        from accounts.models import Organization, OrgMember
        self.org = Organization.objects.create(name='Infra Org', slug='infra-org', owner=self.user)
        self.member = OrgMember.objects.create(organization=self.org, user=self.user)

    def test_health_check_unauthenticated(self):
        url = reverse('system-health')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('config.celery.app.control.ping')
    def test_health_check_authenticated_success(self, mock_ping):
        mock_ping.return_value = [{'worker1': 'pong'}]
        url = reverse('system-health')
        self.client.force_authenticate(user=self.user)
        response = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='infra-org')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['database'], 'ok')
        self.assertEqual(response.data['redis'], 'ok')
        self.assertEqual(response.data['celery'], 'ok')
        self.assertEqual(response.data['storage'], 'ok')

    @patch('django.db.backends.utils.CursorWrapper.execute')
    @patch('config.celery.app.control.ping')
    def test_health_check_failure(self, mock_ping, mock_execute):
        mock_ping.return_value = []
        mock_execute.side_effect = Exception("DB Fail")
        url = reverse('system-health')
        self.client.force_authenticate(user=self.user)
        response = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='infra-org')
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertTrue(response.data['database'].startswith('error'))

    def test_structured_logging_and_request_id(self):
        self.client.force_authenticate(user=self.user)
        url = reverse('system-health')
        response = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='infra-org')
        self.assertIn('X-Request-ID', response.headers)
        request_id = response.headers['X-Request-ID']
        uuid.UUID(request_id)

    def test_prometheus_metrics_endpoint(self):
        url = reverse('system-metrics')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(b'http_requests_total', response.content)

    def test_rate_limiting_authentication(self):
        url = reverse('login')
        # Trigger rate limiter: we have configured 10/minute for authentication
        # SimpleRateThrottle caches requests, so multiple calls will hit the limit
        for _ in range(12):
            response = self.client.post(url, {'username': 'non_existent', 'password': 'pw'})
            if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                break
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_celery_task_execution(self):
        res_email = send_email_task.delay('test@example.com', 'subject', 'body')
        self.assertEqual(res_email.result, "Email sent to test@example.com")

        res_sms = send_sms_task.delay('123456789', 'hello')
        self.assertEqual(res_sms.result, "SMS sent to 123456789")

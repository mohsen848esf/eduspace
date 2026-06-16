from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from django.core.exceptions import PermissionDenied
from accounts.models import User, Organization, Course, Role
from sys_admin.models import OrganizationQuota
from billing.models import SubscriptionPlan, OrganizationSubscription, BillingInvoice, BillingEvent
from billing.services import SubscriptionService, StripeService, BillingService
from billing.tasks import payment_recovery_task
from notifications.models import Notification

class BillingTestCase(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()

        # Users
        self.owner = User.objects.create_user(
            username='orgowner',
            email='owner@acme.edu',
            password='securepassword123',
            full_name='Org Owner'
        )
        self.regular_user = User.objects.create_user(
            username='student1',
            email='student1@acme.edu',
            password='securepassword123',
            full_name='Regular Student'
        )
        
        # Org
        self.org = Organization.objects.create(
            name='Acme Academy',
            slug='acme-academy',
            owner=self.owner
        )
        
        # Add Owner role mapping
        owner_role = Role.objects.create(
            name='Admin',
            description='Admin',
            organization=self.org
        )
        from accounts.models import Permission
        perm_manage, _ = Permission.objects.get_or_create(codename='can_manage_members', defaults={'name': 'Manage Members'})
        perm_view, _ = Permission.objects.get_or_create(codename='can_view_dashboard', defaults={'name': 'View Dashboard'})
        perm_view_fin, _ = Permission.objects.get_or_create(codename='can_view_financials', defaults={'name': 'View Financials'})
        owner_role.permissions.add(perm_manage, perm_view, perm_view_fin)
        
        from accounts.models import OrgMember
        OrgMember.objects.create(
            organization=self.org,
            user=self.owner,
            role=owner_role,
            is_active=True
        )

        # Seeding Default Plans
        self.free_plan = SubscriptionPlan.objects.create(
            name='Free Plan',
            slug='free',
            monthly_price=0.0,
            max_students=10,
            max_teachers=2,
            max_courses=2,
            max_storage_gb=1.0,
            max_active_sessions=1,
            max_recording_minutes=30
        )
        
        self.starter_plan = SubscriptionPlan.objects.create(
            name='Starter Plan',
            slug='starter',
            monthly_price=49.0,
            max_students=100,
            max_teachers=10,
            max_courses=10,
            max_storage_gb=10.0,
            max_active_sessions=5,
            max_recording_minutes=300
        )

        # Set default organization subscription to Free
        self.subscription = OrganizationSubscription.objects.create(
            organization=self.org,
            plan=self.free_plan,
            status=OrganizationSubscription.Status.TRIALING,
            stripe_customer_id='cus_mock_acme'
        )

    def test_get_subscription_details(self):
        """
        Verify that organization subscription details can be retrieved.
        """
        self.client.force_authenticate(user=self.owner)
        url = reverse('billing-subscription')
        response = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='acme-academy')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['plan_details']['slug'], 'free')

    def test_checkout_session_creation(self):
        """
        Verify checkout session returns checkout URL mapping.
        """
        self.client.force_authenticate(user=self.owner)
        url = reverse('billing-checkout')
        response = self.client.post(url, {
            'price_id': 'price_starter_monthly',
            'plan_slug': 'starter',
            'return_url': 'http://localhost:5173/billing'
        }, HTTP_X_ORGANIZATION_SLUG='acme-academy')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('checkout_url', response.data)
        self.assertIn('mock_session', response.data['checkout_url'])

    def test_webhook_idempotency_protection(self):
        """
        Ensure duplicate webhook events are logged once and ignored.
        """
        url = reverse('billing-webhooks')
        webhook_payload = {
            'id': 'evt_test_idempotency',
            'type': 'customer.subscription.deleted',
            'data': {
                'object': {
                    'customer': 'cus_mock_acme',
                    'id': 'sub_test_123',
                    'status': 'canceled'
                }
            }
        }
        
        # Send first time
        response = self.client.post(url, webhook_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'processed')
        
        # Verify sub is canceled
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, OrganizationSubscription.Status.CANCELED)
        
        # Send second time
        response = self.client.post(url, webhook_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ignored_duplicate')

    def test_webhook_checkout_completed(self):
        """
        Test checkout.session.completed webhook synchronizes limits and marks sub active.
        """
        url = reverse('billing-webhooks')
        payload = {
            'id': 'evt_test_checkout_complete',
            'type': 'checkout.session.completed',
            'data': {
                'object': {
                    'id': 'cs_test_completed',
                    'customer': 'cus_mock_acme',
                    'subscription': 'sub_test_checkout',
                    'metadata': {
                        'organization_id': str(self.org.id),
                        'plan_slug': 'starter'
                    }
                }
            }
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, OrganizationSubscription.Status.ACTIVE)
        self.assertEqual(self.subscription.plan, self.starter_plan)
        
        # Verify OrgQuota is synchronized
        quota = OrganizationQuota.objects.get(organization=self.org)
        self.assertEqual(quota.max_students, self.starter_plan.max_students)
        self.assertEqual(quota.max_teachers, self.starter_plan.max_teachers)

    def test_progressive_payment_recovery_timeline(self):
        """
        Verify that payment_recovery_task implements degradation steps accurately.
        """
        # Set payment failure starting now
        self.subscription.status = OrganizationSubscription.Status.PAST_DUE
        self.subscription.payment_failed_at = timezone.now()
        self.subscription.plan = self.starter_plan
        self.subscription.save()

        # Day 0: Failure notification
        payment_recovery_task()
        notifs = Notification.objects.filter(recipient=self.owner, title__icontains="Payment Failed")
        self.assertTrue(notifs.exists())

        # Day 3: Reminder notification
        self.subscription.payment_failed_at = timezone.now() - timezone.timedelta(days=3)
        self.subscription.save()
        payment_recovery_task()
        notifs = Notification.objects.filter(recipient=self.owner, title__icontains="Reminder")
        self.assertTrue(notifs.exists())

        # Day 14: Downgrade to Free
        self.subscription.payment_failed_at = timezone.now() - timezone.timedelta(days=14)
        self.subscription.save()
        payment_recovery_task()
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, OrganizationSubscription.Status.DOWNGRADED)
        self.assertEqual(self.subscription.plan, self.free_plan)
        
        quota = OrganizationQuota.objects.get(organization=self.org)
        self.assertEqual(quota.max_students, self.free_plan.max_students)

        # Day 30: Read Only Mode
        self.subscription.payment_failed_at = timezone.now() - timezone.timedelta(days=30)
        self.subscription.save()
        payment_recovery_task()
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, OrganizationSubscription.Status.READ_ONLY)

    def test_read_only_middleware_blocks_mutation(self):
        """
        Ensure read-only status blocks mutative requests, but permits GET/viewing.
        """
        self.subscription.status = OrganizationSubscription.Status.READ_ONLY
        self.subscription.save()

        # Attempt to create a course (POST) - should be blocked
        self.client.force_authenticate(user=self.owner)
        url = reverse('course-list')
        response = self.client.post(url, {
            'title': 'Course under ReadOnly',
            'code': 'RO-101',
            'price': 50
        }, HTTP_X_ORGANIZATION_SLUG='acme-academy')
        
        # Django's middleware throws PermissionDenied which is translated to 403 Forbidden
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Attempt to view courses list (GET) - should be allowed
        response = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='acme-academy')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

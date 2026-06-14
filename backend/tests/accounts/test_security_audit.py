from django.test import TransactionTestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import Organization, OrgMember, Role, Permission, Course, TuitionInvoice, Session, AcademyClass

User = get_user_model()

class SecurityAuditTest(TransactionTestCase):
    def setUp(self):
        # Users
        self.user_a = User.objects.create_user(username='user_a', password='password')
        self.user_b = User.objects.create_user(username='user_b', password='password')

        # Organizations
        self.org_a = Organization.objects.create(name='Org A', slug='org-a', owner=self.user_a)
        self.org_b = Organization.objects.create(name='Org B', slug='org-b', owner=self.user_b)

        # Roles with basic access
        view_perm, _ = Permission.objects.get_or_create(codename='can_view_dashboard', defaults={'name': 'View Dashboard'})
        role_a = Role.objects.create(name='Member A', organization=self.org_a)
        role_a.permissions.add(view_perm)

        role_b = Role.objects.create(name='Member B', organization=self.org_b)
        role_b.permissions.add(view_perm)

        # Memberships
        OrgMember.objects.create(organization=self.org_a, user=self.user_a, role=role_a)
        OrgMember.objects.create(organization=self.org_b, user=self.user_b, role=role_b)

        # Create private resources in Org B
        self.course_b = Course.objects.create(organization=self.org_b, title='Course B', code='CS-B')
        self.class_b = AcademyClass.objects.create(course=self.course_b, name='Class B')
        self.session_b = Session.objects.create(academy_class=self.class_b, organization=self.org_b, host=self.user_b, title='Session B')
        self.invoice_b = TuitionInvoice.objects.create(organization=self.org_b, student=self.user_b, amount=100.0)

    def test_unauthenticated_api_rejection(self):
        client = APIClient()
        response = client.get('/api/auth/courses/', HTTP_X_ORGANIZATION_SLUG=self.org_a.slug)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cross_tenant_course_access_rejected(self):
        client = APIClient()
        client.force_authenticate(user=self.user_a)
        # Try to access Org B's course detail in Org A's context
        response = client.get(f'/api/auth/courses/{self.course_b.id}/', HTTP_X_ORGANIZATION_SLUG=self.org_a.slug)
        # Should return 404 since it's filtered to Org A
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_tenant_session_access_rejected(self):
        client = APIClient()
        client.force_authenticate(user=self.user_a)
        response = client.get(f'/api/auth/sessions/{self.session_b.id}/', HTTP_X_ORGANIZATION_SLUG=self.org_a.slug)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cross_tenant_invoice_access_rejected(self):
        client = APIClient()
        client.force_authenticate(user=self.user_a)
        response = client.get(f'/api/auth/invoices/{self.invoice_b.id}/', HTTP_X_ORGANIZATION_SLUG=self.org_a.slug)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_tenant_global_search_rejection(self):
        client = APIClient()
        client.force_authenticate(user=self.user_a)
        # Attempt to search using Org B's slug
        response = client.get('/api/auth/search/global/?q=test', HTTP_X_ORGANIZATION_SLUG=self.org_b.slug)
        # User A has no membership in Org B, so resolving org B slug will fail permission check
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

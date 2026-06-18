from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from accounts.models import (
    Organization, TuitionInvoice, ExpenseItem, OrgMember, Role, Permission
)

User = get_user_model()

class FinancialsIntegrationTest(APITestCase):
    def setUp(self):
        # Create user
        self.user = User.objects.create_user(username='fin_admin', password='password')
        # Create organization
        self.org = Organization.objects.create(name='Fin Org', slug='fin-org', owner=self.user)
        
        # Permissions
        self.perm_view, _ = Permission.objects.get_or_create(codename='can_view_financials', defaults={'name': 'View Financials'})
        self.perm_manage, _ = Permission.objects.get_or_create(codename='can_manage_financials', defaults={'name': 'Manage Financials'})
        self.perm_dash, _ = Permission.objects.get_or_create(codename='can_view_dashboard', defaults={'name': 'View Dashboard'})
        
        # Role
        self.fin_role = Role.objects.create(name='Fin Admin', organization=self.org)
        self.fin_role.permissions.add(self.perm_view, self.perm_manage, self.perm_dash)
        
        # OrgMember
        self.member = OrgMember.objects.create(
            organization=self.org,
            user=self.user,
            role=self.fin_role
        )
        
        self.student = User.objects.create_user(username='student_fin_test', password='password', full_name="John Doe")
        
        # Authenticate
        self.client.force_authenticate(user=self.user)

    def test_invoice_pagination_and_search(self):
        # Create multiple invoices
        for i in range(20):
            TuitionInvoice.objects.create(
                organization=self.org,
                student=self.student,
                amount=100.0 + i,
                status='unpaid',
                invoice_number=f"INV-100{i}"
            )
            
        url = reverse('invoice-list')
        
        # Get page 1
        res = self.client.get(f"{url}?page=1&page_size=5", HTTP_X_ORGANIZATION_SLUG='fin-org')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('results', res.data)
        self.assertEqual(len(res.data['results']), 5)
        self.assertIsNotNone(res.data['next'])
        
        # Get with search filter (q)
        res_search = self.client.get(f"{url}?q=John", HTTP_X_ORGANIZATION_SLUG='fin-org')
        self.assertEqual(res_search.status_code, status.HTTP_200_OK)
        # Without explicit pagination override it defaults to standard page size (15)
        self.assertEqual(len(res_search.data['results']), 15)
        
        # Search for exact invoice number
        res_inv = self.client.get(f"{url}?q=INV-10019", HTTP_X_ORGANIZATION_SLUG='fin-org')
        self.assertEqual(res_inv.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_inv.data['results']), 1)
        self.assertEqual(float(res_inv.data['results'][0]['amount']), 119.0)

    def test_expense_pagination_and_filters(self):
        # Create multiple expenses
        for i in range(10):
            ExpenseItem.objects.create(
                organization=self.org,
                amount=50.0 + (i * 10),
                category='rent' if i % 2 == 0 else 'marketing',
                description=f"Rent and marketing items {i}"
            )
            
        url = reverse('expense-list')
        
        # Filter by category
        res = self.client.get(f"{url}?category=rent", HTTP_X_ORGANIZATION_SLUG='fin-org')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['results']), 5)
        
        # Filter by amount range
        res_amt = self.client.get(f"{url}?min_amount=80&max_amount=120", HTTP_X_ORGANIZATION_SLUG='fin-org')
        self.assertEqual(res_amt.status_code, status.HTTP_200_OK)
        # Should match amounts: 80 (i=3), 90 (i=4), 100 (i=5), 110 (i=6), 120 (i=7)
        self.assertEqual(len(res_amt.data['results']), 5)

    def test_finance_summary(self):
        # Create invoices: 1 paid, 1 unpaid, 1 overdue, 1 partial
        TuitionInvoice.objects.create(
            organization=self.org,
            student=self.student,
            amount=500.00,
            status='paid',
            paid_at=timezone.now()
        )
        TuitionInvoice.objects.create(
            organization=self.org,
            student=self.student,
            amount=200.00,
            status='unpaid'
        )
        TuitionInvoice.objects.create(
            organization=self.org,
            student=self.student,
            amount=150.00,
            status='partial'
        )
        TuitionInvoice.objects.create(
            organization=self.org,
            student=self.student,
            amount=300.00,
            status='overdue'
        )
        
        # Create expenses
        ExpenseItem.objects.create(
            organization=self.org,
            amount=400.00,
            category='rent'
        )
        
        url = reverse('finance_summary')
        res = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='fin-org')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        self.assertEqual(res.data['revenue'], 500.0)
        self.assertEqual(res.data['expenses'], 400.0)
        # outstanding: unpaid (200) + partial (150) + overdue (300) = 650
        self.assertEqual(res.data['outstanding'], 650.0)
        # collection_rate: 500 / (500 + 650) = 500 / 1150 = 43.478% -> 43.5%
        self.assertEqual(res.data['collection_rate'], 43.5)
        
        # Check monthly trends
        self.assertEqual(len(res.data['monthly_trends']), 6)
        # Current month trend (last item) should show 500.0 revenue and 400.0 expense
        current_trend = res.data['monthly_trends'][-1]
        self.assertEqual(current_trend['revenue'], 500.0)
        self.assertEqual(current_trend['expense'], 400.0)

    def test_invoice_balance_action(self):
        # Create invoices: 1 paid, 1 unpaid, 1 overdue, 1 partial, 1 cancelled
        TuitionInvoice.objects.create(
            organization=self.org,
            student=self.student,
            amount=500.00,
            status='paid'
        )
        TuitionInvoice.objects.create(
            organization=self.org,
            student=self.student,
            amount=200.00,
            status='unpaid'
        )
        TuitionInvoice.objects.create(
            organization=self.org,
            student=self.student,
            amount=150.00,
            status='partial'
        )
        TuitionInvoice.objects.create(
            organization=self.org,
            student=self.student,
            amount=300.00,
            status='overdue'
        )
        TuitionInvoice.objects.create(
            organization=self.org,
            student=self.student,
            amount=100.00,
            status='cancelled'
        )

        url = reverse('invoice-balance')
        
        # Test student balance aggregation
        res = self.client.get(f"{url}?student_id={self.student.id}", HTTP_X_ORGANIZATION_SLUG='fin-org')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # outstanding: unpaid (200) + partial (150) + overdue (300) = 650
        self.assertEqual(res.data['outstanding'], 650.0)
        self.assertEqual(res.data['pending_count'], 3)
        # total_billed: all except cancelled: 500 + 200 + 150 + 300 = 1150
        self.assertEqual(res.data['total_billed'], 1150.0)
        self.assertEqual(res.data['total_paid'], 500.0)

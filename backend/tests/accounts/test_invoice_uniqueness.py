from django.db import IntegrityError, transaction
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from accounts.models import Organization, TuitionInvoice

User = get_user_model()

class InvoiceUniquenessConstraintTest(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='test_user', password='password')
        self.org1 = Organization.objects.create(name='Org One', slug='org-one', owner=self.user)
        self.org2 = Organization.objects.create(name='Org Two', slug='org-two', owner=self.user)

    def test_multiple_blank_invoice_numbers_allowed_in_same_org(self):
        # Create two invoices with blank invoice numbers in org1
        inv1 = TuitionInvoice.objects.create(
            organization=self.org1,
            student=self.user,
            amount=100.00,
            invoice_number=""
        )
        inv2 = TuitionInvoice.objects.create(
            organization=self.org1,
            student=self.user,
            amount=200.00,
            invoice_number=""
        )
        # Should succeed without triggering integrity error
        self.assertEqual(inv1.invoice_number, "")
        self.assertEqual(inv2.invoice_number, "")
        self.assertEqual(TuitionInvoice.objects.filter(organization=self.org1).count(), 2)

    def test_duplicate_non_empty_invoice_number_in_same_org_fails(self):
        # Create first invoice with a number
        TuitionInvoice.objects.create(
            organization=self.org1,
            student=self.user,
            amount=100.00,
            invoice_number="INV-1001"
        )
        
        # Creating a second invoice with the same number in the same org should fail
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                TuitionInvoice.objects.create(
                    organization=self.org1,
                    student=self.user,
                    amount=200.00,
                    invoice_number="INV-1001"
                )

    def test_same_invoice_number_allowed_in_different_orgs(self):
        # Create invoice in org1
        inv1 = TuitionInvoice.objects.create(
            organization=self.org1,
            student=self.user,
            amount=100.00,
            invoice_number="INV-1001"
        )
        # Create invoice with same number in org2
        inv2 = TuitionInvoice.objects.create(
            organization=self.org2,
            student=self.user,
            amount=100.00,
            invoice_number="INV-1001"
        )
        
        # Both should succeed
        self.assertEqual(inv1.invoice_number, "INV-1001")
        self.assertEqual(inv2.invoice_number, "INV-1001")
        self.assertEqual(TuitionInvoice.objects.filter(invoice_number="INV-1001").count(), 2)

from django.db import models
from accounts.models import Organization

class SubscriptionPlan(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    monthly_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    yearly_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    
    # Plan Quotas
    max_students = models.IntegerField(default=100)
    max_teachers = models.IntegerField(default=10)
    max_courses = models.IntegerField(default=10)
    max_storage_gb = models.DecimalField(max_digits=8, decimal_places=2, default=5.0)
    max_recording_minutes = models.IntegerField(default=120)
    max_active_sessions = models.IntegerField(default=5)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} Plan ({self.slug})"


class OrganizationSubscription(models.Model):
    class Status(models.TextChoices):
        TRIALING = 'trialing', 'Trialing'
        ACTIVE = 'active', 'Active'
        PAST_DUE = 'past_due', 'Past Due'
        UNPAID = 'unpaid', 'Unpaid'
        DOWNGRADED = 'downgraded', 'Downgraded'
        READ_ONLY = 'read_only', 'Read Only'
        CANCELED = 'canceled', 'Canceled'

    organization = models.OneToOneField(
        Organization, 
        on_delete=models.CASCADE, 
        related_name='subscription'
    )
    plan = models.ForeignKey(
        SubscriptionPlan, 
        on_delete=models.PROTECT, 
        related_name='subscriptions'
    )
    stripe_customer_id = models.CharField(max_length=255, blank=True, db_index=True)
    stripe_subscription_id = models.CharField(max_length=255, blank=True, db_index=True)
    status = models.CharField(
        max_length=50, 
        choices=Status.choices, 
        default=Status.TRIALING,
        db_index=True
    )
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    
    # For progressive degradation tracking
    payment_failed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.organization.name} - {self.plan.name} ({self.status})"


class BillingEvent(models.Model):
    organization = models.ForeignKey(
        Organization, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='billing_events'
    )
    stripe_event_id = models.CharField(max_length=255, unique=True, db_index=True)
    event_type = models.CharField(max_length=255)
    payload = models.JSONField()
    processed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Event {self.stripe_event_id} ({self.event_type})"


class BillingInvoice(models.Model):
    organization = models.ForeignKey(
        Organization, 
        on_delete=models.CASCADE, 
        related_name='billing_invoices'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='USD')
    stripe_invoice_id = models.CharField(max_length=255, blank=True, db_index=True)
    status = models.CharField(max_length=50, db_index=True)  # paid, unpaid, open, void
    invoice_pdf_url = models.URLField(max_length=1024, blank=True)
    issued_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Invoice {self.stripe_invoice_id} ({self.amount} {self.currency})"

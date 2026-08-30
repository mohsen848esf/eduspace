from rest_framework import serializers
from billing.models import SubscriptionPlan, OrganizationSubscription, BillingInvoice

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = (
            'id', 'name', 'slug', 'monthly_price', 'yearly_price',
            'max_students', 'max_teachers', 'max_courses', 'max_storage_gb',
            'max_recording_minutes', 'max_active_sessions', 'is_active'
        )


class OrganizationSubscriptionSerializer(serializers.ModelSerializer):
    plan_details = SubscriptionPlanSerializer(source='plan', read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)

    class Meta:
        model = OrganizationSubscription
        fields = (
            'id', 'organization', 'organization_name', 'plan', 'plan_details',
            'stripe_customer_id', 'stripe_subscription_id', 'status',
            'current_period_start', 'current_period_end', 'cancel_at_period_end',
            'payment_failed_at', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'stripe_customer_id', 'stripe_subscription_id', 'created_at')


class BillingInvoiceSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True)

    class Meta:
        model = BillingInvoice
        fields = (
            'id', 'organization', 'organization_name', 'amount', 'currency',
            'stripe_invoice_id', 'status', 'invoice_pdf_url', 'issued_at', 'created_at'
        )

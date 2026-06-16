from django.urls import path, include
from rest_framework.routers import DefaultRouter
from billing.views import (
    SubscriptionPlanViewSet,
    OrganizationSubscriptionView,
    CheckoutSessionView,
    CustomerPortalView,
    StripeWebhookView,
    BillingInvoiceViewSet
)

router = DefaultRouter()
router.register('plans', SubscriptionPlanViewSet, basename='billing-plan')
router.register('invoices', BillingInvoiceViewSet, basename='billing-invoice')

urlpatterns = [
    path('subscription/', OrganizationSubscriptionView.as_view(), name='billing-subscription'),
    path('checkout/', CheckoutSessionView.as_view(), name='billing-checkout'),
    path('customer-portal/', CustomerPortalView.as_view(), name='billing-customer-portal'),
    path('webhooks/', StripeWebhookView.as_view(), name='billing-webhooks'),
    path('', include(router.urls)),
]

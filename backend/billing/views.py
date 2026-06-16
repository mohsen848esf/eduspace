import json
import logging
from django.conf import settings
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from accounts.models import Organization
from accounts.permissions import HasOrgPermission, resolve_organization
from billing.models import SubscriptionPlan, OrganizationSubscription, BillingInvoice, BillingEvent
from billing.serializers import SubscriptionPlanSerializer, OrganizationSubscriptionSerializer, BillingInvoiceSerializer
from billing.services import StripeService, SubscriptionService, BillingService

logger = logging.getLogger(__name__)

class SubscriptionPlanViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Publicly list active subscription plans.
    """
    permission_classes = [AllowAny]
    queryset = SubscriptionPlan.objects.filter(is_active=True).order_type = 'created_at'
    serializer_class = SubscriptionPlanSerializer

    def get_queryset(self):
        return SubscriptionPlan.objects.filter(is_active=True).order_by('monthly_price')


class OrganizationSubscriptionView(APIView):
    """
    Endpoint for active organization subscription details.
    """
    permission_classes = [IsAuthenticated, HasOrgPermission]
    required_org_permission = 'can_view_dashboard'

    def get(self, request):
        org = resolve_organization(request)
        if not org:
            return Response({'detail': 'Organization context missing.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Instantiate free plan fallback if not exists
        free_plan, _ = SubscriptionPlan.objects.get_or_create(
            slug='free',
            defaults={
                'name': 'Free Plan',
                'monthly_price': 0.0,
                'yearly_price': 0.0,
                'max_students': 100,
                'max_teachers': 10,
                'max_courses': 10,
                'max_storage_gb': 5.0,
                'max_recording_minutes': 120,
                'max_active_sessions': 5,
                'is_active': True,
            }
        )
        
        sub, created = OrganizationSubscription.objects.get_or_create(
            organization=org,
            defaults={'plan': free_plan, 'status': OrganizationSubscription.Status.TRIALING}
        )
        
        serializer = OrganizationSubscriptionSerializer(sub)
        return Response(serializer.data)


class CheckoutSessionView(APIView):
    """
    Initializes a Stripe Checkout Session for plan upgrades.
    """
    permission_classes = [IsAuthenticated, HasOrgPermission]
    required_org_permission = 'can_manage_members'

    def post(self, request):
        org = resolve_organization(request)
        if not org:
            return Response({'detail': 'Organization context missing.'}, status=status.HTTP_400_BAD_REQUEST)

        price_id = request.data.get('price_id')
        plan_slug = request.data.get('plan_slug')
        return_url = request.data.get('return_url')

        if not price_id or not plan_slug or not return_url:
            return Response(
                {'detail': 'price_id, plan_slug, and return_url are required fields.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            checkout_url = StripeService.create_checkout_session(
                organization=org,
                price_id=price_id,
                plan_slug=plan_slug,
                return_url=return_url
            )
            return Response({'checkout_url': checkout_url})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class CustomerPortalView(APIView):
    """
    Returns Stripe self-service billing portal URL.
    """
    permission_classes = [IsAuthenticated, HasOrgPermission]
    required_org_permission = 'can_manage_members'

    def post(self, request):
        org = resolve_organization(request)
        if not org:
            return Response({'detail': 'Organization context missing.'}, status=status.HTTP_400_BAD_REQUEST)

        return_url = request.data.get('return_url')
        if not return_url:
            return Response({'detail': 'return_url is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            portal_url = StripeService.create_portal_session(
                organization=org,
                return_url=return_url
            )
            return Response({'portal_url': portal_url})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@method_decorator(csrf_exempt, name='dispatch')
class StripeWebhookView(APIView):
    """
    Stripe Webhook signature verification and events dispatcher.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        payload = request.body
        sig_header = request.headers.get('STRIPE_SIGNATURE')

        if not sig_header and getattr(settings, 'STRIPE_WEBHOOK_SECRET', None):
            return Response({'detail': 'Missing stripe signature header.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            event = StripeService.verify_webhook_signature(payload, sig_header)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        event_id = event.get('id')
        event_type = event.get('type')
        data_object = event.get('data', {}).get('object', {})

        # Webhook Idempotency Check
        if BillingEvent.objects.filter(stripe_event_id=event_id).exists():
            logger.info(f"Duplicate Webhook event ignored: {event_id}")
            return Response({'status': 'ignored_duplicate'})

        # Log Event
        org = None
        org_id = data_object.get('metadata', {}).get('organization_id')
        if org_id:
            org = Organization.objects.filter(id=int(org_id)).first()
        else:
            # Try to resolve by customer ID
            customer_id = data_object.get('customer')
            if customer_id:
                sub = OrganizationSubscription.objects.filter(stripe_customer_id=customer_id).first()
                if sub:
                    org = sub.organization

        BillingEvent.objects.create(
            stripe_event_id=event_id,
            event_type=event_type,
            payload=event,
            organization=org
        )

        # Event Dispatcher
        if event_type == 'checkout.session.completed':
            cls_session_completed(data_object)
        elif event_type in ['customer.subscription.created', 'customer.subscription.updated']:
            cls_subscription_updated(data_object)
        elif event_type == 'customer.subscription.deleted':
            cls_subscription_deleted(data_object)
        elif event_type == 'invoice.paid':
            cls_invoice_paid(data_object)
        elif event_type == 'invoice.payment_failed':
            cls_invoice_payment_failed(data_object)

        return Response({'status': 'processed'})


# Webhook Handlers Helpers
def cls_session_completed(session):
    metadata = session.get('metadata', {})
    org_id = metadata.get('organization_id')
    plan_slug = metadata.get('plan_slug')
    customer_id = session.get('customer')
    subscription_id = session.get('subscription')
    
    if org_id and plan_slug:
        org = Organization.objects.filter(id=int(org_id)).first()
        if org:
            # Register Stripe customer ID manually if not done yet
            sub, _ = OrganizationSubscription.objects.get_or_create(organization=org)
            sub.stripe_customer_id = customer_id
            sub.save()
            
            SubscriptionService.handle_payment_success(
                stripe_customer_id=customer_id,
                stripe_subscription_id=subscription_id,
                plan_slug=plan_slug
            )

def cls_subscription_updated(stripe_sub):
    customer_id = stripe_sub.get('customer')
    subscription_id = stripe_sub.get('id')
    status = stripe_sub.get('status')
    
    # Resolve metadata details
    metadata = stripe_sub.get('metadata', {})
    plan_slug = metadata.get('plan_slug')
    
    if not plan_slug:
        # Fallback to Stripe Plan details if metadata didn't have it
        items = stripe_sub.get('items', {}).get('data', [])
        if items:
            # In production, associate stripe price/product id to SubscriptionPlan slug
            # Let's default to starter or fallback plans
            price_id = items[0].get('price', {}).get('id')
            logger.info(f"Subscription updated using price: {price_id}")

    if status in ['active', 'trialing']:
        if plan_slug:
            SubscriptionService.handle_payment_success(
                stripe_customer_id=customer_id,
                stripe_subscription_id=subscription_id,
                plan_slug=plan_slug
            )
        else:
            # Fallback update period range
            sub = OrganizationSubscription.objects.filter(stripe_customer_id=customer_id).first()
            if sub:
                sub.status = OrganizationSubscription.Status.ACTIVE
                sub.stripe_subscription_id = subscription_id
                sub.current_period_start = timezone.datetime.fromtimestamp(stripe_sub.get('current_period_start'), tz=timezone.utc)
                sub.current_period_end = timezone.datetime.fromtimestamp(stripe_sub.get('current_period_end'), tz=timezone.utc)
                sub.cancel_at_period_end = stripe_sub.get('cancel_at_period_end', False)
                sub.payment_failed_at = None
                sub.save()
    elif status in ['past_due', 'unpaid']:
        SubscriptionService.apply_payment_failure(
            stripe_customer_id=customer_id,
            stripe_subscription_id=subscription_id
        )

def cls_subscription_deleted(stripe_sub):
    customer_id = stripe_sub.get('customer')
    subscription_id = stripe_sub.get('id')
    SubscriptionService.handle_subscription_canceled(
        stripe_customer_id=customer_id,
        stripe_subscription_id=subscription_id
    )

def cls_invoice_paid(invoice):
    customer_id = invoice.get('customer')
    stripe_invoice_id = invoice.get('id')
    amount = float(invoice.get('amount_paid', 0)) / 100.0
    currency = invoice.get('currency', 'usd').upper()
    status = 'paid'
    issued_at = timezone.datetime.fromtimestamp(invoice.get('created', timezone.now().timestamp()), tz=timezone.utc)
    
    sub = OrganizationSubscription.objects.filter(stripe_customer_id=customer_id).first()
    if sub:
        # Generate pdf representation
        BillingService.generate_and_store_invoice_pdf(
            organization=sub.organization,
            stripe_invoice_id=stripe_invoice_id,
            amount=amount,
            currency=currency,
            status=status,
            issued_at=issued_at
        )

def cls_invoice_payment_failed(invoice):
    customer_id = invoice.get('customer')
    subscription_id = invoice.get('subscription')
    SubscriptionService.apply_payment_failure(
        stripe_customer_id=customer_id,
        stripe_subscription_id=subscription_id
    )


class BillingInvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    List and retrieve invoice history. Accessible to users with can_view_financials or can_manage_members.
    """
    permission_classes = [IsAuthenticated, HasOrgPermission]
    serializer_class = BillingInvoiceSerializer

    def get_permissions(self):
        # Enforce financial viewing or member management role checks
        self.required_org_permission = 'can_view_financials'
        return super().get_permissions()

    def get_queryset(self):
        org = resolve_organization(self.request)
        if not org:
            return BillingInvoice.objects.none()
        return BillingInvoice.objects.filter(organization=org).order_by('-issued_at')

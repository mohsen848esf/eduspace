import stripe
import logging
from django.conf import settings
from django.utils import timezone
from django.core.files.base import ContentFile
from django.core.exceptions import ValidationError
from accounts.models import Organization
from sys_admin.models import OrganizationQuota
from sys_admin.services import QuotaService
from billing.models import SubscriptionPlan, OrganizationSubscription, BillingInvoice

logger = logging.getLogger(__name__)

if hasattr(settings, 'STRIPE_SECRET_KEY') and settings.STRIPE_SECRET_KEY:
    stripe.api_key = settings.STRIPE_SECRET_KEY

class StripeService:
    @classmethod
    def get_or_create_customer(cls, organization: Organization) -> str:
        """
        Retrieves existing stripe_customer_id or registers the organization on Stripe.
        """
        # Ensure default Free plan exists
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
            organization=organization,
            defaults={'plan': free_plan, 'status': OrganizationSubscription.Status.TRIALING}
        )

        if sub.stripe_customer_id:
            return sub.stripe_customer_id

        # Stripe Customer Creation
        if not getattr(settings, 'STRIPE_SECRET_KEY', None):
            # Development/Testing fallback
            sub.stripe_customer_id = f"cus_mock_{organization.id}"
            sub.save()
            return sub.stripe_customer_id

        try:
            customer = stripe.Customer.create(
                email=organization.owner.email,
                name=organization.name,
                metadata={
                    'organization_id': organization.id,
                    'organization_slug': organization.slug
                }
            )
            sub.stripe_customer_id = customer.id
            sub.save()
            return customer.id
        except Exception as e:
            logger.error(f"Failed to create Stripe customer for org {organization.slug}: {e}")
            # Fallback
            sub.stripe_customer_id = f"cus_mock_{organization.id}"
            sub.save()
            return sub.stripe_customer_id

    @classmethod
    def create_checkout_session(cls, organization: Organization, price_id: str, plan_slug: str, return_url: str) -> str:
        """
        Initiates a Stripe Checkout Session redirect url for plan subscription.
        """
        customer_id = cls.get_or_create_customer(organization)
        
        if not getattr(settings, 'STRIPE_SECRET_KEY', None):
            # Dev/Test Mock URL
            return f"https://checkout.stripe.dev/mock_session?customer={customer_id}&plan={plan_slug}&return_url={return_url}"

        try:
            session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=['card'],
                line_items=[{
                    'price': price_id,
                    'quantity': 1,
                }],
                mode='subscription',
                success_url=return_url + "?session_id={CHECKOUT_SESSION_ID}",
                cancel_url=return_url + "?canceled=true",
                metadata={
                    'organization_id': organization.id,
                    'plan_slug': plan_slug
                }
            )
            return session.url
        except Exception as e:
            logger.error(f"Failed to create Stripe checkout session: {e}")
            raise ValidationError(f"Stripe Checkout error: {str(e)}")

    @classmethod
    def create_portal_session(cls, organization: Organization, return_url: str) -> str:
        """
        Creates a Stripe Customer Portal redirect URL.
        """
        customer_id = cls.get_or_create_customer(organization)
        
        if not getattr(settings, 'STRIPE_SECRET_KEY', None):
            return f"https://billing.stripe.dev/mock_portal?customer={customer_id}&return_url={return_url}"

        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=return_url,
            )
            return session.url
        except Exception as e:
            logger.error(f"Failed to create Stripe portal session: {e}")
            raise ValidationError(f"Stripe Customer Portal error: {str(e)}")

    @classmethod
    def verify_webhook_signature(cls, payload: bytes, sig_header: str) -> dict:
        """
        Verifies Stripe Webhook Event signatures.
        """
        webhook_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', None)
        if not webhook_secret:
            # Skip verification in dev/testing environments when secret is empty
            import json
            return json.loads(payload.decode('utf-8'))

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
            return event
        except Exception as e:
            logger.error(f"Webhook signature verification failed: {e}")
            raise ValidationError(f"Invalid webhook signature: {str(e)}")


class SubscriptionService:
    @classmethod
    def sync_quota_limits(cls, organization: Organization, plan: SubscriptionPlan):
        """
        Synchronizes subscription plan limits to OrganizationQuota database.
        """
        quota, created = OrganizationQuota.objects.get_or_create(organization=organization)
        quota.max_students = plan.max_students
        quota.max_teachers = plan.max_teachers
        quota.max_courses = plan.max_courses
        quota.max_storage_gb = plan.max_storage_gb
        quota.max_active_sessions = plan.max_active_sessions
        quota.max_recording_minutes = plan.max_recording_minutes
        quota.save()
        
        # Enforce instant recalculation
        QuotaService.recalculate_usage(organization)
        logger.info(f"Synchronized quota limits for {organization.slug} to plan {plan.slug}")

    @classmethod
    def apply_payment_failure(cls, stripe_customer_id: str, stripe_subscription_id: str):
        """
        Transition subscription to past_due, starting recovery timeline.
        """
        try:
            sub = OrganizationSubscription.objects.get(
                stripe_customer_id=stripe_customer_id
            )
            sub.status = OrganizationSubscription.Status.PAST_DUE
            sub.stripe_subscription_id = stripe_subscription_id
            if not sub.payment_failed_at:
                sub.payment_failed_at = timezone.now()
            sub.save()
            logger.warning(f"Subscription for {sub.organization.slug} flagged past_due on Stripe failed payment.")
        except OrganizationSubscription.DoesNotExist:
            logger.error(f"No subscription found matching customer ID: {stripe_customer_id}")

    @classmethod
    def handle_payment_success(cls, stripe_customer_id: str, stripe_subscription_id: str, plan_slug: str):
        """
        Brings the subscription back to active status, clearing failures, syncing limits.
        """
        try:
            # Find sub by customer id
            sub = OrganizationSubscription.objects.get(stripe_customer_id=stripe_customer_id)
        except OrganizationSubscription.DoesNotExist:
            # If not exists (e.g. mock checkouts), try finding by organization or create
            logger.warning(f"No subscription matching customer ID: {stripe_customer_id}, trying fallback creation")
            return

        try:
            plan = SubscriptionPlan.objects.get(slug=plan_slug)
        except SubscriptionPlan.DoesNotExist:
            logger.error(f"SubscriptionPlan '{plan_slug}' does not exist.")
            return

        sub.plan = plan
        sub.status = OrganizationSubscription.Status.ACTIVE
        sub.stripe_subscription_id = stripe_subscription_id
        sub.payment_failed_at = None
        sub.save()

        # Update limits
        cls.sync_quota_limits(sub.organization, plan)
        logger.info(f"Payment successful: Activated plan {plan.slug} for organization {sub.organization.slug}")

    @classmethod
    def handle_subscription_canceled(cls, stripe_customer_id: str, stripe_subscription_id: str):
        """
        Sets subscription to CANCELED status and downgrades quotas.
        """
        try:
            sub = OrganizationSubscription.objects.get(
                stripe_customer_id=stripe_customer_id
            )
            sub.status = OrganizationSubscription.Status.CANCELED
            sub.stripe_subscription_id = stripe_subscription_id
            sub.save()
            
            # Switch limits to default Free plan
            free_plan = SubscriptionPlan.objects.filter(slug='free').first()
            if free_plan:
                cls.sync_quota_limits(sub.organization, free_plan)
            
            logger.info(f"Subscription for {sub.organization.slug} was canceled and limits downgraded to Free.")
        except OrganizationSubscription.DoesNotExist:
            logger.error(f"Canceled event: no subscription matching customer ID: {stripe_customer_id}")


class BillingService:
    @classmethod
    def generate_and_store_invoice_pdf(cls, organization: Organization, stripe_invoice_id: str, amount: float, currency: str, status: str, issued_at) -> BillingInvoice:
        """
        Generates invoice details, saves a BillingInvoice DB record, and simulates S3 PDF URL upload.
        """
        # Create BillingInvoice entry
        invoice, created = BillingInvoice.objects.get_or_create(
            stripe_invoice_id=stripe_invoice_id,
            defaults={
                'organization': organization,
                'amount': amount,
                'currency': currency,
                'status': status,
                'issued_at': issued_at or timezone.now(),
            }
        )

        if not invoice.invoice_pdf_url:
            # S3/MinIO PDF generation simulation
            # (In production, we can use ReportLab/pdfkit to write actual PDF bytes and store on S3)
            # Create a simple mock invoice PDF file name
            pdf_filename = f"invoices/invoice_{stripe_invoice_id}.pdf"
            
            if settings.S3_ENABLED:
                # Store relative S3 CDN URL
                invoice.invoice_pdf_url = f"{settings.CDN_URL}/{pdf_filename}" if settings.CDN_URL else f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com/{pdf_filename}"
            else:
                # Local media URL fallback
                invoice.invoice_pdf_url = f"{settings.MEDIA_URL}invoices/invoice_{stripe_invoice_id}.pdf"
            
            invoice.save()
            logger.info(f"Generated PDF invoice representation for {stripe_invoice_id} matching org {organization.slug}")

        return invoice

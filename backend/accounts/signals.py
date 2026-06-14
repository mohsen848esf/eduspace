import logging
from django.db import transaction
from django.db.models.signals import post_save, post_delete, pre_delete, m2m_changed
from django.dispatch import receiver
from django.core.cache import cache
from accounts.models import OrgMember, Role

logger = logging.getLogger(__name__)


def invalidate_user_org_perms(user_id, org_id):
    cache_key = f"user_org_perms:{user_id}:{org_id}"
    transaction.on_commit(lambda: cache.delete(cache_key))
    logger.debug(f"Scheduled invalidation for cache key on commit: {cache_key}")


def invalidate_members_with_role(role):
    # Fetch all members associated with this role synchronously while relations are intact
    members = list(OrgMember.objects.filter(role=role).values_list('user_id', 'organization_id'))
    keys = [f"user_org_perms:{user_id}:{org_id}" for user_id, org_id in members]
    if keys:
        transaction.on_commit(lambda: cache.delete_many(keys))
        logger.debug(f"Scheduled invalidation for keys on commit: {keys}")


@receiver(post_save, sender=OrgMember)
def org_member_save_handler(sender, instance, **kwargs):
    invalidate_user_org_perms(instance.user_id, instance.organization_id)


@receiver(post_delete, sender=OrgMember)
def org_member_delete_handler(sender, instance, **kwargs):
    invalidate_user_org_perms(instance.user_id, instance.organization_id)


@receiver(post_save, sender=Role)
def role_save_handler(sender, instance, **kwargs):
    invalidate_members_with_role(instance)


@receiver(pre_delete, sender=Role)
def role_delete_handler(sender, instance, **kwargs):
    invalidate_members_with_role(instance)


@receiver(m2m_changed, sender=Role.permissions.through)
def role_permissions_changed_handler(sender, instance, action, **kwargs):
    if action in ["post_add", "post_remove", "post_clear"]:
        # instance is the Role instance
        invalidate_members_with_role(instance)


# ---------------------------------------------------------------------------
# Enrollment & Certificate Signals
# ---------------------------------------------------------------------------

import uuid
from django.utils import timezone
from django.db import transaction, IntegrityError
from accounts.models import Enrollment, Certificate

def generate_cert_number():
    return f"CERT-{uuid.uuid4().hex[:16].upper()}"


@receiver(post_save, sender=Enrollment)
def enrollment_post_save_handler(sender, instance, **kwargs):
    # Set caching permissions invalidation
    invalidate_user_org_perms(instance.student_id, instance.academy_class.course.organization_id)
    
    # Generate certificate if completed
    if instance.completion_status == Enrollment.CompletionStatus.COMPLETED:
        # Check and set completion date if not present (using update to avoid post_save loops)
        if not instance.completion_date:
            now = timezone.now()
            Enrollment.objects.filter(pk=instance.pk).update(completion_date=now)
            instance.completion_date = now

        # Idempotently create Certificate with collision retries
        for attempt in range(5):
            try:
                with transaction.atomic():
                    Certificate.objects.get_or_create(
                        organization=instance.academy_class.course.organization,
                        student=instance.student,
                        academy_class=instance.academy_class,
                        defaults={
                            'certificate_number': generate_cert_number()
                        }
                    )
                break
            except IntegrityError as e:
                # If the Certificate already exists, we can safely break
                if Certificate.objects.filter(student=instance.student, academy_class=instance.academy_class).exists():
                    break
                if attempt == 4:
                    raise e



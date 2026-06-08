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

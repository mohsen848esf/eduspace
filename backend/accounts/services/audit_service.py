import logging
from django.db import transaction
from accounts.models import AuditLog

logger = logging.getLogger(__name__)

class AuditService:
    @staticmethod
    def log(actor, action: str, entity, before=None, after=None, organization=None, request=None):
        """
        Creates an AuditLog entry.
        
        Args:
            actor: User instance (can be None for system actions)
            action: String identifier (e.g., 'session.status_changed')
            entity: Django model instance being modified
            before: Dict representing state before change
            after: Dict representing state after change
            organization: Organization instance (optional, inferred from entity if possible)
            request: Django request object (optional, used for IP and user agent)
        """
        try:
            entity_type = entity.__class__.__name__
            entity_id = getattr(entity, 'pk', None) or getattr(entity, 'id', None)
            
            if not entity_id:
                logger.warning(f"AuditService skipped: Entity {entity_type} is unsaved (no pk/id).")
                return

            if not organization:
                # Try to infer organization from the entity
                if hasattr(entity, 'organization'):
                    organization = entity.organization
                elif hasattr(entity, 'get_organization') and callable(entity.get_organization):
                    organization = entity.get_organization()
            
            ip_address = None
            user_agent = ""
            
            if request:
                x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
                if x_forwarded_for:
                    ip_address = x_forwarded_for.split(',')[0].strip()
                else:
                    ip_address = request.META.get('REMOTE_ADDR')
                
                user_agent = request.META.get('HTTP_USER_AGENT', '')
                
            def do_log():
                try:
                    AuditLog.objects.create(
                        actor=actor,
                        organization=organization,
                        action=action,
                        entity_type=entity_type,
                        entity_id=entity_id,
                        before_state=before,
                        after_state=after,
                        ip_address=ip_address,
                        user_agent=user_agent
                    )
                except Exception as inner_e:
                    logger.error(f"Failed to create AuditLog for {action} on {entity}: {inner_e}", exc_info=True)

            # Enqueue the log creation to run after the transaction commits
            # This ensures we don't log failed transactions and don't hold up locks.
            transaction.on_commit(do_log)
            
        except Exception as e:
            # Catching setup errors (e.g., introspection failures)
            logger.error(f"AuditService setup failed for {action} on {entity}: {e}", exc_info=True)

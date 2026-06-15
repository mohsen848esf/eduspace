from django.utils.deprecation import MiddlewareMixin
from django.core.exceptions import PermissionDenied
from accounts.permissions import resolve_organization

class SuspensionMiddleware(MiddlewareMixin):
    def process_view(self, request, view_func, view_args, view_kwargs):
        # Exclude superusers from suspension blocks
        if request.user and request.user.is_authenticated and request.user.is_superuser:
            return None

        # Exclude admin and sys-admin operations urls
        if request.path.startswith('/api/sys-admin/') or request.path.startswith('/admin/'):
            return None

        org = resolve_organization(request, view_kwargs)
        if org and org.is_suspended:
            raise PermissionDenied("This organization has been suspended.")
        
        return None

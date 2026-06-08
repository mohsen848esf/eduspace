import functools
import logging
from pathlib import Path
from django.core.exceptions import PermissionDenied
from django.utils import timezone
from rest_framework import status as http
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)


def get_organization_from_request(request, view_kwargs=None):
    """
    Extract organization slug or ID from request headers, query parameters, or URL args.
    """
    if not request:
        # Resolve via view_kwargs only if request is None
        if view_kwargs:
            if 'org_slug' in view_kwargs:
                val = view_kwargs['org_slug']
                if val and str(val).isdigit():
                    return val, 'id'
                return val, 'slug'
            if 'organization_slug' in view_kwargs:
                val = view_kwargs['organization_slug']
                if val and str(val).isdigit():
                    return val, 'id'
                return val, 'slug'
            if 'org_id' in view_kwargs:
                return view_kwargs['org_id'], 'id'
        return None, None

    # 1. Check for custom header
    org_slug = request.headers.get('X-Organization-Slug')
    if org_slug:
        if org_slug.isdigit():
            return org_slug, 'id'
        return org_slug, 'slug'
    
    # 2. Check query params
    org_slug = None
    if hasattr(request, 'query_params'):
        org_slug = request.query_params.get('org_slug')
    if not org_slug and hasattr(request, 'GET'):
        org_slug = request.GET.get('org_slug')
        
    if org_slug:
        if org_slug.isdigit():
            return org_slug, 'id'
        return org_slug, 'slug'
    
    # 3. Check view kwargs (URL parameters)
    if view_kwargs:
        if 'org_slug' in view_kwargs:
            val = view_kwargs['org_slug']
            if val and str(val).isdigit():
                return val, 'id'
            return val, 'slug'
        if 'organization_slug' in view_kwargs:
            val = view_kwargs['organization_slug']
            if val and str(val).isdigit():
                return val, 'id'
            return val, 'slug'
        if 'org_id' in view_kwargs:
            return view_kwargs['org_id'], 'id'
            
    return None, None


def resolve_organization(request, view_kwargs=None):
    """
    Dynamically resolve the Organization model instance based on request context.
    """
    from accounts.models import Organization
    
    slug_or_id, key_type = get_organization_from_request(request, view_kwargs)
    if slug_or_id:
        if key_type == 'slug':
            try:
                return Organization.objects.get(slug=slug_or_id)
            except Organization.DoesNotExist:
                return None
        elif key_type == 'id':
            try:
                return Organization.objects.get(id=int(slug_or_id))
            except (Organization.DoesNotExist, ValueError):
                return None
                
    # Fallback: check if room_code is in view_kwargs
    if view_kwargs and 'room_code' in view_kwargs:
        from rooms.models import Room
        from django.http import Http404
        try:
            room = Room.objects.get(room_code=view_kwargs['room_code'])
            if room.organization:
                return room.organization
            if room.session:
                return room.session.get_organization()
        except Room.DoesNotExist:
            raise Http404("Room not found")
            
    # Fallback: check if recording token is in view_kwargs
    if view_kwargs and 'token' in view_kwargs:
        from rooms.models import Recording
        from django.http import Http404
        try:
            recording = Recording.objects.get(public_token=view_kwargs['token'])
            if recording.session:
                return recording.session.get_organization()
            if recording.room and recording.room.organization:
                return recording.room.organization
        except Recording.DoesNotExist:
            raise Http404("Recording not found")

    return None


def has_org_permission(user, organization, permission_codename) -> bool:
    """
    Return True if user has the specified permission codename in the organization.
    """
    if not user or not user.is_authenticated or not organization:
        return False
    
    if user.is_superuser:
        return True
        
    # Tier 1: Request-scope cache (on user instance)
    if not hasattr(user, '_org_permissions_cache'):
        user._org_permissions_cache = {}
        
    org_id = organization.id
    if org_id not in user._org_permissions_cache:
        # Tier 2: Redis Cache (via Django's cache framework)
        from django.core.cache import cache
        from django.conf import settings
        
        cache_key = f"user_org_perms:{user.id}:{org_id}"
        cached_perms = None
        try:
            cached_perms = cache.get(cache_key)
        except Exception as cache_err:
            logger.error(f"Redis cache.get failed: {cache_err}. Falling back to database.", exc_info=True)
        
        if cached_perms is not None:
            user._org_permissions_cache[org_id] = set(cached_perms)
        else:
            # Cache miss: DB Query
            from accounts.models import OrgMember
            try:
                member = OrgMember.objects.select_related('role').get(organization_id=org_id, user_id=user.id)
                if not member.is_active:
                    perms = set()
                elif member.expires_at and member.expires_at < timezone.now():
                    perms = set()
                elif not member.role:
                    perms = set()
                elif member.role.organization_id is not None and member.role.organization_id != org_id:
                    perms = set()
                else:
                    perms = set(member.role.permissions.values_list('codename', flat=True))
            except OrgMember.DoesNotExist:
                perms = set()
                
            # Store in cache
            try:
                ttl = getattr(settings, 'ORG_CONTEXT_CACHE_TTL', 86400)
                cache.set(cache_key, list(perms), timeout=ttl)
            except Exception as cache_err:
                logger.error(f"Redis cache.set failed: {cache_err}.", exc_info=True)
                
            user._org_permissions_cache[org_id] = perms
            
    return permission_codename in user._org_permissions_cache[org_id]


def require_org_permission(permission_codename):
    """
    Decorator for Django function-based views (including DRF @api_view) to enforce RBAC.
    """
    def decorator(view_func):
        @functools.wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            org = resolve_organization(request, kwargs)
            if not org:
                return Response(
                    {'error': 'Organization context not found'},
                    status=http.HTTP_400_BAD_REQUEST
                )
            
            if not has_org_permission(request.user, org, permission_codename):
                return Response(
                    {'error': f"Required permission missing: {permission_codename}"},
                    status=http.HTTP_403_FORBIDDEN
                )
            
            request.organization = org
            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator


class HasOrgPermission(BasePermission):
    """
    DRF permission class for Class-Based Views (CBVs) or ViewSets.
    """
    def has_permission(self, request, view):
        perm_codename = getattr(view, 'required_org_permission', None)
        if not perm_codename:
            return True
            
        parser_context = getattr(request, 'parser_context', {}) or {}
        view_kwargs = parser_context.get('kwargs')
        org = resolve_organization(request, view_kwargs)
        if not org:
            raise ValidationError(
                detail={'error': 'Organization context required. Include X-Organization-Slug header.'}
            )
            
        request.organization = org
        return has_org_permission(request.user, org, perm_codename)

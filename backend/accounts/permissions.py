import functools
import logging
from pathlib import Path
from django.core.exceptions import PermissionDenied
from django.utils import timezone
from rest_framework import status as http
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

logger = logging.getLogger(__name__)


def get_organization_from_request(request, view_kwargs=None):
    """
    Extract organization slug or ID from request headers, query parameters, or URL args.
    """
    # 1. Check for custom header
    org_slug = request.headers.get('X-Organization-Slug')
    if org_slug:
        return org_slug, 'slug'
    
    # 2. Check query params
    org_slug = request.query_params.get('org_slug') or request.GET.get('org_slug')
    if org_slug:
        return org_slug, 'slug'
    
    # 3. Check view kwargs (URL parameters)
    if view_kwargs:
        if 'org_slug' in view_kwargs:
            return view_kwargs['org_slug'], 'slug'
        if 'organization_slug' in view_kwargs:
            return view_kwargs['organization_slug'], 'slug'
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
        try:
            room = Room.objects.get(room_code=view_kwargs['room_code'])
            academy_class = room.academy_classes.first()
            if academy_class:
                return academy_class.course.organization
        except Room.DoesNotExist:
            pass
            
    # Fallback: check if recording token is in view_kwargs
    if view_kwargs and 'token' in view_kwargs:
        from rooms.models import Recording
        try:
            recording = Recording.objects.get(public_token=view_kwargs['token'])
            academy_class = recording.room.academy_classes.first()
            if academy_class:
                return academy_class.course.organization
        except Recording.DoesNotExist:
            pass

    # Final fallback: Default Academy
    try:
        return Organization.objects.get(slug='default-academy')
    except Organization.DoesNotExist:
        return None


def has_org_permission(user, organization, permission_codename) -> bool:
    """
    Return True if user has the specified permission codename in the organization.
    """
    if not user or not user.is_authenticated or not organization:
        return False
    
    if user.is_superuser:
        return True
        
    from accounts.models import OrgMember
    try:
        member = OrgMember.objects.get(organization=organization, user=user)
        if not member.role:
            return False
        return member.role.permissions.filter(codename=permission_codename).exists()
    except OrgMember.DoesNotExist:
        return False


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
            return False
            
        request.organization = org
        return has_org_permission(request.user, org, perm_codename)

from rest_framework.permissions import BasePermission
from rest_framework.exceptions import ValidationError
from accounts.permissions import resolve_organization, has_org_permission


class IsAssessmentManagerOrAdmin(BasePermission):
    """
    Allows write/management access to teachers (can_teach_class) or admins (can_manage_members).
    """
    def has_permission(self, request, view):
        parser_context = getattr(request, 'parser_context', {}) or {}
        view_kwargs = parser_context.get('kwargs')
        org = resolve_organization(request, view_kwargs)
        if not org:
            raise ValidationError(
                detail={'error': 'Organization context required. Include X-Organization-Slug header.'}
            )
        request.organization = org
        
        return (
            has_org_permission(request.user, org, 'can_teach_class') or
            has_org_permission(request.user, org, 'can_manage_members')
        )


class IsAssessmentParticipant(BasePermission):
    """
    Allows read-only/participation access to members with can_view_dashboard.
    """
    def has_permission(self, request, view):
        parser_context = getattr(request, 'parser_context', {}) or {}
        view_kwargs = parser_context.get('kwargs')
        org = resolve_organization(request, view_kwargs)
        if not org:
            raise ValidationError(
                detail={'error': 'Organization context required. Include X-Organization-Slug header.'}
            )
        request.organization = org
        
        return has_org_permission(request.user, org, 'can_view_dashboard')


class SubmissionPermission(BasePermission):
    """
    Object-level permission for Submission:
    - Students can view/manage only their own submissions.
    - Teachers/Admins can view/manage any submission in the organization.
    """
    def has_object_permission(self, request, view, obj):
        org = getattr(request, 'organization', None)
        if not org:
            parser_context = getattr(request, 'parser_context', {}) or {}
            view_kwargs = parser_context.get('kwargs')
            org = resolve_organization(request, view_kwargs)
            request.organization = org
        
        if not org:
            return False
            
        # Managers can see/manage any submission in the org
        is_manager = (
            has_org_permission(request.user, org, 'can_teach_class') or
            has_org_permission(request.user, org, 'can_manage_members')
        )
        if is_manager:
            return True
            
        # Students can only access their own submissions
        return obj.student == request.user

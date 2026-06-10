import { useAuthStore } from "../features/auth/store/authStore";
import { useOrgContextStore } from "../features/auth/store/orgContextStore";

const LEGACY_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    "can_view_dashboard",
    "can_manage_members",
    "can_view_financials",
    "can_manage_financials",
    "can_control_recordings",
    "can_view_sessions",
    "can_manage_sessions",
  ],
  teacher: [
    "can_view_dashboard",
    "can_teach_class",
    "can_control_recordings",
    "can_view_sessions",
    "can_manage_sessions",
  ],
  student: [
    "can_view_dashboard",
    "can_attend_class",
    "can_view_sessions",
  ],
};

export function useOrgPermission() {
  const { orgContext, isInitialized } = useOrgContextStore();
  const { user } = useAuthStore();

  const hasPermission = (permission: string): boolean => {
    // If the orgContext is loaded, use its permissions list
    if (isInitialized && orgContext) {
      return orgContext.permissions.includes(permission);
    }

    // Fallback: use legacy role-based permissions mapping
    if (user?.role) {
      const allowed = LEGACY_ROLE_PERMISSIONS[user.role];
      return allowed ? allowed.includes(permission) : false;
    }

    return false;
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    return permissions.some(hasPermission);
  };

  const hasAllPermissions = (permissions: string[]): boolean => {
    return permissions.every(hasPermission);
  };

  // Get active organization context (role, org info)
  const activeRole = orgContext?.role || user?.role || null;
  const activeOrg = orgContext?.organization || null;

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    activeRole,
    activeOrg,
    isLoading: !isInitialized,
  };
}

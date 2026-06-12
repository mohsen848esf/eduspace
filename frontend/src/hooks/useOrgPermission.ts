import { useAuthStore } from "../features/auth/store/authStore";
import { useOrgContextStore } from "../features/auth/store/orgContextStore";



export function useOrgPermission() {
  const { orgContext, isInitialized } = useOrgContextStore();
  const { user } = useAuthStore();

  const hasPermission = (permission: string): boolean => {
    // If the orgContext is loaded, use its permissions list
    if (isInitialized && orgContext) {
      return orgContext.permissions.includes(permission);
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
  const activeRole = orgContext?.role || null;
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

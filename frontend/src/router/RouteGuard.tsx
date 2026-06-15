import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../features/auth/store/authStore";
import { useOrgPermission } from "../hooks/useOrgPermission";
import { useOrgContextStore } from "../features/auth/store/orgContextStore";
import Spinner from "../components/ui/Spinner";

interface RouteGuardProps {
  children: React.ReactNode;
  isPrivate?: boolean;
  requiredPermissions?: string[];
}

export default function RouteGuard({
  children,
  isPrivate = true,
  requiredPermissions = [],
}: RouteGuardProps) {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const { hasAnyPermission, isLoading: isPermissionLoading } = useOrgPermission();
  const { isInitialized: isOrgContextInitialized } = useOrgContextStore();
  const location = useLocation();

  // 1. Wait for Auth Initialization
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--s0)]">
        <Spinner size="lg" />
      </div>
    );
  }

  // 2. Handle Public-Only Routes (like Login, Register)
  if (!isPrivate) {
    if (isAuthenticated) {
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  // 3. Handle Private Routes
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 4. Wait for Organization Context to load
  if (!isOrgContextInitialized || isPermissionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--s0)]">
        <Spinner size="lg" />
      </div>
    );
  }

  // 5. Enforce Permissions boundaries
  if (requiredPermissions && requiredPermissions.length > 0) {
    if (!hasAnyPermission(requiredPermissions)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}

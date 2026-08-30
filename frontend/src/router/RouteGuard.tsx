import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../features/auth/store/authStore";
import { useOrgPermission } from "../hooks/useOrgPermission";
import { useOrgContextStore } from "../features/auth/store/orgContextStore";
import Spinner from "../components/ui/Spinner";

interface RouteGuardProps {
  children: React.ReactNode;
  isPrivate?: boolean;
  guestOnly?: boolean;
  requiredPermissions?: string[];
  isSuperUserOnly?: boolean;
}

export default function RouteGuard({
  children,
  isPrivate = true,
  guestOnly = false,
  requiredPermissions = [],
  isSuperUserOnly = false,
}: RouteGuardProps) {
  const { isAuthenticated, isInitialized, user } = useAuthStore();
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

  // 2. Handle Guest-Only Routes (like Login, Register: logged-in users are redirected to dashboard)
  if (guestOnly) {
    if (isAuthenticated) {
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  // 3. Handle Private Routes (require authenticated session and organization context)
  if (isPrivate) {
    if (!isAuthenticated) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Wait for Organization Context to load
    if (!isOrgContextInitialized || isPermissionLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--s0)]">
          <Spinner size="lg" />
        </div>
      );
    }

    // Enforce Superuser Boundary
    if (isSuperUserOnly && !user?.is_superuser) {
      return <Navigate to="/unauthorized" replace />;
    }

    // Enforce Permissions boundaries
    if (requiredPermissions && requiredPermissions.length > 0) {
      if (!hasAnyPermission(requiredPermissions)) {
        return <Navigate to="/unauthorized" replace />;
      }
    }

    return <>{children}</>;
  }

  // 4. Handle Hybrid / Open Routes (accessible to both authenticated users and guests, like /room/:roomCode)
  return <>{children}</>;
}

import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../features/auth/store/authStore";
import { useOrgPermission } from "../hooks/useOrgPermission";
import type { UserRole } from "./routes";

interface Props {
  children: React.ReactNode;
  roles?: UserRole[];
}

export default function PrivateRoute({ children, roles }: Props) {
  const { isAuthenticated } = useAuthStore();
  const { activeRole, isLoading } = useOrgPermission();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isLoading) {
    return null;
  }

  if (roles && activeRole) {
    const normalizedRole = activeRole.toLowerCase() as UserRole;
    if (!roles.includes(normalizedRole)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}

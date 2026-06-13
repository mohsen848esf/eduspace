import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../features/auth/store/authStore";
import { useOrgPermission } from "../hooks/useOrgPermission";

interface Props {
  children: React.ReactNode;
  requiredPermissions?: string[];
}

export default function PrivateRoute({ children, requiredPermissions }: Props) {
  const { isAuthenticated } = useAuthStore();
  const { hasAnyPermission, isLoading } = useOrgPermission();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isLoading) {
    return null;
  }

  if (requiredPermissions && requiredPermissions.length > 0) {
    if (!hasAnyPermission(requiredPermissions)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}

import { Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { routes } from "./routes";
import RouteGuard from "./RouteGuard";
import ErrorBoundary from "../components/ui/ErrorBoundary";
import { UnauthorizedScreen, NotFoundScreen } from "../components/ui/ErrorScreens";
import ShimmerLoader from "../components/ui/ShimmerLoader";
import { useNotifications } from "../features/auth/hooks/useNotifications";
import { useAuthStore } from "../features/auth/store/authStore";
import { useOrgContextStore } from "../features/auth/store/orgContextStore";
import Spinner from "../components/ui/Spinner";

function NotificationProvider() {
  useNotifications();
  return null;
}

function PageLoader() {
  return <ShimmerLoader variant="page" />;
}

function AppInitializer({ children }: { children: React.ReactNode }) {
  const { fetchMe, isInitialized, isAuthenticated } = useAuthStore();
  const { fetchOrgContext, isInitialized: isOrgContextInitialized } = useOrgContextStore();

  useEffect(() => {
    fetchMe();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrgContext();
    }
  }, [isAuthenticated]);

  if (!isInitialized || (isAuthenticated && !isOrgContextInitialized)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--s0)]">
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}

export default function AppRouter() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppInitializer>
          <NotificationProvider />

          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {routes.map(({ path, component: Page, isPrivate, requiredPermissions }) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <RouteGuard isPrivate={isPrivate} requiredPermissions={requiredPermissions}>
                      <ErrorBoundary>
                        <Page />
                      </ErrorBoundary>
                    </RouteGuard>
                  }
                />
              ))}

              <Route path="/unauthorized" element={<UnauthorizedScreen />} />
              <Route path="*" element={<NotFoundScreen />} />
            </Routes>
          </Suspense>
        </AppInitializer>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

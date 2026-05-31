import { Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { routes } from "./routes";
import PrivateRoute from "./PrivateRoute";
import PublicRoute from "./PublicRoute";
import Spinner from "../components/ui/Spinner";
import { useNotifications } from "../features/auth/hooks/useNotifications";
import { useAuthStore } from "../features/auth/store/authStore";

function NotificationProvider() {
  useNotifications();
  return null;
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--s0)]">
      <Spinner size="lg" />
    </div>
  );
}

function UnauthorizedScreen() {
  const { t } = useTranslation("common");
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--s0)]">
      <div className="text-center">
        <p className="text-4xl mb-4">🚫</p>
        <h1 className="text-xl font-bold text-[var(--t1)] mb-2">
          {t("errors.accessDenied")}
        </h1>
        <p className="text-[var(--t2)] text-sm">{t("errors.noPermission")}</p>
      </div>
    </div>
  );
}

function AppInitializer({ children }: { children: React.ReactNode }) {
  const { fetchMe, isInitialized } = useAuthStore();

  useEffect(() => {
    fetchMe();
  }, []);

  if (!isInitialized) {
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
    <BrowserRouter>
      <AppInitializer>
        <NotificationProvider />

        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {routes.map(({ path, component: Page, isPrivate, roles }) => (
              <Route
                key={path}
                path={path}
                element={
                  isPrivate ? (
                    <PrivateRoute roles={roles}>
                      <Page />
                    </PrivateRoute>
                  ) : (
                    <PublicRoute>
                      <Page />
                    </PublicRoute>
                  )
                }
              />
            ))}

            <Route path="/unauthorized" element={<UnauthorizedScreen />} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AppInitializer>
    </BrowserRouter>
  );
}

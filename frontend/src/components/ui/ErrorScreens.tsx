import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Button from "./Button";

interface ErrorScreenProps {
  title?: string;
  description?: string;
  code?: string;
  error?: Error;
  resetErrorBoundary?: () => void;
}

export function UnauthorizedScreen({ title, description }: ErrorScreenProps) {
  const navigate = useNavigate();
  const { t } = useTranslation(["common", "dashboard"]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--s0)] px-6 py-12">
      <div className="max-w-md w-full bg-[var(--s1)] border border-[var(--b)] rounded-2xl p-8 text-center space-y-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="w-20 h-20 bg-[var(--red)]/10 rounded-full flex items-center justify-center mx-auto text-4xl text-[var(--red)]">
          🚫
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--t1)] tracking-tight">
            {title || t("common:errors.accessDenied", "Access Denied")}
          </h1>
          <p className="text-[var(--t2)] text-sm leading-relaxed">
            {description || t("common:errors.noPermission", "You do not have permission to access this resource. Please contact your organization administrator.")}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto"
          >
            {t("common:actions.goBack", "Go Back")}
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate("/dashboard")}
            className="w-full sm:w-auto"
          >
            {t("dashboard:nav.home", "Dashboard")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NotFoundScreen({ title, description }: ErrorScreenProps) {
  const navigate = useNavigate();
  const { t } = useTranslation(["common", "dashboard"]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--s0)] px-6 py-12">
      <div className="max-w-md w-full bg-[var(--s1)] border border-[var(--b)] rounded-2xl p-8 text-center space-y-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="w-20 h-20 bg-[var(--brand)]/10 rounded-full flex items-center justify-center mx-auto text-4xl text-[var(--brand-text)]">
          🔍
        </div>
        <div className="space-y-2">
          <h1 className="text-5xl font-extrabold text-[var(--brand-text)] tracking-tight">
            404
          </h1>
          <h2 className="text-xl font-bold text-[var(--t1)]">
            {title || t("common:errors.notFoundTitle", "Page Not Found")}
          </h2>
          <p className="text-[var(--t2)] text-sm leading-relaxed">
            {description || t("common:errors.notFoundDesc", "The page you are looking for does not exist or has been moved to another path.")}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto"
          >
            {t("common:actions.goBack", "Go Back")}
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate("/dashboard")}
            className="w-full sm:w-auto"
          >
            {t("dashboard:nav.home", "Dashboard")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ServerErrorScreen({ error, resetErrorBoundary }: ErrorScreenProps) {
  const navigate = useNavigate();
  const { t } = useTranslation(["common", "dashboard"]);

  const handleRetry = () => {
    if (resetErrorBoundary) {
      resetErrorBoundary();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--s0)] px-6 py-12">
      <div className="max-w-lg w-full bg-[var(--s1)] border border-[var(--b)] rounded-2xl p-8 text-center space-y-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="w-20 h-20 bg-[var(--red)]/10 rounded-full flex items-center justify-center mx-auto text-4xl text-[var(--red)]">
          ⚠️
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--t1)] tracking-tight">
            {t("common:errors.serverErrorTitle", "System Crash Detected")}
          </h1>
          <p className="text-[var(--t2)] text-sm leading-relaxed">
            {t("common:errors.serverErrorDesc", "An unexpected UI error has occurred. We have logged the error details. You can retry the current action or head back home.")}
          </p>
        </div>

        {error && !import.meta.env.PROD && (
          <div className="bg-[var(--s2)] border border-[var(--b)] rounded-xl p-4 text-start overflow-auto max-h-48 text-xs font-mono text-[var(--red)]">
            <p className="font-bold mb-1">{error.toString()}</p>
            <p className="whitespace-pre opacity-80">{error.stack}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={handleRetry}
            className="w-full sm:w-auto"
          >
            {t("common:actions.retry", "Retry Connection")}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (resetErrorBoundary) resetErrorBoundary();
              navigate("/dashboard");
            }}
            className="w-full sm:w-auto"
          >
            {t("dashboard:nav.home", "Dashboard")}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLogin } from "../hooks/useLogin";
import { usePasswordToggle } from "../hooks/usePasswordToggle";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";

export default function LoginPage() {
  const { t } = useTranslation(["auth", "common"]);
  const { form, onSubmit, isLoading, error, clearError } = useLogin();
  const { inputType, icon, toggle } = usePasswordToggle();
  const {
    register,
    formState: { errors },
  } = form;

  useEffect(() => {
    clearError();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--s0)] px-4 py-6 md:p-4">
      <div className="w-full max-w-sm fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6 md:mb-8 gap-3">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-[var(--brand)] rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl font-bold shadow-lg shadow-[var(--brand)]/20">
            E
          </div>
          <div className="text-center">
            <h1 className="text-xl md:text-2xl font-bold text-[var(--t1)]">
              {t("common:app.name")}
            </h1>
            <p className="text-sm text-[var(--t3)] mt-0.5">
              {t("login.title")}
            </p>
          </div>
        </div>

        {/* Card — borderless on mobile, framed at md+. */}
        <div className="md:bg-[var(--s1)] md:rounded-2xl md:p-6 md:border md:border-[var(--b)]">
          {/* Server error */}
          {error && (
            <div className="mb-4 p-3 bg-[var(--red)]/10 border border-[var(--red)]/20 rounded-xl flex items-center gap-2 fade-in">
              <span className="text-[var(--red)]">⚠</span>
              <p className="text-[var(--red)] text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <Input
              label={t("fields.username")}
              placeholder={t("placeholders.username")}
              autoFocus
              error={errors.username?.message}
              {...register("username")}
            />

            <Input
              label={t("fields.password")}
              type={inputType}
              placeholder={t("placeholders.password")}
              error={errors.password?.message}
              rightIcon={<span>{icon}</span>}
              onRightIconClick={toggle}
              {...register("password")}
            />

            <Button
              type="submit"
              fullWidth
              loading={isLoading}
              className="mt-1 min-h-11"
            >
              {t("login.submit")}
            </Button>
          </form>

          <p className="text-center text-xs text-[var(--t3)] mt-4">
            {t("login.noAccount")}{" "}
            <Link
              to="/register"
              className="text-[var(--brand-text)] hover:underline font-medium"
            >
              {t("login.createOne")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

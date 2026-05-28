import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useRegister } from "../hooks/useRegister";
import { usePasswordToggle } from "../hooks/usePasswordToggle";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";

export default function RegisterPage() {
  const { t } = useTranslation(["auth", "common"]);
  const { form, onSubmit, isLoading, error, clearError } = useRegister();
  const { inputType, icon, toggle } = usePasswordToggle();
  const {
    register,
    watch,
    formState: { errors },
  } = form;

  const selectedRole = watch("role");

  useEffect(() => {
    clearError();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--s0)] p-4">
      <div className="w-full max-w-sm fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-12 h-12 bg-[var(--brand)] rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-[var(--brand)]/20">
            E
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-[var(--t1)]">
              {t("common:app.name")}
            </h1>
            <p className="text-sm text-[var(--t3)] mt-0.5">
              {t("register.title")}
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[var(--s1)] rounded-2xl p-6 border border-[var(--b)]">
          {/* Server error */}
          {error && (
            <div className="mb-4 p-3 bg-[var(--red)]/10 border border-[var(--red)]/20 rounded-xl flex items-center gap-2 fade-in">
              <span className="text-[var(--red)]">⚠</span>
              <p className="text-[var(--red)] text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            {/* Role selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {t("register.iAmA")}
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(["student", "teacher"] as const).map((role) => (
                  <label
                    key={role}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border cursor-pointer transition-all duration-150 ${
                      selectedRole === role
                        ? "bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)]"
                        : "bg-[var(--s2)] border-[var(--b)] text-[var(--t2)] hover:border-[var(--bh)]"
                    }`}
                  >
                    <input
                      type="radio"
                      value={role}
                      className="hidden"
                      {...register("role")}
                    />
                    <span>{role === "student" ? "🎓" : "👨‍🏫"}</span>
                    <span className="text-sm font-medium">
                      {t(`register.${role}`)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <Input
              label={t("fields.fullName")}
              placeholder={t("placeholders.fullName")}
              autoFocus
              error={errors.full_name?.message}
              {...register("full_name")}
            />

            <Input
              label={t("fields.username")}
              placeholder={t("placeholders.usernameRegister")}
              hint={t("hints.username")}
              error={errors.username?.message}
              {...register("username")}
            />

            <Input
              label={t("fields.email")}
              type="email"
              placeholder={t("placeholders.email")}
              error={errors.email?.message}
              {...register("email")}
            />

            <Input
              label={t("fields.password")}
              type={inputType}
              placeholder={t("placeholders.passwordRegister")}
              error={errors.password?.message}
              rightIcon={<span>{icon}</span>}
              onRightIconClick={toggle}
              {...register("password")}
            />

            <Input
              label={t("fields.confirmPassword")}
              type={inputType}
              placeholder={t("placeholders.confirmPassword")}
              error={errors.confirmPassword?.message}
              {...register("confirmPassword")}
            />

            <Button
              type="submit"
              fullWidth
              loading={isLoading}
              className="mt-1"
            >
              {t("register.submit")}
            </Button>
          </form>

          <p className="text-center text-xs text-[var(--t3)] mt-4">
            {t("register.hasAccount")}{" "}
            <Link
              to="/login"
              className="text-[var(--brand-text)] hover:underline font-medium"
            >
              {t("register.signIn")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

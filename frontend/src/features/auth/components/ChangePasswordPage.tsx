import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import AppShell from "../../../components/layout/AppShell";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { usePasswordToggle } from "../hooks/usePasswordToggle";
import { useAuthStore } from "../store/authStore";
import {
  buildChangePasswordSchema,
  type ChangePasswordInput,
} from "../schemas/auth.schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale } from "../../../i18n/useLocale";

export default function ChangePasswordPage() {
  const { t } = useTranslation("auth");
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const { changePassword, isLoading, error, clearError } = useAuthStore();
  const [isSuccess, setIsSuccess] = useState(false);

  const schema = useMemo(() => buildChangePasswordSchema(t), [t]);
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;
  const currentPasswordField = register("current_password");
  const newPasswordField = register("new_password");
  const confirmPasswordField = register("confirm_password");

  const currentPasswordToggle = usePasswordToggle();
  const newPasswordToggle = usePasswordToggle();
  const confirmPasswordToggle = usePasswordToggle();
  const visibilityLabel = (isVisible: boolean) =>
    t(isVisible ? "changePassword.visibilityHide" : "changePassword.visibilityShow");

  const onSubmit = async (data: ChangePasswordInput) => {
    clearError();
    setIsSuccess(false);
    const changed = await changePassword(data);
    if (changed) {
      reset();
      setIsSuccess(true);
    }
  };

  return (
    <AppShell
      title={t("changePassword.title")}
      subtitle={t("changePassword.subtitle")}
      activeNav="changePassword"
    >
      <div className="mx-auto w-full max-w-2xl fade-in">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--t1)]">
              {t("changePassword.title")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--t2)]">
              {t("changePassword.subtitle")}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--b)] bg-[var(--s1)] p-5 shadow-sm sm:p-7">
          {isSuccess && (
            <div
              role="status"
              className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-emerald-400"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">{t("changePassword.successTitle")}</p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-400/90">
                  {t("changePassword.successDescription")}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-center gap-2 rounded-xl border border-[var(--red)]/20 bg-[var(--red)]/10 p-3.5 text-sm text-[var(--red)]"
            >
              <span aria-hidden="true">⚠</span>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
            <Input
              label={t("changePassword.currentPassword")}
              type={currentPasswordToggle.inputType}
              placeholder={t("changePassword.currentPlaceholder")}
              autoComplete="current-password"
              required
              error={errors.current_password?.message}
              rightIcon={<span aria-hidden="true">{currentPasswordToggle.icon}</span>}
              rightIconLabel={visibilityLabel(currentPasswordToggle.showPassword)}
              onRightIconClick={currentPasswordToggle.toggle}
              {...currentPasswordField}
              onChange={(event) => {
                clearError();
                void currentPasswordField.onChange(event);
              }}
            />

            <Input
              label={t("changePassword.newPassword")}
              type={newPasswordToggle.inputType}
              placeholder={t("changePassword.newPlaceholder")}
              hint={t("changePassword.passwordHint")}
              autoComplete="new-password"
              required
              error={errors.new_password?.message}
              rightIcon={<span aria-hidden="true">{newPasswordToggle.icon}</span>}
              rightIconLabel={visibilityLabel(newPasswordToggle.showPassword)}
              onRightIconClick={newPasswordToggle.toggle}
              {...newPasswordField}
              onChange={(event) => {
                clearError();
                void newPasswordField.onChange(event);
              }}
            />

            <Input
              label={t("changePassword.confirmPassword")}
              type={confirmPasswordToggle.inputType}
              placeholder={t("changePassword.confirmPlaceholder")}
              autoComplete="new-password"
              required
              error={errors.confirm_password?.message}
              rightIcon={<span aria-hidden="true">{confirmPasswordToggle.icon}</span>}
              rightIconLabel={visibilityLabel(confirmPasswordToggle.showPassword)}
              onRightIconClick={confirmPasswordToggle.toggle}
              {...confirmPasswordField}
              onChange={(event) => {
                clearError();
                void confirmPasswordField.onChange(event);
              }}
            />

            <div className="flex justify-end pt-1">
              <Button type="submit" loading={isLoading} className="min-h-11">
                {t("changePassword.submit")}
              </Button>
            </div>
          </form>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-[var(--t3)]">
          {isFarsi
            ? "پس از تغییر گذرواژه، نشست‌های دستگاه‌های دیگر برای محافظت از حساب شما پایان می‌یابند."
            : "For your protection, sessions on other devices end after you change your password."}
        </p>
      </div>
    </AppShell>
  );
}

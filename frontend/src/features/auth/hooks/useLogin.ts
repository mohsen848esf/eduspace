import { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/authStore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { buildLoginSchema, type LoginInput } from "../schemas/auth.schema";

export function useLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("auth");
  const { login, isLoading, error, clearError } = useAuthStore();

  const from = (location.state as any)?.from?.pathname || "/dashboard";

  const schema = useMemo(() => buildLoginSchema(t), [t]);

  const form = useForm<LoginInput>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = async (data: LoginInput) => {
    await login(data);
    if (useAuthStore.getState().isAuthenticated) {
      navigate(from, { replace: true });
    }
  };

  return {
    form,
    onSubmit: form.handleSubmit(onSubmit),
    isLoading,
    error,
    clearError,
  };
}

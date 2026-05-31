import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/authStore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  buildRegisterSchema,
  type RegisterInput,
} from "../schemas/auth.schema";

export function useRegister() {
  const navigate = useNavigate();
  const { t } = useTranslation("auth");
  const {
    register: registerUser,
    isLoading,
    error,
    clearError,
  } = useAuthStore();

  const schema = useMemo(() => buildRegisterSchema(t), [t]);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(schema),
    defaultValues: { role: "student" },
  });

  const onSubmit = async (data: RegisterInput) => {
    const { confirmPassword: _ignored, ...payload } = data;
    void _ignored;
    await registerUser(payload);
    if (useAuthStore.getState().isAuthenticated) {
      navigate("/dashboard", { replace: true });
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

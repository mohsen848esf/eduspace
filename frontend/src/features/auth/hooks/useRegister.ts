import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "../schemas/auth.schema";

export function useRegister() {
  const navigate = useNavigate();
  const {
    register: registerUser,
    isLoading,
    error,
    clearError,
  } = useAuthStore();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "student" },
  });

  const onSubmit = async (data: RegisterInput) => {
    const { confirmPassword, ...payload } = data;
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

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useLogin } from "../hooks/useLogin";
import { usePasswordToggle } from "../hooks/usePasswordToggle";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";

export default function LoginPage() {
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
    <div className="min-h-screen flex items-center justify-center bg-[var(--s0)] p-4">
      <div className="w-full max-w-sm fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-12 h-12 bg-[var(--brand)] rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-[var(--brand)]/20">
            E
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-[var(--t1)]">EduSpace</h1>
            <p className="text-sm text-[var(--t3)] mt-0.5">
              Sign in to your account
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
            <Input
              label="Username"
              placeholder="Enter your username"
              autoFocus
              error={errors.username?.message}
              {...register("username")}
            />

            <Input
              label="Password"
              type={inputType}
              placeholder="Enter your password"
              error={errors.password?.message}
              rightIcon={<span>{icon}</span>}
              onRightIconClick={toggle}
              {...register("password")}
            />

            <Button
              type="submit"
              fullWidth
              loading={isLoading}
              className="mt-1"
            >
              Sign In
            </Button>
          </form>

          <p className="text-center text-xs text-[var(--t3)] mt-4">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-[var(--brand-text)] hover:underline font-medium"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

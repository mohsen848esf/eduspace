import { forwardRef } from "react";
import { cn } from "../../lib/utils";
import Spinner from "./Spinner";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "success";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--brand)] hover:bg-[var(--brand-h)] text-white shadow-sm shadow-[var(--brand)]/20",
  secondary: "bg-[var(--s3)] hover:brightness-110 text-[var(--t1)]",
  ghost: "bg-transparent hover:bg-[var(--brand-soft)] text-[var(--brand-text)]",
  danger: "bg-[var(--red)]/10 hover:bg-[var(--red)]/18 text-[var(--red)]",
  success:
    "bg-[var(--green)]/10 hover:bg-[var(--green)]/18 text-[var(--green)]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-6 py-3 text-base rounded-xl gap-2.5",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      className,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center font-semibold",
          "border-none cursor-pointer select-none",
          "transition-all duration-150",
          "active:scale-[0.97]",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--s0)]",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        {loading ? <Spinner size={size === "lg" ? "md" : "sm"} /> : leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    );
  },
);

Button.displayName = "Button";
export default Button;

import { forwardRef } from "react";
import { cn } from "../../lib/utils";

export type InputType =
  | "text"
  | "password"
  | "email"
  | "search"
  | "number"
  | "tel";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconClick?: () => void;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      leftIcon,
      rightIcon,
      onRightIconClick,
      className,
      id,
      ...props
    },
    ref,
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const hasError = !!error;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide"
          >
            {label}
            {props.required && (
              <span className="text-[var(--red)] ms-1">*</span>
            )}
          </label>
        )}

        {/* Input wrapper */}
        <div className="relative flex items-center">
          {/* Left icon */}
          {leftIcon && (
            <span className="absolute start-3 text-[var(--t3)] pointer-events-none text-sm">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full bg-[var(--s2)] text-[var(--t1)] text-sm",
              "border rounded-xl px-4 py-2.5",
              "placeholder-[var(--t3)]",
              "outline-none transition-all duration-200",
              "focus:ring-2",
              // Border & ring states
              hasError
                ? "border-[var(--red)]/50 focus:border-[var(--red)] focus:ring-[var(--red)]/20"
                : "border-[var(--b)] focus:border-[var(--brand)] focus:ring-[var(--brand)]/20",
              // Icon padding
              leftIcon && "ps-9",
              rightIcon && "pe-10",
              // Disabled
              "disabled:opacity-50 disabled:cursor-not-allowed",
              className,
            )}
            {...props}
          />

          {/* Right icon */}
          {rightIcon && (
            <button
              type="button"
              onClick={onRightIconClick}
              className={cn(
                "absolute end-3 text-[var(--t3)] transition-colors duration-150",
                onRightIconClick
                  ? "hover:text-[var(--t1)] cursor-pointer"
                  : "cursor-default pointer-events-none",
              )}
            >
              {rightIcon}
            </button>
          )}
        </div>

        {/* Error message */}
        {error && (
          <p className="text-xs text-[var(--red)] flex items-center gap-1 fade-in">
            <span>⚠</span>
            {error}
          </p>
        )}

        {/* Hint */}
        {hint && !error && <p className="text-xs text-[var(--t3)]">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
export default Input;

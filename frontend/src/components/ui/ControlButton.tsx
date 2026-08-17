import { forwardRef } from "react";
import { Tooltip } from "./Tooltip";
import { cn } from "../../lib/utils";

export type ControlButtonVariant =
  | "default"
  | "active"
  | "danger"
  | "leave";

export type ControlButtonSize = "sm" | "md" | "lg";

interface ControlButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Icon node (uses currentColor). */
  icon: React.ReactNode;
  /** Text label rendered below the icon. */
  label: string;
  /** Optional tooltip surfaced on hover. Defaults to the label. */
  tooltip?: string;
  /** Visual state. */
  variant?: ControlButtonVariant;
  /** Size token: sm (mobile 40px), md (tablet 44px), lg (desktop 48px). */
  size?: ControlButtonSize;
  /** Hide the visual label and rely on the tooltip alone. */
  hideLabel?: boolean;
  /** Force show active indicator dot */
  isActiveDot?: boolean;
}

/**
 * Refreshed in-call control button with macOS dock micro-interactions.
 */
const containerSize: Record<ControlButtonSize, string> = {
  sm: "w-10 h-10 min-w-10 rounded-xl",
  md: "w-11 h-11 min-w-11 rounded-xl",
  lg: "w-12 h-12 min-w-12 rounded-xl",
};

const labelSize: Record<ControlButtonSize, string> = {
  sm: "text-[10px]",
  md: "text-[11px]",
  lg: "text-[11px]",
};

const variantClasses: Record<ControlButtonVariant, string> = {
  default:
    "bg-[var(--s2)] text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)]",
  active:
    "bg-[var(--brand-soft)] text-[var(--brand-text)] hover:bg-[var(--brand)]/20 ring-1 ring-[var(--brand)]/30",
  danger: "bg-[var(--red)]/15 text-[var(--red)] hover:bg-[var(--red)]/25",
  leave:
    "bg-[var(--red)] text-white shadow-md shadow-[var(--red)]/30 hover:bg-[var(--red)]/90",
};

const ControlButton = forwardRef<HTMLButtonElement, ControlButtonProps>(
  (
    {
      icon,
      label,
      tooltip,
      variant = "default",
      size = "md",
      hideLabel = false,
      isActiveDot,
      className,
      ...rest
    },
    ref,
  ) => {
    const isLeave = variant === "leave";
    const showDot = isActiveDot !== undefined ? isActiveDot : variant === "active";

    const button = (
      <button
        ref={ref}
        {...rest}
        className={cn(
          "relative flex flex-col items-center justify-center gap-1 group",
          "border-none cursor-pointer transition-all duration-200 ease-out",
          "hover:-translate-y-1 hover:scale-105 hover:rotate-[-1deg] active:scale-95",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:hover:rotate-0",
          hideLabel ? "min-h-11" : "py-1",
          isLeave && "rounded-full px-1",
          className,
        )}
      >
        <span
          className={cn(
            "flex items-center justify-center transition-all duration-200 shadow-xs",
            isLeave
              ? containerSize[size]
              : cn(containerSize[size], variantClasses[variant], "border border-[var(--b)]"),
            isLeave && variantClasses.leave,
          )}
        >
          {icon}
        </span>
        {!hideLabel && (
          <span
            className={cn(
              "font-medium leading-none whitespace-nowrap",
              labelSize[size],
              variant === "active"
                ? "text-[var(--brand-text)]"
                : variant === "danger"
                  ? "text-[var(--red)]"
                  : variant === "leave"
                    ? "text-[var(--red)]"
                    : "text-[var(--t2)]",
            )}
          >
            {label}
          </span>
        )}
        {showDot && !isLeave && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[var(--brand)] shadow-[0_0_6px_var(--brand)] animate-in fade-in zoom-in" />
        )}
      </button>
    );

    if (tooltip ?? label) {
      return <Tooltip content={tooltip ?? label}>{button}</Tooltip>;
    }
    return button;
  },
);

ControlButton.displayName = "ControlButton";

export default ControlButton;

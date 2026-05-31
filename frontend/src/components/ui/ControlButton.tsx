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
}

/**
 * Refreshed in-call control button.
 *
 * Photo-1 visual: rounded-square icon container with the label below.
 * Variants:
 *   default  — neutral surface, brand-text on hover
 *   active   — brand-soft fill, brand-text foreground (selected panel etc.)
 *   danger   — rose-soft fill, rose foreground (cam/mic off, end-call etc.)
 *   leave    — solid rose circle, white icon, larger than the others
 *
 * Sizes scale with the viewport: sm on mobile, md on tablet, lg on desktop.
 * Pass the right size from the layout (mobile shells default to sm).
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
    "bg-[var(--brand-soft)] text-[var(--brand-text)] hover:bg-[var(--brand)]/20",
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
      className,
      ...rest
    },
    ref,
  ) => {
    const isLeave = variant === "leave";

    const button = (
      <button
        ref={ref}
        {...rest}
        className={cn(
          "flex flex-col items-center justify-center gap-1",
          "border-none cursor-pointer transition-colors duration-150",
          "active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed",
          // Touch-target floor: bumped to min-h-11 so the inner icon
          // square plus label still clears 44px on mobile.
          hideLabel ? "min-h-11" : "py-1",
          isLeave && "rounded-full px-1",
          className,
        )}
      >
        <span
          className={cn(
            "flex items-center justify-center transition-colors duration-150",
            isLeave
              ? containerSize[size]
              : cn(containerSize[size], variantClasses[variant]),
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

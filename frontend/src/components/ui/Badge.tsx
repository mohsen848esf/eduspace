import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 font-semibold transition-colors select-none",
  {
    variants: {
      variant: {
        brand: "bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--brand)]/20",
        success: "bg-[var(--green)]/15 text-[var(--green)] border border-[var(--green)]/25",
        warning: "bg-[var(--amber)]/15 text-[var(--amber)] border border-[var(--amber)]/25",
        danger: "bg-[var(--red)]/15 text-[var(--red)] border border-[var(--red)]/25",
        cyan: "bg-[var(--cyan)]/15 text-[var(--cyan)] border border-[var(--cyan)]/25",
        neutral: "bg-[var(--s3)] text-[var(--t2)] border border-[var(--b)]",
        outline: "bg-transparent text-[var(--t2)] border border-[var(--b)]",
        live: "bg-[var(--green)]/15 text-[var(--green)] border border-[var(--green)]/30 animate-pulse",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px] rounded-md",
        md: "px-2.5 py-1 text-xs rounded-lg",
        lg: "px-3 py-1.5 text-sm rounded-xl",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "sm",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant,
  size,
  dot,
  icon,
  children,
  ...props
}) => {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            variant === "success" || variant === "live"
              ? "bg-[var(--green)]"
              : variant === "warning"
              ? "bg-[var(--amber)]"
              : variant === "danger"
              ? "bg-[var(--red)]"
              : variant === "cyan"
              ? "bg-[var(--cyan)]"
              : variant === "brand"
              ? "bg-[var(--brand)]"
              : "bg-[var(--t3)]"
          )}
        />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
};

export default Badge;

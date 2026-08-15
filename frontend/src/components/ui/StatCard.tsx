import React from "react";
import { cn } from "@/lib/utils";
import Badge from "./Badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
  trend?: {
    value: string | number;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  variant?: "brand" | "success" | "warning" | "danger" | "cyan" | "default";
}

const iconBgVariants = {
  brand: "bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand)]/20",
  success: "bg-[var(--green)]/15 text-[var(--green)] border-[var(--green)]/25",
  warning: "bg-[var(--amber)]/15 text-[var(--amber)] border-[var(--amber)]/25",
  danger: "bg-[var(--red)]/15 text-[var(--red)] border-[var(--red)]/25",
  cyan: "bg-[var(--cyan)]/15 text-[var(--cyan)] border-[var(--cyan)]/25",
  default: "bg-[var(--s3)] text-[var(--t1)] border-[var(--b)]",
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  subtitle,
  trend,
  variant = "brand",
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "rounded-2xl bg-[var(--s2)] border border-[var(--b)] p-5",
        "flex flex-col justify-between gap-4 transition-all duration-200",
        "hover:border-[var(--brand)]/30 hover:shadow-lg hover:shadow-[var(--brand)]/5",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs font-semibold text-[var(--t2)] tracking-wide uppercase">
            {title}
          </span>
          <span className="text-2xl md:text-3xl font-extrabold text-[var(--t1)] tracking-tight">
            {value}
          </span>
        </div>
        <div
          className={cn(
            "w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 shadow-sm",
            iconBgVariants[variant]
          )}
        >
          {icon}
        </div>
      </div>

      {(subtitle || trend) && (
        <div className="flex items-center gap-2 pt-3 border-t border-[var(--b)]/60 text-xs">
          {trend && (
            <Badge
              variant={
                trend.direction === "up"
                  ? "success"
                  : trend.direction === "down"
                  ? "danger"
                  : "neutral"
              }
              size="sm"
              icon={
                trend.direction === "up" ? (
                  <TrendingUp className="w-3 h-3" />
                ) : trend.direction === "down" ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <Minus className="w-3 h-3" />
                )
              }
            >
              {trend.value}
            </Badge>
          )}
          {subtitle && (
            <span className="text-[var(--t3)] text-[11px] truncate">
              {trend?.label || subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StatCard;

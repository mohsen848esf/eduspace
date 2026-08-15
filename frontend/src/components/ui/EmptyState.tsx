import React from "react";
import { cn } from "@/lib/utils";
import Button from "./Button";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionNode?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionNode,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 md:p-12 rounded-2xl",
        "border border-dashed border-[var(--b)] bg-[var(--s2)]/40",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-[var(--s3)] border border-[var(--b)] flex items-center justify-center text-[var(--t2)] mb-4 shadow-sm">
          {icon}
        </div>
      )}
      <h4 className="text-sm md:text-base font-bold text-[var(--t1)] mb-1">
        {title}
      </h4>
      {description && (
        <p className="text-xs text-[var(--t2)] max-w-sm mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {actionNode ? (
        actionNode
      ) : actionLabel && onAction ? (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
};

export default EmptyState;

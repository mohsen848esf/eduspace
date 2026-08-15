import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  glass?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable = false, glass = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border border-[var(--b)] p-5 transition-all duration-200",
          glass
            ? "bg-[color-mix(in_srgb,var(--s2)_80%,transparent)] backdrop-blur-xl"
            : "bg-[var(--s2)]",
          hoverable &&
            "hover:border-[var(--brand)]/35 hover:shadow-lg hover:shadow-[var(--brand)]/5 hover:-translate-y-0.5 cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  action?: React.ReactNode;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, action, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-start justify-between gap-4 pb-4 border-b border-[var(--b)]/60 mb-4",
          className
        )}
        {...props}
      >
        <div className="flex flex-col gap-1 min-w-0">{children}</div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    );
  }
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => {
  return (
    <h3
      ref={ref}
      className={cn(
        "text-base font-bold text-[var(--t1)] tracking-tight",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
});
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn("text-xs text-[var(--t2)] leading-relaxed", className)}
      {...props}
    >
      {children}
    </p>
  );
});
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div ref={ref} className={cn("flex-1", className)} {...props}>
      {children}
    </div>
  );
});
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between gap-3 pt-4 border-t border-[var(--b)]/60 mt-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
CardFooter.displayName = "CardFooter";

export default Card;

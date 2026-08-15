import React, { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({
  defaultValue = "",
  value: controlledValue,
  onValueChange,
  className,
  children,
  ...props
}) => {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue;

  const handleChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setUncontrolledValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ value, onChange: handleChange }}>
      <div className={cn("flex flex-col gap-4 w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 p-1 bg-[var(--s3)] border border-[var(--b)] rounded-xl overflow-x-auto max-w-full",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
TabsList.displayName = "TabsList";

export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  TabsTriggerProps
>(({ className, value, icon, badge, children, ...props }, ref) => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be used within Tabs");

  const isActive = ctx.value === value;

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx.onChange(value)}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all select-none whitespace-nowrap cursor-pointer",
        isActive
          ? "bg-[var(--s2)] text-[var(--t1)] shadow-sm border border-[var(--b)]"
          : "text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[var(--s2)]/40",
        className
      )}
      {...props}
    >
      {icon && <span className="shrink-0 text-sm">{icon}</span>}
      <span>{children}</span>
      {badge && <span className="shrink-0">{badge}</span>}
    </button>
  );
});
TabsTrigger.displayName = "TabsTrigger";

export interface TabsContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent = React.forwardRef<
  HTMLDivElement,
  TabsContentProps
>(({ className, value, children, ...props }, ref) => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be used within Tabs");

  if (ctx.value !== value) return null;

  return (
    <div
      ref={ref}
      role="tabpanel"
      className={cn("fade-in outline-none", className)}
      {...props}
    >
      {children}
    </div>
  );
});
TabsContent.displayName = "TabsContent";

export default Tabs;

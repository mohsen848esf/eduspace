import React from "react";
import { cn } from "../../lib/utils";

export interface SwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "brand" | "indigo" | "emerald";
  className?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
}

const sizeConfig = {
  sm: {
    container: "w-7 h-4 p-0.5",
    thumb: "w-3 h-3",
    translate: "translate-x-3",
  },
  md: {
    container: "w-9 h-5 p-0.5",
    thumb: "w-4 h-4",
    translate: "translate-x-4",
  },
  lg: {
    container: "w-11 h-6 p-0.5",
    thumb: "w-5 h-5",
    translate: "translate-x-5",
  },
};

const variantConfig = {
  brand: "bg-[var(--brand)]",
  indigo: "bg-indigo-600",
  emerald: "bg-emerald-600",
};

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  size = "md",
  variant = "indigo",
  className,
  id,
  name,
  "aria-label": ariaLabel,
}) => {
  const config = sizeConfig[size] || sizeConfig.md;
  const activeBg = variantConfig[variant] || variantConfig.indigo;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || !onChange) return;
    onChange(!checked);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      id={id}
      name={name}
      dir="ltr"
      onClick={handleClick}
      className={cn(
        "relative inline-flex items-center shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out border-none outline-none select-none",
        "focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus-visible:ring-offset-1",
        config.container,
        checked ? activeBg : "bg-white/20 hover:bg-white/25",
        disabled && "opacity-40 cursor-not-allowed pointer-events-none",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out",
          config.thumb,
          checked ? config.translate : "translate-x-0",
        )}
      />
    </button>
  );
};

export default Switch;

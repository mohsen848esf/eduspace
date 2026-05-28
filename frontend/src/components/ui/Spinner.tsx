import { cn } from "../../lib/utils";

type SpinnerSize = "sm" | "md" | "lg";

const sizeStyles: Record<SpinnerSize, string> = {
  sm: "w-3.5 h-3.5 border-[1.5px]",
  md: "w-5 h-5 border-2",
  lg: "w-7 h-7 border-2",
};

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

export default function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div
      className={cn(
        "rounded-full border-white/25 border-t-white animate-spin",
        sizeStyles[size],
        className,
      )}
    />
  );
}

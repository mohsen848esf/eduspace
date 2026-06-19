import { AlertCircle } from "lucide-react";
import { cn } from "../../../lib/utils";
import { useLocale } from "../../../i18n/useLocale";

export interface DateTimePickerProps {
  label?: string;
  value?: string; // Format: YYYY-MM-DDTHH:mm
  onChange?: (val: string) => void;
  minDateTime?: string; // YYYY-MM-DDTHH:mm
  maxDateTime?: string; // YYYY-MM-DDTHH:mm
  required?: boolean;
  error?: string;
  loading?: boolean;
  className?: string;
}

export default function DateTimePicker({
  label,
  value,
  onChange,
  minDateTime,
  maxDateTime,
  required,
  error,
  loading = false,
  className,
}: DateTimePickerProps) {
  const { isRTL } = useLocale();

  return (
    <div className={cn("flex flex-col gap-1.5 w-full relative", className)}>
      {label && (
        <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
          {label}
          {required && <span className="text-[var(--red)] ms-1">*</span>}
        </label>
      )}

      {loading ? (
        <div className="w-full h-[40px] rounded-xl bg-[var(--s2)] animate-pulse border border-[var(--b)]" />
      ) : (
        <div className="relative flex items-center">
          <input
            type="datetime-local"
            value={value || ""}
            min={minDateTime}
            max={maxDateTime}
            onChange={(e) => {
              if (onChange) onChange(e.target.value);
            }}
            className={cn(
              "w-full bg-[var(--s2)] text-[var(--t1)] text-sm cursor-pointer",
              "border rounded-xl px-4 py-2.5 outline-none transition-all duration-200",
              "placeholder-[var(--t3)]",
              error
                ? "border-[var(--red)]/50 focus:border-[var(--red)]"
                : "border-[var(--b)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10",
              isRTL ? "text-right" : "text-left"
            )}
            style={{
              colorScheme: "dark",
            }}
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-[var(--red)] flex items-center gap-1 mt-0.5">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

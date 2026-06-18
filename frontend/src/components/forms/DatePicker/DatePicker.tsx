import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { useLocale } from "../../../i18n/useLocale";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, AlertCircle } from "lucide-react";
import { cn } from "../../../lib/utils";
import "./DatePicker.css";

export interface DatePickerProps {
  label?: string;
  value?: string; // Format: YYYY-MM-DD
  onChange?: (val: string) => void;
  mode?: "single" | "range";
  rangeValue?: { from?: string; to?: string };
  onRangeChange?: (range: { from?: string; to?: string } | undefined) => void;
  disabledDays?: (date: Date) => boolean;
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
  required?: boolean;
  error?: string;
  loading?: boolean;
  className?: string;
}

// Persian conversion digits helper
const toPersianDigits = (str: string | number) => {
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(str).replace(/[0-9]/g, (w) => persianDigits[parseInt(w)]);
};

export default function DatePicker({
  label,
  value,
  onChange,
  mode = "single",
  rangeValue,
  onRangeChange,
  disabledDays,
  minDate,
  maxDate,
  required,
  error,
  loading = false,
  className,
}: DatePickerProps) {
  const { isRTL } = useLocale();
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close calendar popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Parse input dates
  const selectedDate = value ? new Date(value) : undefined;
  const selectedRange = rangeValue
    ? {
        from: rangeValue.from ? new Date(rangeValue.from) : undefined,
        to: rangeValue.to ? new Date(rangeValue.to) : undefined,
      }
    : undefined;

  // Format date to YYYY-MM-DD
  const formatDateString = (date?: Date): string => {
    if (!date) return "";
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);
    return localDate.toISOString().split("T")[0];
  };

  const handleSelectSingle = (day: Date | undefined) => {
    if (day && onChange) {
      onChange(formatDateString(day));
    }
    setOpen(false);
  };

  const handleSelectRange = (range: any) => {
    if (onRangeChange) {
      onRangeChange({
        from: range?.from ? formatDateString(range.from) : undefined,
        to: range?.to ? formatDateString(range.to) : undefined,
      });
    }
  };

  // Min and max limits checks
  const isDateDisabled = (day: Date) => {
    if (disabledDays && disabledDays(day)) return true;
    if (minDate && formatDateString(day) < minDate) return true;
    if (maxDate && formatDateString(day) > maxDate) return true;
    return false;
  };

  // Convert Gregorian display caption to localized Farsi if RTL
  const formatCaption = (date: Date) => {
    const monthsFa = [
      "ژانویه",
      "فوریه",
      "مارس",
      "آوریل",
      "مه",
      "ژوئن",
      "ژوئیه",
      "اوت",
      "سپتامبر",
      "اکتبر",
      "نوامبر",
      "دسامبر",
    ];
    const monthsEn = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const month = isRTL ? monthsFa[date.getMonth()] : monthsEn[date.getMonth()];
    const year = isRTL
      ? toPersianDigits(date.getFullYear())
      : date.getFullYear();
    return `${month} ${year}`;
  };

  const formatDay = (day: Date) => {
    return isRTL ? toPersianDigits(day.getDate()) : String(day.getDate());
  };

  const getDisplayValue = () => {
    if (mode === "single" && value) {
      return isRTL ? toPersianDigits(value) : value;
    }
    if (mode === "range" && rangeValue) {
      const fromVal = rangeValue.from
        ? isRTL
          ? toPersianDigits(rangeValue.from)
          : rangeValue.from
        : "";
      const toVal = rangeValue.to
        ? isRTL
          ? toPersianDigits(rangeValue.to)
          : rangeValue.to
        : "";
      if (fromVal && toVal) return `${fromVal} ➔ ${toVal}`;
      return fromVal || "";
    }
    return "";
  };

  return (
    <div
      className={cn("flex flex-col gap-1.5 w-full relative", className)}
      ref={containerRef}
    >
      {label && (
        <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide flex items-center">
          {label}
          {required && <span className="text-[var(--red)] ms-1">*</span>}
        </label>
      )}

      {loading ? (
        <div className="w-full h-[40px] rounded-xl bg-[var(--s2)] animate-pulse border border-[var(--b)]" />
      ) : (
        <>
          <div className="relative flex items-center">
            <input
              type="text"
              readOnly
              value={getDisplayValue()}
              onClick={() => setOpen(!open)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setOpen(true);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              placeholder={
                mode === "single"
                  ? t("date.select", "Select Date...")
                  : t("date.selectRange", "Select Range...")
              }
              className={cn(
                "w-full bg-[var(--s2)] text-[var(--t1)] text-sm cursor-pointer",
                "border rounded-xl px-4 py-2.5 outline-none transition-all duration-200",
                "placeholder-[var(--t3)]",
                error
                  ? "border-[var(--red)]/50 focus:border-[var(--red)]"
                  : "border-[var(--b)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10",
                isRTL ? "ps-10" : "pe-10",
              )}
            />
            <Calendar
              className={cn(
                "absolute text-[var(--t3)] pointer-events-none w-4 h-4",
                isRTL ? "left-3.5" : "right-3.5",
              )}
            />
          </div>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  "absolute z-50 mt-1 rdp-container",
                  isRTL ? "right-0" : "left-0",
                  "top-[100%]",
                )}
              >
                {mode === "single" ? (
                  <DayPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleSelectSingle}
                    disabled={isDateDisabled}
                    formatters={{ formatCaption, formatDay }}
                    dir={isRTL ? "rtl" : "ltr"}
                  />
                ) : (
                  <DayPicker
                    mode="range"
                    selected={selectedRange}
                    onSelect={handleSelectRange}
                    disabled={isDateDisabled}
                    formatters={{ formatCaption, formatDay }}
                    dir={isRTL ? "rtl" : "ltr"}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
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

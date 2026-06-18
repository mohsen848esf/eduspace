import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import Timekeeper from "react-timekeeper";

const TimekeeperComponent = (Timekeeper as any).default || Timekeeper;
import { useLocale } from "../../../i18n/useLocale";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, AlertCircle, X } from "lucide-react";
import { cn } from "../../../lib/utils";
import "../DatePicker/DatePicker.css";

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

// Convert numbers/digits to Persian characters if Farsi active
const toPersianDigits = (str: string | number) => {
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(str).replace(/[0-9]/g, (w) => persianDigits[parseInt(w)]);
};

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
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"date" | "time">("date");
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse state parts
  const initialDateStr = value ? value.split("T")[0] : "";
  const initialTimeStr = value ? value.split("T")[1]?.substring(0, 5) : "12:00";

  const [tempDate, setTempDate] = useState<string>(initialDateStr);
  const [tempTime, setTempTime] = useState<string>(initialTimeStr);

  // Track window resizing for mobile sheet trigger layout
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Update local temp states when value prop changes
  useEffect(() => {
    if (value) {
      setTempDate(value.split("T")[0]);
      setTempTime(value.split("T")[1]?.substring(0, 5) || "12:00");
    }
  }, [value]);

  // Click outside to close popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        !isMobile &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile]);

  // Clean formatting date/time output values
  const formatDateString = (date?: Date): string => {
    if (!date) return "";
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);
    return localDate.toISOString().split("T")[0];
  };

  const handleSelectDay = (day: Date | undefined) => {
    if (day) {
      const dateStr = formatDateString(day);
      setTempDate(dateStr);
      if (onChange) {
        onChange(`${dateStr}T${tempTime}`);
      }
      setActiveTab("time");
    }
  };

  const handleTimeChange = (timeData: any) => {
    const time24 = timeData.formatted24; // e.g. "14:30"
    setTempTime(time24);
    if (tempDate && onChange) {
      onChange(`${tempDate}T${time24}`);
    }
  };

  const handleSaveAndClose = () => {
    const finalDate = tempDate || formatDateString(new Date());
    const finalTime = tempTime || "12:00";
    if (onChange) {
      onChange(`${finalDate}T${finalTime}`);
    }
    setOpen(false);
  };

  const isDateDisabled = (day: Date) => {
    const dStr = formatDateString(day);
    if (minDateTime && dStr < minDateTime.split("T")[0]) return true;
    if (maxDateTime && dStr > maxDateTime.split("T")[0]) return true;
    return false;
  };

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

  // Human friendly output strings representation
  const getDisplayValue = () => {
    if (!value) return "";
    const [d, tVal] = value.split("T");
    const displayTime = tVal ? tVal.substring(0, 5) : "";
    const combined = `${d} ${displayTime}`;
    return isRTL ? toPersianDigits(combined) : combined;
  };

  // Simple custom scrolling select picker for mobile
  const MobileSelectorWheel = () => {
    const hours = Array.from({ length: 24 }, (_, i) =>
      String(i).padStart(2, "0"),
    );
    const minutes = Array.from({ length: 60 }, (_, i) =>
      String(i).padStart(2, "0"),
    );

    const activeHour = tempTime.split(":")[0] || "12";
    const activeMin = tempTime.split(":")[1] || "00";

    return (
      <div className="flex flex-col gap-4 w-full bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)]">
        <div className="flex justify-center items-center gap-4">
          {/* Hours wheel list select */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-[var(--t3)] font-semibold uppercase mb-1">
              {t("time.hours", "Hours")}
            </span>
            <select
              value={activeHour}
              onChange={(e) => {
                const newTime = `${e.target.value}:${activeMin}`;
                setTempTime(newTime);
                if (tempDate && onChange) onChange(`${tempDate}T${newTime}`);
              }}
              className="bg-[var(--s3)] text-[var(--t1)] text-lg font-bold border border-[var(--b)] rounded-lg p-2 outline-none"
            >
              {hours.map((h) => (
                <option key={h} value={h}>
                  {isRTL ? toPersianDigits(h) : h}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xl font-bold text-[var(--t1)] self-end mb-2">
            :
          </span>

          {/* Minutes wheel list select */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-[var(--t3)] font-semibold uppercase mb-1">
              {t("time.minutes", "Minutes")}
            </span>
            <select
              value={activeMin}
              onChange={(e) => {
                const newTime = `${activeHour}:${e.target.value}`;
                setTempTime(newTime);
                if (tempDate && onChange) onChange(`${tempDate}T${newTime}`);
              }}
              className="bg-[var(--s3)] text-[var(--t1)] text-lg font-bold border border-[var(--b)] rounded-lg p-2 outline-none"
            >
              {minutes.map((m) => (
                <option key={m} value={m}>
                  {isRTL ? toPersianDigits(m) : m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn("flex flex-col gap-1.5 w-full relative", className)}
      ref={containerRef}
    >
      {label && (
        <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
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
              placeholder={t("datetime.select", "Select Date & Time...")}
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
            <Clock
              className={cn(
                "absolute text-[var(--t3)] pointer-events-none w-4 h-4",
                isRTL ? "left-3.5" : "right-3.5",
              )}
            />
          </div>

          <AnimatePresence>
            {open && (
              <>
                {isMobile ? (
                  // Mobile bottom sheet
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.5 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setOpen(false)}
                      className="fixed inset-0 bg-black z-50 pointer-events-auto"
                    />
                    <motion.div
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", damping: 25, stiffness: 200 }}
                      className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--s1)] border-t border-[var(--b)] rounded-t-2xl p-4 flex flex-col gap-4 pointer-events-auto"
                    >
                      <div className="flex justify-between items-center pb-2 border-b border-[var(--b)]">
                        <span className="text-sm font-bold text-[var(--t1)]">
                          {label || t("datetime.select", "Select Date & Time")}
                        </span>
                        <button
                          onClick={() => setOpen(false)}
                          className="w-8 h-8 rounded-full bg-[var(--s3)] border-none text-[var(--t2)] flex items-center justify-center cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setActiveTab("date")}
                          className={cn(
                            "flex-1 py-2 text-xs font-semibold rounded-lg",
                            activeTab === "date"
                              ? "bg-[var(--brand)] text-white"
                              : "bg-[var(--s2)] text-[var(--t2)]",
                          )}
                        >
                          {t("datetime.date", "Date")}
                        </button>
                        <button
                          onClick={() => setActiveTab("time")}
                          className={cn(
                            "flex-1 py-2 text-xs font-semibold rounded-lg",
                            activeTab === "time"
                              ? "bg-[var(--brand)] text-white"
                              : "bg-[var(--s2)] text-[var(--t2)]",
                          )}
                        >
                          {t("datetime.time", "Time")}
                        </button>
                      </div>

                      <div className="flex justify-center max-h-[300px] overflow-y-auto">
                        {activeTab === "date" ? (
                          <DayPicker
                            mode="single"
                            selected={tempDate ? new Date(tempDate) : undefined}
                            onSelect={handleSelectDay}
                            disabled={isDateDisabled}
                            formatters={{ formatCaption, formatDay }}
                            dir={isRTL ? "rtl" : "ltr"}
                          />
                        ) : (
                          <MobileSelectorWheel />
                        )}
                      </div>

                      <button
                        onClick={handleSaveAndClose}
                        className="w-full bg-[var(--brand)] hover:bg-[var(--brand-h)] text-white font-bold py-2.5 rounded-xl cursor-pointer transition-colors"
                      >
                        {t("common:save", "Save & Apply")}
                      </button>
                    </motion.div>
                  </>
                ) : (
                  // Desktop popover layout
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      "absolute z-50 mt-1 bg-[var(--s1)] border border-[var(--b)] rounded-2xl p-4 shadow-xl flex flex-col md:flex-row gap-4 backdrop-blur-xl",
                      isRTL ? "right-0" : "left-0",
                      "top-[100%]",
                    )}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="text-xs font-semibold text-[var(--t2)] uppercase border-b border-[var(--b)] pb-1">
                        {t("datetime.date", "Select Date")}
                      </div>
                      <DayPicker
                        mode="single"
                        selected={tempDate ? new Date(tempDate) : undefined}
                        onSelect={handleSelectDay}
                        disabled={isDateDisabled}
                        formatters={{ formatCaption, formatDay }}
                        dir={isRTL ? "rtl" : "ltr"}
                      />
                    </div>

                    <div className="w-px bg-[var(--b)] self-stretch hidden md:block" />

                    <div className="flex flex-col gap-2 min-w-[250px]">
                      <div className="text-xs font-semibold text-[var(--t2)] uppercase border-b border-[var(--b)] pb-1">
                        {t("datetime.time", "Select Time")}
                      </div>
                      <div className="flex-1 flex items-center justify-center p-2 rounded-xl bg-[var(--s2)] overflow-hidden">
                        <TimekeeperComponent
                          time={tempTime}
                          onChange={handleTimeChange}
                          switchToMinuteOnHourSelect
                        />
                      </div>
                      <button
                        onClick={handleSaveAndClose}
                        className="w-full bg-[var(--brand)] hover:bg-[var(--brand-h)] text-white text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors"
                      >
                        {t("common:apply", "Apply")}
                      </button>
                    </div>
                  </motion.div>
                )}
              </>
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

import AppShell from "../../../components/layout/AppShell";
import { useTranslation } from "react-i18next";
import { useLocale } from "../../../i18n/useLocale";

export default function OrgSettingsPage() {
  useTranslation(["dashboard"]);
  const { language } = useLocale();
  const isFarsi = language === "fa";

  return (
    <AppShell title={isFarsi ? "تنظیمات سازمان" : "Organization Settings"}>
      <div className="bg-[var(--s2)] rounded-xl border border-[var(--b)] p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[var(--t1)] mb-3">
          {isFarsi ? "مدیریت و تنظیمات آکادمی" : "Academy Organization settings"}
        </h2>
        <p className="text-sm text-[var(--t2)] leading-relaxed">
          {isFarsi
            ? "این بخش به عنوان نقطه ورود در اسپرینت E2 توسعه داده خواهد شد. در حال حاضر آماده پیاده‌سازی مدیریت اعضا و سوییچ اورگ می‌باشد."
            : "This module will be fully populated in Sprint E2. It will contain configuration options, teacher/staff invitations, and context adjustments."}
        </p>
      </div>
    </AppShell>
  );
}

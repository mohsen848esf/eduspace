import { useLocale } from "../../../i18n/useLocale";
import AppShell from "../../../components/layout/AppShell";
import NotificationSettingsContent from "../../notifications/components/NotificationSettingsContent";

export default function NotificationSettings() {
  const { language } = useLocale();
  const isFarsi = language === "fa";

  return (
    <AppShell
      title={isFarsi ? "تنظیمات اعلان‌ها" : "Notification Settings"}
      subtitle={
        isFarsi
          ? "مدیریت کانال‌های دریافت اعلان‌های ایمیلی، پیامکی و درون‌برنامه‌ای"
          : "Manage email, SMS, and in-app notification channels"
      }
      activeNav="inbox"
    >
      <NotificationSettingsContent />
    </AppShell>
  );
}

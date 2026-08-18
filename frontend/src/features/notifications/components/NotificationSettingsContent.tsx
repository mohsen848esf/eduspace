import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import client from "../../../lib/api/client";
import { toast } from "react-hot-toast";
import { useLocale } from "../../../i18n/useLocale";
import Spinner from "../../../components/ui/Spinner";
import { Switch } from "../../../components/ui";
import { useAuthStore } from "../../auth/store/authStore";
import { Bell, Mail, MessageSquare, ShieldCheck, AlertTriangle } from "lucide-react";

export interface Preference {
  category: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
}

export default function NotificationSettingsContent() {
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const hasPhoneNumber = !!(user?.phone_number && user.phone_number.trim());

  // Categories metadata
  const categoriesMeta: Record<
    string,
    { titleEn: string; titleFa: string; descEn: string; descFa: string }
  > = {
    session_reminders: {
      titleEn: "Session Reminders",
      titleFa: "یادآورهای جلسات",
      descEn: "Get notified when class sessions are about to start or rescheduled.",
      descFa: "زمانی که جلسات کلاس در حال شروع یا تغییر زمان هستند مطلع شوید.",
    },
    assessment_reminders: {
      titleEn: "Assessment Alerts",
      titleFa: "هشدارهای ارزیابی",
      descEn: "Notifications for new quizzes, assignments, and grading results.",
      descFa: "اعلان‌ها برای آزمون‌های جدید، تکالیف و نتایج نمره‌دهی.",
    },
    financial_notifications: {
      titleEn: "Billing & Invoices",
      titleFa: "صورتحساب و فاکتورها",
      descEn: "Receive alerts for issued invoices, successful payments, or late warnings.",
      descFa: "هشدارهای مربوط به فاکتورهای صادر شده، پرداخت‌های موفق یا اخطارهای تاخیر.",
    },
    marketing_notifications: {
      titleEn: "Updates & Offers",
      titleFa: "به‌روزرسانی‌ها و پیشنهادها",
      descEn: "Stay in the loop with platform updates, new feature releases, and newsletters.",
      descFa: "با به‌روزرسانی‌های پلتفرم، انتشار ویژگی‌های جدید و خبرنامه‌ها در جریان باشید.",
    },
  };

  // Fetch preferences
  const { data: preferences, isLoading } = useQuery<Preference[]>({
    queryKey: ["notificationPreferences"],
    queryFn: async () => {
      const res = await client.get("/accounts/preferences/notifications/");
      return res.data;
    },
  });

  // Local state to manage optimistic switches
  const [localPrefs, setLocalPrefs] = useState<Preference[]>([]);

  useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences);
    }
  }, [preferences]);

  // Mutation to update preferences
  const updatePreferenceMutation = useMutation({
    mutationFn: async (updated: Preference) => {
      const res = await client.patch("/accounts/preferences/notifications/", updated);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["notificationPreferences"], data);
      toast.success(
        isFarsi
          ? "تنظیمات اعلان‌ها با موفقیت ذخیره شد"
          : "Notification settings saved successfully"
      );
    },
    onError: () => {
      toast.error(isFarsi ? "خطا در ذخیره تنظیمات" : "Failed to save settings");
      if (preferences) {
        setLocalPrefs(preferences);
      }
    },
  });

  const handleToggle = (
    category: string,
    channel: "email_enabled" | "sms_enabled" | "in_app_enabled"
  ) => {
    const target = localPrefs.find((p) => p.category === category);
    if (!target) return;

    const updated = {
      ...target,
      [channel]: !target[channel],
    };

    // Optimistically update local state
    setLocalPrefs((prev) => prev.map((p) => (p.category === category ? updated : p)));

    // Fire mutation
    updatePreferenceMutation.mutate(updated);
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 h-64 items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 flex flex-col gap-6 overflow-y-auto max-w-4xl mx-auto w-full animate-in fade-in duration-200">
      <div>
        <h2 className="text-lg font-bold text-[var(--t1)]">
          {isFarsi ? "مدیریت کانال‌های اعلان" : "Notification Channels Settings"}
        </h2>
        <p className="text-xs text-[var(--t3)] mt-1">
          {isFarsi
            ? "کانال‌های دریافت اعلان خود را برای هر دسته‌بندی شخصی‌سازی کنید."
            : "Choose exactly how and when you want to receive updates from our academy."}
        </p>
      </div>

      {!hasPhoneNumber && (
        <div className="text-xs text-[var(--yellow)] bg-[var(--yellow)]/10 border border-[var(--yellow)]/20 p-3.5 rounded-xl flex items-center gap-2 animate-in fade-in duration-150">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {isFarsi
              ? "برای فعال‌سازی اعلان‌های پیامک، شماره تلفن خود را اضافه کنید."
              : "Add a phone number to enable SMS notifications."}
          </span>
        </div>
      )}

      <div className="border border-[var(--b)] rounded-2xl overflow-hidden bg-[var(--s1)] shadow-sm">
        {/* Header Row */}
        <div className="grid grid-cols-12 bg-[var(--s2)] border-b border-[var(--b)] p-4 text-xs font-bold text-[var(--t2)] items-center">
          <div className="col-span-12 md:col-span-6">
            {isFarsi ? "دسته‌بندی اعلان‌ها" : "Notification Category"}
          </div>
          <div className="col-span-4 md:col-span-2 text-center mt-2 md:mt-0 flex items-center justify-center gap-1">
            <Mail className="w-3.5 h-3.5" />
            <span>{isFarsi ? "ایمیل" : "Email"}</span>
          </div>
          <div className="col-span-4 md:col-span-2 text-center mt-2 md:mt-0 flex items-center justify-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{isFarsi ? "پیامک" : "SMS"}</span>
          </div>
          <div className="col-span-4 md:col-span-2 text-center mt-2 md:mt-0 flex items-center justify-center gap-1">
            <Bell className="w-3.5 h-3.5" />
            <span>{isFarsi ? "درون‌برنامه‌ای" : "In-App"}</span>
          </div>
        </div>

        {/* Preferences list */}
        <div className="divide-y divide-[var(--b)]">
          {localPrefs.map((pref) => {
            const meta = categoriesMeta[pref.category] || {
              titleEn: pref.category,
              titleFa: pref.category,
              descEn: "",
              descFa: "",
            };

            return (
              <div
                key={pref.category}
                className="grid grid-cols-12 p-4 items-center gap-2 hover:bg-[var(--s2)]/60 transition-colors"
              >
                <div className="col-span-12 md:col-span-6 flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-[var(--t1)]">
                    {isFarsi ? meta.titleFa : meta.titleEn}
                  </span>
                  <span className="text-xs text-[var(--t3)]">
                    {isFarsi ? meta.descFa : meta.descEn}
                  </span>
                </div>

                {/* Email Channel */}
                <div className="col-span-4 md:col-span-2 flex justify-center">
                  <Switch
                    checked={pref.email_enabled}
                    onChange={() => handleToggle(pref.category, "email_enabled")}
                    variant="brand"
                  />
                </div>

                {/* SMS Channel */}
                <div
                  className={`col-span-4 md:col-span-2 flex justify-center ${
                    !hasPhoneNumber ? "opacity-40 cursor-not-allowed" : ""
                  }`}
                >
                  <Switch
                    checked={pref.sms_enabled && hasPhoneNumber}
                    onChange={() =>
                      hasPhoneNumber && handleToggle(pref.category, "sms_enabled")
                    }
                    disabled={!hasPhoneNumber}
                    variant="brand"
                  />
                </div>

                {/* In-App Channel */}
                <div className="col-span-4 md:col-span-2 flex justify-center">
                  <Switch
                    checked={pref.in_app_enabled}
                    onChange={() => handleToggle(pref.category, "in_app_enabled")}
                    variant="brand"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between items-center bg-[var(--brand-soft)]/20 p-4 border border-[var(--b)] rounded-2xl">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[var(--brand)] shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-[var(--t1)]">
              {isFarsi ? "حریم خصوصی و حریم داده" : "Privacy & Alerts"}
            </span>
            <span className="text-[11px] text-[var(--t3)]">
              {isFarsi
                ? "ما هرگز بدون اجازه شما اعلان‌های بازاریابی ارسال نمی‌کنیم."
                : "We only dispatch transaction or course-related alerts unless you opt into newsletters."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

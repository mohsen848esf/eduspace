import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import client from "../../../lib/api/client";
import { toast } from "react-hot-toast";
import { useLocale } from "../../../i18n/useLocale";
import AppShell from "../../../components/layout/AppShell";
import Spinner from "../../../components/ui/Spinner";

interface Preference {
  category: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
}

export default function NotificationSettings() {
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const queryClient = useQueryClient();

  // Categories metadata
  const categoriesMeta: Record<string, { titleEn: string; titleFa: string; descEn: string; descFa: string }> = {
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
      toast.success(isFarsi ? "تنظیمات اعلان‌ها با موفقیت ذخیره شد" : "Notification settings saved successfully");
    },
    onError: () => {
      toast.error(isFarsi ? "خطا در ذخیره تنظیمات" : "Failed to save settings");
      // Rollback to query cache
      if (preferences) {
        setLocalPrefs(preferences);
      }
    },
  });

  const handleToggle = (category: string, channel: "email_enabled" | "sms_enabled" | "in_app_enabled") => {
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
      <AppShell title={isFarsi ? "تنظیمات اعلان‌ها" : "Notification Settings"}>
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={isFarsi ? "تنظیمات اعلان‌ها" : "Notification Settings"}>
      <div className="max-w-4xl mx-auto bg-[var(--s2)] rounded-2xl border border-[var(--b)] p-6 md:p-8 shadow-sm flex flex-col gap-8 animate-in fade-in duration-150">
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

        <div className="border border-[var(--b)] rounded-xl overflow-hidden bg-[var(--s1)]">
          {/* Header Row */}
          <div className="grid grid-cols-12 bg-[var(--s3)] border-b border-[var(--b)] p-4 text-xs font-bold text-[var(--t2)] items-center">
            <div className="col-span-12 md:col-span-6">
              {isFarsi ? "دسته‌بندی اعلان‌ها" : "Notification Category"}
            </div>
            <div className="col-span-4 md:col-span-2 text-center mt-2 md:mt-0">
              📧 {isFarsi ? "ایمیل" : "Email"}
            </div>
            <div className="col-span-4 md:col-span-2 text-center mt-2 md:mt-0">
              💬 {isFarsi ? "پیامک" : "SMS"}
            </div>
            <div className="col-span-4 md:col-span-2 text-center mt-2 md:mt-0">
              🔔 {isFarsi ? "درون‌برنامه‌ای" : "In-App"}
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
                  className="grid grid-cols-12 p-4 items-center gap-2 hover:bg-[var(--s2)] transition-colors"
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
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pref.email_enabled}
                        onChange={() => handleToggle(pref.category, "email_enabled")}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[var(--s3)] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--brand)]"></div>
                    </label>
                  </div>

                  {/* SMS Channel */}
                  <div className="col-span-4 md:col-span-2 flex justify-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pref.sms_enabled}
                        onChange={() => handleToggle(pref.category, "sms_enabled")}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[var(--s3)] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--brand)]"></div>
                    </label>
                  </div>

                  {/* In-App Channel */}
                  <div className="col-span-4 md:col-span-2 flex justify-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pref.in_app_enabled}
                        onChange={() => handleToggle(pref.category, "in_app_enabled")}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[var(--s3)] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--brand)]"></div>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between items-center bg-[var(--brand-soft)]/20 p-4 border border-[var(--b)] rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-lg">💡</span>
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
    </AppShell>
  );
}

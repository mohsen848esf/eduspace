import { useState } from "react";
import { useTranslation } from "react-i18next";
import AppShell from "../../../components/layout/AppShell";
import { useAuthStore } from "../../auth/store/authStore";
import { useRoom } from "../../room/hooks/useRoom";
import { useLocale } from "../../../i18n/useLocale";
import CRMTabs from "./CRMTabs";

import { useOrgPermission } from "../../../hooks/useOrgPermission";

export default function DashboardPage() {
  const { t } = useTranslation(["dashboard"]);
  const { language } = useLocale();
  const { user } = useAuthStore();
  const { activeRole } = useOrgPermission();
  const [activeNav, setActiveNav] = useState("dashboard");
  const { createRoom, isLoading: roomLoading } = useRoom();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t("greeting.morning");
    if (h < 17) return t("greeting.afternoon");
    return t("greeting.evening");
  };

  const localeTag = language === "fa" ? "fa-IR" : "en-US";
  const subtitle = new Date().toLocaleDateString(localeTag, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <AppShell
      title={t("title")}
      subtitle={subtitle}
      activeNav={activeNav}
      onNavigate={setActiveNav}
    >
      <div className="flex flex-col gap-4 md:gap-5 fade-in">
        {/* Greeting */}
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-[var(--t1)]">
            {greeting()}, {user?.full_name || user?.username} 👋
          </h2>
          <p className="text-sm text-[var(--t2)] mt-1">
            {t("role")}:{" "}
            <span className="text-[var(--brand-text)] font-semibold capitalize">
              {activeRole}
            </span>
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              icon: "📹",
              labelKey: "actions.startCall",
              nav: "calls",
              action: () =>
                createRoom({
                  name: t("roomDefault", {
                    name: user?.full_name || user?.username || "",
                  }),
                  max_participants: 20,
                  is_recorded: false,
                }),
            },
            { icon: "📝", labelKey: "actions.newExam", nav: "exams" },
            { icon: "🎬", labelKey: "actions.recordings", nav: "recordings" },
          ].map((item) => (
            <button
              key={item.nav}
              onClick={item.action || (() => setActiveNav(item.nav))}
              disabled={roomLoading}
              className="flex flex-col items-center gap-2 p-4 md:p-5 min-h-[88px] bg-[var(--s2)] hover:bg-[var(--s3)] rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.97] border-none disabled:opacity-50"
            >
              <span className="text-2xl md:text-3xl">{item.icon}</span>
              <span className="text-xs md:text-sm font-medium text-[var(--t2)] text-center">
                {t(item.labelKey)}
              </span>
            </button>
          ))}
        </div>

        {/* CRM and Financial Ledger Management */}
        <CRMTabs language={language} />
      </div>
    </AppShell>
  );
}

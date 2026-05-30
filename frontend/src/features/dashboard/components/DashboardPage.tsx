import { useState } from "react";
import { useTranslation } from "react-i18next";
import AppShell from "../../../components/layout/AppShell";
import Button from "../../../components/ui/Button";import { useAuthStore } from "../../auth/store/authStore";
import { useDashboard } from "../hooks/useDashboard";
import { useRoom } from "../../room/hooks/useRoom";
import { useLocale } from "../../../i18n/useLocale";

export default function DashboardPage() {
  const { t } = useTranslation(["dashboard"]);
  const { language } = useLocale();
  const { user } = useAuthStore();
  const { stats, sessions, isLoading } = useDashboard();
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
              {user?.role}
            </span>
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            { icon: "🎮", labelKey: "actions.launchGame", nav: "games" },
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

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              labelKey: "stats.sessionsThisWeek",
              value: isLoading ? "—" : stats.sessions,
            },
            {
              labelKey: "stats.activeStudents",
              value: isLoading ? "—" : stats.students,
            },
            {
              labelKey: "stats.avgAttendance",
              value: isLoading ? "—" : stats.attendance,
              color: "var(--green)",
            },
          ].map((stat) => (
            <div
              key={stat.labelKey}
              className="bg-[var(--s2)] rounded-xl p-4 md:p-5 flex md:flex-col items-baseline md:items-start justify-between md:justify-start gap-2"
            >
              <div
                className="text-2xl md:text-3xl font-bold text-[var(--t1)]"
                style={stat.color ? { color: stat.color } : {}}
              >
                {stat.value}
              </div>
              <div className="text-xs text-[var(--t3)] md:mt-1">
                {t(stat.labelKey)}
              </div>
            </div>
          ))}
        </div>

        {/* Sessions list */}
        <div className="bg-[var(--s2)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--b)]">
            <span className="text-xs font-semibold text-[var(--t3)] uppercase tracking-wide">
              {t("sessions.title")}
            </span>
            <button className="text-xs text-[var(--brand-text)] bg-transparent border-none cursor-pointer hover:underline">
              {t("sessions.seeAll")}
            </button>
          </div>

          {isLoading ? (
            <div className="p-4 flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton w-8 h-8 rounded-lg flex-shrink-0" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="skeleton h-3 w-48 rounded" />
                    <div className="skeleton h-2.5 w-32 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <span className="text-3xl">📭</span>
              <p className="text-sm text-[var(--t3)]">{t("sessions.empty")}</p>
              <Button size="sm" onClick={() => setActiveNav("calls")}>
                {t("sessions.startFirst")}
              </Button>
            </div>
          ) : (
            <div>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--s3)] transition-colors cursor-pointer border-t border-[var(--b)] first:border-t-0"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${session.iconBg}`}
                  >
                    {session.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--t1)] truncate">
                      {session.name}
                    </div>
                    <div className="text-xs text-[var(--t3)] mt-0.5">
                      {session.meta}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${session.pillClass}`}
                    >
                      {session.status}
                    </span>
                    <span className="text-[11px] text-[var(--t3)]">
                      {session.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

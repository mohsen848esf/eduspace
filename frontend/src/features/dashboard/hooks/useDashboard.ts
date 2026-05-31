import { useTranslation } from "react-i18next";

export function useDashboard() {
  const { t } = useTranslation("dashboard");
  // TODO: replace with real API calls via React Query

  const stats = {
    sessions: "14",
    students: "87",
    attendance: "94%",
  };

  const sessions = [
    {
      id: 1,
      name: "Advanced English — Group A",
      meta: "8 students · Word Quest active",
      status: t("sessions.statusLive"),
      time: "12m ago",
      icon: "📗",
      iconBg: "bg-[rgba(34,197,94,0.12)]",
      pillClass: "bg-[rgba(34,197,94,0.12)] text-[var(--green)]",
    },
    {
      id: 2,
      name: "Grammar B1 — Group C",
      meta: "12 students · Exam scheduled",
      status: t("sessions.statusSoon"),
      time: "In 25 min",
      icon: "📘",
      iconBg: "bg-[rgba(99,102,241,0.15)]",
      pillClass: "bg-[rgba(245,158,11,0.1)] text-[var(--amber)]",
    },
    {
      id: 3,
      name: "Python Basics — Beginners",
      meta: "6 students · Recording ready",
      status: t("sessions.statusDone"),
      time: "Yesterday",
      icon: "💻",
      iconBg: "bg-[rgba(56,189,248,0.12)]",
      pillClass: "bg-[var(--s3)] text-[var(--t3)]",
    },
  ];

  return { stats, sessions, isLoading: false };
}

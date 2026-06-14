import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "../../../components/layout/AppShell";
import { useAuthStore } from "../../auth/store/authStore";
import { useRoom } from "../../room/hooks/useRoom";
import { useLocale } from "../../../i18n/useLocale";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import { useSessions } from "../../sessions/hooks/useSessions";
import { crmApi } from "../api/crm.api";
import Spinner from "../../../components/ui/Spinner";

export default function DashboardPage() {
  const { t } = useTranslation(["dashboard"]);
  const { language } = useLocale();
  const { user } = useAuthStore();
  const { hasPermission, activeRole, activeOrg } = useOrgPermission();
  const [activeNav, setActiveNav] = useState("dashboard");
  const { createRoom, isLoading: roomLoading } = useRoom();
  const navigate = useNavigate();

  const isFarsi = language === "fa";

  const canManageCRM = hasPermission("can_manage_members") || hasPermission("can_teach_class");
  const canManageFinance = hasPermission("can_manage_financials") || hasPermission("can_view_financials");

  // Queries
  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["courses"],
    queryFn: crmApi.getCourses,
    enabled: canManageCRM,
  });

  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ["classes"],
    queryFn: crmApi.getClasses,
    enabled: canManageCRM,
  });

  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery({
    queryKey: ["enrollments"],
    queryFn: crmApi.getEnrollments,
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["invoices"],
    queryFn: crmApi.getInvoices,
  });

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: crmApi.getExpenses,
    enabled: hasPermission("can_view_financials"),
  });

  const { data: liveSessions = [], isLoading: loadingSessions } = useSessions(undefined, "live");

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

  // Financial Summary Helpers
  const totalRevenue = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

  const totalPendingRevenue = invoices
    .filter((inv) => inv.status === "unpaid")
    .reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

  const totalExpense = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

  const isDataLoading = loadingCourses || loadingClasses || loadingEnrollments || loadingInvoices || loadingExpenses || loadingSessions;

  // Aggregated data for past 6 months
  const chartData = (() => {
    const months: Array<{
      year: number;
      month: number;
      label: string;
      revenue: number;
      expense: number;
    }> = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleDateString(language === "fa" ? "fa-IR" : "en-US", { month: "short" }),
        revenue: 0,
        expense: 0
      });
    }

    // Aggregate Invoices (Revenue)
    invoices.forEach(inv => {
      if (inv.status === "paid" && inv.paid_at) {
        const d = new Date(inv.paid_at);
        const match = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth());
        if (match) {
          match.revenue += parseFloat(inv.amount) || 0;
        }
      }
    });

    // Aggregate Expenses
    expenses.forEach(exp => {
      if (exp.incurred_at) {
        const d = new Date(exp.incurred_at);
        const match = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth());
        if (match) {
          match.expense += parseFloat(exp.amount) || 0;
        }
      }
    });

    return months;
  })();

  const maxVal = Math.max(
    ...chartData.map(d => Math.max(d.revenue, d.expense)),
    100
  );
  const roundMaxVal = Math.ceil(maxVal / 100) * 100;

  const getX = (index: number) => 50 + (index * 530) / 5;
  const getY = (value: number) => 210 - (value * 190) / roundMaxVal;

  const revenuePath = `M ${chartData.map((d, idx) => `${getX(idx)} ${getY(d.revenue)}`).join(" L ")}`;
  const expensePath = `M ${chartData.map((d, idx) => `${getX(idx)} ${getY(d.expense)}`).join(" L ")}`;

  const revenueArea = `${revenuePath} L ${getX(5)} 210 L ${getX(0)} 210 Z`;
  const expenseArea = `${expensePath} L ${getX(5)} 210 L ${getX(0)} 210 Z`;

  return (
    <AppShell
      title={t("title")}
      subtitle={subtitle}
      activeNav={activeNav}
      onNavigate={setActiveNav}
    >
      <div className="flex flex-col gap-5 md:gap-6 fade-in">
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
            { icon: "📝", labelKey: "actions.newExam", nav: "exams", action: () => navigate("/academic/assessments") },
            { icon: "🎬", labelKey: "actions.recordings", nav: "recordings", action: () => navigate("/recordings") },
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

        {/* Overview Stats Dashboard */}
        {isDataLoading ? (
          <div className="p-12 flex justify-center"><Spinner size="lg" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Financial Chart Card (Only visible to Admins/Financial role) */}
            {canManageFinance && (
              <div className="bg-[var(--s2)] rounded-xl p-5 border border-[var(--b)] col-span-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                      {isFarsi ? "روند مالی (۶ ماه گذشته)" : "Financial Trends (Past 6 Months)"}
                    </h3>
                    <p className="text-[10px] text-[var(--t3)] mt-0.5">
                      {isFarsi ? "درآمد در مقابل هزینه‌ها" : "Revenue vs. Expenses"}
                    </p>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--green)] inline-block" />
                      <span className="text-[var(--t2)] font-medium">
                        {isFarsi ? "درآمد" : "Revenue"}: ${totalRevenue.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--red)] inline-block" />
                      <span className="text-[var(--t2)] font-medium">
                        {isFarsi ? "هزینه‌ها" : "Expenses"}: ${totalExpense.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="relative w-full overflow-x-auto scrollbar-none">
                  <div className="min-w-[580px] h-[240px]">
                    <svg className="w-full h-full" viewBox="0 0 600 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--green)" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--red)" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="var(--red)" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Gridlines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                        const y = 210 - ratio * 190;
                        return (
                          <g key={idx}>
                            <line
                              x1="50"
                              y1={y}
                              x2="580"
                              y2={y}
                              stroke="var(--b)"
                              strokeWidth="1"
                              strokeDasharray="4 4"
                            />
                            <text
                              x="42"
                              y={y + 3.5}
                              fill="var(--t3)"
                              fontSize="9"
                              textAnchor="end"
                              fontFamily="monospace"
                            >
                              ${Math.round(ratio * roundMaxVal)}
                            </text>
                          </g>
                        );
                      })}

                      {/* X Axis labels */}
                      {chartData.map((d, idx) => {
                        const x = getX(idx);
                        return (
                          <text
                            key={idx}
                            x={x}
                            y="230"
                            fill="var(--t2)"
                            fontSize="10"
                            textAnchor="middle"
                          >
                            {d.label}
                          </text>
                        );
                      })}

                      {/* Area paths */}
                      <path d={revenueArea} fill="url(#revenueGrad)" />
                      <path d={expenseArea} fill="url(#expenseGrad)" />

                      {/* Line paths */}
                      <path
                        d={revenuePath}
                        fill="none"
                        stroke="var(--green)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d={expensePath}
                        fill="none"
                        stroke="var(--red)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Data Points */}
                      {chartData.map((d, idx) => {
                        const rx = getX(idx);
                        const ry = getY(d.revenue);
                        const ex = getX(idx);
                        const ey = getY(d.expense);
                        return (
                          <g key={idx}>
                            {/* Revenue point */}
                            <circle
                              cx={rx}
                              cy={ry}
                              r="4"
                              fill="var(--s2)"
                              stroke="var(--green)"
                              strokeWidth="2"
                            />
                            <text
                              x={rx}
                              y={ry - 8}
                              fill="var(--green)"
                              fontSize="8"
                              fontWeight="semibold"
                              textAnchor="middle"
                            >
                              {d.revenue > 0 ? `$${Math.round(d.revenue)}` : ""}
                            </text>

                            {/* Expense point */}
                            <circle
                              cx={ex}
                              cy={ey}
                              r="4"
                              fill="var(--s2)"
                              stroke="var(--red)"
                              strokeWidth="2"
                            />
                            <text
                              x={ex}
                              y={ey - 8}
                              fill="var(--red)"
                              fontSize="8"
                              fontWeight="semibold"
                              textAnchor="middle"
                            >
                              {d.expense > 0 ? `$${Math.round(d.expense)}` : ""}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {/* Courses & Classes (Admins/Teachers) */}
            {canManageCRM && (
              <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)]">
                <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-2">
                  {isFarsi ? "دوره‌ها و کلاس‌ها" : "Courses & Classes"}
                </h3>
                <div className="flex justify-between items-center mt-3">
                  <div>
                    <div className="text-2xl font-bold text-[var(--t1)]">{courses.length}</div>
                    <div className="text-[11px] text-[var(--t3)]">{isFarsi ? "تعداد کل دوره‌ها" : "Total Courses"}</div>
                  </div>
                  <div className="h-8 w-px bg-[var(--b)]" />
                  <div>
                    <div className="text-2xl font-bold text-[var(--t1)]">{classes.length}</div>
                    <div className="text-[11px] text-[var(--t3)]">{isFarsi ? "کلاس‌های فعال" : "Active Classes"}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Enrollments */}
            <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)]">
              <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-2">
                {isFarsi ? "ثبت‌نام‌ها" : "Enrollments"}
              </h3>
              <div className="flex items-baseline gap-2 mt-3">
                <div className="text-3xl font-bold text-[var(--t1)]">{enrollments.length}</div>
                <div className="text-xs text-[var(--green)]">
                  {isFarsi ? "ثبت‌نام فعال" : "Active student enrollments"}
                </div>
              </div>
            </div>

            {/* Financial Balance (Admins/Financial role) */}
            {canManageFinance && (
              <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)] col-span-1 md:col-span-2 lg:col-span-1">
                <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-2">
                  {isFarsi ? "تراز مالی" : "Financial Balance"}
                </h3>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <div className="text-sm font-semibold text-[var(--green)]">${totalRevenue.toFixed(1)}</div>
                    <div className="text-[10px] text-[var(--t3)]">{isFarsi ? "دریافت شده" : "Revenue"}</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--amber)]">${totalPendingRevenue.toFixed(1)}</div>
                    <div className="text-[10px] text-[var(--t3)]">{isFarsi ? "در انتظار" : "Pending"}</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--red)]">${totalExpense.toFixed(1)}</div>
                    <div className="text-[10px] text-[var(--t3)]">{isFarsi ? "هزینه‌ها" : "Expenses"}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Active Live Classes List */}
            {liveSessions.length > 0 && (
              <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)] col-span-full">
                <h3 className="text-xs font-semibold text-[var(--green)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--green)] animate-pulse" />
                  {isFarsi ? "کلاس‌های زنده در حال برگزاری" : "Active Live Classes"}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {liveSessions.map((s) => (
                    <div key={s.id} className="bg-[var(--s3)] border border-[var(--b)] rounded-xl p-3.5 flex flex-col justify-between min-h-[120px]">
                      <div>
                        <h4 className="text-sm font-bold text-[var(--t1)]">{s.title}</h4>
                        <p className="text-xs text-[var(--t3)] mt-1">{s.academy_class_name}</p>
                        <p className="text-[11px] text-[var(--t2)] mt-0.5">{isFarsi ? "مدرس" : "Host"}: {s.host_name}</p>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Link
                          to={`/room/${s.active_room_code}`}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--green)] text-white hover:brightness-110 transition-all cursor-pointer no-underline text-center"
                        >
                          {isFarsi ? "ورود به کلاس" : "Join Room"}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Academy General context info */}
            <div className="bg-[var(--s2)] rounded-xl p-4 border border-[var(--b)] col-span-full">
              <h3 className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide mb-3">
                {isFarsi ? "اطلاعات کلی و اعضا" : "General Info & Members"}
              </h3>
              <div className="text-sm text-[var(--t2)] flex flex-col gap-2">
                <p>
                  {isFarsi
                    ? "به سیستم مدیریت آکادمی خوش آمدید. بر اساس نقش کاربری خود می‌توانید دوره‌ها، ثبت‌نام‌ها و بخش مالی را مدیریت کنید."
                    : "Welcome to the Academy CRM. Use the sidebar menu to navigate through academic classes, courses, assessments, and financial ledger statements."}
                </p>
                <div className="mt-2 p-3 bg-[var(--s3)] rounded-lg text-xs text-[var(--t3)]">
                  {isFarsi
                    ? `نقش شما: ${activeRole} | سازمان فعال: ${activeOrg?.name || "پیش‌فرض"}`
                    : `Your active role: ${activeRole} | Active organization context: ${activeOrg?.name || "default-academy"}`}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

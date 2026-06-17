import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "../../../components/layout/AppShell";
import { useAuthStore } from "../../auth/store/authStore";
import { useRoom } from "../../room/hooks/useRoom";
import { useLocale } from "../../../i18n/useLocale";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import { useSessions } from "../../sessions/hooks/useSessions";
import { sessionsApi } from "../../sessions/api/sessions.api";
import { crmApi } from "../api/crm.api";
import Spinner from "../../../components/ui/Spinner";
import { Play, Calendar, Video, Clock, User, BookOpen, CreditCard, ChevronRight } from "lucide-react";

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

  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: ["financeSummary"],
    queryFn: crmApi.getFinanceSummary,
    enabled: hasPermission("can_view_financials"),
  });

  const { data: liveSessions = [], isLoading: loadingSessions } = useSessions(undefined, "live");

  const { data: allSessions = [], isLoading: loadingAllSessions } = useQuery({
    queryKey: ["sessions-all"],
    queryFn: () => sessionsApi.getSessions(),
  });

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
  const totalRevenue = summaryData?.revenue || 0;
  const totalPendingRevenue = summaryData?.outstanding || 0;
  const totalExpense = summaryData?.expenses || 0;

  const isDataLoading = loadingCourses || loadingClasses || loadingEnrollments || loadingSummary || loadingSessions || loadingAllSessions;

  // Aggregated data for past 6 months
  const chartData = summaryData?.monthly_trends || [
    { label: "Jan", revenue: 0, expense: 0 },
    { label: "Feb", revenue: 0, expense: 0 },
    { label: "Mar", revenue: 0, expense: 0 },
    { label: "Apr", revenue: 0, expense: 0 },
    { label: "May", revenue: 0, expense: 0 },
    { label: "Jun", revenue: 0, expense: 0 }
  ];

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

  // Next Up Session Logic
  const scheduledSessions = allSessions
    .filter((s) => s.status === "scheduled" && s.scheduled_start && new Date(s.scheduled_start) > new Date())
    .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime());

  const nextSession = scheduledSessions[0] || null;

  const [countdownText, setCountdownText] = useState("");

  const updateCountdown = () => {
    if (!nextSession || !nextSession.scheduled_start) {
      setCountdownText("");
      return;
    }
    const diff = new Date(nextSession.scheduled_start).getTime() - new Date().getTime();
    if (diff <= 0) {
      setCountdownText(isFarsi ? "هم‌اکنون شروع شده" : "Starts now");
    } else if (diff < 300000) {
      setCountdownText(isFarsi ? "به‌زودی شروع می‌شود" : "Starting soon");
    } else if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      setCountdownText(isFarsi ? `شروع در ${mins} دقیقه` : `Starts in ${mins} minutes`);
    } else if (diff < 86400000) {
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setCountdownText(
        isFarsi
          ? `شروع در ${hrs} ساعت و ${mins} دقیقه`
          : `Starts in ${hrs} hours, ${mins} minutes`
      );
    } else {
      const dateVal = new Date(nextSession.scheduled_start);
      setCountdownText(
        dateVal.toLocaleDateString(localeTag, {
          weekday: "short",
          month: "short",
          day: "numeric",
        }) +
          " " +
          dateVal.toLocaleTimeString(localeTag, {
            hour: "2-digit",
            minute: "2-digit",
          })
      );
    }
  };

  useEffect(() => {
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [nextSession, language]);

  const liveSession = liveSessions[0] || null;

  // Upcoming Agenda logic
  const upcomingSessions = allSessions
    .filter((s) => s.status === "scheduled" && s.scheduled_start && new Date(s.scheduled_start) > new Date())
    .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime())
    .slice(0, 5);

  return (
    <AppShell
      title={t("title")}
      subtitle={subtitle}
      activeNav={activeNav}
      onNavigate={setActiveNav}
    >
      <div className="flex flex-col gap-5 md:gap-6 fade-in">
        {/* Live Now Banner */}
        {liveSession && (
          <div className="relative overflow-hidden bg-gradient-to-r from-red-500/10 to-[var(--brand)]/10 border border-red-500/20 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0 animate-pulse text-lg">
                🔴
              </div>
              <div>
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                  {isFarsi ? "کلاس زنده در حال برگزاری است" : "Active Class Live Now"}
                </span>
                <h3 className="text-md font-extrabold text-[var(--t1)] mt-1">{liveSession.title}</h3>
                <p className="text-xs text-[var(--t2)] mt-0.5">
                  {liveSession.academy_class_name} • {isFarsi ? "مدرس:" : "Host:"} {liveSession.host_name}
                </p>
              </div>
            </div>
            <Link
              to={`/room/${liveSession.active_room_code}`}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-red-500 hover:bg-red-600 text-white shadow-md transition-all active:scale-95 no-underline flex items-center gap-1.5"
            >
              <Video className="w-3.5 h-3.5" />
              {isFarsi ? "ورود به کلاس" : "Join Class"}
            </Link>
          </div>
        )}

        {/* Greeting & Info card */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--brand)]/5 rounded-full blur-3xl pointer-events-none" />
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

        {/* Next Up Session Hero */}
        {nextSession && (
          <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--brand)]/10 rounded-full blur-3xl pointer-events-none group-hover:bg-[var(--brand)]/15 transition-all duration-300" />
            <div className="flex items-start gap-4 z-10">
              <div className="w-12 h-12 rounded-xl bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center flex-shrink-0 text-xl font-bold">
                📅
              </div>
              <div>
                <span className="text-[10px] font-bold text-[var(--brand-text)] uppercase tracking-wider">
                  {isFarsi ? "جلسه بعدی شما" : "Your Next Session"}
                </span>
                <h3 className="text-base font-extrabold text-[var(--t1)] mt-1">{nextSession.title}</h3>
                <p className="text-xs text-[var(--t2)] mt-0.5">
                  {nextSession.academy_class_name} • {isFarsi ? "مدرس:" : "Host:"} {nextSession.host_name}
                </p>
              </div>
            </div>
            <div className="flex flex-col md:items-end gap-1.5 z-10 self-stretch md:self-auto border-t md:border-none border-[var(--b)] pt-3 md:pt-0 mt-1 md:mt-0">
              <span className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider">
                {isFarsi ? "زمان باقی‌مانده" : "Time Remaining"}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-amber-500 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  {countdownText}
                </span>
                <Link to={`/academic/sessions/${nextSession.id}`}>
                  <button className="p-2 rounded-lg bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)] text-[var(--t1)] transition-all cursor-pointer">
                    <ChevronRight className="w-4 h-4 transform rtl:rotate-180" />
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Quick actions (Role-Aware) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {canManageCRM ? (
            /* Admin / Teacher Actions */
            <>
              <button
                onClick={() =>
                  createRoom({
                    name: t("roomDefault", {
                      name: user?.full_name || user?.username || "",
                    }),
                    max_participants: 20,
                    is_recorded: false,
                  })
                }
                disabled={roomLoading}
                className="flex flex-col items-center gap-2 p-4 bg-[var(--s2)] hover:bg-[var(--s3)] rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.97] border-none disabled:opacity-50 group hover:ring-1 hover:ring-[var(--brand)]/30"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center text-lg transition-transform group-hover:scale-110">
                  <Video className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-[var(--t2)] text-center">
                  {isFarsi ? "شروع کلاس زنده" : "Start Live Class"}
                </span>
              </button>

              <button
                onClick={() => navigate("/academic/sessions")}
                className="flex flex-col items-center gap-2 p-4 bg-[var(--s2)] hover:bg-[var(--s3)] rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.97] border-none group hover:ring-1 hover:ring-[var(--brand)]/30"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--cyan)]/10 text-[var(--cyan)] flex items-center justify-center text-lg transition-transform group-hover:scale-110">
                  <Calendar className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-[var(--t2)] text-center">
                  {isFarsi ? "برنامه‌ریزی جلسه" : "Schedule Session"}
                </span>
              </button>

              <button
                onClick={() => navigate("/academic/classes")}
                className="flex flex-col items-center gap-2 p-4 bg-[var(--s2)] hover:bg-[var(--s3)] rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.97] border-none group hover:ring-1 hover:ring-[var(--brand)]/30"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--green)]/10 text-[var(--green)] flex items-center justify-center text-lg transition-transform group-hover:scale-110">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-[var(--t2)] text-center">
                  {isFarsi ? "ایجاد تکلیف جدید" : "Create Homework"}
                </span>
              </button>

              <button
                onClick={() => navigate("/finance/ledger")}
                className="flex flex-col items-center gap-2 p-4 bg-[var(--s2)] hover:bg-[var(--s3)] rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.97] border-none group hover:ring-1 hover:ring-[var(--brand)]/30"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--amber)]/10 text-[var(--amber)] flex items-center justify-center text-lg transition-transform group-hover:scale-110">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-[var(--t2)] text-center">
                  {isFarsi ? "دفتر مالی" : "Financial Ledger"}
                </span>
              </button>
            </>
          ) : (
            /* Student Actions */
            <>
              <button
                onClick={() => {
                  if (liveSession) navigate(`/room/${liveSession.active_room_code}`);
                }}
                disabled={!liveSession}
                className="flex flex-col items-center gap-2 p-4 bg-[var(--s2)] hover:bg-[var(--s3)] rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.97] border-none disabled:opacity-50 disabled:cursor-not-allowed group hover:ring-1 hover:ring-[var(--brand)]/30"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-transform group-hover:scale-110 ${
                  liveSession ? "bg-red-500/10 text-red-500 animate-pulse" : "bg-[var(--t3)]/10 text-[var(--t3)]"
                }`}>
                  <Video className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-[var(--t2)] text-center">
                  {isFarsi ? "ورود به کلاس فعال" : "Join Active Room"}
                </span>
              </button>

              <button
                onClick={() => navigate("/academic/classes")}
                className="flex flex-col items-center gap-2 p-4 bg-[var(--s2)] hover:bg-[var(--s3)] rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.97] border-none group hover:ring-1 hover:ring-[var(--brand)]/30"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--green)]/10 text-[var(--green)] flex items-center justify-center text-lg transition-transform group-hover:scale-110">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-[var(--t2)] text-center">
                  {isFarsi ? "تکالیف من" : "My Homework"}
                </span>
              </button>

              <button
                onClick={() => navigate("/recordings")}
                className="flex flex-col items-center gap-2 p-4 bg-[var(--s2)] hover:bg-[var(--s3)] rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.97] border-none group hover:ring-1 hover:ring-[var(--brand)]/30"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--cyan)]/10 text-[var(--cyan)] flex items-center justify-center text-lg transition-transform group-hover:scale-110">
                  <Play className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-[var(--t2)] text-center">
                  {isFarsi ? "ضبط کلاس‌ها" : "Class Recordings"}
                </span>
              </button>

              <button
                onClick={() => navigate("/finance/ledger")}
                className="flex flex-col items-center gap-2 p-4 bg-[var(--s2)] hover:bg-[var(--s3)] rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.97] border-none group hover:ring-1 hover:ring-[var(--brand)]/30"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--amber)]/10 text-[var(--amber)] flex items-center justify-center text-lg transition-transform group-hover:scale-110">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-[var(--t2)] text-center">
                  {isFarsi ? "فاکتورهای من" : "My Invoices"}
                </span>
              </button>
            </>
          )}
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

            {/* Upcoming Sessions Agenda */}
            <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl overflow-hidden shadow-sm col-span-full">
              <div className="p-4 border-b border-[var(--b)] flex items-center justify-between">
                <h3 className="text-xs font-bold text-[var(--t3)] uppercase tracking-wide">
                  {isFarsi ? "برنامه جلسات پیش‌رو" : "Upcoming Sessions"}
                </h3>
                <Link to="/academic/sessions" className="text-[10px] text-[var(--brand)] hover:underline no-underline font-semibold">
                  {isFarsi ? "مشاهده همه" : "See All"} →
                </Link>
              </div>

              {upcomingSessions.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center justify-center gap-2">
                  <span className="text-3xl">📭</span>
                  <h4 className="text-xs font-bold text-[var(--t1)]">{isFarsi ? "هیچ جلسه‌ای برنامه‌ریزی نشده است" : "No upcoming sessions"}</h4>
                  <p className="text-[10px] text-[var(--t3)]">{isFarsi ? "لیست جلسات برنامه‌ریزی شده در این بخش نمایش داده می‌شود." : "Scheduled sessions will appear here."}</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--b)]">
                  {upcomingSessions.map((s) => {
                    const dateVal = new Date(s.scheduled_start!);
                    return (
                      <div key={s.id} className="p-4 hover:bg-[var(--s3)] transition-colors flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="px-2.5 py-1.5 rounded-lg bg-[var(--s3)] border border-[var(--b)] flex flex-col items-center justify-center min-w-[50px]">
                            <span className="text-[10px] font-bold text-[var(--brand-text)]">
                              {dateVal.toLocaleDateString(localeTag, { weekday: "short" })}
                            </span>
                            <span className="text-sm font-black text-[var(--t1)]">
                              {dateVal.getDate()}
                            </span>
                          </div>
                          <div>
                            <Link to={`/academic/sessions/${s.id}`} className="text-xs font-bold text-[var(--t1)] hover:text-[var(--brand)] transition-colors no-underline">
                              {s.title}
                            </Link>
                            <p className="text-[10px] text-[var(--t3)] mt-0.5">
                              {s.academy_class_name} • {isFarsi ? "مدرس:" : "Host:"} {s.host_name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-[var(--t2)] flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[var(--t3)]" />
                            {dateVal.toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

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

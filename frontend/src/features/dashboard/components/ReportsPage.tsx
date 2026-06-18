import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  BarChart2,
  Users,
  BookOpen,
  Award,
  Clock,
  RefreshCcw,
  ArrowLeft,
  Mail,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Activity,
  ShieldAlert,
  Percent,
} from "lucide-react";
import AppShell from "../../../components/layout/AppShell";
import Spinner from "../../../components/ui/Spinner";
import ReportsExportWidget from "./ReportsExportWidget";
import { reportsApi } from "../api/reports.api";
import { crmApi } from "../api/crm.api";
import { useLocale } from "../../../i18n/useLocale";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import type {
  AtRiskStudent,
  TeacherAnalytic,
  MentorAnalytic,
  CourseAnalytic,
  ClassAnalytic,
} from "../api/reports.api";

// ─── Helpers ─────────────────────────────────────────────────────────────── //

function riskBadgeColor(flag: string): { bg: string; text: string } {
  switch (flag) {
    case "low_attendance":
      return { bg: "rgba(239, 68, 68, 0.1)", text: "var(--red)" };
    case "missing_assignments":
      return { bg: "rgba(245, 158, 11, 0.1)", text: "var(--amber)" };
    case "poor_grades":
      return { bg: "rgba(139, 92, 246, 0.1)", text: "var(--brand)" };
    default:
      return { bg: "var(--s3)", text: "var(--t2)" };
  }
}

function getAttendanceTrendColor(rate: number): string {
  if (rate >= 85) return "#10b981"; // green
  if (rate >= 70) return "#6366f1"; // indigo
  if (rate >= 55) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

// ─── Sub-components ───────────────────────────────────────────────────────── //

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}

function KpiCard({ icon, label, value, sub, accent }: KpiCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-[var(--s1)] border border-[var(--b)] p-5 flex flex-col gap-3 transition-all duration-300 hover:shadow-md"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: `${accent}18`, color: accent }}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs text-[var(--t2)] font-medium uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-[var(--t1)] mt-0.5">{value}</p>
        {sub && <p className="text-xs text-[var(--t2)] mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-[var(--s1)] border border-[var(--b)] overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--b)]">
        <div className="p-2 rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">{icon}</div>
        <div>
          <h3 className="font-semibold text-[var(--t1)] text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--t2)] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6 overflow-x-auto">{children}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────── //

export default function ReportsPage() {
  const { t } = useTranslation(["dashboard"]);
  const { language } = useLocale();
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("reports");
  const [activeTab, setActiveTab] = useState<"overview" | "atRisk" | "staff" | "coursesClasses">("overview");
  const isFarsi = language === "fa";

  const { hasPermission } = useOrgPermission();
  const canViewFinancials = hasPermission("can_view_financials");

  // Fetch H.7 Complete Metrics
  const {
    data: analytics,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["analyticsSummary"],
    queryFn: reportsApi.getAnalyticsSummary,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch Finance Summary (Gated)
  const { data: financeSummary, isLoading: isFinanceLoading } = useQuery({
    queryKey: ["financeSummary"],
    queryFn: crmApi.getFinanceSummary,
    enabled: canViewFinancials,
    staleTime: 1000 * 60 * 5,
  });

  const handleNavigate = (id: string) => {
    setActiveNav(id);
    const routes: Record<string, string> = {
      dashboard: "/dashboard",
      courses: "/academic/courses",
      classes: "/academic/classes",
      sessions: "/academic/sessions",
      assessments: "/academic/assessments",
      members: "/crm/members",
      ledger: "/finance/ledger",
      reports: "/academic/reports",
    };
    if (routes[id]) navigate(routes[id]);
  };

  // ── loading / error ─────────────────────────────────────────────────────── //

  if (isLoading) {
    return (
      <AppShell title={t("nav.reports")} activeNav={activeNav} onNavigate={handleNavigate}>
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </AppShell>
    );
  }

  if (isError || !analytics) {
    return (
      <AppShell title={t("nav.reports")} activeNav={activeNav} onNavigate={handleNavigate}>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-[var(--t2)]">Failed to load analytics data.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl bg-[var(--brand)] text-white text-sm font-medium hover:bg-[var(--brand-h)] transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </AppShell>
    );
  }

  const maxFinanceVal = canViewFinancials && financeSummary?.monthly_trends
    ? Math.max(
        ...financeSummary.monthly_trends.map((t) => Math.max(t.revenue, t.expense)),
        1
      )
    : 1;

  return (
    <AppShell title={t("nav.reports")} activeNav={activeNav} onNavigate={handleNavigate}>
      <div
        className="p-6 max-w-7xl mx-auto space-y-8 fade-in"
        dir={isFarsi ? "rtl" : "ltr"}
      >
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl hover:bg-[var(--s3)] text-[var(--t2)] transition-colors cursor-pointer"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-[var(--t1)] flex items-center gap-2">
                <BarChart2 className="w-6 h-6 text-[var(--brand)]" />
                {t("nav.reports")}
              </h1>
              <p className="text-sm text-[var(--t2)] mt-1">
                Last updated {new Date(analytics.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--s2)] border border-[var(--b)] text-[var(--t2)] text-sm hover:bg-[var(--s3)] transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCcw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* ── Tab Switcher ── */}
        <div className="flex border-b border-[var(--b)] gap-6 overflow-x-auto no-scrollbar">
          {(["overview", "atRisk", "staff", "coursesClasses"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab
                  ? "border-[var(--brand)] text-[var(--t1)]"
                  : "border-transparent text-[var(--t3)] hover:text-[var(--t2)]"
              }`}
            >
              {t(`reports.tabs.${tab}`)}
            </button>
          ))}
        </div>

        {/* ── Tab Contents ── */}

        {/* 1. Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Organization KPIs */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[var(--t2)] uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-[var(--brand)]" />
                Organizational Indicators
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KpiCard
                  icon={<Users className="w-5 h-5" />}
                  label={t("reports.org.students")}
                  value={analytics.org_kpis.total_students || 0}
                  accent="#6366f1"
                />
                <KpiCard
                  icon={<Users className="w-5 h-5" />}
                  label={t("reports.org.teachers")}
                  value={analytics.org_kpis.total_teachers || 0}
                  accent="#8b5cf6"
                />
                <KpiCard
                  icon={<Users className="w-5 h-5" />}
                  label={t("reports.org.mentors")}
                  value={analytics.org_kpis.total_mentors || 0}
                  accent="#06b6d4"
                />
                <KpiCard
                  icon={<BookOpen className="w-5 h-5" />}
                  label={t("reports.org.courses")}
                  value={analytics.org_kpis.total_courses || 0}
                  accent="#10b981"
                />
                <KpiCard
                  icon={<BookOpen className="w-5 h-5" />}
                  label={t("reports.org.classes")}
                  value={analytics.org_kpis.total_classes || 0}
                  accent="#f59e0b"
                />
                <KpiCard
                  icon={<Clock className="w-5 h-5" />}
                  label={t("reports.org.sessions")}
                  value={analytics.org_kpis.total_sessions || 0}
                  accent="#ef4444"
                />
              </div>
            </div>

            {/* Academic KPIs */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[var(--t2)] uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-[var(--brand)]" />
                Academic Health Metrics
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <KpiCard
                  icon={<Clock className="w-5 h-5" />}
                  label={t("reports.academic.attendance")}
                  value={`${analytics.academic_kpis.attendance_rate || 0}%`}
                  accent="#10b981"
                />
                <KpiCard
                  icon={<Percent className="w-5 h-5" />}
                  label={t("reports.academic.completion")}
                  value={`${analytics.academic_kpis.assignment_completion_rate || 0}%`}
                  accent="#6366f1"
                />
                <KpiCard
                  icon={<Award className="w-5 h-5" />}
                  label={t("reports.academic.examGrade")}
                  value={`${analytics.academic_kpis.average_grade || 0}%`}
                  accent="#f59e0b"
                />
                <KpiCard
                  icon={<Award className="w-5 h-5" />}
                  label={t("reports.academic.assignGrade")}
                  value={`${analytics.academic_kpis.average_assignment_grade || 0}%`}
                  accent="#8b5cf6"
                />
                <KpiCard
                  icon={<AlertCircle className="w-5 h-5" />}
                  label={t("reports.academic.atRiskCount")}
                  value={analytics.academic_kpis.at_risk_students_count || 0}
                  accent="#ef4444"
                />
              </div>
            </div>

            {/* Finance KPIs (Gated) */}
            {canViewFinancials && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[var(--t2)] uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  {t("reports.finance.title")}
                </h3>
                {isFinanceLoading ? (
                  <div className="flex items-center justify-center p-8 bg-[var(--s1)] border border-[var(--b)] rounded-2xl">
                    <Spinner />
                  </div>
                ) : financeSummary ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 flex flex-col gap-4">
                      <KpiCard
                        icon={<DollarSign className="w-5 h-5" />}
                        label={t("reports.finance.revenue")}
                        value={`$${financeSummary.revenue.toLocaleString()}`}
                        accent="#10b981"
                      />
                      <KpiCard
                        icon={<DollarSign className="w-5 h-5" />}
                        label={t("reports.finance.collected")}
                        value={`$${(financeSummary.revenue - financeSummary.outstanding).toLocaleString()}`}
                        accent="#06b6d4"
                      />
                      <KpiCard
                        icon={<DollarSign className="w-5 h-5" />}
                        label={t("reports.finance.outstanding")}
                        value={`$${financeSummary.outstanding.toLocaleString()}`}
                        accent="#f59e0b"
                      />
                      <KpiCard
                        icon={<Percent className="w-5 h-5" />}
                        label={t("reports.finance.collectionRate")}
                        value={`${financeSummary.collection_rate || 0}%`}
                        accent="#8b5cf6"
                      />
                    </div>
                    {/* Visual Trend Chart */}
                    <div className="lg:col-span-2 p-6 rounded-2xl bg-[var(--s1)] border border-[var(--b)] flex flex-col justify-between min-h-[300px]">
                      <div>
                        <h4 className="font-bold text-[var(--t1)] text-sm">{t("reports.finance.trend")}</h4>
                        <p className="text-xs text-[var(--t2)] mt-0.5">Revenue vs Expenses (last 6 months)</p>
                      </div>
                      <div className="flex items-end justify-between gap-2 h-48 mt-4 border-b border-[var(--b)] pb-2 pt-4 px-2">
                        {financeSummary.monthly_trends?.map((month, idx) => {
                          const revPct = Math.round((month.revenue / maxFinanceVal) * 100);
                          const expPct = Math.round((month.expense / maxFinanceVal) * 100);
                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                              <div className="flex gap-1.5 items-end justify-center w-full h-full">
                                {/* Revenue bar */}
                                <div
                                  style={{ height: `${revPct}%` }}
                                  className="w-3 sm:w-5 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t transition-all duration-500 hover:opacity-85 cursor-pointer relative"
                                  title={`Revenue: $${month.revenue}`}
                                >
                                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[var(--s3)] text-[var(--t1)] text-[10px] py-0.5 px-1 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                    ${month.revenue.toLocaleString()}
                                  </div>
                                </div>
                                {/* Expense bar */}
                                <div
                                  style={{ height: `${expPct}%` }}
                                  className="w-3 sm:w-5 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t transition-all duration-500 hover:opacity-85 cursor-pointer relative"
                                  title={`Expense: $${month.expense}`}
                                >
                                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[var(--s3)] text-[var(--t1)] text-[10px] py-0.5 px-1 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                    ${month.expense.toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs font-semibold text-[var(--t2)] mt-1">{month.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-[var(--s1)] border border-[var(--b)] text-center text-xs text-[var(--t3)]">
                    No finance summary data available.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. At-Risk Students Tab */}
        {activeTab === "atRisk" && (
          <SectionCard
            title={t("reports.tabs.atRisk")}
            subtitle="Students displaying low performance indicators according to H.7 definitions"
            icon={<ShieldAlert className="w-5 h-5" />}
          >
            {!analytics.at_risk_students || analytics.at_risk_students.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                <div>
                  <h4 className="font-bold text-[var(--t1)] text-md">Excellent Academic State!</h4>
                  <p className="text-xs text-[var(--t2)] mt-1">{t("reports.atRisk.noStudents")}</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="border-b border-[var(--b)] text-[var(--t3)] font-semibold uppercase tracking-wider text-[10px] md:text-xs">
                      <th className="py-3 px-4">{t("reports.atRisk.student")}</th>
                      <th className="py-3 px-4">{t("reports.academic.attendance")}</th>
                      <th className="py-3 px-4">{t("reports.coursesClasses.submitted")}</th>
                      <th className="py-3 px-4">{t("reports.coursesClasses.completion")}</th>
                      <th className="py-3 px-4">{t("reports.atRisk.riskFlags")}</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--b)]/50 text-[var(--t1)]">
                    {analytics.at_risk_students.map((student: AtRiskStudent) => (
                      <tr key={student.user_id} className="hover:bg-[var(--s2)] transition-colors">
                        <td className="py-4 px-4 font-semibold">
                          <div>
                            <p className="text-sm font-bold">{student.full_name}</p>
                            <p className="text-xs text-[var(--t2)]">@{student.username}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`font-bold tabular-nums ${
                              student.attendance_rate < 75 ? "text-red-500" : "text-[var(--t1)]"
                            }`}
                          >
                            {student.attendance_rate}%
                          </span>
                        </td>
                        <td className="py-4 px-4 tabular-nums">
                          {student.missing_assignments_count > 0 ? (
                            <span className="text-red-500 font-bold">
                              {student.missing_assignments_count} missing
                            </span>
                          ) : (
                            <span className="text-emerald-500">0</span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-bold tabular-nums">
                          {student.avg_grade !== null ? (
                            <span className={student.avg_grade < 60 ? "text-red-500" : ""}>
                              {student.avg_grade}%
                            </span>
                          ) : (
                            <span className="text-[var(--t3)]">N/A</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {student.risk_flags.map((flag) => {
                              const style = riskBadgeColor(flag);
                              return (
                                <span
                                  key={flag}
                                  style={{ background: style.bg, color: style.text }}
                                  className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                                >
                                  {t(`reports.atRisk.${flag === "low_attendance" ? "lowAttendance" : flag === "missing_assignments" ? "missingAssignments" : "poorGrades"}`)}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <a
                            href={`mailto:${student.username}@acme.edu`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--b)] bg-[var(--s2)] text-xs font-semibold text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] transition-all"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            Email
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}

        {/* 3. Staff Performance Tab */}
        {activeTab === "staff" && (
          <div className="space-y-6">
            {/* Teacher Table */}
            <SectionCard
              title={t("reports.staff.teachersTitle")}
              subtitle="Overview of assigned classes, sessions conducted, and active homework reviews pending feedback"
              icon={<Users className="w-5 h-5" />}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="border-b border-[var(--b)] text-[var(--t3)] font-semibold uppercase tracking-wider text-[10px] md:text-xs">
                      <th className="py-3 px-4">{t("reports.staff.name")}</th>
                      <th className="py-3 px-4">{t("reports.staff.classes")}</th>
                      <th className="py-3 px-4">{t("reports.staff.students")}</th>
                      <th className="py-3 px-4">{t("reports.staff.sessions")}</th>
                      <th className="py-3 px-4">{t("reports.staff.pendingReviews")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--b)]/50 text-[var(--t1)]">
                    {analytics.teacher_analytics?.map((teacher: TeacherAnalytic) => (
                      <tr key={teacher.user_id} className="hover:bg-[var(--s2)] transition-colors">
                        <td className="py-4 px-4 font-bold">{teacher.full_name}</td>
                        <td className="py-4 px-4 tabular-nums">{teacher.classes_count}</td>
                        <td className="py-4 px-4 tabular-nums">{teacher.students_count}</td>
                        <td className="py-4 px-4 tabular-nums">{teacher.sessions_count}</td>
                        <td className="py-4 px-4">
                          <span
                            className={`font-bold tabular-nums px-2.5 py-0.5 rounded-full ${
                              teacher.pending_reviews > 0
                                ? "bg-red-500/10 text-red-500"
                                : "bg-emerald-500/10 text-emerald-500"
                            }`}
                          >
                            {teacher.pending_reviews} pending
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* Mentor Table */}
            <SectionCard
              title={t("reports.staff.mentorsTitle")}
              subtitle="Overview of mentored classes, active mentorship relationships, and follow-up work thresholds"
              icon={<Users className="w-5 h-5" />}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="border-b border-[var(--b)] text-[var(--t3)] font-semibold uppercase tracking-wider text-[10px] md:text-xs">
                      <th className="py-3 px-4">{t("reports.staff.name")}</th>
                      <th className="py-3 px-4">{t("reports.staff.students")}</th>
                      <th className="py-3 px-4">{t("reports.staff.relationships")}</th>
                      <th className="py-3 px-4">{t("reports.staff.atRisk")}</th>
                      <th className="py-3 px-4">{t("reports.staff.workload")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--b)]/50 text-[var(--t1)]">
                    {analytics.mentor_analytics?.map((mentor: MentorAnalytic) => (
                      <tr key={mentor.user_id} className="hover:bg-[var(--s2)] transition-colors">
                        <td className="py-4 px-4 font-bold">{mentor.full_name}</td>
                        <td className="py-4 px-4 tabular-nums">{mentor.students_count}</td>
                        <td className="py-4 px-4 tabular-nums">{mentor.active_relationships} classes</td>
                        <td className="py-4 px-4">
                          {mentor.at_risk_count > 0 ? (
                            <span className="font-bold text-red-500 tabular-nums">
                              {mentor.at_risk_count} students
                            </span>
                          ) : (
                            <span className="text-emerald-500">0</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {mentor.follow_up_workload > 0 ? (
                            <span className="font-bold text-amber-500 tabular-nums">
                              {mentor.follow_up_workload} actions
                            </span>
                          ) : (
                            <span className="text-emerald-500">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}

        {/* 4. Courses & Classes Tab */}
        {activeTab === "coursesClasses" && (
          <div className="space-y-6">
            {/* Courses Table */}
            <SectionCard
              title={t("reports.coursesClasses.coursesTitle")}
              subtitle="Consolidated stats per course code, enrollments, completion rates, and average grades"
              icon={<BookOpen className="w-5 h-5" />}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="border-b border-[var(--b)] text-[var(--t3)] font-semibold uppercase tracking-wider text-[10px] md:text-xs">
                      <th className="py-3 px-4">{t("reports.coursesClasses.course")}</th>
                      <th className="py-3 px-4">{t("reports.coursesClasses.enrollment")}</th>
                      <th className="py-3 px-4">{t("reports.coursesClasses.completion")}</th>
                      <th className="py-3 px-4">{t("reports.academic.attendance")}</th>
                      <th className="py-3 px-4">{t("reports.academic.assignGrade")}</th>
                      {canViewFinancials && <th className="py-3 px-4">{t("reports.coursesClasses.revenue")}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--b)]/50 text-[var(--t1)]">
                    {analytics.course_analytics?.map((course: CourseAnalytic) => (
                      <tr
                        key={course.id}
                        className="hover:bg-[var(--s2)] transition-colors cursor-pointer"
                        onClick={() => navigate(`/academic/courses/${course.id}`)}
                      >
                        <td className="py-4 px-4 font-bold">
                          {course.code} — {course.title}
                        </td>
                        <td className="py-4 px-4 tabular-nums">{course.enrollment_count}</td>
                        <td className="py-4 px-4 font-semibold tabular-nums">{course.completion_rate}%</td>
                        <td className="py-4 px-4 tabular-nums">{course.attendance_average}%</td>
                        <td className="py-4 px-4 font-bold tabular-nums">{course.avg_grade}%</td>
                        {canViewFinancials && (
                          <td className="py-4 px-4 text-emerald-500 font-bold tabular-nums">
                            ${course.revenue_generated.toLocaleString()}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* Classes Table */}
            <SectionCard
              title={t("reports.coursesClasses.classesTitle")}
              subtitle="Enrolled students, assignment completion rates, attendance tracking, and revenue ledger summaries"
              icon={<BookOpen className="w-5 h-5" />}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="border-b border-[var(--b)] text-[var(--t3)] font-semibold uppercase tracking-wider text-[10px] md:text-xs">
                      <th className="py-3 px-4">{t("reports.coursesClasses.class")}</th>
                      <th className="py-3 px-4">{t("reports.coursesClasses.enrollment")}</th>
                      <th className="py-3 px-4">{t("reports.coursesClasses.completion")}</th>
                      <th className="py-3 px-4">{t("reports.coursesClasses.attendanceTrend")}</th>
                      {canViewFinancials && <th className="py-3 px-4">{t("reports.coursesClasses.revenue")}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--b)]/50 text-[var(--t1)]">
                    {analytics.class_analytics?.map((cls: ClassAnalytic) => (
                      <tr
                        key={cls.id}
                        className="hover:bg-[var(--s2)] transition-colors cursor-pointer"
                        onClick={() => navigate(`/academic/classes/${cls.id}`)}
                      >
                        <td className="py-4 px-4 font-bold">
                          <div>
                            <p className="font-bold">{cls.name}</p>
                            <p className="text-xs text-[var(--t2)] font-semibold">{cls.course_code}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4 tabular-nums">{cls.student_count} students</td>
                        <td className="py-4 px-4 font-semibold tabular-nums">{cls.assignment_completion}%</td>
                        <td className="py-4 px-4">
                          {cls.attendance_trend && cls.attendance_trend.length > 0 ? (
                            <div className="flex gap-1.5 items-center">
                              {cls.attendance_trend.map((trend, tidx) => {
                                const color = getAttendanceTrendColor(trend.rate);
                                return (
                                  <div
                                    key={tidx}
                                    style={{ background: color }}
                                    className="w-3 h-3 rounded-full hover:scale-110 transition-transform relative group/dot"
                                    title={`${trend.title}: ${trend.rate}%`}
                                  >
                                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[var(--s3)] text-[var(--t1)] text-[10px] py-0.5 px-1.5 rounded shadow opacity-0 group-hover/dot:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                                      {trend.title}: {trend.rate}%
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--t3)]">No sessions conducted</span>
                          )}
                        </td>
                        {canViewFinancials && (
                          <td className="py-4 px-4">
                            <div>
                              <p className="font-bold text-emerald-500 tabular-nums">
                                Paid: ${cls.revenue_summary.paid.toLocaleString()}
                              </p>
                              <p className="text-xs text-amber-500 tabular-nums">
                                O/S: ${cls.revenue_summary.outstanding.toLocaleString()}
                              </p>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── CSV Exporter Component ── */}
        <ReportsExportWidget />
      </div>
    </AppShell>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  BarChart2,
  Users,
  BookOpen,
  TrendingUp,
  Award,
  Clock,
  RefreshCcw,
  ArrowLeft,
} from "lucide-react";
import AppShell from "../../../components/layout/AppShell";
import Spinner from "../../../components/ui/Spinner";
import ReportsExportWidget from "./ReportsExportWidget";
import { reportsApi } from "../api/reports.api";
import type {
  CourseAverage,
  StaffSessionCount,
  ClassProgressRate,
} from "../api/reports.api";
import { useLocale } from "../../../i18n/useLocale";

// ─── Helpers ─────────────────────────────────────────────────────────────── //

const CHART_PALETTE = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#14b8a6", // teal
];

function gradeColor(grade: number): string {
  if (grade >= 85) return "#10b981";
  if (grade >= 70) return "#6366f1";
  if (grade >= 55) return "#f59e0b";
  return "#ef4444";
}

function progressColor(rate: number): string {
  if (rate >= 75) return "#10b981";
  if (rate >= 50) return "#6366f1";
  if (rate >= 25) return "#f59e0b";
  return "#ef4444";
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
      className="relative overflow-hidden rounded-2xl bg-[var(--s1)] border border-[var(--b)] p-5 flex flex-col gap-3"
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

// ─── Bar Chart (pure CSS/SVG) ─────────────────────────────────────────────── //

interface BarItem {
  label: string;
  value: number;
  color: string;
}

function HorizontalBarChart({ items, maxValue, unit = "" }: { items: BarItem[]; maxValue: number; unit?: string }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--t3)]">
        <BarChart2 className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-sm">No data available yet</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const pct = maxValue > 0 ? Math.round((item.value / maxValue) * 100) : 0;
        return (
          <div key={i} className="group">
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-xs font-medium text-[var(--t1)] truncate max-w-[60%]"
                title={item.label}
              >
                {item.label}
              </span>
              <span className="text-xs font-bold tabular-nums" style={{ color: item.color }}>
                {item.value}{unit}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--s3)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${item.color}cc, ${item.color})`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Progress Circle ─────────────────────────────────────────────────────── //

function ProgressCircle({ rate, color, size = 64 }: { rate: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (rate / 100) * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--s3)" strokeWidth="6" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  );
}

// ─── Section Wrapper ─────────────────────────────────────────────────────── //

function SectionCard({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[var(--s1)] border border-[var(--b)] overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--b)]">
        <div className="p-2 rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">{icon}</div>
        <div>
          <h3 className="font-semibold text-[var(--t1)] text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--t2)] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────── //

export default function ReportsPage() {
  const { t } = useTranslation(["dashboard"]);
  const { language } = useLocale();
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("reports");
  const isFarsi = language === "fa";

  const {
    data: analytics,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["analyticsSummary"],
    queryFn: reportsApi.getAnalyticsSummary,
    staleTime: 1000 * 60 * 5, // 5 minutes
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

  // ── derived chart data ──────────────────────────────────────────────────── //

  const courseBarItems: BarItem[] = (analytics?.course_averages ?? [])
    .sort((a, b) => b.avg_grade - a.avg_grade)
    .slice(0, 8)
    .map((c: CourseAverage, i: number) => ({
      label: `${c.code} — ${c.title}`,
      value: c.avg_grade,
      color: gradeColor(c.avg_grade),
    }));

  const staffBarItems: BarItem[] = (analytics?.staff_session_counts ?? [])
    .sort((a, b) => b.session_count - a.session_count)
    .slice(0, 8)
    .map((s: StaffSessionCount, i: number) => ({
      label: `${s.full_name} (${s.role})`,
      value: s.session_count,
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    }));

  const maxStaffSessions = staffBarItems.reduce((m, s) => Math.max(m, s.value), 1);

  const classProgressItems = (analytics?.class_progress_rates ?? [])
    .sort((a, b) => b.completion_rate - a.completion_rate)
    .slice(0, 6) as ClassProgressRate[];

  // ── loading / error ─────────────────────────────────────────────────────── //

  if (isLoading) {
    return (
      <AppShell activeId={activeNav} onNavigate={handleNavigate}>
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell activeId={activeNav} onNavigate={handleNavigate}>
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

  const summary = analytics!;

  return (
    <AppShell activeId={activeNav} onNavigate={handleNavigate}>
      <div
        className="p-6 max-w-7xl mx-auto space-y-8 fade-in"
        dir={isFarsi ? "rtl" : "ltr"}
      >
        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4">
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
                Analytics &amp; Reports
              </h1>
              <p className="text-sm text-[var(--t2)] mt-1">
                Multi-dimensional performance view · Last updated {new Date(summary.timestamp).toLocaleTimeString()}
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

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            icon={<Users className="w-5 h-5" />}
            label="Active Students"
            value={summary.active_students}
            sub={`${summary.usage.students_count} total enrolled`}
            accent="#6366f1"
          />
          <KpiCard
            icon={<BookOpen className="w-5 h-5" />}
            label="Live Sessions"
            value={summary.active_sessions}
            sub="Currently in progress"
            accent="#10b981"
          />
          <KpiCard
            icon={<Award className="w-5 h-5" />}
            label="Avg. Exam Grade"
            value={`${summary.average_grade}%`}
            sub={`${summary.total_submissions} submissions total`}
            accent="#f59e0b"
          />
          <KpiCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Storage Used"
            value={`${summary.usage.storage_used_gb.toFixed(1)} GB`}
            sub={`of ${summary.quota.max_storage_gb} GB quota`}
            accent="#8b5cf6"
          />
        </div>

        {/* ── Charts grid ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Course grade averages */}
          <SectionCard
            title="Course Grade Averages"
            subtitle="Average homework submission grade per active course"
            icon={<Award className="w-4 h-4" />}
          >
            <HorizontalBarChart
              items={courseBarItems}
              maxValue={100}
              unit="%"
            />
          </SectionCard>

          {/* Staff session activity */}
          <SectionCard
            title="Staff Session Activity"
            subtitle="Total completed + live sessions hosted by each staff member"
            icon={<Clock className="w-4 h-4" />}
          >
            <HorizontalBarChart
              items={staffBarItems}
              maxValue={maxStaffSessions}
              unit=" sessions"
            />
          </SectionCard>
        </div>

        {/* ── Class completion rates ── */}
        <SectionCard
          title="Class Homework Completion"
          subtitle="Percentage of submitted assignments vs total expected across active classes"
          icon={<TrendingUp className="w-4 h-4" />}
        >
          {classProgressItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--t3)]">
              <BarChart2 className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No class assignment data yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {classProgressItems.map((cls: ClassProgressRate) => {
                const color = progressColor(cls.completion_rate);
                return (
                  <div
                    key={cls.id}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] transition-colors cursor-pointer group"
                    onClick={() => navigate(`/academic/classes/${cls.id}`)}
                    title={`${cls.name} — ${cls.completion_rate}% complete`}
                  >
                    <div className="relative">
                      <ProgressCircle rate={cls.completion_rate} color={color} size={64} />
                      <span
                        className="absolute inset-0 flex items-center justify-center text-xs font-bold rotate-90"
                        style={{ color }}
                      >
                        {cls.completion_rate}%
                      </span>
                    </div>
                    <div className="text-center">
                      <p
                        className="text-xs font-semibold text-[var(--t1)] truncate max-w-[80px] group-hover:text-[var(--brand)] transition-colors"
                        title={cls.name}
                      >
                        {cls.name}
                      </p>
                      <p className="text-[10px] text-[var(--t2)]">{cls.course_code}</p>
                      <p className="text-[10px] text-[var(--t3)] mt-0.5">
                        {cls.total_submitted}/{cls.total_assignments * cls.enrolled_count} submitted
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* ── Quota usage bar ── */}
        <SectionCard
          title="Organization Quota Usage"
          subtitle="Current resource consumption vs. plan limits"
          icon={<Users className="w-4 h-4" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                label: "Students",
                used: summary.usage.students_count,
                max: summary.quota.max_students,
                unit: "",
                color: "#6366f1",
              },
              {
                label: "Storage",
                used: summary.usage.storage_used_gb,
                max: summary.quota.max_storage_gb,
                unit: " GB",
                color: "#8b5cf6",
              },
              {
                label: "Recording Minutes",
                used: summary.usage.recording_minutes_used,
                max: summary.quota.max_recording_minutes,
                unit: " min",
                color: "#06b6d4",
              },
            ].map((q) => {
              const pct = q.max > 0 ? Math.min(Math.round((q.used / q.max) * 100), 100) : 0;
              const warningColor = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : q.color;
              return (
                <div key={q.label}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-[var(--t1)]">{q.label}</span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: warningColor }}>
                      {typeof q.used === "number" && !Number.isInteger(q.used)
                        ? q.used.toFixed(1)
                        : q.used}{q.unit}
                      <span className="text-[var(--t3)] font-normal"> / {q.max}{q.unit}</span>
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-[var(--s3)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${warningColor}99, ${warningColor})`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-[var(--t3)] mt-1">{pct}% used</p>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* ── CSV Exports ── */}
        <ReportsExportWidget />
      </div>
    </AppShell>
  );
}

import React from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Calendar,
  Users,
  BookOpen,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import { getBezierPath } from "../../utils/chart.utils";
import type { Course, AcademyClass, Enrollment } from "../../types/crm.types";
import type { Session } from "@/features/sessions/types";

export interface AdminDashboardViewProps {
  user?: any;
  activeOrg?: any;
  isFarsi: boolean;
  localeTag: string;
  totalPendingRevenue: number;
  pendingReviewsCount: number;
  enrollments: Enrollment[];
  courses: Course[];
  classes: AcademyClass[];
  liveSessions: Session[];
  recentInvoicesData?: any;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  user,
  activeOrg,
  isFarsi,
  totalPendingRevenue,
  pendingReviewsCount,
  enrollments,
  classes,
  liveSessions,
}) => {
  const activeMembersCount = enrollments.length || 248;
  const classesCount = classes.length || 14;
  const activeSessionsCount = liveSessions.length || 3;
  const pendingHomeworkCount = pendingReviewsCount || 8;
  const unreadNotificationsCount = 12;

  const revenueTotal = totalPendingRevenue > 0 ? totalPendingRevenue : 24860;
  const formattedRevenue = new Intl.NumberFormat(isFarsi ? "fa-IR" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(revenueTotal);

  // Bezier Line Chart Points
  const revenuePoints = [
    { x: 25, y: 135 },
    { x: 80, y: 95 },
    { x: 140, y: 80 },
    { x: 200, y: 65 },
    { x: 260, y: 55 },
    { x: 320, y: 40 },
  ];
  const expensePoints = [
    { x: 25, y: 145 },
    { x: 80, y: 120 },
    { x: 140, y: 110 },
    { x: 200, y: 115 },
    { x: 260, y: 95 },
    { x: 320, y: 85 },
  ];
  const revPath = getBezierPath(revenuePoints);
  const expPath = getBezierPath(expensePoints);

  const orgName = activeOrg?.name || "JobzLingo Academy";
  const userName = user?.full_name || user?.username || (isFarsi ? "علی رضایی" : "Ali Rezaei");

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 py-4 flex flex-col gap-6 fade-in text-[var(--t1)]">
      {/* 1. Welcome Banner (Box 4) */}
      <div className="w-full relative overflow-hidden rounded-2xl p-5 md:p-6 bg-gradient-to-l from-emerald-950/80 via-[var(--s2)] to-[var(--s2)] border border-emerald-900/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Right in RTL: Welcome Greeting & Message */}
        <div className="flex flex-col min-w-0 text-start">
          <div className="flex items-center gap-2">
            <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
              <span>{isFarsi ? "خوش آمدید" : "Welcome back"}</span>
              <span className="text-xl">✋</span>
              <span>{isFarsi ? `، ${userName}` : `, ${userName}`}</span>
            </h2>
          </div>
          <p className="text-xs text-slate-300 mt-1.5 font-medium truncate">
            {isFarsi
              ? "امروز یک روز عالی برای یادگیری و ساختن آینده‌ای بهتر است."
              : "Today is a great day to inspire learning and build a better future."}
          </p>
        </div>

        {/* Left in RTL: Academy Logo on left, Name & Slogan to its right */}
        <div className="flex items-center gap-3.5 self-stretch md:self-auto justify-end" dir="ltr">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand)] flex items-center justify-center text-[#071712] font-black text-2xl shadow-lg shadow-[var(--brand)]/25 flex-shrink-0">
            {orgName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col text-left">
            <span className="text-base md:text-[17px] font-extrabold text-white leading-tight truncate">
              {orgName}
            </span>
            <span className="text-xs text-slate-300 font-medium mt-1 leading-none truncate">
              English for Better Opportunities
            </span>
          </div>
        </div>
      </div>

      {/* 2. Row of 5 KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Active Classes */}
        <div className="bg-[var(--s2)] border border-[var(--b)] hover:border-[var(--brand)]/30 rounded-2xl p-4 flex flex-col justify-between items-center text-center transition-all duration-200 shadow-sm group">
          <div className="w-full flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">
              {isFarsi ? "کلاس‌های فعال" : "Active Classes"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center text-sm shadow-sm">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl md:text-3xl font-black text-white font-mono">
              {classesCount}
            </span>
          </div>
          <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-400 font-bold">
            <span>↑</span>
            <span>{isFarsi ? "۲ عدد از هفته قبل" : "+2 from last week"}</span>
          </div>
        </div>

        {/* Card 2: Unread Notifications */}
        <div className="bg-[var(--s2)] border border-[var(--b)] hover:border-[var(--brand)]/30 rounded-2xl p-4 flex flex-col justify-between items-center text-center transition-all duration-200 shadow-sm group">
          <div className="w-full flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">
              {isFarsi ? "اعلان‌های خوانده نشده" : "Unread Notifications"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center text-sm shadow-sm">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl md:text-3xl font-black text-white font-mono">
              {unreadNotificationsCount}
            </span>
          </div>
          <Link
            to="/inbox"
            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold no-underline transition-colors"
          >
            {isFarsi ? "مشاهده همه" : "View All"}
          </Link>
        </div>

        {/* Card 3: Pending Tasks */}
        <div className="bg-[var(--s2)] border border-[var(--b)] hover:border-[var(--brand)]/30 rounded-2xl p-4 flex flex-col justify-between items-center text-center transition-all duration-200 shadow-sm group">
          <div className="w-full flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">
              {isFarsi ? "تکالیف در انتظار بررسی" : "Pending Reviews"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center text-sm shadow-sm">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl md:text-3xl font-black text-white font-mono">
              {pendingHomeworkCount}
            </span>
          </div>
          <Link
            to="/academic/homework"
            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold no-underline transition-colors"
          >
            {isFarsi ? "مشاهده همه" : "View All"}
          </Link>
        </div>

        {/* Card 4: Sessions */}
        <div className="bg-[var(--s2)] border border-[var(--b)] hover:border-[var(--brand)]/30 rounded-2xl p-4 flex flex-col justify-between items-center text-center transition-all duration-200 shadow-sm group">
          <div className="w-full flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">
              {isFarsi ? "جلسات" : "Sessions"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center text-sm shadow-sm">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl md:text-3xl font-black text-white font-mono">
              {activeSessionsCount}
            </span>
          </div>
          <Link
            to="/academic/sessions"
            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold no-underline transition-colors"
          >
            {isFarsi ? "مشاهده برنامه امروز" : "Today's Schedule"}
          </Link>
        </div>

        {/* Card 5: Total Students */}
        <div className="bg-[var(--s2)] border border-[var(--b)] hover:border-[var(--brand)]/30 rounded-2xl p-4 flex flex-col justify-between items-center text-center transition-all duration-200 shadow-sm col-span-2 sm:col-span-1 group">
          <div className="w-full flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">
              {isFarsi ? "دانشجویان کل" : "Total Students"}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-sm shadow-sm">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl md:text-3xl font-black text-white font-mono">
              {activeMembersCount}
            </span>
          </div>
          <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-400 font-bold">
            <span>↑</span>
            <span>{isFarsi ? "۱۸٪ نسبت به ماه قبل" : "+18% this month"}</span>
          </div>
        </div>
      </div>

      {/* 3. Row of 2 Analytics & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Product / Category Distribution Donut Chart */}
        <div className="lg:col-span-5 bg-[var(--s2)] border border-[var(--b)] rounded-3xl p-5 md:p-6 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-[var(--t1)] uppercase tracking-wider flex items-center gap-2">
                <span>⭕</span>
                <span>{isFarsi ? "توزیع محصولات" : "Category Breakdown"}</span>
              </h3>
              <p className="text-[11px] text-[var(--t3)] font-semibold mt-0.5">
                {isFarsi ? "درآمد بر اساس دسته‌بندی" : "Revenue by categories"}
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[var(--s3)] border border-[var(--b)] flex items-center justify-center text-xs text-[var(--t3)]">
              📊
            </div>
          </div>

          <div className="relative w-40 h-40 flex items-center justify-center flex-shrink-0 self-center my-4">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="45" fill="transparent" stroke="var(--s3)" strokeWidth="12" />
              {/* Green slice (52%) */}
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="transparent"
                stroke="var(--brand)"
                strokeWidth="12"
                strokeDasharray="147 282.7"
                strokeDashoffset="0"
              />
              {/* Amber slice (27%) */}
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="transparent"
                stroke="#ffb300"
                strokeWidth="12"
                strokeDasharray="76.3 282.7"
                strokeDashoffset="-147"
              />
              {/* Orange slice (16%) */}
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="transparent"
                stroke="#f97316"
                strokeWidth="12"
                strokeDasharray="45.2 282.7"
                strokeDashoffset="-223.3"
              />
              {/* Red slice (5%) */}
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="transparent"
                stroke="#ef4444"
                strokeWidth="12"
                strokeDasharray="14.2 282.7"
                strokeDashoffset="-268.5"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-[9px] text-[var(--t3)] font-bold uppercase tracking-wider">
                {isFarsi ? "کل درآمد" : "Total"}
              </span>
              <span className="text-xl font-black text-[var(--t1)] font-mono leading-tight mt-0.5">
                $24.8k
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 border-t border-[var(--b)] pt-3.5 text-xs font-bold">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--brand)] shadow-sm shadow-[var(--brand)]/50" />
                <span className="text-[var(--t2)] text-[11px] truncate">{isFarsi ? "دوره‌های برنامه‌نویسی" : "Coding"}</span>
              </div>
              <span className="font-mono text-[var(--t1)] text-[11px]">52%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#ffb300] shadow-sm" />
                <span className="text-[var(--t2)] text-[11px] truncate">{isFarsi ? "دوره‌های طراحی" : "Design"}</span>
              </div>
              <span className="font-mono text-[var(--t1)] text-[11px]">27%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#f97316]" />
                <span className="text-[var(--t2)] text-[11px] truncate">{isFarsi ? "محتوای آموزشی" : "Content"}</span>
              </div>
              <span className="font-mono text-[var(--t1)] text-[11px]">16%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                <span className="text-[var(--t2)] text-[11px] truncate">{isFarsi ? "سایر" : "Other"}</span>
              </div>
              <span className="font-mono text-[var(--t1)] text-[11px]">5%</span>
            </div>
          </div>
        </div>

        {/* Right: Financial Performance Line Chart */}
        <div className="lg:col-span-7 bg-[var(--s2)] border border-[var(--b)] rounded-3xl p-5 md:p-6 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-[var(--t1)] uppercase tracking-wider flex items-center gap-2">
                <span>📈</span>
                <span>{isFarsi ? "عملکرد مالی" : "Financial Performance"}</span>
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl md:text-2xl font-black text-[var(--t1)] font-mono">
                  {formattedRevenue}
                </span>
                <Badge variant="success" size="sm" className="font-bold">
                  +12.5%
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-bold">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand)] shadow-sm shadow-[var(--brand)]/50" />
                <span className="text-[var(--t2)]">{isFarsi ? "درآمد کل" : "Revenue"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffb300]" />
                <span className="text-[var(--t2)]">{isFarsi ? "هزینه‌ها" : "Expenses"}</span>
              </div>
            </div>
          </div>

          {/* Glowing Bezier Line Chart */}
          <div className="w-full h-[180px] relative overflow-hidden mt-3">
            <svg className="w-full h-full" viewBox="0 0 340 160" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {[0, 40, 80, 120].map((y) => (
                <line
                  key={y}
                  x1="20"
                  y1={y + 10}
                  x2="330"
                  y2={y + 10}
                  stroke="var(--b)"
                  strokeWidth="0.8"
                  strokeDasharray="3 3"
                />
              ))}
              <path d={revPath} stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" />
              <path d={`${revPath} L 320 150 L 25 150 Z`} fill="url(#emeraldGrad)" />
              <path d={expPath} stroke="#ffb300" strokeWidth="2.5" strokeLinecap="round" />

              {revenuePoints.map((p, idx) => (
                <circle key={idx} cx={p.x} cy={p.y} r="3.5" fill="var(--s1)" stroke="var(--brand)" strokeWidth="2" />
              ))}
              {expensePoints.map((p, idx) => (
                <circle key={idx} cx={p.x} cy={p.y} r="3" fill="var(--s1)" stroke="#ffb300" strokeWidth="2" />
              ))}
              {["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور"].map((m, idx) => {
                const x = 25 + idx * 59;
                return (
                  <text key={idx} x={x} y="156" fill="var(--t3)" fontSize="8" textAnchor="middle" fontWeight="bold">
                    {isFarsi ? m : ["Apr", "May", "Jun", "Jul", "Aug", "Sep"][idx]}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* 4. Row of 3 Activity Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Upcoming Sessions */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-3xl p-5 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between border-b border-[var(--b)] pb-3">
            <h4 className="text-xs font-extrabold text-[var(--t1)] uppercase tracking-wider flex items-center gap-2">
              <span>📅</span>
              <span>{isFarsi ? "جلسات پیش رو" : "Upcoming Sessions"}</span>
            </h4>
            <Link
              to="/academic/sessions"
              className="text-[11px] font-bold text-[var(--brand)] hover:underline no-underline"
            >
              {isFarsi ? "مشاهده همه" : "View all"}
            </Link>
          </div>

          <div className="flex flex-col gap-3 my-3">
            <div className="bg-[var(--s3)]/80 border border-[var(--b)] rounded-2xl p-3 flex items-center justify-between gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-[var(--t1)] truncate">
                  {isFarsi ? "جلسه React پیشرفته" : "Advanced React Workshop"}
                </span>
                <span className="text-[10px] text-[var(--t3)] font-semibold mt-0.5">
                  {isFarsi ? "امروز • ۱۶:۰۰" : "Today • 16:00"}
                </span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center text-sm flex-shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-[var(--s3)]/80 border border-[var(--b)] rounded-2xl p-3 flex items-center justify-between gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-[var(--t1)] truncate">
                  {isFarsi ? "کارگاه طراحی UI/UX" : "UI/UX Design Masterclass"}
                </span>
                <span className="text-[10px] text-[var(--t3)] font-semibold mt-0.5">
                  {isFarsi ? "فردا • ۱۸:۰۰" : "Tomorrow • 18:00"}
                </span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-[var(--cyan)]/10 text-[var(--cyan)] flex items-center justify-center text-sm flex-shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Recent Homework */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-3xl p-5 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between border-b border-[var(--b)] pb-3">
            <h4 className="text-xs font-extrabold text-[var(--t1)] uppercase tracking-wider flex items-center gap-2">
              <span>📝</span>
              <span>{isFarsi ? "تکالیف اخیر" : "Recent Homework"}</span>
            </h4>
            <Link
              to="/academic/homework"
              className="text-[11px] font-bold text-[var(--brand)] hover:underline no-underline"
            >
              {isFarsi ? "مشاهده همه" : "View all"}
            </Link>
          </div>

          <div className="flex flex-col gap-3 my-3">
            <div className="bg-[var(--s3)]/80 border border-[var(--b)] rounded-2xl p-3 flex items-center justify-between gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-[var(--t1)] truncate">
                  {isFarsi ? "پروژه نهایی React" : "Final React Project"}
                </span>
                <span className="text-[10px] text-[var(--t3)] font-semibold mt-0.5">
                  {isFarsi ? "توسط محمد کریمی" : "By Mohammad Karimi"}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                {isFarsi ? "تحویل داده شده" : "Submitted"}
              </span>
            </div>

            <div className="bg-[var(--s3)]/80 border border-[var(--b)] rounded-2xl p-3 flex items-center justify-between gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-[var(--t1)] truncate">
                  {isFarsi ? "طراحی داشبورد ادمین" : "Admin Dashboard UI"}
                </span>
                <span className="text-[10px] text-[var(--t3)] font-semibold mt-0.5">
                  {isFarsi ? "توسط سارا احمدی" : "By Sara Ahmadi"}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 text-[10px] font-bold">
                {isFarsi ? "در انتظار بررسی" : "Pending"}
              </span>
            </div>
          </div>
        </div>

        {/* Column 3: Recent Members */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-3xl p-5 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between border-b border-[var(--b)] pb-3">
            <h4 className="text-xs font-extrabold text-[var(--t1)] uppercase tracking-wider flex items-center gap-2">
              <span>👥</span>
              <span>{isFarsi ? "اعضای جدید" : "Recent Members"}</span>
            </h4>
            <Link
              to="/crm/members"
              className="text-[11px] font-bold text-[var(--brand)] hover:underline no-underline"
            >
              {isFarsi ? "مشاهده همه" : "View all"}
            </Link>
          </div>

          <div className="flex flex-col gap-2.5 my-3">
            <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[var(--s3)]/50 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[var(--brand)]/20 border border-[var(--brand)]/30 text-[var(--brand)] font-bold text-xs flex items-center justify-center flex-shrink-0">
                  R
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[var(--t1)] truncate">
                    {isFarsi ? "رضا محمدی" : "Reza Mohammadi"}
                  </span>
                  <span className="text-[10px] text-[var(--t3)]">{isFarsi ? "دانشجو" : "Student"}</span>
                </div>
              </div>
              <span className="text-[10px] text-[var(--t3)] font-semibold">{isFarsi ? "امروز" : "Today"}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[var(--s3)]/50 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                  Z
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[var(--t1)] truncate">
                    {isFarsi ? "زهرا موسوی" : "Zahra Mousavi"}
                  </span>
                  <span className="text-[10px] text-[var(--t3)]">{isFarsi ? "استاد" : "Teacher"}</span>
                </div>
              </div>
              <span className="text-[10px] text-[var(--t3)] font-semibold">{isFarsi ? "دیروز" : "Yesterday"}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[var(--s3)]/50 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                  A
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[var(--t1)] truncate">
                    {isFarsi ? "علی حسینی" : "Ali Hosseini"}
                  </span>
                  <span className="text-[10px] text-[var(--t3)]">{isFarsi ? "دانشجو" : "Student"}</span>
                </div>
              </div>
              <span className="text-[10px] text-[var(--t3)] font-semibold">{isFarsi ? "۲ روز پیش" : "2d ago"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardView;


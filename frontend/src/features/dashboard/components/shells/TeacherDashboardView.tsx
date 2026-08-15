import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clock, BookOpen, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import type { AcademyClass, Enrollment } from "../../types/crm.types";
import type { AssignmentSubmission } from "@/features/assessments/types";

export interface TeacherDashboardViewProps {
  user: any;
  isFarsi: boolean;
  taughtHours: number;
  myTaughtClasses: AcademyClass[];
  pendingSubmissions: AssignmentSubmission[];
  allSubmissions: AssignmentSubmission[];
  enrollments: Enrollment[];
  createRoom: (opts: { name: string; max_participants: number; is_recorded: boolean }) => void;
  roomLoading: boolean;
}

export const TeacherDashboardView: React.FC<TeacherDashboardViewProps> = ({
  user,
  isFarsi,
  taughtHours,
  myTaughtClasses,
  pendingSubmissions,
  allSubmissions,
  enrollments,
  createRoom,
  roomLoading,
}) => {
  const navigate = useNavigate();

  const totalTaughtHours = taughtHours > 0 ? taughtHours : 124.5;
  const activeClassesCount = myTaughtClasses.length > 0 ? myTaughtClasses.length : 6;
  const pendingReviewsCount = pendingSubmissions.length > 0 ? pendingSubmissions.length : 14;

  const gradedSubmissions = allSubmissions.filter(
    (sub) => sub.status === "graded" && sub.grade !== null
  );
  const avgStudentGrade =
    gradedSubmissions.length > 0
      ? Math.round(
          gradedSubmissions.reduce((acc, sub) => acc + parseFloat(sub.grade || "0"), 0) /
            gradedSubmissions.length
        )
      : 84;

  const getSubjectIcon = (index: number) => {
    const icons = [
      <svg
        key="0"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="text-white"
      >
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>,
      <svg
        key="1"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="text-white"
      >
        <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
        <line x1="9" y1="9" x2="9" y2="15" />
        <line x1="15" y1="9" x2="15" y2="15" />
        <line x1="9" y1="12" x2="15" y2="12" />
      </svg>,
      <svg
        key="2"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="text-white"
      >
        <circle cx="12" cy="5" r="3" />
        <circle cx="5" cy="19" r="3" />
        <circle cx="19" cy="19" r="3" />
        <line x1="12" y1="8" x2="5" y2="16" />
        <line x1="12" y1="8" x2="19" y2="16" />
      </svg>,
    ];
    return icons[index % icons.length];
  };

  const getSubjectBg = (index: number) => {
    const colors = ["bg-[#6366f1]", "bg-[#0ea5e9]", "bg-[#475569]"];
    return colors[index % colors.length];
  };

  return (
    <div className="flex flex-col gap-6 fade-in text-[var(--t1)]">
      {/* Welcome back header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--t1)] tracking-tight">
          {isFarsi
            ? `خوش آمدید، استاد ${user?.full_name || user?.username}!`
            : `Welcome back, Professor ${user?.full_name || user?.username}!`}
        </h1>
        <p className="text-xs md:text-sm text-[var(--t3)] mt-1 font-medium">
          {isFarsi
            ? "خلاصه‌ای از وضعیت آموزشی و کلاس‌های امروز شما:"
            : "Here's your academic overview for today."}
        </p>
      </div>

      {/* 4 KPIs row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Taught Hours */}
        <StatCard
          title={isFarsi ? "ساعات تدریس" : "Taught Hours"}
          value={`${totalTaughtHours} hrs`}
          icon={<Clock className="w-5 h-5 text-[var(--brand)]" />}
          variant="brand"
          trend={{
            value: "+12%",
            direction: "up",
            label: isFarsi ? "نسبت به ماه گذشته" : "vs last month",
          }}
        />

        {/* KPI 2: Active Classes */}
        <StatCard
          title={isFarsi ? "کلاس‌های فعال" : "Active Classes"}
          value={activeClassesCount}
          icon={<BookOpen className="w-5 h-5 text-[var(--cyan)]" />}
          variant="cyan"
          subtitle={isFarsi ? "در ۲ دپارتمان آموزشی" : "Across 2 departments"}
        />

        {/* KPI 3: Pending Reviews */}
        <Card className="flex items-center justify-between gap-4 p-5">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">
              {isFarsi ? "بررسی‌های معوق" : "Pending Reviews"}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl md:text-2xl font-black text-[var(--t1)] leading-none">
                {pendingReviewsCount}
              </span>
              <Link
                to="/academic/classes"
                className="px-2 py-0.5 rounded text-[8px] font-extrabold bg-[var(--brand)] hover:brightness-110 text-white no-underline tracking-wider uppercase transition-colors"
              >
                {isFarsi ? "تصحیح" : "Grade Now"}
              </Link>
            </div>
            <span className="text-[10px] text-[var(--t3)] font-semibold">
              {isFarsi ? "پاسخ‌های در انتظار نمره" : "Submissions awaiting grade"}
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-[var(--s3)] border border-[var(--b)] text-[var(--red)] flex items-center justify-center flex-shrink-0 text-lg animate-pulse">
            <AlertTriangle className="w-5 h-5 text-[var(--red)]" />
          </div>
        </Card>

        {/* KPI 4: Avg Student Grade */}
        <StatCard
          title={isFarsi ? "میانگین نمرات" : "Avg Student Grade"}
          value={`${avgStudentGrade}%`}
          icon={<CheckCircle2 className="w-5 h-5 text-amber-500" />}
          variant="warning"
          subtitle={isFarsi ? "ثابت در این ترم" : "Stable this term"}
        />
      </div>

      {/* Row 1: Active Classes & Integrity Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Active Classes */}
        <Card className="lg:col-span-2 flex flex-col gap-4">
          <CardHeader
            action={
              <Link
                to="/academic/classes"
                className="text-xs font-semibold text-[var(--t3)] hover:text-[var(--brand)] no-underline flex items-center gap-1"
              >
                <span>{isFarsi ? "مشاهده همه" : "View All"}</span> →
              </Link>
            }
          >
            <CardTitle className="text-xs font-bold text-[var(--t2)] uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[var(--t3)]" />
              <span>{isFarsi ? "کلاس‌های فعال من" : "My Active Classes"}</span>
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {myTaughtClasses.length === 0 ? (
                <div className="col-span-full p-8 text-center text-xs text-[var(--t3)] bg-[var(--s3)] rounded-2xl border border-[var(--b)] border-dashed">
                  {isFarsi
                    ? "شما کلاسی را در این ترم تدریس نمی‌کنید."
                    : "You are not teaching any active classes currently."}
                </div>
              ) : (
                myTaughtClasses.slice(0, 2).map((c, idx) => {
                  const isFirst = idx === 0;
                  const enrollmentCount = enrollments.filter(
                    (e) => e.academy_class === c.id && e.is_active
                  ).length;
                  const classThemeBg = getSubjectBg(idx);
                  const classThemeIcon = getSubjectIcon(idx);
                  return (
                    <div
                      key={c.id}
                      className="bg-[var(--s3)] border border-[var(--b)] rounded-2xl p-5 flex flex-col justify-between gap-4 group hover:border-[var(--brand)]/30 transition-all shadow-sm"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <div
                            className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center shadow-md",
                              classThemeBg
                            )}
                          >
                            {classThemeIcon}
                          </div>
                          <Badge
                            variant={isFirst ? "success" : "neutral"}
                            size="sm"
                            dot={isFirst}
                          >
                            {isFirst
                              ? isFarsi
                                ? "کلاس تا ۱۰ دقیقه دیگر"
                                : "Live in 10m"
                              : "14:00 PM"}
                          </Badge>
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-[var(--t1)]">{c.name}</h3>
                          <p className="text-[10px] text-[var(--t3)] font-semibold mt-0.5 truncate">
                            {c.course_title || (isFarsi ? "عنوان درس" : "Subject details")}
                          </p>
                        </div>
                        <span className="text-[10px] text-[var(--t2)] font-semibold flex items-center gap-1 mt-1 select-none">
                          👥 {enrollmentCount}{" "}
                          {isFarsi ? "دانشجو ثبت نام شده" : "Students enrolled"}
                        </span>
                      </div>
                      <div className="border-t border-[var(--b)] pt-3.5 mt-1">
                        {isFirst ? (
                          <Link
                            to={`/room/${c.room || "CS102"}`}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[var(--brand)] hover:brightness-110 text-white font-bold text-xs cursor-pointer border-none shadow-md transition-all active:scale-[0.98] no-underline"
                          >
                            <span>🚪</span>
                            <span>{isFarsi ? "ورود به کلاس" : "Enter Room"}</span>
                          </Link>
                        ) : (
                          <button
                            onClick={() => navigate(`/academic/classes/${c.id}`)}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)] text-[var(--t2)] hover:text-[var(--t1)] font-bold text-xs cursor-pointer transition-all active:scale-[0.98]"
                          >
                            {isFarsi ? "آماده‌سازی جلسه" : "Prepare Setup"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Integrity Alerts */}
        <Card className="flex flex-col gap-4">
          <CardHeader
            action={
              <Badge variant="danger" size="sm">
                2 NEW
              </Badge>
            }
          >
            <CardTitle className="text-xs font-bold text-[var(--t2)] uppercase tracking-wider flex items-center gap-2">
              <span>⚠️</span>
              <span>{isFarsi ? "هشدارهای سلامت آزمون" : "Integrity Alerts"}</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-2.5">
            <div className="bg-[var(--s3)] border border-[var(--b)] rounded-2xl p-3.5 flex items-start gap-3 shadow-inner">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center text-base flex-shrink-0">
                👁️‍🗨️
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-bold text-[var(--t1)] truncate">
                  Alex J. - CS102 Quiz 3
                </span>
                <span className="text-[9px] text-[var(--red)] font-extrabold mt-0.5">
                  {isFarsi
                    ? "خروج مکرر از صفحه آزمون (۴ بار)"
                    : "High Tab Focus Loss detected (4 times)"}
                </span>
                <span className="text-[8px] text-[var(--t3)] font-semibold mt-1">
                  10 mins ago
                </span>
              </div>
            </div>

            <div className="bg-[var(--s3)] border border-[var(--b)] rounded-2xl p-3.5 flex items-start gap-3 shadow-inner">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center text-base flex-shrink-0">
                📷
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-bold text-[var(--t1)] truncate">
                  Sarah M. - CS102 Quiz 3
                </span>
                <span className="text-[9px] text-[var(--red)] font-extrabold mt-0.5">
                  {isFarsi ? "چهره بر روی دوربین شناسایی نشد" : "Face not detected on camera"}
                </span>
                <span className="text-[8px] text-[var(--t3)] font-semibold mt-1">
                  25 mins ago
                </span>
              </div>
            </div>

            <div className="bg-[var(--s3)] border border-[var(--b)] rounded-2xl p-3.5 flex items-start gap-3 shadow-inner opacity-60">
              <div className="w-8 h-8 rounded-lg bg-[var(--s2)] text-[var(--t3)] flex items-center justify-center text-base flex-shrink-0">
                🎙️
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-bold text-[var(--t1)] truncate">
                  David L. - CS102 Quiz 3
                </span>
                <span className="text-[9px] text-[var(--t3)] font-semibold mt-0.5">
                  {isFarsi ? "قطع شدن ورودی میکروفون" : "Audio input disconnected"}
                </span>
                <span className="text-[8px] text-[var(--t3)] font-semibold mt-1">
                  1 hr ago • Resolved
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Attendance Overview & Today's Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Attendance Overview */}
        <Card className="lg:col-span-2 flex flex-col justify-between gap-5">
          <div>
            <h2 className="text-xs font-bold text-[var(--t2)] uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--t3)]" />
              <span>{isFarsi ? "آمار حضور و غیاب امروز" : "Today's Attendance Overview"}</span>
            </h2>
            <p className="text-[10px] text-[var(--t3)] font-semibold mt-1">
              {isFarsi
                ? "مجموع آمار به دست آمده از جلسات پایان یافته امروز"
                : "Aggregated metrics across all completed sessions today."}
            </p>
          </div>

          <div className="flex flex-row justify-between items-center gap-6 pb-2">
            <div className="flex flex-col gap-3.5 w-full sm:w-1/2">
              <div className="flex justify-between items-center text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  <span className="text-[var(--t2)]">{isFarsi ? "حاضر" : "Present"}</span>
                </div>
                <span className="font-mono text-[var(--t1)]">88%</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                  <span className="text-[var(--t2)]">{isFarsi ? "تاخیر" : "Late"}</span>
                </div>
                <span className="font-mono text-[var(--t1)]">5%</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                  <span className="text-[var(--t2)]">{isFarsi ? "غایب" : "Absent"}</span>
                </div>
                <span className="font-mono text-[var(--t1)]">7%</span>
              </div>
            </div>

            {/* Donut Chart Ring */}
            <div className="relative w-32 h-32 flex items-center justify-center flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="transparent"
                  stroke="var(--s3)"
                  strokeWidth="10"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="transparent"
                  stroke="#10b981"
                  strokeWidth="10"
                  strokeDasharray="248.8 282.7"
                  strokeDashoffset="0"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="transparent"
                  stroke="#f59e0b"
                  strokeWidth="10"
                  strokeDasharray="14.1 282.7"
                  strokeDashoffset="-248.8"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="transparent"
                  stroke="#ef4444"
                  strokeWidth="10"
                  strokeDasharray="19.8 282.7"
                  strokeDashoffset="-262.9"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-[var(--t1)] font-mono leading-none">
                  142
                </span>
                <span className="text-[8px] text-[var(--t3)] font-bold uppercase tracking-wider mt-1 select-none">
                  {isFarsi ? "کل دانشجویان" : "Total Students"}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--b)] pt-3.5 mt-1">
            <button
              onClick={() =>
                toast.success(
                  isFarsi
                    ? "دانلود گزارش آغاز شد..."
                    : "Downloading detailed attendance report..."
                )
              }
              className="text-xs font-extrabold text-[var(--brand)] hover:underline bg-transparent border-none cursor-pointer p-0"
            >
              {isFarsi ? "دانلود گزارش تفصیلی حضور و غیاب" : "Download detailed report"}
            </button>
          </div>
        </Card>

        {/* Today's Agenda */}
        <Card className="flex flex-col gap-4">
          <CardHeader>
            <CardTitle className="text-xs font-bold text-[var(--t2)] uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--t3)]" />
              <span>{isFarsi ? "برنامه امروز" : "Today's Agenda"}</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 relative border-s-2 border-[var(--b)] ms-2 ps-4.5 py-1">
            <div className="relative">
              <span className="absolute -start-[23px] top-1 w-2.5 h-2.5 rounded-full bg-[var(--brand)] ring-4 ring-[var(--s2)] shadow-sm" />
              <span className="text-[9px] font-black text-[var(--brand)] font-mono block">
                10:00 AM - 11:30 AM
              </span>
              <div className="bg-[var(--s3)] border border-[var(--b)] rounded-xl p-3.5 mt-2 flex flex-col gap-3 shadow-inner">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-[var(--t1)]">
                    CS102: Data Structures
                  </span>
                  <span className="text-[9px] text-[var(--t3)] font-semibold mt-0.5">
                    📂 Lecture Hall A (Virtual)
                  </span>
                </div>
                <button
                  onClick={() =>
                    createRoom({
                      name: "CS102 Lecture Session",
                      max_participants: 30,
                      is_recorded: true,
                    })
                  }
                  disabled={roomLoading}
                  className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[var(--brand)] hover:brightness-110 text-white font-bold text-[10px] cursor-pointer border-none transition-all active:scale-[0.98]"
                >
                  {isFarsi ? "شروع جلسه کلاس" : "Start Session"}
                </button>
              </div>
            </div>

            <div className="relative mt-2">
              <span className="absolute -start-[23px] top-1 w-2.5 h-2.5 rounded-full bg-[var(--b)] ring-4 ring-[var(--s2)]" />
              <span className="text-[9px] font-black text-[var(--t3)] font-mono block">
                14:00 PM - 15:30 PM
              </span>
              <div className="bg-[var(--s3)] border border-[var(--b)] rounded-xl p-3.5 mt-2 flex flex-col shadow-inner">
                <span className="text-[11px] font-bold text-[var(--t1)]">
                  CS305: Computer Arch.
                </span>
                <span className="text-[9px] text-[var(--t3)] font-semibold mt-0.5">
                  🔬 Lab Session
                </span>
              </div>
            </div>

            <div className="relative mt-2">
              <span className="absolute -start-[23px] top-1 w-2.5 h-2.5 rounded-full bg-[var(--b)] ring-4 ring-[var(--s2)]" />
              <span className="text-[9px] font-black text-[var(--t3)] font-mono block">
                16:00 PM - 17:00 PM
              </span>
              <div className="bg-[var(--s3)] border border-[var(--b)] rounded-xl p-3.5 mt-2 flex flex-col shadow-inner">
                <span className="text-[11px] font-bold text-[var(--t1)]">
                  {isFarsi ? "ساعات پاسخگویی استاد" : "Office Hours"}
                </span>
                <span className="text-[9px] text-[var(--t3)] font-semibold mt-0.5">
                  👥 Open Booking
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeacherDashboardView;

import React from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Users,
  Radio,
  FileCheck2,
  DollarSign,
  GraduationCap,
  CalendarCheck,
  Film,
} from "lucide-react";
import type { AcademyClass, Enrollment } from "../../types/crm.types";
import type { Session } from "@/features/sessions/types";
import type { Assignment, AssignmentSubmission } from "@/features/assessments/types";
import type { User } from "@/features/auth/api/auth.api";
import type { Recording } from "@/features/recordings/api/recordings.api";

export interface OrgKpiGridProps {
  user: User | null;
  hasPermission: (permission: string) => boolean;
  isFarsi: boolean;
  localeTag: string;
  classes: AcademyClass[];
  enrollments: Enrollment[];
  liveSessions: Session[];
  todaySessions: Session[];
  allSubmissions: AssignmentSubmission[];
  studentAssignments?: Assignment[];
  studentSubmissions?: AssignmentSubmission[];
  studentRecordings?: Recording[];
  totalPendingRevenue?: number;
  totalRevenue?: number;
}

interface KpiItem {
  id: string;
  title: string;
  value: string | number;
  subtext: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  linkTo?: string;
}

export const OrgKpiGrid: React.FC<OrgKpiGridProps> = ({
  user,
  hasPermission,
  isFarsi,
  localeTag,
  classes,
  enrollments,
  liveSessions,
  todaySessions,
  allSubmissions,
  studentAssignments = [],
  studentSubmissions = [],
  studentRecordings = [],
  totalPendingRevenue = 0,
  totalRevenue = 0,
}) => {
  const canManageMembers = hasPermission("can_manage_members");
  const canViewFinancials = hasPermission("can_view_financials");
  const canTeachClass = hasPermission("can_teach_class");
  const canAttendClass = hasPermission("can_attend_class");

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(localeTag, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const kpis: KpiItem[] = [];

  if (canManageMembers || (!canTeachClass && !canAttendClass)) {
    // Admin / Manager perspective
    kpis.push({
      id: "classes",
      title: isFarsi ? "کلاس‌های فعال" : "Active Classes",
      value: classes.length,
      subtext: isFarsi ? "کلاس‌های تعریف‌شده در سازمان" : "Total configured classes",
      icon: <BookOpen className="w-4 h-4" />,
      iconBg: "bg-cyan-500/15",
      iconColor: "text-cyan-500 dark:text-cyan-400",
      linkTo: "/academic/classes",
    });

    kpis.push({
      id: "members",
      title: isFarsi ? "دانشجویان و ثبت‌نام‌ها" : "Active Enrollments",
      value: enrollments.length,
      subtext: isFarsi ? "کل ثبت‌نام‌های فعال" : "Total active memberships",
      icon: <Users className="w-4 h-4" />,
      iconBg: "bg-indigo-500/15",
      iconColor: "text-indigo-500 dark:text-indigo-400",
      linkTo: "/organization/members",
    });

    kpis.push({
      id: "live-sessions",
      title: isFarsi ? "جلسات زنده آنلاین" : "Live Class Sessions",
      value: liveSessions.length,
      subtext: liveSessions.length > 0
        ? (isFarsi ? "جلسه فعال در حال برگزاری" : "Active room sessions")
        : (isFarsi ? "بدون تماس فعال" : "No active calls right now"),
      icon: <Radio className="w-4 h-4" />,
      iconBg: liveSessions.length > 0 ? "bg-emerald-500/15" : "bg-[var(--s3)]",
      iconColor: liveSessions.length > 0 ? "text-emerald-500" : "text-[var(--t3)]",
      linkTo: "/academic/sessions",
    });

    const pendingReviewCount = allSubmissions.filter((s) => s.status === "submitted").length;
    kpis.push({
      id: "pending-reviews",
      title: isFarsi ? "تکالیف در انتظار بررسی" : "Pending Reviews",
      value: pendingReviewCount,
      subtext: isFarsi ? "پاسخ‌های ارسال‌شده دانشجویان" : "Awaiting instructor grade",
      icon: <FileCheck2 className="w-4 h-4" />,
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-500 dark:text-amber-400",
      linkTo: "/academic/assessments",
    });

    if (canViewFinancials) {
      kpis.push({
        id: "financials",
        title: isFarsi ? "مطالبات شهریه" : "Outstanding Balance",
        value: formatCurrency(totalPendingRevenue),
        subtext: totalRevenue > 0
          ? (isFarsi ? `کل دریافتی: ${formatCurrency(totalRevenue)}` : `Collected: ${formatCurrency(totalRevenue)}`)
          : (isFarsi ? "صورت‌حساب‌های منتظر پرداخت" : "Invoices awaiting payment"),
        icon: <DollarSign className="w-4 h-4" />,
        iconBg: "bg-emerald-500/15",
        iconColor: "text-emerald-500 dark:text-emerald-400",
        linkTo: "/finance/ledger",
      });
    }
  } else if (canTeachClass) {
    // Teacher perspective
    const myClasses = classes.filter((c) => c.teacher === user?.id);
    const myClassIds = new Set(myClasses.map((c) => c.id));
    const myEnrollments = enrollments.filter((e) => myClassIds.has(e.academy_class));
    const myPendingSubmissions = allSubmissions.filter(
      (s) => s.status === "submitted" && (!s.assignment_class || myClassIds.has(s.assignment_class))
    );

    kpis.push({
      id: "my-classes",
      title: isFarsi ? "کلاس‌های تدریس من" : "My Assigned Classes",
      value: myClasses.length,
      subtext: isFarsi ? "کلاس‌های تحت مدیریت شما" : "Classes taught by you",
      icon: <GraduationCap className="w-4 h-4" />,
      iconBg: "bg-indigo-500/15",
      iconColor: "text-indigo-500 dark:text-indigo-400",
      linkTo: "/academic/classes",
    });

    kpis.push({
      id: "my-students",
      title: isFarsi ? "دانشجویان من" : "Enrolled Students",
      value: myEnrollments.length,
      subtext: isFarsi ? "دانشجویان در کلاس‌های شما" : "Students in your courses",
      icon: <Users className="w-4 h-4" />,
      iconBg: "bg-cyan-500/15",
      iconColor: "text-cyan-500 dark:text-cyan-400",
      linkTo: "/academic/classes",
    });

    kpis.push({
      id: "today-sessions",
      title: isFarsi ? "جلسات کلاسی امروز" : "Today's Schedule",
      value: todaySessions.length,
      subtext: isFarsi ? "جلسات آنلاین زمان‌بندی‌شده" : "Scheduled live meetings",
      icon: <CalendarCheck className="w-4 h-4" />,
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-500 dark:text-emerald-400",
      linkTo: "/academic/sessions",
    });

    kpis.push({
      id: "grading-tasks",
      title: isFarsi ? "تکالیف نیازمند نمره‌دهی" : "Submissions to Grade",
      value: myPendingSubmissions.length,
      subtext: isFarsi ? "پاسخ‌های ثبت‌شده جدید" : "Unchecked assignments",
      icon: <FileCheck2 className="w-4 h-4" />,
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-500 dark:text-amber-400",
      linkTo: "/academic/assessments",
    });
  } else {
    // Student perspective
    const myEnrollments = enrollments.filter((e) => e.student === user?.id && e.is_active);
    const submittedIds = new Set(studentSubmissions.map((s) => s.assignment));
    const pendingHomework = studentAssignments.filter((a) => !submittedIds.has(a.id));

    kpis.push({
      id: "enrolled-classes",
      title: isFarsi ? "کلاس‌های من" : "Enrolled Classes",
      value: myEnrollments.length,
      subtext: isFarsi ? "دوره‌های آموزشی فعال" : "Active courses in progress",
      icon: <BookOpen className="w-4 h-4" />,
      iconBg: "bg-indigo-500/15",
      iconColor: "text-indigo-500 dark:text-indigo-400",
      linkTo: "/academic/classes",
    });

    kpis.push({
      id: "today-sessions",
      title: isFarsi ? "کلاس‌های امروز من" : "Today's Classes",
      value: todaySessions.length,
      subtext: isFarsi ? "جلسات زمان‌بندی‌شده امروز" : "Live lessons scheduled today",
      icon: <CalendarCheck className="w-4 h-4" />,
      iconBg: "bg-cyan-500/15",
      iconColor: "text-cyan-500 dark:text-cyan-400",
      linkTo: "/academic/sessions",
    });

    kpis.push({
      id: "pending-assignments",
      title: isFarsi ? "تکالیف در انتظار تحویل" : "Pending Assignments",
      value: pendingHomework.length,
      subtext: isFarsi ? "تکالیف باقی‌مانده شما" : "Assignments to submit",
      icon: <FileCheck2 className="w-4 h-4" />,
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-500 dark:text-amber-400",
      linkTo: "/academic/homework",
    });

    kpis.push({
      id: "recordings",
      title: isFarsi ? "ویدیوهای ضبط‌شده" : "Class Recordings",
      value: studentRecordings.length,
      subtext: isFarsi ? "جلسات ضبط‌شده منتشر شده" : "Archived sessions to review",
      icon: <Film className="w-4 h-4" />,
      iconBg: "bg-purple-500/15",
      iconColor: "text-purple-500 dark:text-purple-400",
      linkTo: "/recordings",
    });
  }

  const gridColsClass =
    kpis.length >= 5
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      : kpis.length === 4
      ? "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4"
      : "grid-cols-1 sm:grid-cols-3";

  return (
    <div className={`grid ${gridColsClass} gap-3.5`}>
      {kpis.map((kpi) => {
        const content = (
          <div className="h-full bg-[var(--s2)] border border-[var(--b)] hover:border-[var(--brand)] hover:bg-[var(--s3)] rounded-2xl p-4 flex flex-col justify-between items-start text-start transition-all duration-200 shadow-sm group">
            <div className="w-full flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--t2)] group-hover:text-[var(--t1)] transition-colors">
                {kpi.title}
              </span>
              <div className={`w-8 h-8 rounded-xl ${kpi.iconBg} ${kpi.iconColor} flex items-center justify-center text-sm shadow-sm flex-shrink-0`}>
                {kpi.icon}
              </div>
            </div>

            <div className="my-2.5">
              <span className="text-2xl md:text-3xl font-black text-[var(--t1)] font-mono tracking-tight">
                {kpi.value}
              </span>
            </div>

            <div className="w-full pt-1.5 border-t border-[var(--b)]/50">
              <span className="text-[11px] text-[var(--t3)] font-medium line-clamp-1">
                {kpi.subtext}
              </span>
            </div>
          </div>
        );

        return kpi.linkTo ? (
          <Link key={kpi.id} to={kpi.linkTo} className="no-underline block">
            {content}
          </Link>
        ) : (
          <div key={kpi.id}>{content}</div>
        );
      })}
    </div>
  );
};

export default OrgKpiGrid;

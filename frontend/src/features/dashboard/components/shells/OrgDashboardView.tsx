import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, Users, ArrowLeft, ArrowRight, Video, Plus } from "lucide-react";
import Button from "@/components/ui/Button";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import OrgWelcomeBanner from "../widgets/OrgWelcomeBanner";
import OrgKpiGrid from "../widgets/OrgKpiGrid";
import OrgSetupGuide from "../widgets/OrgSetupGuide";
import OrgScheduleWidget from "../widgets/OrgScheduleWidget";
import OrgActionCenter from "../widgets/OrgActionCenter";
import OrgFinanceSnapshot from "../widgets/OrgFinanceSnapshot";
import type { Course, AcademyClass, Enrollment, FinanceSummary, TuitionInvoice } from "../../types/crm.types";
import type { Session } from "@/features/sessions/types";
import type { Assignment, AssignmentSubmission } from "@/features/assessments/types";

export interface OrgDashboardViewProps {
  user: any;
  activeOrg: any;
  activeRole: string | null;
  hasPermission: (permission: string) => boolean;
  isFarsi: boolean;
  localeTag: string;
  courses: Course[];
  classes: AcademyClass[];
  enrollments: Enrollment[];
  summaryData?: FinanceSummary | null;
  liveSessions: Session[];
  allSessions: Session[];
  todaySessions: Session[];
  allSubmissions: AssignmentSubmission[];
  studentAssignments?: Assignment[];
  studentSubmissions?: AssignmentSubmission[];
  studentRecordings?: any[];
  recentInvoicesData?: { results?: TuitionInvoice[] } | null;
}

export const OrgDashboardView: React.FC<OrgDashboardViewProps> = ({
  user,
  activeOrg,
  activeRole,
  hasPermission,
  isFarsi,
  localeTag,
  courses,
  classes,
  enrollments,
  summaryData,
  liveSessions,
  todaySessions,
  allSubmissions,
  studentAssignments = [],
  studentSubmissions = [],
  studentRecordings = [],
  recentInvoicesData,
}) => {
  const canManageMembers = hasPermission("can_manage_members");
  const canTeachClass = hasPermission("can_teach_class");
  const canViewFinancials = hasPermission("can_view_financials");

  const isBrandNewOrg =
    courses.length === 0 &&
    classes.length === 0 &&
    (activeRole === "owner" || activeRole === "admin" || canManageMembers);

  // Relevant classes to display in the academic list
  const displayedClasses = canTeachClass && !canManageMembers
    ? classes.filter((c) => c.teacher === user?.id)
    : classes;

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 py-4 flex flex-col gap-6 fade-in text-[var(--t1)]">
      {/* 1. Standardized Unified Header Banner */}
      <OrgWelcomeBanner
        user={user}
        activeOrg={activeOrg}
        activeRole={activeRole}
        isFarsi={isFarsi}
        localeTag={localeTag}
      />

      {/* 2. Onboarding Setup Checklist (Shown only for brand new orgs with 0 courses/classes) */}
      {isBrandNewOrg && (
        <OrgSetupGuide
          isFarsi={isFarsi}
          hasCourses={courses.length > 0}
          hasClasses={classes.length > 0}
          hasMembers={enrollments.length > 0}
          hasBranding={!!activeOrg?.logo || !!activeOrg?.branding?.slogan}
        />
      )}

      {/* 3. Real-Data KPI Metrics Grid (Role & Permission Adapted) */}
      <OrgKpiGrid
        user={user}
        hasPermission={hasPermission}
        isFarsi={isFarsi}
        localeTag={localeTag}
        classes={classes}
        enrollments={enrollments}
        liveSessions={liveSessions}
        todaySessions={todaySessions}
        allSubmissions={allSubmissions}
        studentAssignments={studentAssignments}
        studentSubmissions={studentSubmissions}
        studentRecordings={studentRecordings}
        totalPendingRevenue={summaryData?.outstanding || 0}
        totalRevenue={summaryData?.revenue || 0}
      />

      {/* 4. Main Two-Column Content Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Today's Schedule + Active Classes List (8 Cols on Desktop) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
          {/* Today's Schedule & Live Rooms */}
          <OrgScheduleWidget
            todaySessions={todaySessions}
            isFarsi={isFarsi}
            localeTag={localeTag}
          />

          {/* Active Classes & Courses Overview Card */}
          <Card className="flex flex-col">
            <CardHeader
              action={
                <Link
                  to="/academic/classes"
                  className="text-xs font-bold text-[var(--t3)] hover:text-[var(--brand)] no-underline flex items-center gap-1 transition-colors"
                >
                  <span>{isFarsi ? "مشاهده همه کلاس‌ها" : "View All Classes"}</span>
                  {isFarsi ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                </Link>
              }
            >
              <CardTitle className="text-xs font-bold text-[var(--t2)] uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[var(--brand)]" />
                <span>
                  {canTeachClass && !canManageMembers
                    ? (isFarsi ? "کلاس‌های تدریس من" : "My Teaching Classes")
                    : (isFarsi ? "کلاس‌های آموزشی فعال" : "Active Academic Classes")}
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent>
              {displayedClasses.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--t3)] space-y-3">
                  <div className="w-10 h-10 rounded-2xl bg-[var(--s2)] border border-[var(--b)] mx-auto flex items-center justify-center text-lg">
                    📚
                  </div>
                  <p>{isFarsi ? "هنوز کلاسی در این آکادمی ایجاد نشده است." : "No academic classes created yet."}</p>
                  {canManageMembers && (
                    <Link to="/academic/classes" className="no-underline inline-block">
                      <Button size="sm" variant="secondary" className="text-xs font-bold gap-1">
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isFarsi ? "ایجاد اولین کلاس" : "Create First Class"}</span>
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-[var(--b)]/60">
                  {displayedClasses.slice(0, 5).map((cls) => {
                    const classEnrollmentsCount = enrollments.filter((e) => e.academy_class === cls.id).length;
                    return (
                      <div
                        key={cls.id}
                        className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group transition-colors"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/academic/classes/${cls.id}`}
                              className="text-xs sm:text-sm font-bold text-[var(--t1)] hover:text-[var(--brand)] transition-colors truncate no-underline"
                            >
                              {cls.name}
                            </Link>
                            {cls.course_title && (
                              <span className="px-2 py-0.5 rounded-full bg-[var(--s3)] text-[var(--t3)] text-[10px] font-medium truncate max-w-[150px]">
                                {cls.course_title}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--t3)] font-medium">
                            {cls.teacher_name && (
                              <span>
                                {isFarsi ? `استاد: ${cls.teacher_name}` : `Teacher: ${cls.teacher_name}`}
                              </span>
                            )}
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-[var(--brand)]" />
                              <span>
                                {isFarsi
                                  ? `${classEnrollmentsCount} دانشجو`
                                  : `${classEnrollmentsCount} students`}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <Link to={`/academic/classes/${cls.id}`} className="no-underline">
                            <Button size="sm" variant="secondary" className="text-xs font-bold">
                              <span>{isFarsi ? "مشاهده کلاس" : "View"}</span>
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Action Center & Financial Overview (4-5 Cols on Desktop) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
          {/* Action Center (Tasks, Pending reviews, upcoming assignments) */}
          <OrgActionCenter
            hasPermission={hasPermission}
            isFarsi={isFarsi}
            localeTag={localeTag}
            pendingSubmissions={allSubmissions.filter((s) => s.status === "submitted")}
            studentAssignments={studentAssignments}
            studentSubmissions={studentSubmissions}
            studentRecordings={studentRecordings}
          />

          {/* Financial Snapshot (Only rendered for users with financial permissions) */}
          {canViewFinancials && (
            <OrgFinanceSnapshot
              isFarsi={isFarsi}
              localeTag={localeTag}
              summaryData={summaryData}
              recentInvoicesData={recentInvoicesData}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default OrgDashboardView;

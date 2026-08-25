import React from "react";
import { Link } from "react-router-dom";
import {
  FileCheck2,
  FileText,
  Calendar,
  Film,
  Plus,
  Video,
  ArrowLeft,
  ArrowRight,
  Clock,
  CheckCircle,
} from "lucide-react";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { Assignment, AssignmentSubmission } from "@/features/assessments/types";

export interface OrgActionCenterProps {
  hasPermission: (permission: string) => boolean;
  isFarsi: boolean;
  localeTag: string;
  pendingSubmissions: AssignmentSubmission[];
  studentAssignments?: Assignment[];
  studentSubmissions?: AssignmentSubmission[];
  studentRecordings?: any[];
}

export const OrgActionCenter: React.FC<OrgActionCenterProps> = ({
  hasPermission,
  isFarsi,
  localeTag,
  pendingSubmissions,
  studentAssignments = [],
  studentSubmissions = [],
  studentRecordings = [],
}) => {
  const canTeachClass = hasPermission("can_teach_class");
  const canManageMembers = hasPermission("can_manage_members");
  const isTeacherOrAdmin = canTeachClass || canManageMembers;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(localeTag, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const submittedIds = new Set(studentSubmissions.map((s) => s.assignment));
  const pendingStudentAssignments = studentAssignments.filter((a) => !submittedIds.has(a.id));

  return (
    <Card className="flex flex-col h-full space-y-4">
      <CardHeader
        action={
          <Link
            to={isTeacherOrAdmin ? "/academic/assessments" : "/academic/homework"}
            className="text-xs font-bold text-[var(--t3)] hover:text-[var(--brand)] no-underline flex items-center gap-1 transition-colors"
          >
            <span>{isFarsi ? "مشاهده همه" : "View All"}</span>
            {isFarsi ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          </Link>
        }
      >
        <CardTitle className="text-xs font-bold text-[var(--t2)] uppercase tracking-wider flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-[var(--brand)]" />
          <span>
            {isTeacherOrAdmin
              ? (isFarsi ? "تکالیف در انتظار بررسی و نمره‌دهی" : "Submissions to Grade")
              : (isFarsi ? "تکالیف و مهلت‌های پیش‌رو" : "Pending Assignments")}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between space-y-4">
        {isTeacherOrAdmin ? (
          // Teacher / Admin list: Pending Submissions from Students
          pendingSubmissions.length === 0 ? (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-2 text-[var(--t3)]">
              <div className="w-10 h-10 rounded-xl bg-[var(--green)]/15 text-[var(--green)] flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-[var(--t2)]">
                {isFarsi ? "همه تکالیف بررسی شده‌اند!" : "All submissions are graded!"}
              </h4>
              <p className="text-[11px] text-[var(--t3)]">
                {isFarsi ? "پاسخ ارسالی جدیدی در انتظار نمره‌دهی نیست." : "No new submissions waiting for review."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--b)]/60">
              {pendingSubmissions.slice(0, 4).map((sub) => (
                <div key={sub.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--t1)] truncate">
                        {sub.student_name || sub.student_username || (isFarsi ? "دانشجو" : "Student")}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-[var(--amber)]/15 text-[var(--amber)] text-[10px] font-semibold">
                        {isFarsi ? "منتظر نمره" : "Submitted"}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--t3)] truncate">
                      {sub.assignment_title || (isFarsi ? "تکلیف کلاسی" : "Assignment")}
                    </div>
                  </div>

                  <Link to="/academic/assessments" className="no-underline shrink-0">
                    <Button size="sm" variant="secondary" className="text-xs font-bold px-3 py-1">
                      {isFarsi ? "نمره‌دهی" : "Grade"}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )
        ) : (
          // Student list: Pending Assignments to Submit
          pendingStudentAssignments.length === 0 ? (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-2 text-[var(--t3)]">
              <div className="w-10 h-10 rounded-xl bg-[var(--green)]/15 text-[var(--green)] flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-[var(--t2)]">
                {isFarsi ? "تکلیف معوقه‌ای ندارید!" : "No pending assignments!"}
              </h4>
              <p className="text-[11px] text-[var(--t3)]">
                {isFarsi ? "تمام تکالیف محول‌شده را ارسال کرده‌اید." : "You are up to date on all class assignments."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--b)]/60">
              {pendingStudentAssignments.slice(0, 4).map((assignment) => (
                <div key={assignment.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="text-xs font-bold text-[var(--t1)] truncate">
                      {assignment.title}
                    </div>
                    {assignment.due_date && (
                      <div className="flex items-center gap-1 text-[11px] text-[var(--amber)]">
                        <Clock className="w-3 h-3" />
                        <span>{isFarsi ? `مهلت: ${formatDate(assignment.due_date)}` : `Due: ${formatDate(assignment.due_date)}`}</span>
                      </div>
                    )}
                  </div>

                  <Link to="/academic/homework" className="no-underline shrink-0">
                    <Button size="sm" variant="primary" className="text-xs font-bold px-3 py-1">
                      {isFarsi ? "ارسال پاسخ" : "Submit"}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )
        )}

        {/* Quick Shortcuts Pill Row */}
        <div className="pt-3 border-t border-[var(--b)]/60 flex flex-wrap gap-2">
          {isTeacherOrAdmin ? (
            <>
              <Link to="/academic/classes" className="no-underline flex-1 min-w-[120px]">
                <Button size="sm" variant="secondary" className="w-full text-xs font-bold gap-1.5 justify-center">
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isFarsi ? "تعریف کلاس" : "New Class"}</span>
                </Button>
              </Link>
              <Link to="/academic/courses" className="no-underline flex-1 min-w-[120px]">
                <Button size="sm" variant="secondary" className="w-full text-xs font-bold gap-1.5 justify-center">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{isFarsi ? "دوره‌ها" : "Courses"}</span>
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/recordings" className="no-underline flex-1 min-w-[120px]">
                <Button size="sm" variant="secondary" className="w-full text-xs font-bold gap-1.5 justify-center">
                  <Film className="w-3.5 h-3.5" />
                  <span>{isFarsi ? "آرشیو جلسات" : "Recordings"}</span>
                </Button>
              </Link>
              <Link to="/academic/sessions" className="no-underline flex-1 min-w-[120px]">
                <Button size="sm" variant="secondary" className="w-full text-xs font-bold gap-1.5 justify-center">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{isFarsi ? "تقویم کلاس‌ها" : "Schedule"}</span>
                </Button>
              </Link>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OrgActionCenter;

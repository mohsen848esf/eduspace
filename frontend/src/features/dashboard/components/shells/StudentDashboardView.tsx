import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Video, BookOpen, Clock, ChevronRight } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { getBezierPath } from "../../utils/chart.utils";
import type { Session } from "@/features/sessions/types";
import type { Assignment, AssignmentSubmission } from "@/features/assessments/types";

export interface StudentDashboardViewProps {
  user: any;
  isFarsi: boolean;
  localeTag: string;
  todaySessions: Session[];
  pendingAssignments: Assignment[];
  gradedAssignmentSubmissions: AssignmentSubmission[];
  studentRecordings: any[];
  calculatedGPA: string;
  studyStreak: number;
  semesterProgress: number;
}

export const StudentDashboardView: React.FC<StudentDashboardViewProps> = ({
  user,
  isFarsi,
  localeTag,
  todaySessions,
  pendingAssignments,
  gradedAssignmentSubmissions,
  studentRecordings,
  calculatedGPA,
  studyStreak,
  semesterProgress,
}) => {
  const getDueHours = (dueDateStr?: string | null) => {
    if (!dueDateStr) return 24;
    const diff = new Date(dueDateStr).getTime() - Date.now();
    const hrs = Math.ceil(diff / 3600000);
    return hrs > 0 ? hrs : 0;
  };

  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString(localeTag, { month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col gap-6 fade-in text-[var(--t1)]">
      {/* Welcome back header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--t1)] tracking-tight">
            {isFarsi
              ? `خوش آمدی، ${user?.full_name?.split(" ")[0] || user?.username}`
              : `Welcome back, ${user?.full_name?.split(" ")[0] || user?.username}.`}
          </h1>
          <p className="text-xs md:text-sm text-[var(--t3)] mt-1 font-medium">
            {isFarsi
              ? `امروز شما ${todaySessions.length} کلاس و ${pendingAssignments.length} مهلت تحویل دارید.`
              : `You have ${todaySessions.length} classes today and ${pendingAssignments.length} upcoming deadlines.`}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* GPA capsule */}
          <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--s2)] border border-[var(--b)] text-xs text-[var(--t1)] font-bold shadow-sm">
            <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-[10px] font-black">
              ✓
            </span>
            <span>{isFarsi ? `معدل کل ${calculatedGPA}` : `Current GPA ${calculatedGPA}`}</span>
          </div>
          {/* Streak capsule */}
          <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--s2)] border border-[var(--b)] text-xs text-[var(--t1)] font-bold shadow-sm">
            <span className="text-sm">🔥</span>
            <span>
              {isFarsi ? `زنجیره مطالعه ${studyStreak} روز` : `Study Streak ${studyStreak} Days`}
            </span>
          </div>
        </div>
      </div>

      {/* Row 1: Grid for Schedule and Grade Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Schedule Widget */}
        <Card className="lg:col-span-2 flex flex-col gap-4">
          <CardHeader
            action={
              <Link
                to="/academic/sessions"
                className="text-xs font-semibold text-[var(--t3)] hover:text-[var(--brand)] no-underline flex items-center gap-1"
              >
                <span>{isFarsi ? "مشاهده تقویم" : "View Calendar"}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            }
          >
            <CardTitle className="text-xs font-bold text-[var(--t2)] uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--t3)]" />
              <span>{isFarsi ? "برنامه من" : "My Schedule"}</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-3.5">
            {todaySessions.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--t3)] bg-[var(--s3)] rounded-2xl border border-[var(--b)] border-dashed">
                {isFarsi
                  ? "هیچ جلسه‌ای برای امروز برنامه‌ریزی نشده است. روز آزاد خود را لذت ببرید!"
                  : "No classes scheduled for today. Enjoy your day off!"}
              </div>
            ) : (
              todaySessions.map((s) => {
                const isLive = s.status === "live";
                const sTime = s.scheduled_start ? new Date(s.scheduled_start) : null;
                const eTime = s.scheduled_end ? new Date(s.scheduled_end) : null;
                const timeRange =
                  sTime && eTime
                    ? `${sTime.toLocaleTimeString(localeTag, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })} - ${eTime.toLocaleTimeString(localeTag, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : "";

                return (
                  <div
                    key={s.id}
                    className="bg-[var(--s3)] border border-[var(--b)] rounded-[18px] p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:bg-[var(--s3)]/80"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg shadow-inner",
                          isLive
                            ? "bg-red-500/10 text-red-500 animate-pulse"
                            : "bg-[var(--s2)] text-[var(--t3)]"
                        )}
                      >
                        {isLive ? <Video className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <h4 className="text-xs font-bold text-[var(--t1)] truncate">{s.title}</h4>
                        <p className="text-[10px] text-[var(--t3)] mt-0.5 truncate font-medium">
                          {s.host_name} • {timeRange}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-stretch sm:self-auto justify-end flex-shrink-0">
                      {isLive ? (
                        <>
                          <Badge variant="live" size="sm">
                            {isFarsi ? "هم‌اکنون زنده" : "Live Now"}
                          </Badge>
                          <Link
                            to={`/room/${s.active_room_code}`}
                            className="px-4 py-2 rounded-xl bg-[var(--brand)] text-[var(--brand-text)] hover:brightness-110 font-bold text-xs shadow-md transition-all active:scale-[0.98] no-underline"
                          >
                            {isFarsi ? "ورود به کلاس" : "Join Class"}
                          </Link>
                        </>
                      ) : (
                        <Link
                          to={`/academic/sessions/${s.id}`}
                          className="px-4 py-2 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)] text-[var(--t2)] hover:text-[var(--t1)] font-bold text-xs transition-all active:scale-[0.98] no-underline"
                        >
                          {isFarsi ? "جزئیات" : "Details"}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Grade Trend Widget */}
        <Card className="flex flex-col justify-between min-h-[300px]">
          <div>
            <h2 className="text-xs font-bold text-[var(--t2)] uppercase tracking-wider flex items-center gap-2 mb-3">
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-[var(--t3)]"
              >
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              <span>{isFarsi ? "روند نمرات" : "Grade Trend"}</span>
            </h2>

            {gradedAssignmentSubmissions.length === 0 ? (
              <div className="h-[140px] flex flex-col items-center justify-center gap-2 text-[var(--t3)] text-xs">
                <span className="text-xl">📈</span>
                <span>{isFarsi ? "هنوز نمره‌ای ثبت نشده است." : "No grades recorded yet."}</span>
              </div>
            ) : (
              <div className="w-full h-[140px] relative overflow-hidden">
                <svg
                  className="w-full h-full"
                  viewBox="0 0 240 130"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="gradeGradMini" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[0, 50, 100].map((ratio) => {
                    const y = 100 - (ratio * 80) / 100;
                    return (
                      <line
                        key={ratio}
                        x1="10"
                        y1={y}
                        x2="230"
                        y2={y}
                        stroke="var(--b)"
                        strokeWidth="0.8"
                        strokeDasharray="3 3"
                      />
                    );
                  })}
                  {gradedAssignmentSubmissions.length > 1 && (
                    <>
                      <path
                        d={getBezierPath(
                          gradedAssignmentSubmissions.map((sub, idx) => {
                            const x =
                              15 +
                              (idx * 210) / Math.max(1, gradedAssignmentSubmissions.length - 1);
                            const y = 100 - (parseFloat(sub.grade || "0") * 80) / 100;
                            return { x, y };
                          })
                        )}
                        fill="none"
                        stroke="var(--brand)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d={`${getBezierPath(
                          gradedAssignmentSubmissions.map((sub, idx) => {
                            const x =
                              15 +
                              (idx * 210) / Math.max(1, gradedAssignmentSubmissions.length - 1);
                            const y = 100 - (parseFloat(sub.grade || "0") * 80) / 100;
                            return { x, y };
                          })
                        )} L ${
                          15 +
                          ((gradedAssignmentSubmissions.length - 1) * 210) /
                            Math.max(1, gradedAssignmentSubmissions.length - 1)
                        } 100 L 15 100 Z`}
                        fill="url(#gradeGradMini)"
                      />
                    </>
                  )}
                  {gradedAssignmentSubmissions.map((sub, idx) => {
                    const x =
                      15 +
                      (idx * 210) / Math.max(1, gradedAssignmentSubmissions.length - 1);
                    const label = sub.assignment_title?.slice(0, 3) || `HW${idx + 1}`;
                    return (
                      <text
                        key={idx}
                        x={x}
                        y="118"
                        fill="var(--t3)"
                        fontSize="7"
                        textAnchor="middle"
                        fontWeight="bold"
                      >
                        {label}
                      </text>
                    );
                  })}
                  {gradedAssignmentSubmissions.map((sub, idx) => {
                    const x =
                      15 +
                      (idx * 210) / Math.max(1, gradedAssignmentSubmissions.length - 1);
                    const val = parseFloat(sub.grade || "0");
                    const y = 100 - (val * 80) / 100;
                    return (
                      <circle
                        key={idx}
                        cx={x}
                        cy={y}
                        r="3"
                        fill="var(--s2)"
                        stroke="var(--brand)"
                        strokeWidth="1.8"
                      />
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          {/* Semester Progress */}
          <div className="border-t border-[var(--b)] pt-3.5 mt-2 flex flex-col gap-2">
            <div className="flex justify-between items-center text-[11px] font-bold text-[var(--t1)]">
              <span>{isFarsi ? "پیشرفت ترم تحصیلی" : "Semester Progress"}</span>
              <span className="font-mono">{semesterProgress}%</span>
            </div>
            <div className="w-full bg-[var(--s3)] rounded-full h-2 overflow-hidden border border-[var(--b)]">
              <div
                className="bg-[var(--brand)] h-full rounded-full transition-all duration-500"
                style={{ width: `${semesterProgress}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Row 2: Homework Progress Section */}
      <div className="flex flex-col gap-4 mt-2">
        <div className="flex justify-between items-center">
          <h2 className="text-md font-extrabold text-[var(--t1)] tracking-tight">
            {isFarsi ? "پیشرفت تکالیف" : "Homework Progress"}
          </h2>
          <Link
            to="/academic/homework"
            className="px-3.5 py-1.5 bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/30 text-[11px] font-bold text-[var(--t1)] rounded-xl no-underline transition-colors flex items-center justify-center"
          >
            {isFarsi ? "مشاهده همه" : "View All"}
          </Link>
        </div>

        {/* Assignments Grid (3 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Due Soon */}
          {pendingAssignments.length > 0 ? (
            (() => {
              const a = pendingAssignments[0];
              const dueHours = getDueHours(a.due_date);
              return (
                <Card hoverable className="flex flex-col justify-between gap-5">
                  <div className="flex flex-col gap-3">
                    <div className="flex">
                      <Badge variant="danger" size="sm">
                        {isFarsi ? `تحویل تا ${dueHours} ساعت دیگر` : `DUE IN ${dueHours}H`}
                      </Badge>
                    </div>
                    <h3 className="text-sm font-extrabold text-[var(--t1)] leading-snug">
                      {a.title}
                    </h3>
                    <p className="text-[10px] text-[var(--t3)] font-semibold mt-0.5">
                      {a.class_name || (isFarsi ? "کلاس من" : "My Class")} •{" "}
                      {isFarsi ? "استاد" : "Instructor"}
                    </p>
                  </div>
                  <div className="flex justify-between items-center border-t border-[var(--b)] pt-3.5 mt-1">
                    <div className="flex -space-x-1.5">
                      <div className="w-5.5 h-5.5 rounded-full bg-indigo-600 border-2 border-[var(--s2)] flex items-center justify-center text-[9px] text-white font-bold select-none">
                        JD
                      </div>
                      <div className="w-5.5 h-5.5 rounded-full bg-teal-600 border-2 border-[var(--s2)] flex items-center justify-center text-[9px] text-white font-bold select-none">
                        KL
                      </div>
                    </div>
                    <Link
                      to={`/academic/homework`}
                      className="text-[11px] font-extrabold text-[var(--t1)] hover:text-[var(--brand)] transition-colors no-underline flex items-center gap-1"
                    >
                      {isFarsi ? "ارسال پاسخ" : "Submit Work"} →
                    </Link>
                  </div>
                </Card>
              );
            })()
          ) : (
            <Card className="opacity-60 flex flex-col justify-between gap-5">
              <div className="flex flex-col gap-3">
                <Badge variant="danger" size="sm">
                  {isFarsi ? "تحویل موعد" : "No Due Tasks"}
                </Badge>
                <h3 className="text-sm font-extrabold text-[var(--t1)] leading-snug">
                  {isFarsi ? "هیچ تکلیفی در مهلت فوری نیست" : "No homework due soon"}
                </h3>
              </div>
              <div className="border-t border-[var(--b)] pt-3.5 text-[11px] text-[var(--t3)]">
                {isFarsi ? "کلاس‌ها بدون موعد تکلیف" : "Everything is up to date"}
              </div>
            </Card>
          )}

          {/* Card 2: Draft / In Progress */}
          {pendingAssignments.length > 1 ? (
            (() => {
              const a = pendingAssignments[1];
              const sTime = a.due_date ? new Date(a.due_date) : null;
              const totalDays = sTime
                ? Math.max(1, Math.ceil((sTime.getTime() - Date.now()) / 86400000))
                : 2;
              return (
                <Card hoverable className="flex flex-col justify-between gap-5">
                  <div className="flex flex-col gap-3">
                    <Badge variant="warning" size="sm">
                      {isFarsi ? `${totalDays} روز باقی‌مانده` : `${totalDays} DAYS LEFT`}
                    </Badge>
                    <h3 className="text-sm font-extrabold text-[var(--t1)] leading-snug">
                      {a.title}
                    </h3>
                    <p className="text-[10px] text-[var(--t3)] font-semibold mt-0.5">
                      {a.class_name || (isFarsi ? "کلاس من" : "My Class")} •{" "}
                      {isFarsi ? "استاد" : "Instructor"}
                    </p>
                  </div>
                  <div className="flex justify-between items-center border-t border-[var(--b)] pt-3.5 mt-1 text-xs">
                    <span className="text-[10px] text-[var(--t3)] flex items-center gap-1 select-none font-semibold">
                      <span className="text-[var(--green)] font-bold">✓</span>{" "}
                      {isFarsi ? "پیش‌نویس ذخیره شد" : "Draft Saved"}
                    </span>
                    <Link
                      to={`/academic/homework`}
                      className="text-[11px] font-extrabold text-[var(--brand)] hover:opacity-80 transition-opacity no-underline flex items-center gap-1"
                    >
                      {isFarsi ? "ادامه تکلیف" : "Continue"} 📝
                    </Link>
                  </div>
                </Card>
              );
            })()
          ) : (
            <Card className="opacity-60 flex flex-col justify-between gap-5">
              <div className="flex flex-col gap-3">
                <Badge variant="warning" size="sm">
                  {isFarsi ? "بدون پیش‌نویس" : "No Drafts"}
                </Badge>
                <h3 className="text-sm font-extrabold text-[var(--t1)] leading-snug">
                  {isFarsi ? "هیچ پیش‌نویسی ذخیره نشده" : "No homework drafts"}
                </h3>
              </div>
              <div className="border-t border-[var(--b)] pt-3.5 text-[11px] text-[var(--t3)]">
                {isFarsi ? "کاری در جریان نیست" : "All clean"}
              </div>
            </Card>
          )}

          {/* Card 3: Graded / Completed */}
          {gradedAssignmentSubmissions.length > 0 ? (
            (() => {
              const sub = gradedAssignmentSubmissions[0];
              const dateText = sub.graded_at
                ? formatDueDate(sub.graded_at)
                : isFarsi
                ? "اخیر"
                : "Recent";
              return (
                <Card hoverable className="flex flex-col justify-between gap-5">
                  <div className="flex flex-col gap-3">
                    <Badge variant="success" size="sm">
                      {isFarsi ? `تصحیح شده: نمره ${sub.grade}` : `GRADED: ${sub.grade}`}
                    </Badge>
                    <h3 className="text-sm font-extrabold text-[var(--t1)] leading-snug">
                      {sub.assignment_title}
                    </h3>
                    <p className="text-[10px] text-[var(--t3)] font-semibold mt-0.5">
                      {isFarsi ? "کلاس من" : "My Class"}
                    </p>
                  </div>
                  <div className="flex justify-between items-center border-t border-[var(--b)] pt-3.5 mt-1 text-xs">
                    <span className="text-[10px] text-[var(--t3)] font-medium select-none">
                      {isFarsi ? `تکمیل در ${dateText}` : `Completed ${dateText}`}
                    </span>
                    <Link
                      to={`/academic/homework`}
                      className="text-[11px] font-extrabold text-[var(--t1)] hover:text-[var(--brand)] transition-colors no-underline flex items-center gap-1"
                    >
                      {isFarsi ? "مشاهده بازخورد" : "View Feedback"} →
                    </Link>
                  </div>
                </Card>
              );
            })()
          ) : (
            <Card className="opacity-60 flex flex-col justify-between gap-5">
              <div className="flex flex-col gap-3">
                <Badge variant="success" size="sm">
                  {isFarsi ? "نمرات" : "Grades"}
                </Badge>
                <h3 className="text-sm font-extrabold text-[var(--t1)] leading-snug">
                  {isFarsi ? "هیچ نمره جدیدی ثبت نشده" : "No graded submissions yet"}
                </h3>
              </div>
              <div className="border-t border-[var(--b)] pt-3.5 text-[11px] text-[var(--t3)]">
                {isFarsi ? "تکالیف تصحیح شده اینجا نمایش داده می‌شوند" : "Graded work will appear here"}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Row 3: Recent Recordings Carousel */}
      <div className="flex flex-col gap-4 mt-2">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-extrabold text-[var(--t1)] tracking-tight flex items-center gap-2">
            <span>▶️</span> {isFarsi ? "ویدیوهای ضبط‌شده اخیر" : "Recent Recordings"}
          </h2>
        </div>

        {studentRecordings.length === 0 ? (
          <div className="p-10 text-center text-xs text-[var(--t3)] bg-[var(--s2)] rounded-3xl border border-[var(--b)] border-dashed">
            {isFarsi
              ? "هیچ ویدیو ضبط شده‌ای برای شما در دسترس نیست."
              : "No recordings available currently."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {studentRecordings.slice(0, 3).map((rec) => {
              const durationMin = Math.round(rec.duration_seconds / 60);
              const qualityTag = rec.quality || "720p";
              return (
                <Card
                  key={rec.public_token}
                  hoverable
                  className="p-4 flex flex-col gap-3"
                >
                  <div className="relative aspect-video rounded-[18px] overflow-hidden bg-[var(--s3)] border border-[var(--b)] flex items-center justify-center shadow-inner group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/15 flex items-center justify-center">
                      <svg
                        viewBox="0 0 24 24"
                        width="36"
                        height="36"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-[var(--t3)] opacity-70 group-hover:scale-110 transition-transform duration-300"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polygon points="10 8 16 12 10 16 10 8" />
                      </svg>
                    </div>
                    <span className="absolute top-2 start-2 text-[8px] font-black px-1.5 py-0.5 rounded bg-black/60 text-white uppercase tracking-wider">
                      {qualityTag}
                    </span>
                    <span className="absolute bottom-2 end-2 bg-black/75 text-white font-mono text-[9px] px-1.5 py-0.5 rounded font-medium">
                      {durationMin}:00
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <h4 className="text-xs font-bold text-[var(--t1)] truncate">
                      {rec.room_name || rec.room_code}
                    </h4>
                    <p className="text-[10px] text-[var(--t3)] font-semibold mt-0.5 truncate">
                      {isFarsi ? "توسط" : "By"} {rec.owner_full_name}
                    </p>
                  </div>
                  <div className="flex justify-end border-t border-[var(--b)] pt-3 mt-1">
                    <Link
                      to={`/recordings/${rec.public_token}`}
                      className="text-[11px] font-bold text-[var(--brand)] hover:underline no-underline"
                    >
                      {isFarsi ? "مشاهده فیلم ضبط‌شده" : "Watch Recording"} →
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboardView;

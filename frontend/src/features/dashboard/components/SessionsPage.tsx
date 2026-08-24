import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { sessionsApi } from "../../sessions/api/sessions.api";
import {
  useSessions,
  useStartSession,
  useCompleteSession,
  useCancelSession,
} from "../../sessions/hooks";
import { crmApi } from "../api/crm.api";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { DateTimePicker } from "../../../components/forms/DateTimePicker";

import Spinner from "../../../components/ui/Spinner";
import { Modal, ModalHeader, ModalTitle, ModalBody } from "../../../components/ui/Modal";
import AttendanceModal from "./AttendanceModal";
import AppShell from "../../../components/layout/AppShell";
import { useLocale } from "../../../i18n/useLocale";
import { TableRowActions, type TableAction } from "../../../components/ui/TableRowActions";
import { Play, Video, CheckCircle, ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";

export default function SessionsPage() {
  const { language } = useLocale();
  const { hasPermission } = useOrgPermission();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isFarsi = language === "fa";

  const canSchedule = hasPermission("can_manage_sessions");
  const canStartCompleteCancel = hasPermission("can_teach_class") || hasPermission("can_manage_sessions");

  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    academy_class: "",
    title: "",
    scheduled_start: "",
    scheduled_end: "",
  });

  const [activeAttendanceSessionId, setActiveAttendanceSessionId] = useState<number | null>(null);

  // View state and Month pagination state
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Queries
  const { data: sessions = [], isLoading: loadingSessions } = useSessions();
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: crmApi.getClasses,
  });

  const { data: calendarEvents = [] } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: crmApi.getCalendarEvents,
  });

  // Start scheduling with pre-filled first class if available
  const handleOpenSchedule = () => {
    setScheduleForm({
      academy_class: classes[0]?.id.toString() || "",
      title: "",
      scheduled_start: "",
      scheduled_end: "",
    });
    setIsScheduling(true);
  };

  // Mutations
  const startSessionMutation = useStartSession();
  const completeSessionMutation = useCompleteSession();
  const cancelSessionMutation = useCancelSession();

  const scheduleSessionMutation = useMutation({
    mutationFn: sessionsApi.createSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(isFarsi ? "جلسه با موفقیت برنامه‌ریزی شد" : "Session scheduled successfully");
      setIsScheduling(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در ثبت جلسه" : "Failed to schedule session"));
    },
  });

  const handleStartSession = (sessionId: number) => {
    startSessionMutation.mutate(sessionId, {
      onSuccess: (data) => {
        toast.success(isFarsi ? "کلاس با موفقیت آغاز شد" : "Session started successfully");
        if (data.active_room_code) {
          navigate(`/room/${data.active_room_code}`);
        }
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.error || (isFarsi ? "خطا در شروع کلاس" : "Failed to start session"));
      },
    });
  };

  const handleCompleteSession = (sessionId: number) => {
    if (confirm(isFarsi ? "آیا از اتمام کلاس مطمئن هستید؟" : "Are you sure you want to complete this session?")) {
      completeSessionMutation.mutate(sessionId, {
        onSuccess: () => {
          toast.success(isFarsi ? "کلاس پایان یافت" : "Session completed successfully");
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.error || (isFarsi ? "خطا در ثبت پایان کلاس" : "Failed to complete session"));
        },
      });
    }
  };

  const handleCancelSession = (sessionId: number) => {
    if (confirm(isFarsi ? "آیا از لغو این جلسه مطمئن هستید؟" : "Are you sure you want to cancel this session?")) {
      cancelSessionMutation.mutate(sessionId, {
        onSuccess: () => {
          toast.success(isFarsi ? "جلسه لغو شد" : "Session cancelled successfully");
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.error || (isFarsi ? "خطا در لغو جلسه" : "Failed to cancel session"));
        },
      });
    }
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    scheduleSessionMutation.mutate({
      academy_class: parseInt(scheduleForm.academy_class),
      title: scheduleForm.title,
      scheduled_start: scheduleForm.scheduled_start ? new Date(scheduleForm.scheduled_start).toISOString() : null,
      scheduled_end: scheduleForm.scheduled_end ? new Date(scheduleForm.scheduled_end).toISOString() : null,
    });
  };

  return (
    <AppShell title={isFarsi ? "جلسات کلاس‌ها" : "Sessions"}>
      <div className="bg-[var(--s2)] rounded-xl border border-[var(--b)] overflow-hidden flex flex-col gap-4">
        <div className="flex justify-between items-center p-4 border-b border-[var(--b)] bg-[var(--s2)]">
          <span className="text-xs font-semibold text-[var(--t3)] uppercase tracking-wider">
            {isFarsi ? "برنامه جلسات آکادمی" : "Academy Class Sessions"}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex rounded-xl bg-[var(--s3)] border border-[var(--b)] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-all border-none ${
                  viewMode === "calendar"
                    ? "bg-[var(--brand)] text-[var(--brand-text)] shadow-sm"
                    : "text-[var(--t2)] hover:text-[var(--brand)] bg-transparent"
                }`}
              >
                {isFarsi ? "تقویم" : "Calendar"}
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-all border-none ${
                  viewMode === "list"
                    ? "bg-[var(--brand)] text-[var(--brand-text)] shadow-sm"
                    : "text-[var(--t2)] hover:text-[var(--brand)] bg-transparent"
                }`}
              >
                {isFarsi ? "لیست" : "List"}
              </button>
            </div>
            {canSchedule && (
              <Button size="sm" onClick={handleOpenSchedule}>
                {isFarsi ? "+ برنامه‌ریزی جلسه" : "+ Schedule Session"}
              </Button>
            )}
          </div>
        </div>

        {viewMode === "calendar" ? (
          <div className="p-4 flex flex-col gap-4">
            {/* Calendar Month Header */}
            <div className="flex justify-between items-center bg-[var(--s3)] border border-[var(--b)] p-3 rounded-2xl">
              <button 
                type="button"
                onClick={handlePrevMonth} 
                className="p-2 border border-[var(--b)] bg-[var(--s2)] text-[var(--t1)] hover:border-[var(--brand)] rounded-xl transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="text-sm font-bold text-[var(--t1)]">
                {currentMonth.toLocaleString(isFarsi ? "fa-IR" : "en-US", { month: "long", year: "numeric" })}
              </h3>
              <button 
                type="button"
                onClick={handleNextMonth} 
                className="p-2 border border-[var(--b)] bg-[var(--s2)] text-[var(--t1)] hover:border-[var(--brand)] rounded-xl transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Grid */}
            <div className="border border-[var(--b)] rounded-2xl overflow-hidden bg-[var(--s2)]">
              {/* Day Names */}
              <div className="grid grid-cols-7 border-b border-[var(--b)] bg-[var(--s3)] text-[var(--t3)] text-[10px] font-semibold uppercase tracking-wider text-center py-2">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                  <div key={d} className="py-1">
                    {isFarsi ? {
                      Sunday: "یکشنبه", Monday: "دوشنبه", Tuesday: "سه‌شنبه",
                      Wednesday: "چهارشنبه", Thursday: "پنج‌شنبه", Friday: "جمعه", Saturday: "شنبه"
                    }[d] : d.slice(0, 3)}
                  </div>
                ))}
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7 bg-[var(--b)] gap-[1px]">
                {(() => {
                  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
                  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

                  const daysInMonth = getDaysInMonth(currentMonth);
                  const firstDayIndex = getFirstDayOfMonth(currentMonth);
                  const cells = [];

                  // Blank cells before first day
                  for (let i = 0; i < firstDayIndex; i++) {
                    cells.push(
                      <div key={`blank-${i}`} className="bg-[var(--s2)] min-h-[100px] p-2 opacity-50" />
                    );
                  }

                  // Day cells
                  for (let day = 1; day <= daysInMonth; day++) {
                    const cellDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                    const dayStart = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate(), 0, 0, 0, 0);
                    const dayEnd = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate(), 23, 59, 59, 999);

                    const dayEvents = calendarEvents.filter((event: any) => {
                      const eventStart = new Date(event.start);
                      return eventStart >= dayStart && eventStart <= dayEnd;
                    });

                    cells.push(
                      <div key={`day-${day}`} className="bg-[var(--s2)] min-h-[100px] p-2 flex flex-col gap-1.5 hover:bg-[var(--s3)]/50 transition-colors">
                        <span className="text-xs font-bold text-[var(--t3)] self-end mb-1">
                          {day}
                        </span>
                        <div className="flex flex-col gap-1 overflow-y-auto max-h-[80px]">
                          {dayEvents.slice(0, 3).map((event: any) => {
                            const isSession = event.type === 'session';
                            const isOccurrence = event.type === 'occurrence';
                            const isHomework = event.type === 'homework';
                            
                            const badgeColor = isSession ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                               isOccurrence ? "bg-purple-500/10 text-purple-500 border-purple-500/20" :
                                               "bg-amber-500/10 text-amber-500 border-amber-500/20";
                            
                            const targetUrl = isSession ? `/academic/sessions/${event.id}` :
                                              isOccurrence ? `/academic/classes/${event.class_id}` :
                                              `/academic/assignments/${event.id}`;

                            return (
                              <Link 
                                key={event.id + '-' + event.type}
                                to={targetUrl}
                                className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${badgeColor} truncate hover:underline no-underline block`}
                              >
                                {isHomework ? "📝 " : isSession ? "💻 " : "📅 "}
                                {event.title}
                              </Link>
                            );
                          })}
                          {dayEvents.length > 3 && (
                            <span className="text-[8px] text-[var(--t3)] text-center font-bold">
                              +{dayEvents.length - 3} {isFarsi ? "مورد بیشتر" : "more"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Empty cells after end of month to complete grid line if needed
                  const totalGridCells = cells.length;
                  const remainingCells = totalGridCells % 7 === 0 ? 0 : 7 - (totalGridCells % 7);
                  for (let i = 0; i < remainingCells; i++) {
                    cells.push(
                      <div key={`blank-end-${i}`} className="bg-[var(--s2)] min-h-[100px] p-2 opacity-50" />
                    );
                  }

                  return cells;
                })()}
              </div>
            </div>
          </div>
        ) : loadingSessions ? (
          <div className="flex justify-center p-8">
            <Spinner />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-sm text-[var(--t3)] text-center py-8">
            {isFarsi ? "هیچ جلسه‌ای ثبت نشده است." : "No sessions found."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--b)] text-[var(--t3)] text-xs uppercase text-left">
                  <th className="p-4">#</th>
                  <th className="p-4">{isFarsi ? "کلاس" : "Class"}</th>
                  <th className="p-4">{isFarsi ? "عنوان جلسه" : "Session Title"}</th>
                  <th className="p-4">{isFarsi ? "زمان برنامه‌ریزی" : "Scheduled Time"}</th>
                  <th className="p-4">{isFarsi ? "مدرس" : "Host"}</th>
                  <th className="p-4">{isFarsi ? "وضعیت" : "Status"}</th>
                  <th className="p-4 text-right">{isFarsi ? "عملیات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, idx) => {
                  const isLive = s.status === "live";
                  const isScheduled = s.status === "scheduled";
                  const isCompleted = s.status === "completed";

                  return (
                    <tr key={s.id} className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left">
                      <td className="p-4 text-[var(--t3)]">{idx + 1}</td>
                      <td className="p-4 font-semibold text-[var(--t1)]">
                        <Link to={`/academic/classes/${s.academy_class}`} className="hover:underline text-[var(--brand)] no-underline">
                          {s.academy_class_name || "—"}
                        </Link>
                      </td>
                      <td className="p-4 font-semibold text-[var(--t1)]">
                        <Link to={`/academic/sessions/${s.id}`} className="hover:underline text-[var(--t1)] no-underline">
                          {s.title}
                        </Link>
                      </td>
                      <td className="p-4 text-[var(--t2)]">
                        {s.scheduled_start ? new Date(s.scheduled_start).toLocaleString() : "—"}
                      </td>
                      <td className="p-4 text-[var(--t2)]">{s.host_name || "—"}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold text-[10px] uppercase ${
                            isLive
                              ? "bg-[rgba(34,197,94,0.12)] text-[var(--green)] animate-pulse"
                              : isScheduled
                              ? "bg-[rgba(59,130,246,0.12)] text-blue-500"
                              : isCompleted
                              ? "bg-[var(--s3)] text-[var(--t3)]"
                              : "bg-[rgba(239,68,68,0.12)] text-[var(--red)]"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {(() => {
                          const sessionActions: TableAction[] = [];

                          // Scheduled + Authed actions
                          if (isScheduled && canStartCompleteCancel) {
                            sessionActions.push({
                              label: isFarsi ? "شروع کلاس" : "Start",
                              onClick: () => handleStartSession(s.id),
                              icon: Play,
                            });
                            sessionActions.push({
                              label: isFarsi ? "لغو" : "Cancel",
                              onClick: () => handleCancelSession(s.id),
                              isDelete: true,
                            });
                          }

                          // Live actions
                          if (isLive) {
                            if (canStartCompleteCancel) {
                              sessionActions.push({
                                label: isFarsi ? "ورود" : "Join",
                                onClick: () => navigate(`/room/${s.active_room_code}`),
                                icon: Video,
                              });
                              sessionActions.push({
                                label: isFarsi ? "اتمام" : "Complete",
                                onClick: () => handleCompleteSession(s.id),
                                icon: CheckCircle,
                              });
                              sessionActions.push({
                                label: isFarsi ? "لغو" : "Cancel",
                                onClick: () => handleCancelSession(s.id),
                                isDelete: true,
                              });
                            } else {
                              sessionActions.push({
                                label: isFarsi ? "ورود به کلاس" : "Join Room",
                                onClick: () => navigate(`/room/${s.active_room_code}`),
                                icon: Video,
                              });
                            }
                          }

                          // Attendance action (live or completed)
                          if (isLive || isCompleted) {
                            sessionActions.push({
                              label: isFarsi ? "حضور و غیاب" : "Attendance",
                              onClick: () => setActiveAttendanceSessionId(s.id),
                              icon: ClipboardList,
                            });
                          }

                          return (
                            <TableRowActions
                              isFarsi={isFarsi}
                              actions={sessionActions}
                            />
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      <Modal open={isScheduling} onOpenChange={setIsScheduling}>
        <ModalHeader>
          <ModalTitle>
            {isFarsi ? "برنامه‌ریزی جلسه جدید" : "Schedule New Session"}
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form onSubmit={handleScheduleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-[var(--t2)] uppercase tracking-wide">
                {isFarsi ? "انتخاب کلاس" : "Class"}
              </label>
              <select
                className="w-full bg-[var(--s2)] text-[var(--t1)] text-sm border border-[var(--b)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--brand)] transition-colors"
                value={scheduleForm.academy_class}
                onChange={(e) => setScheduleForm({ ...scheduleForm, academy_class: e.target.value })}
                required
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.course_title})
                  </option>
                ))}
              </select>
            </div>
            <Input
              label={isFarsi ? "عنوان جلسه" : "Session Title"}
              value={scheduleForm.title}
              onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
              placeholder="e.g. Session 1: Introduction"
              required
            />
            <DateTimePicker
              label={isFarsi ? "زمان شروع" : "Start Time"}
              value={scheduleForm.scheduled_start || undefined}
              onChange={(val) => setScheduleForm({ ...scheduleForm, scheduled_start: val })}
              required
            />
            <DateTimePicker
              label={isFarsi ? "زمان پایان" : "End Time"}
              value={scheduleForm.scheduled_end || undefined}
              onChange={(val) => setScheduleForm({ ...scheduleForm, scheduled_end: val })}
              required
            />


            {(() => {
              if (!scheduleForm.scheduled_start || !scheduleForm.scheduled_end || !scheduleForm.academy_class) return null;
              const formStart = new Date(scheduleForm.scheduled_start);
              const formEnd = new Date(scheduleForm.scheduled_end);
              const formClassId = parseInt(scheduleForm.academy_class);

              const selectedClass = classes.find((c) => c.id === formClassId);
              const formTeacher = selectedClass?.teacher;
              const formRoom = selectedClass?.room ? selectedClass.room.trim().toLowerCase() : "";

              for (const s of sessions) {
                if (!s.scheduled_start || !s.scheduled_end) continue;
                const sStart = new Date(s.scheduled_start);
                const sEnd = new Date(s.scheduled_end);

                if (formStart < sEnd && formEnd > sStart) {
                  if (s.academy_class === formClassId) {
                    return (
                      <div className="bg-[rgba(245,158,11,0.1)] border border-[var(--amber)] text-[var(--amber)] text-xs p-3 rounded-xl flex flex-col gap-1">
                        <div className="font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)] animate-pulse" />
                          {isFarsi ? "هشدار تداخل زمان‌بندی:" : "Class Overlap Warning:"}
                        </div>
                        <div>
                          {isFarsi
                            ? `کلاس در این زمان جلسه دیگری دارد ("${s.title}").`
                            : `This class already has another session scheduled ("${s.title}") at this time.`}
                        </div>
                      </div>
                    );
                  }
                  if (formTeacher && s.host === formTeacher) {
                    return (
                      <div className="bg-[rgba(245,158,11,0.1)] border border-[var(--amber)] text-[var(--amber)] text-xs p-3 rounded-xl flex flex-col gap-1">
                        <div className="font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)] animate-pulse" />
                          {isFarsi ? "هشدار تداخل مدرس:" : "Host Conflict Warning:"}
                        </div>
                        <div>
                          {isFarsi
                            ? `مدرس ${s.host_name || "مورد نظر"} در این بازه در جلسه "${s.title}" مشغول است.`
                            : `Host ${s.host_name || "selected"} is busy with session "${s.title}" at this time.`}
                        </div>
                      </div>
                    );
                  }
                  const otherClass = classes.find((c) => c.id === s.academy_class);
                  const otherRoom = otherClass?.room ? otherClass.room.trim().toLowerCase() : "";
                  if (formRoom && otherRoom === formRoom) {
                    return (
                      <div className="bg-[rgba(245,158,11,0.1)] border border-[var(--amber)] text-[var(--amber)] text-xs p-3 rounded-xl flex flex-col gap-1">
                        <div className="font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)] animate-pulse" />
                          {isFarsi ? "هشدار تداخل اتاق:" : "Room Conflict Warning:"}
                        </div>
                        <div>
                          {isFarsi
                            ? `اتاق ${selectedClass?.room} در این بازه برای جلسه "${s.title}" کلاس "${s.academy_class_name}" رزرو شده است.`
                            : `Room ${selectedClass?.room || "Room"} is booked for session "${s.title}" of class "${s.academy_class_name}" at this time.`}
                        </div>
                      </div>
                    );
                  }
                }
              }
              return null;
            })()}

            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="secondary" onClick={() => setIsScheduling(false)}>
                {isFarsi ? "انصراف" : "Cancel"}
              </Button>
              <Button
                type="submit"
                loading={scheduleSessionMutation.isPending}
              >
                {isFarsi ? "ثبت جلسه" : "Schedule"}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      {/* Attendance Modal */}
      {activeAttendanceSessionId !== null && (
        <AttendanceModal
          sessionId={activeAttendanceSessionId}
          language={language}
          onClose={() => setActiveAttendanceSessionId(null)}
        />
      )}
    </AppShell>
  );
}

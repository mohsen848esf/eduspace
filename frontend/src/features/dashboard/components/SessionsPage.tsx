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
import Spinner from "../../../components/ui/Spinner";
import { Modal, ModalHeader, ModalTitle, ModalBody } from "../../../components/ui/Modal";
import AttendanceModal from "./AttendanceModal";
import AppShell from "../../../components/layout/AppShell";
import { useLocale } from "../../../i18n/useLocale";

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

  // Queries
  const { data: sessions = [], isLoading: loadingSessions } = useSessions();
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: crmApi.getClasses,
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
          {canSchedule && (
            <Button size="sm" onClick={handleOpenSchedule}>
              {isFarsi ? "+ برنامه‌ریزی جلسه" : "+ Schedule Session"}
            </Button>
          )}
        </div>

        {loadingSessions ? (
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
                      <td className="p-4 font-semibold text-[var(--brand-text)]">{s.academy_class_name || "—"}</td>
                      <td className="p-4 font-semibold text-[var(--t1)]">{s.title}</td>
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
                      <td className="p-4 text-right flex justify-end gap-1.5 items-center">
                        {isScheduled && canStartCompleteCancel && (
                          <>
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => handleStartSession(s.id)}
                              loading={startSessionMutation.isPending && startSessionMutation.variables === s.id}
                            >
                              {isFarsi ? "شروع کلاس" : "Start"}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleCancelSession(s.id)}
                              loading={cancelSessionMutation.isPending && cancelSessionMutation.variables === s.id}
                            >
                              {isFarsi ? "لغو" : "Cancel"}
                            </Button>
                          </>
                        )}

                        {isLive && (
                          <>
                            {canStartCompleteCancel ? (
                              <>
                                <Link
                                  to={`/room/${s.active_room_code}`}
                                  className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--brand)] text-[var(--brand-text)] hover:brightness-110 transition-all cursor-pointer no-underline"
                                >
                                  {isFarsi ? "ورود" : "Join"}
                                </Link>
                                <Button
                                  size="sm"
                                  variant="success"
                                  onClick={() => handleCompleteSession(s.id)}
                                  loading={completeSessionMutation.isPending && completeSessionMutation.variables === s.id}
                                >
                                  {isFarsi ? "اتمام" : "Complete"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => handleCancelSession(s.id)}
                                  loading={cancelSessionMutation.isPending && cancelSessionMutation.variables === s.id}
                                >
                                  {isFarsi ? "لغو" : "Cancel"}
                                </Button>
                              </>
                            ) : (
                              <Link
                                to={`/room/${s.active_room_code}`}
                                className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--brand)] text-[var(--brand-text)] hover:brightness-110 transition-all cursor-pointer no-underline"
                              >
                                {isFarsi ? "ورود به کلاس" : "Join Room"}
                              </Link>
                            )}
                          </>
                        )}

                        {(isLive || isCompleted) && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setActiveAttendanceSessionId(s.id)}
                          >
                            {isFarsi ? "حضور و غیاب" : "Attendance"}
                          </Button>
                        )}
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
            <Input
              label={isFarsi ? "زمان شروع" : "Start Time"}
              type="datetime-local"
              value={scheduleForm.scheduled_start}
              onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_start: e.target.value })}
              required
            />
            <Input
              label={isFarsi ? "زمان پایان" : "End Time"}
              type="datetime-local"
              value={scheduleForm.scheduled_end}
              onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_end: e.target.value })}
              required
            />
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

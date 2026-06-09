import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { sessionsApi } from "../api/sessions.api";
import {
  useSessions,
  useStartSession,
  useCompleteSession,
  useCancelSession,
  useSessionAttendance,
  useUpdateAttendance,
} from "../hooks";
import type { Session } from "../types";
import type { AcademyClass } from "../../dashboard/api/crm.api";
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalClose } from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import Spinner from "../../../components/ui/Spinner";
import Input from "../../../components/ui/Input";

interface ClassSessionsSubTableProps {
  cls: AcademyClass;
  language: string;
  canManageCRM: boolean;
}

export default function ClassSessionsSubTable({
  cls,
  language,
  canManageCRM,
}: ClassSessionsSubTableProps) {
  const isFarsi = language === "fa";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    title: "",
    scheduled_start: "",
    scheduled_end: "",
  });

  const [activeAttendanceSessionId, setActiveAttendanceSessionId] = useState<number | null>(null);

  // Queries & Mutations
  const { data: sessions = [], isLoading: loadingSessions } = useSessions(cls.id);
  const startSessionMutation = useStartSession();
  const completeSessionMutation = useCompleteSession();
  const cancelSessionMutation = useCancelSession();

  const scheduleSessionMutation = useMutation({
    mutationFn: (data: Partial<Session>) => sessionsApi.createSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["class"] });
      toast.success(isFarsi ? "جلسه با موفقیت برنامه‌ریزی شد" : "Session scheduled successfully");
      setIsScheduling(false);
      setScheduleForm({ title: "", scheduled_start: "", scheduled_end: "" });
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
      academy_class: cls.id,
      title: scheduleForm.title,
      scheduled_start: scheduleForm.scheduled_start ? new Date(scheduleForm.scheduled_start).toISOString() : null,
      scheduled_end: scheduleForm.scheduled_end ? new Date(scheduleForm.scheduled_end).toISOString() : null,
    });
  };

  return (
    <div className="p-4 bg-[var(--s3)] border-t border-[var(--b)] rounded-b-xl flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h4 className="text-xs font-bold text-[var(--t2)] uppercase tracking-wider">
          {isFarsi ? "لیست جلسات این کلاس" : "Class Sessions"} ({sessions.length})
        </h4>
        {canManageCRM && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsScheduling(!isScheduling)}
          >
            {isScheduling ? (isFarsi ? "انصراف" : "Cancel") : (isFarsi ? "+ تعریف جلسه" : "+ Schedule Session")}
          </Button>
        )}
      </div>

      {/* Schedule Form */}
      {isScheduling && (
        <form onSubmit={handleScheduleSubmit} className="bg-[var(--s2)] p-4 rounded-xl border border-[var(--b)] grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
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
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label={isFarsi ? "زمان پایان" : "End Time"}
                type="datetime-local"
                value={scheduleForm.scheduled_end}
                onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_end: e.target.value })}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              loading={scheduleSessionMutation.isPending}
            >
              {isFarsi ? "ثبت" : "Schedule"}
            </Button>
          </div>
        </form>
      )}

      {/* Sessions Table */}
      {loadingSessions ? (
        <div className="flex justify-center p-4">
          <Spinner />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-xs text-[var(--t3)] text-center py-2">
          {isFarsi ? "هیچ جلسه‌ای برای این کلاس ثبت نشده است." : "No sessions found for this class."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--b)] bg-[var(--s2)]">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--b)] text-[var(--t3)] uppercase text-left">
                <th className="p-3">#</th>
                <th className="p-3">{isFarsi ? "عنوان" : "Title"}</th>
                <th className="p-3">{isFarsi ? "زمان برنامه‌ریزی" : "Scheduled Time"}</th>
                <th className="p-3">{isFarsi ? "مدرس" : "Host"}</th>
                <th className="p-3">{isFarsi ? "وضعیت" : "Status"}</th>
                <th className="p-3 text-right">{isFarsi ? "عملیات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, idx) => {
                const isLive = s.status === "live";
                const isScheduled = s.status === "scheduled";
                const isCompleted = s.status === "completed";

                return (
                  <tr key={s.id} className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left">
                    <td className="p-3 text-[var(--t3)]">{idx + 1}</td>
                    <td className="p-3 font-semibold text-[var(--t1)]">{s.title}</td>
                    <td className="p-3 text-[var(--t2)]">
                      {s.scheduled_start ? new Date(s.scheduled_start).toLocaleString() : "—"}
                    </td>
                    <td className="p-3 text-[var(--t2)]">{s.host_name || "—"}</td>
                    <td className="p-3">
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
                    <td className="p-3 text-right flex justify-end gap-1.5 items-center">
                      {isScheduled && canManageCRM && (
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
                          {canManageCRM ? (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => navigate(`/room/${s.active_room_code}`)}
                              >
                                {isFarsi ? "ورود" : "Join"}
                              </Button>
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
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => navigate(`/room/${s.active_room_code}`)}
                            >
                              {isFarsi ? "ورود به کلاس" : "Join Room"}
                            </Button>
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

      {/* Attendance Modal */}
      {activeAttendanceSessionId !== null && (
        <AttendanceModal
          sessionId={activeAttendanceSessionId}
          language={language}
          onClose={() => setActiveAttendanceSessionId(null)}
          canManageCRM={canManageCRM}
        />
      )}
    </div>
  );
}

interface AttendanceModalProps {
  sessionId: number;
  language: string;
  onClose: () => void;
  canManageCRM: boolean;
}

function AttendanceModal({
  sessionId,
  language,
  onClose,
  canManageCRM,
}: AttendanceModalProps) {
  const isFarsi = language === "fa";
  const { data: attendance = [], isLoading: loadingAttendance } = useSessionAttendance(sessionId);
  const { updateSingle, updateBulk } = useUpdateAttendance(sessionId);
  const [bulkStatus, setBulkStatus] = useState("present");

  const handleBulkApply = () => {
    if (attendance.length === 0) return;
    const records = attendance.map((att) => ({
      student_id: att.student,
      status: bulkStatus,
    }));
    updateBulk.mutate(records, {
      onSuccess: () => {
        toast.success(isFarsi ? "تغییرات گروهی اعمال شد" : "Bulk updates applied successfully");
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.error || (isFarsi ? "خطا در ویرایش گروهی" : "Bulk update failed"));
      },
    });
  };

  return (
    <Modal open={true} onOpenChange={(open) => { if (!open) onClose(); }} panelClassName="max-w-2xl">
      <ModalHeader>
        <ModalTitle>
          {isFarsi ? "لیست حضور و غیاب جلسه" : "Session Attendance Panel"}
        </ModalTitle>
      </ModalHeader>
      <ModalBody>
        {canManageCRM && attendance.length > 0 && (
          <div className="flex gap-2 items-center bg-[var(--s3)] p-3 rounded-xl border border-[var(--b)]">
            <span className="text-xs font-semibold text-[var(--t2)]">
              {isFarsi ? "ویرایش گروهی تمام دانش‌آموزان به:" : "Set all students to:"}
            </span>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="bg-[var(--s2)] text-[var(--t1)] text-xs border border-[var(--b)] rounded-lg px-2 py-1 outline-none"
            >
              <option value="present">{isFarsi ? "حاضر" : "Present"}</option>
              <option value="absent">{isFarsi ? "غایب" : "Absent"}</option>
              <option value="late">{isFarsi ? "تاخیر" : "Late"}</option>
              <option value="excused">{isFarsi ? "مرخصی" : "Excused"}</option>
            </select>
            <Button
              size="sm"
              onClick={handleBulkApply}
              loading={updateBulk.isPending}
            >
              {isFarsi ? "اعمال" : "Apply"}
            </Button>
          </div>
        )}

        {loadingAttendance ? (
          <div className="flex justify-center p-8">
            <Spinner />
          </div>
        ) : attendance.length === 0 ? (
          <div className="text-sm text-[var(--t3)] text-center py-4">
            {isFarsi ? "هیچ رکورد حضور و غیابی یافت نشد." : "No attendance logs generated for this session."}
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[350px] border border-[var(--b)] rounded-xl">
            <table className="w-full text-xs text-start border-collapse">
              <thead>
                <tr className="border-b border-[var(--b)] text-[var(--t3)] bg-[var(--s3)]">
                  <th className="p-3 text-left">{isFarsi ? "نام دانشجو" : "Student Name"}</th>
                  <th className="p-3 text-left">{isFarsi ? "وضعیت" : "Status"}</th>
                  <th className="p-3 text-left">{isFarsi ? "یادداشت مدرس" : "Teacher Note"}</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((att) => (
                  <tr key={att.id} className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left">
                    <td className="p-3 font-medium text-[var(--t1)]">
                      {att.student_full_name} ({att.student_username})
                    </td>
                    <td className="p-3">
                      {canManageCRM ? (
                        <select
                          value={att.status}
                          onChange={(e) =>
                            updateSingle.mutate({
                              studentId: att.student,
                              status: e.target.value,
                              note: att.note,
                            })
                          }
                          className="bg-[var(--s2)] text-[var(--t1)] text-xs border border-[var(--b)] rounded-lg px-2 py-1 outline-none focus:border-[var(--brand)]"
                        >
                          <option value="present">{isFarsi ? "حاضر" : "Present"}</option>
                          <option value="absent">{isFarsi ? "غایب" : "Absent"}</option>
                          <option value="late">{isFarsi ? "تاخیر" : "Late"}</option>
                          <option value="excused">{isFarsi ? "مرخصی" : "Excused"}</option>
                        </select>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold text-[10px] uppercase ${
                            att.status === "present"
                              ? "bg-[rgba(34,197,94,0.12)] text-[var(--green)]"
                              : att.status === "absent"
                              ? "bg-[rgba(239,68,68,0.12)] text-[var(--red)]"
                              : "bg-[rgba(245,158,11,0.1)] text-[var(--amber)]"
                          }`}
                        >
                          {att.status}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {canManageCRM ? (
                        <input
                          type="text"
                          defaultValue={att.note || ""}
                          placeholder={isFarsi ? "افزودن یادداشت..." : "Add a note..."}
                          onBlur={(e) => {
                            if (e.target.value !== (att.note || "")) {
                              updateSingle.mutate({
                                studentId: att.student,
                                status: att.status,
                                note: e.target.value,
                              });
                            }
                          }}
                          className="bg-[var(--s2)] text-[var(--t1)] text-xs border border-[var(--b)] rounded-lg px-2 py-1 outline-none focus:border-[var(--brand)] w-full"
                        />
                      ) : (
                        <span className="text-[var(--t3)]">{att.note || "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <ModalClose asChild>
            <Button variant="secondary" onClick={onClose}>
              {isFarsi ? "بستن" : "Close"}
            </Button>
          </ModalClose>
        </div>
      </ModalBody>
    </Modal>
  );
}

import { useState } from "react";
import { toast } from "react-hot-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  useSessionAttendance,
  useUpdateAttendance,
} from "../../sessions/hooks";
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalClose } from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import Spinner from "../../../components/ui/Spinner";
import { useOrgPermission } from "../../../hooks/useOrgPermission";
import { sessionsApi } from "../../sessions/api/sessions.api";
import recordingsApi from "../../recordings/api/recordings.api";

interface AttendanceModalProps {
  sessionId: number;
  language: string;
  onClose: () => void;
}

export default function AttendanceModal({
  sessionId,
  language,
  onClose,
}: AttendanceModalProps) {
  const isFarsi = language === "fa";
  const { hasPermission } = useOrgPermission();
  const canManage = hasPermission("can_manage_attendance") || hasPermission("can_teach_class");

  // Fetch session details
  const { data: session } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => sessionsApi.getSession(sessionId),
  });

  const { data: attendance = [], isLoading: loadingAttendance } = useSessionAttendance(sessionId);
  const { updateSingle, updateBulk } = useUpdateAttendance(sessionId);
  const [bulkStatus, setBulkStatus] = useState("present");

  const activeRoomCode = session?.active_room_code;

  // Query LiveKit room recording status if live
  const { data: recStatus, refetch: refetchRecStatus } = useQuery({
    queryKey: ["roomRecordingStatus", activeRoomCode],
    queryFn: () => recordingsApi.roomStatus(activeRoomCode!),
    enabled: !!activeRoomCode && session?.status === "live",
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "starting" || status === "processing" ? 3000 : 10000;
    }
  });

  const startRecordingMutation = useMutation({
    mutationFn: () => recordingsApi.start(activeRoomCode!, "720p"),
    onSuccess: () => {
      toast.success(isFarsi ? "ضبط کلاس شروع شد" : "Recording started");
      refetchRecStatus();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || (isFarsi ? "خطا در شروع ضبط" : "Failed to start recording"));
    }
  });

  const stopRecordingMutation = useMutation({
    mutationFn: () => recordingsApi.stop(activeRoomCode!),
    onSuccess: () => {
      toast.success(isFarsi ? "ضبط کلاس متوقف شد" : "Recording stopped");
      refetchRecStatus();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || (isFarsi ? "خطا در توقف ضبط" : "Failed to stop recording"));
    }
  });

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

  // Calculate attendance rates
  const totalCount = attendance.length;
  const presentCount = attendance.filter((a) => a.status === "present").length;
  const lateCount = attendance.filter((a) => a.status === "late").length;
  const presentOrLate = presentCount + lateCount;
  const attendanceRate = totalCount > 0 ? Math.round((presentOrLate / totalCount) * 100) : 0;

  return (
    <Modal open={true} onOpenChange={(open) => { if (!open) onClose(); }} panelClassName="max-w-2xl">
      <ModalHeader>
        <ModalTitle>
          {isFarsi ? "جزئیات و حضور و غیاب جلسه" : "Session Details & Attendance"}
        </ModalTitle>
      </ModalHeader>
      <ModalBody>
        {/* Session Info & Visual Progress Rate */}
        <div className="flex flex-col sm:flex-row items-center gap-6 bg-[var(--s3)] p-4 rounded-2xl border border-[var(--b)] mb-4">
          <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="40" cy="40" r="34" className="stroke-[var(--b)] fill-none" strokeWidth="6" />
              <circle
                cx="40"
                cy="40"
                r="34"
                className="stroke-[var(--green)] fill-none transition-all duration-500 ease-out"
                strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - attendanceRate / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-sm font-bold text-[var(--t1)]">{attendanceRate}%</span>
          </div>
          <div className="flex-1 text-center sm:text-start flex flex-col gap-1">
            <h3 className="text-sm font-bold text-[var(--t1)]">{session?.title || "—"}</h3>
            <span className="text-xs text-[var(--t3)]">
              {isFarsi ? "کلاس:" : "Class:"} <strong className="text-[var(--t2)]">{session?.academy_class_name || "—"}</strong>
            </span>
            <span className="text-xs text-[var(--t3)]">
              {isFarsi ? "مدرس:" : "Host:"} <strong className="text-[var(--t2)]">{session?.host_name || "—"}</strong>
            </span>
            <div className="flex gap-3 mt-1.5 justify-center sm:justify-start text-[10px] font-semibold text-[var(--t3)]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--green)]" />
                {isFarsi ? `حاضر/تاخیر: ${presentOrLate}` : `Present/Late: ${presentOrLate}`}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--red)]" />
                {isFarsi ? `غایب: ${totalCount - presentOrLate}` : `Absent: ${totalCount - presentOrLate}`}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--b)]" />
                {isFarsi ? `کل: ${totalCount}` : `Total: ${totalCount}`}
              </span>
            </div>
          </div>
        </div>

        {/* LiveKit Recording Egress Controls */}
        {session?.status === "live" && activeRoomCode && canManage && (
          <div className="flex flex-col gap-2 bg-[var(--s3)] p-4 rounded-2xl border border-[var(--b)] mb-4">
            <span className="text-xs font-semibold text-[var(--t3)] uppercase tracking-wider">
              {isFarsi ? "مدیریت ضبط زنده (LiveKit Egress)" : "Live Recording Controls"}
            </span>
            <div className="flex items-center justify-between gap-4 mt-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  recStatus?.status === "recording"
                    ? "bg-[var(--red)] animate-pulse"
                    : recStatus?.status === "starting" || recStatus?.status === "processing"
                    ? "bg-[var(--amber)] animate-pulse"
                    : "bg-[var(--t3)]"
                }`} />
                <span className="text-xs font-semibold text-[var(--t1)]">
                  {recStatus?.status === "recording" && (isFarsi ? "در حال ضبط زنده..." : "Recording Live...")}
                  {recStatus?.status === "starting" && (isFarsi ? "در حال آماده‌سازی..." : "Initializing...")}
                  {recStatus?.status === "processing" && (isFarsi ? "در حال پردازش ویدیو..." : "Processing video...")}
                  {(!recStatus || recStatus.status === "idle") && (isFarsi ? "غیرفعال" : "Idle")}
                  {recStatus?.status === "failed" && (isFarsi ? "ضبط با خطا مواجه شد" : "Failed")}
                </span>
              </div>
              
              <div className="flex gap-2">
                {(!recStatus || recStatus.status === "idle" || recStatus.status === "failed") ? (
                  <Button
                    size="sm"
                    onClick={() => startRecordingMutation.mutate()}
                    loading={startRecordingMutation.isPending}
                    variant="success"
                  >
                    {isFarsi ? "شروع ضبط" : "Start Recording"}
                  </Button>
                ) : recStatus.status === "recording" ? (
                  <Button
                    size="sm"
                    onClick={() => stopRecordingMutation.mutate()}
                    loading={stopRecordingMutation.isPending}
                    variant="danger"
                  >
                    {isFarsi ? "توقف ضبط" : "Stop Recording"}
                  </Button>
                ) : (
                  <Button size="sm" disabled variant="secondary">
                    {isFarsi ? "کمی صبر کنید..." : "Please wait..."}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bulk attendance tools */}
        {canManage && attendance.length > 0 && (
          <div className="flex gap-2 items-center bg-[var(--s3)] p-3 rounded-xl border border-[var(--b)] mb-4">
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

        {/* Attendance table */}
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
                <tr className="border-b border-[var(--b)] text-[var(--t3)] bg-[var(--s3)] text-left">
                  <th className="p-3">{isFarsi ? "نام دانشجو" : "Student Name"}</th>
                  <th className="p-3">{isFarsi ? "وضعیت" : "Status"}</th>
                  <th className="p-3">{isFarsi ? "یادداشت مدرس" : "Teacher Note"}</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((att) => (
                  <tr key={att.id} className="border-b border-[var(--b)] hover:bg-[var(--s3)] transition-colors text-left">
                    <td className="p-3 font-medium text-[var(--t1)]">
                      {att.student_full_name} ({att.student_username})
                    </td>
                    <td className="p-3">
                      {canManage ? (
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
                      {canManage ? (
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

import { useState } from "react";
import { toast } from "react-hot-toast";
import {
  useSessionAttendance,
  useUpdateAttendance,
} from "../../sessions/hooks";
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalClose } from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import Spinner from "../../../components/ui/Spinner";

interface AttendanceModalProps {
  sessionId: number;
  language: string;
  onClose: () => void;
  canManageCRM: boolean;
}

export default function AttendanceModal({
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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionsApi } from "../api/sessions.api";

export function useUpdateAttendance(sessionId: number) {
  const queryClient = useQueryClient();

  const updateSingle = useMutation({
    mutationFn: ({
      studentId,
      status,
      note,
    }: {
      studentId: number;
      status: string;
      note?: string;
    }) => sessionsApi.updateStudentAttendance(sessionId, studentId, status, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", sessionId] });
    },
  });

  const updateBulk = useMutation({
    mutationFn: (
      records: { student_id: number; status: string; note?: string }[]
    ) => sessionsApi.bulkUpdateAttendance(sessionId, records),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", sessionId] });
    },
  });

  return {
    updateSingle,
    updateBulk,
  };
}

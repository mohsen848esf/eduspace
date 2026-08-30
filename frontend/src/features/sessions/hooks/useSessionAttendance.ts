import { useQuery } from "@tanstack/react-query";
import { sessionsApi } from "../api/sessions.api";
import type { Attendance } from "../types";

export function useSessionAttendance(sessionId: number) {
  return useQuery<Attendance[]>({
    queryKey: ["attendance", sessionId],
    queryFn: () => sessionsApi.getAttendance(sessionId),
    enabled: !!sessionId,
  });
}

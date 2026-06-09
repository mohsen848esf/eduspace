import { useQuery } from "@tanstack/react-query";
import { sessionsApi } from "../api/sessions.api";
import type { Session } from "../types";

export function useSessions(classId?: number, status?: string) {
  return useQuery<Session[]>({
    queryKey: ["sessions", { classId, status }],
    queryFn: () => sessionsApi.getSessions({ class_id: classId, status }),
  });
}

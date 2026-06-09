import { useQuery } from "@tanstack/react-query";
import { sessionsApi } from "../api/sessions.api";
import type { Session } from "../types";

export function useSession(id: number) {
  return useQuery<Session>({
    queryKey: ["session", id],
    queryFn: () => sessionsApi.getSession(id),
    enabled: !!id,
  });
}

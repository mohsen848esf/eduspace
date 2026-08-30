import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionsApi } from "../api/sessions.api";

export function useCompleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => sessionsApi.completeSession(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["session", id] });
      queryClient.invalidateQueries({ queryKey: ["attendance", id] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["class"] });
    },
  });
}

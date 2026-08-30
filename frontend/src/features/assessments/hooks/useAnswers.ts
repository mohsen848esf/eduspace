import { useMutation, useQueryClient } from "@tanstack/react-query";
import { assessmentsApi } from "../api/assessments.api";

export function useUpdateAnswer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { selected_options?: string[] | null; text_answer?: string | null } }) =>
      assessmentsApi.updateAnswer(id, data),
    onSuccess: (answer) => {
      queryClient.invalidateQueries({ queryKey: ["submission", answer.submission] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });
}

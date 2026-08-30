import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assessmentsApi } from "../api/assessments.api";
import type { Question } from "../types";

export function useQuestions(enabled: boolean = true) {
  return useQuery<Question[]>({
    queryKey: ["questions"],
    queryFn: () => assessmentsApi.getQuestions(),
    enabled,
  });
}

export function useCreateQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Question>) => assessmentsApi.createQuestion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions"] });
    },
  });
}

export function useUpdateQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Question> }) =>
      assessmentsApi.updateQuestion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions"] });
    },
  });
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => assessmentsApi.deleteQuestion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions"] });
    },
  });
}

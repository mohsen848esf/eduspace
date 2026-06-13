import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assessmentsApi } from "../api/assessments.api";
import type { QuestionBank } from "../types";

export function useQuestionBanks(enabled: boolean = true) {
  return useQuery<QuestionBank[]>({
    queryKey: ["question-banks"],
    queryFn: () => assessmentsApi.getQuestionBanks(),
    enabled,
  });
}

export function useCreateQuestionBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<QuestionBank>) => assessmentsApi.createQuestionBank(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-banks"] });
    },
  });
}

export function useUpdateQuestionBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<QuestionBank> }) =>
      assessmentsApi.updateQuestionBank(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-banks"] });
    },
  });
}

export function useDeleteQuestionBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => assessmentsApi.deleteQuestionBank(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-banks"] });
    },
  });
}

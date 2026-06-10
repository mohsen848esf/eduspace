import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assessmentsApi } from "../api/assessments.api";
import type { Submission } from "../types";

export function useStartAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => assessmentsApi.startAssessment(id),
    onSuccess: (submission) => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["submission", submission.id] });
    },
  });
}

export function useSubmissions(params?: { assessment_id?: number }) {
  return useQuery<Submission[]>({
    queryKey: ["submissions", params],
    queryFn: () => assessmentsApi.getSubmissions(params),
  });
}

export function useSubmission(id: number) {
  return useQuery<Submission>({
    queryKey: ["submission", id],
    queryFn: () => assessmentsApi.getSubmission(id),
    enabled: !!id,
  });
}

export function useSubmitSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => assessmentsApi.submitSubmission(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["submission", id] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
    },
  });
}

export function useGradeSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, gradesDict }: { id: number; gradesDict: Record<number, any> }) =>
      assessmentsApi.gradeSubmission(id, gradesDict),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["submission", id] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });
}

export function useRecordTabLoss() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => assessmentsApi.recordTabLoss(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["submission", id] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });
}

export function useUpdateTelemetry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { ip_address?: string; browser_info?: string } }) =>
      assessmentsApi.updateTelemetry(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["submission", id] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assessmentsApi } from "../api/assessments.api";
import type { Assessment } from "../types";

export function useAssessments() {
  return useQuery<Assessment[]>({
    queryKey: ["assessments"],
    queryFn: () => assessmentsApi.getAssessments(),
  });
}

export function useAssessment(id: number) {
  return useQuery<Assessment>({
    queryKey: ["assessment", id],
    queryFn: () => assessmentsApi.getAssessment(id),
    enabled: !!id,
  });
}

export function useCreateAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Assessment>) => assessmentsApi.createAssessment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
    },
  });
}

export function useUpdateAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Assessment> }) =>
      assessmentsApi.updateAssessment(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["assessment", id] });
    },
  });
}

export function useDeleteAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => assessmentsApi.deleteAssessment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
    },
  });
}

export function usePublishAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => assessmentsApi.publishAssessment(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["assessment", id] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assessmentsApi } from "../api/assessments.api";
import type { QuestionBank, Question, Assessment, Submission } from "../types";

// --- QuestionBanks Queries & Mutations ---

export function useQuestionBanks() {
  return useQuery<QuestionBank[]>({
    queryKey: ["question-banks"],
    queryFn: () => assessmentsApi.getQuestionBanks(),
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

// --- Questions Queries & Mutations ---

export function useQuestions() {
  return useQuery<Question[]>({
    queryKey: ["questions"],
    queryFn: () => assessmentsApi.getQuestions(),
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

// --- Assessments Queries & Mutations ---

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

// --- Submissions Queries & Mutations ---

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
    },
  });
}

// --- Answers Mutations ---

export function useUpdateAnswer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { selected_options?: string[] | null; text_answer?: string | null } }) =>
      assessmentsApi.updateAnswer(id, data),
    onSuccess: (answer) => {
      queryClient.invalidateQueries({ queryKey: ["submission", answer.submission] });
    },
  });
}

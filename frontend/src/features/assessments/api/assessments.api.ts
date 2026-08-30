import client from "../../../lib/api/client";
import type { QuestionBank, Question, Assessment, AssessmentWritePayload, Submission, SubmissionGrades, StudentAnswer, Assignment, AssignmentSubmission } from "../types";
import { unwrapList, type PaginatedResponse } from "@/lib/api/pagination";

export const assessmentsApi = {
  // QuestionBanks API
  getQuestionBanks: async (): Promise<QuestionBank[]> => {
    const res = await client.get("/assessments/question-banks/");
    return res.data;
  },
  createQuestionBank: async (data: Partial<QuestionBank>): Promise<QuestionBank> => {
    const res = await client.post("/assessments/question-banks/", data);
    return res.data;
  },
  updateQuestionBank: async (id: number, data: Partial<QuestionBank>): Promise<QuestionBank> => {
    const res = await client.patch(`/assessments/question-banks/${id}/`, data);
    return res.data;
  },
  deleteQuestionBank: async (id: number): Promise<void> => {
    await client.delete(`/assessments/question-banks/${id}/`);
  },

  // Questions API
  getQuestions: async (): Promise<Question[]> => {
    const res = await client.get("/assessments/questions/");
    return res.data;
  },
  createQuestion: async (data: Partial<Question>): Promise<Question> => {
    const res = await client.post("/assessments/questions/", data);
    return res.data;
  },
  updateQuestion: async (id: number, data: Partial<Question>): Promise<Question> => {
    const res = await client.patch(`/assessments/questions/${id}/`, data);
    return res.data;
  },
  deleteQuestion: async (id: number): Promise<void> => {
    await client.delete(`/assessments/questions/${id}/`);
  },

  // Assessments (Exams) API
  getAssessments: async (params?: { class_id?: number; session_id?: number }): Promise<Assessment[]> => {
    const res = await client.get("/assessments/assessments/", { params });
    return res.data;
  },
  getAssessment: async (id: number): Promise<Assessment> => {
    const res = await client.get(`/assessments/assessments/${id}/`);
    return res.data;
  },
  createAssessment: async (data: AssessmentWritePayload): Promise<Assessment> => {
    const res = await client.post("/assessments/assessments/", data);
    return res.data;
  },
  updateAssessment: async (id: number, data: Partial<AssessmentWritePayload>): Promise<Assessment> => {
    const res = await client.patch(`/assessments/assessments/${id}/`, data);
    return res.data;
  },
  deleteAssessment: async (id: number): Promise<void> => {
    await client.delete(`/assessments/assessments/${id}/`);
  },
  publishAssessment: async (id: number): Promise<{ status: string }> => {
    const res = await client.post(`/assessments/assessments/${id}/publish/`);
    return res.data;
  },
  startAssessment: async (id: number): Promise<Submission> => {
    const res = await client.post(`/assessments/assessments/${id}/start/`);
    return res.data;
  },
  getAssessmentAnalytics: async (id: number): Promise<{ average_score: number; highest_score: number; average_tab_focus_losses: number }> => {
    const res = await client.get(`/assessments/assessments/${id}/analytics/`);
    return res.data;
  },

  // Submissions API
  getSubmissions: async (params?: { assessment_id?: number; class_id?: number }): Promise<Submission[]> => {
    const res = await client.get("/assessments/submissions/", { params });
    return res.data;
  },
  getSubmission: async (id: number): Promise<Submission> => {
    const res = await client.get(`/assessments/submissions/${id}/`);
    return res.data;
  },
  submitSubmission: async (id: number): Promise<Submission> => {
    const res = await client.post(`/assessments/submissions/${id}/submit/`);
    return res.data;
  },
  gradeSubmission: async (
    id: number,
    gradesDict: SubmissionGrades,
  ): Promise<Submission> => {
    const res = await client.post(`/assessments/submissions/${id}/grade/`, { grades_dict: gradesDict });
    return res.data;
  },
  recordTabLoss: async (
    id: number,
    antiCheatToken: string
  ): Promise<{ tab_focus_losses: number; anomaly_detected: boolean; anti_cheat_token: string }> => {
    const res = await client.post(`/assessments/submissions/${id}/record-tab-loss/`, {
      anti_cheat_token: antiCheatToken,
    });
    return res.data;
  },
  updateTelemetry: async (id: number, data: { ip_address?: string; browser_info?: string }): Promise<Submission> => {
    const res = await client.post(`/assessments/submissions/${id}/update-telemetry/`, data);
    return res.data;
  },

  // Answers API
  updateAnswer: async (id: number, data: { selected_options?: string[] | null; text_answer?: string | null }): Promise<StudentAnswer> => {
    const res = await client.patch(`/assessments/answers/${id}/`, data);
    return res.data;
  },

  // Assignments API
  getAssignments: async (params?: { class_id?: number }): Promise<Assignment[]> => {
    const res = await client.get("/assessments/assignments/", { params });
    return res.data;
  },
  getAssignment: async (id: number): Promise<Assignment> => {
    const res = await client.get(`/assessments/assignments/${id}/`);
    return res.data;
  },
  createAssignment: async (data: FormData | Partial<Assignment>): Promise<Assignment> => {
    const headers = data instanceof FormData ? { "Content-Type": "multipart/form-data" } : {};
    const res = await client.post("/assessments/assignments/", data, { headers });
    return res.data;
  },
  updateAssignment: async (id: number, data: FormData | Partial<Assignment>): Promise<Assignment> => {
    const headers = data instanceof FormData ? { "Content-Type": "multipart/form-data" } : {};
    const res = await client.patch(`/assessments/assignments/${id}/`, data, { headers });
    return res.data;
  },
  deleteAssignment: async (id: number): Promise<void> => {
    await client.delete(`/assessments/assignments/${id}/`);
  },

  // Assignment Submissions API
  getAssignmentSubmissions: async (params?: { assignment_id?: number; class_id?: number }): Promise<AssignmentSubmission[]> => {
    const res = await client.get<
      AssignmentSubmission[] | PaginatedResponse<AssignmentSubmission>
    >("/assessments/assignment-submissions/", { params });
    return unwrapList(res.data);
  },
  getAssignmentSubmission: async (id: number): Promise<AssignmentSubmission> => {
    const res = await client.get(`/assessments/assignment-submissions/${id}/`);
    return res.data;
  },
  createAssignmentSubmission: async (data: FormData | Partial<AssignmentSubmission>): Promise<AssignmentSubmission> => {
    const headers = data instanceof FormData ? { "Content-Type": "multipart/form-data" } : {};
    const res = await client.post("/assessments/assignment-submissions/", data, { headers });
    return res.data;
  },
  gradeAssignmentSubmission: async (id: number, data: { grade: number; feedback: string }): Promise<AssignmentSubmission> => {
    const res = await client.patch(`/assessments/assignment-submissions/${id}/`, data);
    return res.data;
  },
};

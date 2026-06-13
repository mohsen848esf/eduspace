import client from "../../../lib/api/client";
import type { QuestionBank, Question, Assessment, Submission, StudentAnswer } from "../types";

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
  getAssessments: async (): Promise<Assessment[]> => {
    const res = await client.get("/assessments/assessments/");
    return res.data;
  },
  getAssessment: async (id: number): Promise<Assessment> => {
    const res = await client.get(`/assessments/assessments/${id}/`);
    return res.data;
  },
  createAssessment: async (data: Partial<Assessment>): Promise<Assessment> => {
    const res = await client.post("/assessments/assessments/", data);
    return res.data;
  },
  updateAssessment: async (id: number, data: Partial<Assessment>): Promise<Assessment> => {
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

  // Submissions API
  getSubmissions: async (params?: { assessment_id?: number }): Promise<Submission[]> => {
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
  gradeSubmission: async (id: number, gradesDict: Record<number, any>): Promise<Submission> => {
    const res = await client.post(`/assessments/submissions/${id}/grade/`, { grades_dict: gradesDict });
    return res.data;
  },
  recordTabLoss: async (id: number): Promise<{ tab_focus_losses: number; anomaly_detected: boolean }> => {
    const res = await client.post(`/assessments/submissions/${id}/record-tab-loss/`);
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
};

export type QuestionType = "single_choice" | "multiple_choice" | "text" | "code";

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: number;
  question_bank: number;
  text: string;
  question_type: QuestionType;
  options: QuestionOption[];
  points: string;
  is_active: boolean;
  correct_answer?: string[] | string | Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface QuestionBank {
  id: number;
  title: string;
  description: string;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AssessmentQuestion {
  id: number;
  question: Question;
  order: number;
  points: string;
}

export interface Assessment {
  id: number;
  session?: number | null;
  session_title?: string;
  title: string;
  description: string;
  questions: AssessmentQuestion[];
  duration_minutes: number;
  passing_score: string;
  is_published: boolean;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
}

export type SubmissionStatus = "started" | "submitted" | "graded";

export interface StudentAnswer {
  id: number;
  submission: number;
  question: number;
  selected_options: string[] | null;
  text_answer: string | null;
  score: string;
  is_correct: boolean;
  teacher_notes?: string;
}

export interface Submission {
  id: number;
  assessment: Assessment;
  student: number;
  student_username: string;
  status: SubmissionStatus;
  started_at: string;
  submitted_at: string | null;
  score: string;
  graded_by: number | null;
  graded_at: string | null;
  tab_focus_losses: number;
  browser_info: string;
  ip_address: string | null;
  answers: StudentAnswer[];
}

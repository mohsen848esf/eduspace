import client from "../../../lib/api/client";

// ── Types ──────────────────────────────────────────────────────────────────── //

export interface CourseAverage {
  id: number;
  code: string;
  title: string;
  avg_grade: number;
  graded_count: number;
}

export interface StaffSessionCount {
  user_id: number;
  full_name: string;
  role: string;
  session_count: number;
}

export interface ClassProgressRate {
  id: number;
  name: string;
  course_code: string;
  enrolled_count: number;
  total_assignments: number;
  total_submitted: number;
  completion_rate: number;
}

export interface AnalyticsSummary {
  active_sessions: number;
  active_students: number;
  total_submissions: number;
  average_grade: number;
  quota: { max_students: number; max_storage_gb: number; max_recording_minutes: number };
  usage: { students_count: number; storage_used_gb: number; recording_minutes_used: number };
  course_averages: CourseAverage[];
  staff_session_counts: StaffSessionCount[];
  class_progress_rates: ClassProgressRate[];
  timestamp: string;
}

// ── API ────────────────────────────────────────────────────────────────────── //

export const reportsApi = {
  /** Fetch the full analytics summary (KPIs + chart data). */
  getAnalyticsSummary: async (): Promise<AnalyticsSummary> => {
    const response = await client.get("/analytics/summary/");
    return response.data;
  },

  exportReport: async (type: "grades" | "financials" | "attendance"): Promise<void> => {
    const response = await client.get(`/analytics/reports/export/?type=${type}`, {
      responseType: "blob",
    });
    const blob = new Blob([response.data], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${type}_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  requestGDPRData: async (): Promise<void> => {
    const response = await client.post("/auth/privacy/request-export/");
    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `gdpr_personal_data_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  deleteAccount: async (password: string): Promise<{ detail: string }> => {
    const response = await client.post("/auth/privacy/delete-account/", { password });
    return response.data;
  },
};


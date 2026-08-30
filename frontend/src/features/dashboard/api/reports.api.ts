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

export interface OrgKPIs {
  total_students: number;
  total_teachers: number;
  total_mentors: number;
  total_courses: number;
  total_classes: number;
  total_sessions: number;
}

export interface AcademicKPIs {
  assignment_completion_rate: number;
  attendance_rate: number;
  average_grade: number;
  average_assignment_grade: number;
  active_students: number;
  at_risk_students_count: number;
}

export interface AtRiskStudent {
  user_id: number;
  username: string;
  full_name: string;
  attendance_rate: number;
  missing_assignments_count: number;
  avg_grade: number | null;
  risk_flags: ("low_attendance" | "missing_assignments" | "poor_grades")[];
}

export interface TeacherAnalytic {
  user_id: number;
  full_name: string;
  classes_count: number;
  students_count: number;
  sessions_count: number;
  pending_reviews: number;
}

export interface MentorAnalytic {
  user_id: number;
  full_name: string;
  students_count: number;
  active_relationships: number;
  at_risk_count: number;
  follow_up_workload: number;
}

export interface CourseAnalytic {
  id: number;
  code: string;
  title: string;
  enrollment_count: number;
  completion_rate: number;
  revenue_generated: number;
  attendance_average: number;
  avg_grade: number;
}

export interface ClassAttendanceTrend {
  session_id: number;
  title: string;
  rate: number;
  scheduled_start: string | null;
}

export interface ClassAnalytic {
  id: number;
  name: string;
  course_code: string;
  student_count: number;
  attendance_trend: ClassAttendanceTrend[];
  assignment_completion: number;
  revenue_summary: {
    paid: number;
    outstanding: number;
  };
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
  // Extended H.7 complete metrics
  org_kpis: OrgKPIs;
  academic_kpis: AcademicKPIs;
  at_risk_students: AtRiskStudent[];
  teacher_analytics: TeacherAnalytic[];
  mentor_analytics: MentorAnalytic[];
  course_analytics: CourseAnalytic[];
  class_analytics: ClassAnalytic[];
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


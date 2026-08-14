import type { Session } from "../../sessions/types";

export interface Course {
  id: number;
  title: string;
  code: string;
  description: string;
  price: string;
  thumbnail?: string | null;
  created_at: string;
}

export interface AcademyClass {
  id: number;
  course: number;
  course_title?: string;
  course_code?: string;
  teacher?: number | null;
  teacher_name?: string;
  mentor?: number | null;
  mentor_name?: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  room?: string | null;
  created_at: string;
  session_count?: number;
  latest_session?: Session | null;
  student_ids?: number[];
  enrolled_student_ids?: number[];
  scheduling_mode?: "manual" | "automatic";
  capacity_mode?: "unlimited" | "limited";
  max_students?: number | null;
  recurrence_weekdays?: string[];
  recurrence_start_time?: string | null;
  recurrence_duration_minutes?: number | null;
  recurrence_timezone?: string;
  recurrence_end_mode?: "date" | "occurrences";
  recurrence_max_occurrences?: number | null;
  google_calendar_id?: string | null;
}

export interface ClassOccurrence {
  id: number;
  academy_class: number;
  academy_class_name?: string;
  occurrence_id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: "scheduled" | "live" | "completed" | "cancelled";
  room?: number | null;
  room_code?: string | null;
  google_event_id?: string | null;
  attendance_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Enrollment {
  id: number;
  academy_class: number;
  class_name?: string;
  student: number;
  student_username?: string;
  student_full_name?: string;
  enrolled_at: string;
  is_active: boolean;
  completion_status?: "in_progress" | "completed" | "dropped";
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface FinanceSummary {
  revenue: number;
  expenses: number;
  outstanding: number;
  collection_rate: number;
  monthly_trends: {
    label: string;
    revenue: number;
    expense: number;
  }[];
}

export interface TuitionInvoiceItem {
  description: string;
  quantity: number;
  unit_price: string;
}

export interface TuitionInvoice {
  id: number;
  student: number;
  student_username?: string;
  student_full_name?: string;
  academy_class: number | null;
  class_name?: string;
  amount: string;
  status: "paid" | "unpaid" | "partial" | "overdue" | "cancelled" | "refunded" | "void";
  due_date: string | null;
  paid_at: string | null;
  payment_method?: "cash" | "bank_transfer" | "online" | "";
  notes?: string;
  items?: TuitionInvoiceItem[];
  invoice_number?: string;
  created_at: string;
}

export interface ExpenseItem {
  id: number;
  amount: string;
  category: "rent" | "utilities" | "teacher_payout" | "marketing" | "infrastructure" | "other";
  description: string;
  recipient?: number | null;
  recipient_username?: string;
  recipient_full_name?: string;
  approved_by?: number | null;
  approved_by_name?: string;
  attachment?: string | File | null;
  incurred_at: string;
  created_at: string;
}

export interface SimpleUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
}

export interface OrgMember {
  id: number;
  user: number;
  user_details: {
    id: number;
    username: string;
    email: string;
    full_name: string;
    avatar?: string | null;
    is_online: boolean;
    is_superuser: boolean;
  };
  role: number | null;
  role_name?: string;
  is_active: boolean;
  contract_type: "full_time" | "part_time" | "contractor" | "guest";
  joined_at: string;
  expires_at: string | null;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  permissions: string[];
}

export interface Permission {
  codename: string;
  name: string;
  description: string;
}

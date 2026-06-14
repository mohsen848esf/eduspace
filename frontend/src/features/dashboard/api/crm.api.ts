import client from "../../../lib/api/client";
import type { Session } from "../../sessions/types";

export interface Course {
  id: number;
  title: string;
  code: string;
  description: string;
  price: string;
  created_at: string;
}

export interface AcademyClass {
  id: number;
  course: number;
  course_title?: string;
  course_code?: string;
  teacher?: number | null;
  teacher_name?: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  room?: string | null;
  created_at: string;
  session_count?: number;
  latest_session?: Session | null;
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
  status: "paid" | "unpaid" | "void" | "cancelled";
  due_date: string | null;
  paid_at: string | null;
  payment_method?: "cash" | "bank_transfer" | "online" | "";
  notes?: string;
  items?: TuitionInvoiceItem[];
  created_at: string;
}

export interface ExpenseItem {
  id: number;
  amount: string;
  category: "rent" | "utilities" | "teacher_payout" | "marketing" | "other";
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
  role: "student" | "teacher" | "admin";
}

export const crmApi = {
  // Courses CRUD
  getCourses: async (): Promise<Course[]> => {
    const res = await client.get("/auth/courses/?include_archived=true");
    return res.data;
  },
  createCourse: async (data: Partial<Course>): Promise<Course> => {
    const res = await client.post("/auth/courses/", data);
    return res.data;
  },
  updateCourse: async (id: number, data: Partial<Course>): Promise<Course> => {
    const res = await client.patch(`/auth/courses/${id}/`, data);
    return res.data;
  },
  deleteCourse: async (id: number): Promise<void> => {
    await client.delete(`/auth/courses/${id}/`);
  },

  // Classes CRUD
  getClasses: async (): Promise<AcademyClass[]> => {
    const res = await client.get("/auth/classes/?include_archived=true");
    return res.data;
  },
  createClass: async (data: Partial<AcademyClass>): Promise<AcademyClass> => {
    const res = await client.post("/auth/classes/", data);
    return res.data;
  },
  updateClass: async (id: number, data: Partial<AcademyClass>): Promise<AcademyClass> => {
    const res = await client.patch(`/auth/classes/${id}/`, data);
    return res.data;
  },
  deleteClass: async (id: number): Promise<void> => {
    await client.delete(`/auth/classes/${id}/`);
  },

  // Enrollments CRUD
  getEnrollments: async (): Promise<Enrollment[]> => {
    const res = await client.get("/auth/enrollments/?include_archived=true");
    return res.data;
  },
  createEnrollment: async (data: Partial<Enrollment>): Promise<Enrollment> => {
    const res = await client.post("/auth/enrollments/", data);
    return res.data;
  },
  updateEnrollment: async (id: number, data: Partial<Enrollment>): Promise<Enrollment> => {
    const res = await client.patch(`/auth/enrollments/${id}/`, data);
    return res.data;
  },
  deleteEnrollment: async (id: number): Promise<void> => {
    await client.delete(`/auth/enrollments/${id}/`);
  },

  // Invoices CRUD
  getInvoices: async (): Promise<TuitionInvoice[]> => {
    const res = await client.get("/auth/invoices/");
    return res.data;
  },
  createInvoice: async (data: Partial<TuitionInvoice>): Promise<TuitionInvoice> => {
    const res = await client.post("/auth/invoices/", data);
    return res.data;
  },
  updateInvoice: async (id: number, data: Partial<TuitionInvoice>): Promise<TuitionInvoice> => {
    const res = await client.patch(`/auth/invoices/${id}/`, data);
    return res.data;
  },
  deleteInvoice: async (id: number): Promise<void> => {
    await client.delete(`/auth/invoices/${id}/`);
  },

  // Expenses CRUD
  getExpenses: async (): Promise<ExpenseItem[]> => {
    const res = await client.get("/auth/expenses/");
    return res.data;
  },
  createExpense: async (data: FormData | Partial<ExpenseItem>): Promise<ExpenseItem> => {
    const headers = data instanceof FormData ? { "Content-Type": "multipart/form-data" } : {};
    const res = await client.post("/auth/expenses/", data, { headers });
    return res.data;
  },
  updateExpense: async (id: number, data: FormData | Partial<ExpenseItem>): Promise<ExpenseItem> => {
    const headers = data instanceof FormData ? { "Content-Type": "multipart/form-data" } : {};
    const res = await client.patch(`/auth/expenses/${id}/`, data, { headers });
    return res.data;
  },
  deleteExpense: async (id: number): Promise<void> => {
    await client.delete(`/auth/expenses/${id}/`);
  },
  approveExpense: async (id: number): Promise<ExpenseItem> => {
    const res = await client.post(`/auth/expenses/${id}/approve/`);
    return res.data;
  },

  // User search for selector
  searchUsers: async (q: string, role?: string): Promise<SimpleUser[]> => {
    const url = `/auth/search/?q=${encodeURIComponent(q)}${role ? `&role=${encodeURIComponent(role)}` : ""}`;
    const res = await client.get(url);
    return res.data;
  },
};

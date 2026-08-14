import client from "@/lib/api/client";
import type { PaginatedResponse, TuitionInvoice } from "../types/crm.types";

export const invoicesApi = {
  getInvoices: async (params?: {
    page?: number;
    page_size?: number;
    q?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    class_id?: number;
    course_id?: number;
  }): Promise<PaginatedResponse<TuitionInvoice>> => {
    const res = await client.get("/auth/invoices/", { params });
    return res.data;
  },
  getInvoiceBalance: async (params?: {
    student_id?: number;
    class_id?: number;
    course_id?: number;
  }): Promise<{
    outstanding: number;
    pending_count: number;
    total_billed: number;
    total_paid: number;
  }> => {
    const res = await client.get("/auth/invoices/balance/", { params });
    return res.data;
  },
  getInvoice: async (id: number): Promise<TuitionInvoice> => {
    const res = await client.get(`/auth/invoices/${id}/`);
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
};

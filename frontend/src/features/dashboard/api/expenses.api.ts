import client from "@/lib/api/client";
import type { ExpenseItem, FinanceSummary, PaginatedResponse } from "../types/crm.types";

export const expensesApi = {
  getExpenses: async (params?: {
    page?: number;
    page_size?: number;
    q?: string;
    category?: string;
    min_amount?: string;
    max_amount?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<PaginatedResponse<ExpenseItem>> => {
    const res = await client.get("/auth/expenses/", { params });
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
  getFinanceSummary: async (): Promise<FinanceSummary> => {
    const res = await client.get("/auth/finance/summary/");
    return res.data;
  },
};

import client from "@/lib/api/client";
import type { Enrollment } from "../types/crm.types";

export const enrollmentsApi = {
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
};

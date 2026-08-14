import client from "@/lib/api/client";
import type { Course } from "../types/crm.types";

export const coursesApi = {
  getCourses: async (): Promise<Course[]> => {
    const res = await client.get("/auth/courses/?include_archived=true");
    return res.data;
  },
  createCourse: async (data: FormData | Partial<Course>): Promise<Course> => {
    const headers = data instanceof FormData ? { "Content-Type": "multipart/form-data" } : {};
    const res = await client.post("/auth/courses/", data, { headers });
    return res.data;
  },
  updateCourse: async (id: number, data: FormData | Partial<Course>): Promise<Course> => {
    const headers = data instanceof FormData ? { "Content-Type": "multipart/form-data" } : {};
    const res = await client.patch(`/auth/courses/${id}/`, data, { headers });
    return res.data;
  },
  deleteCourse: async (id: number): Promise<void> => {
    await client.delete(`/auth/courses/${id}/`);
  },
};

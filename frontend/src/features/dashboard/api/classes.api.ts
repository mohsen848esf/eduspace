import client from "@/lib/api/client";
import type { AcademyClass } from "../types/crm.types";

export const classesApi = {
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
  startAutomaticClass: async (id: number): Promise<{ active_room_code: string; id: number }> => {
    const res = await client.post(`/auth/classes/${id}/start/`);
    return res.data;
  },
};

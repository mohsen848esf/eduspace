import client from "@/lib/api/client";
import type { ClassOccurrence } from "../types/crm.types";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string | null;
  type: "session" | "occurrence" | "homework";
  status: string;
  class_id: number | null;
  details_url: string | null;
}

export const occurrencesApi = {
  getOccurrences: async (params?: { class_id?: number; status?: string }): Promise<ClassOccurrence[]> => {
    const res = await client.get("/auth/occurrences/", { params });
    return Array.isArray(res.data) ? res.data : res.data?.results || [];
  },
  startOccurrence: async (
    id: number
  ): Promise<{ occurrence: ClassOccurrence; token: string; room_code: string; livekit_url: string }> => {
    const res = await client.post(`/auth/occurrences/${id}/start/`);
    return res.data;
  },
  completeOccurrence: async (id: number): Promise<ClassOccurrence> => {
    const res = await client.post(`/auth/occurrences/${id}/complete/`);
    return res.data;
  },
  cancelOccurrence: async (id: number): Promise<ClassOccurrence> => {
    const res = await client.post(`/auth/occurrences/${id}/cancel/`);
    return res.data;
  },
  getCalendarEvents: async (): Promise<CalendarEvent[]> => {
    const res = await client.get<CalendarEvent[]>("/auth/calendar/");
    return res.data;
  },
};

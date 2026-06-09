import client from "../../../lib/api/client";
import type { Session, Attendance } from "../types";

export const sessionsApi = {
  getSessions: async (params?: { class_id?: number; status?: string }): Promise<Session[]> => {
    const res = await client.get("/auth/sessions/", { params });
    return res.data;
  },

  getSession: async (id: number): Promise<Session> => {
    const res = await client.get(`/auth/sessions/${id}/`);
    return res.data;
  },

  createSession: async (data: Partial<Session>): Promise<Session> => {
    const res = await client.post("/auth/sessions/", data);
    return res.data;
  },

  startSession: async (id: number): Promise<Session> => {
    const res = await client.post(`/auth/sessions/${id}/start/`);
    return res.data;
  },

  completeSession: async (id: number): Promise<Session> => {
    const res = await client.post(`/auth/sessions/${id}/complete/`);
    return res.data;
  },

  cancelSession: async (id: number): Promise<Session> => {
    const res = await client.post(`/auth/sessions/${id}/cancel/`);
    return res.data;
  },

  getAttendance: async (sessionId: number): Promise<Attendance[]> => {
    const res = await client.get(`/auth/sessions/${sessionId}/attendance/`);
    return res.data;
  },

  updateStudentAttendance: async (
    sessionId: number,
    studentId: number,
    status: string,
    note?: string
  ): Promise<Attendance> => {
    const res = await client.patch(
      `/auth/sessions/${sessionId}/attendance/${studentId}/`,
      { status, note }
    );
    return res.data;
  },

  bulkUpdateAttendance: async (
    sessionId: number,
    records: { student_id: number; status: string; note?: string }[]
  ): Promise<{ message: string; updated: number }> => {
    const res = await client.post(
      `/auth/sessions/${sessionId}/attendance/bulk/`,
      { records }
    );
    return res.data;
  },
};

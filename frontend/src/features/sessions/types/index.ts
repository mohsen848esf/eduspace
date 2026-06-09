export type SessionStatus = "scheduled" | "live" | "completed" | "cancelled";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface Session {
  id: number;
  academy_class: number;
  academy_class_name: string;
  organization: number;
  host: number;
  host_name: string;
  created_by: number | null;
  active_room: number | null;
  active_room_code: string | null;
  title: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  status: SessionStatus;
  created_at: string;
}

export interface Attendance {
  id: number;
  session: number;
  student: number;
  student_username: string;
  student_full_name: string;
  status: AttendanceStatus;
  joined_at: string | null;
  left_at: string | null;
  note: string;
}

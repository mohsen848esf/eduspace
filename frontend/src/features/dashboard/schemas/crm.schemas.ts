import { z } from "zod";

export const courseSchema = z.object({
  title: z.string().min(2, "Course title is required"),
  code: z.string().min(2, "Course code is required").toUpperCase(),
  description: z.string().optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Please enter a valid price (e.g. 150.00)"),
});

export type CourseFormData = z.infer<typeof courseSchema>;

export const classSchema = z.object({
  name: z.string().min(2, "Class name is required"),
  course: z.number({ message: "Course selection is required" }),
  teacher: z.number().nullable().optional(),
  mentor: z.number().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  room: z.string().optional(),
  scheduling_mode: z.enum(["manual", "automatic"]).default("manual"),
  capacity_mode: z.enum(["unlimited", "limited"]).default("unlimited"),
  max_students: z.number().nullable().optional(),
  recurrence_weekdays: z.array(z.string()).default([]),
  recurrence_start_time: z.string().nullable().optional(),
  recurrence_duration_minutes: z.number().default(60),
  recurrence_timezone: z.string().default("UTC"),
  recurrence_end_mode: z.enum(["date", "occurrences"]).default("date"),
  recurrence_max_occurrences: z.number().nullable().optional(),
});

export type ClassFormData = z.infer<typeof classSchema>;

export const invoiceSchema = z.object({
  student: z.number({ message: "Student is required" }),
  academy_class: z.number().nullable().optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valid amount required"),
  due_date: z.string().min(1, "Due date is required"),
  description: z.string().optional(),
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;

export const memberRoleSchema = z.object({
  role: z.string().min(1, "Role is required"),
  is_active: z.boolean().default(true),
  contract_type: z.string().default("full_time"),
});

export type MemberRoleFormData = z.infer<typeof memberRoleSchema>;

export const broadcastSchema = z.object({
  title: z.string().min(2, "Title is required"),
  message: z.string().min(5, "Message must be at least 5 characters"),
  channel: z.enum(["in_app", "email", "sms", "all"]).default("in_app"),
});

export type BroadcastFormData = z.infer<typeof broadcastSchema>;

/**
 * Centralized Query Key Factory
 *
 * Enforces structured, type-safe query key tuples across all React Query hooks
 * to avoid cache collision and key duplication.
 */

export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
    invitations: ["invitations"] as const,
    orgContext: (slug: string) => ["orgContext", slug] as const,
  },
  courses: {
    all: ["courses"] as const,
    detail: (id: number) => ["courses", id] as const,
  },
  classes: {
    all: ["classes"] as const,
    detail: (id: number) => ["classes", id] as const,
    balance: (id: number) => ["class-balance", id] as const,
    invoices: (id: number) => ["class-invoices", id] as const,
  },
  enrollments: {
    all: ["enrollments"] as const,
  },
  members: {
    all: ["orgMembers"] as const,
    detail: (id: number) => ["orgMembers", id] as const,
    roles: ["roles"] as const,
    permissions: ["permissions"] as const,
  },
  invoices: {
    all: ["invoices"] as const,
    list: (params?: Record<string, unknown>) => ["invoices", params] as const,
    detail: (id: number) => ["invoices", id] as const,
    balance: (params?: Record<string, unknown>) => ["invoice-balance", params] as const,
  },
  expenses: {
    all: ["expenses"] as const,
    list: (params?: Record<string, unknown>) => ["expenses", params] as const,
    summary: ["finance-summary"] as const,
  },
  occurrences: {
    all: ["occurrences"] as const,
    byClass: (classId?: number) => ["occurrences", { classId }] as const,
  },
  calendar: {
    events: ["calendar-events"] as const,
  },
  sessions: {
    all: ["sessions"] as const,
    byClass: (classId?: number) => ["sessions", { classId }] as const,
    byStatus: (status?: string) => ["sessions", { status }] as const,
    detail: (id: number) => ["sessions", id] as const,
  },
  assessments: {
    all: ["assessments"] as const,
    detail: (id: number) => ["assessments", id] as const,
    submissions: (assessmentId: number) => ["submissions", assessmentId] as const,
  },
  recordings: {
    all: ["recordings"] as const,
    detail: (token: string) => ["recordings", token] as const,
  },
  sharedMedia: {
    assets: (params?: Record<string, unknown>) => ["sharedMedia", "assets", params] as const,
    asset: (publicToken: string) => ["sharedMedia", "asset", publicToken] as const,
    history: (publicToken: string) => ["sharedMedia", "history", publicToken] as const,
    snapshot: (roomCode: string) => ["sharedMedia", "snapshot", roomCode] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    unread: ["notifications", "unread"] as const,
  },
};

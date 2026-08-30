import { coursesApi } from "./courses.api";
import { classesApi } from "./classes.api";
import { enrollmentsApi } from "./enrollments.api";
import { invoicesApi } from "./invoices.api";
import { expensesApi } from "./expenses.api";
import { occurrencesApi } from "./occurrences.api";
import { membersApi } from "./members.api";

export * from "../types/crm.types";
export * from "./courses.api";
export * from "./classes.api";
export * from "./enrollments.api";
export * from "./invoices.api";
export * from "./expenses.api";
export * from "./occurrences.api";
export * from "./members.api";

/**
 * Backwards-compatible crmApi object combining all domain APIs.
 * Preserves legacy component imports while transitioning to domain-specific modules.
 */
export const crmApi = {
  ...coursesApi,
  ...classesApi,
  ...enrollmentsApi,
  ...invoicesApi,
  ...expensesApi,
  ...occurrencesApi,
  ...membersApi,
};

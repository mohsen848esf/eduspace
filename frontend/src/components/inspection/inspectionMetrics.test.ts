import { describe, expect, it } from "vitest";
import { countMissingAssignments } from "./inspectionMetrics";
import type {
  Assignment,
  AssignmentSubmission,
} from "@/features/assessments/types";

const assignments = [
  { id: 1, due_date: "2026-08-01T00:00:00Z" },
  { id: 2, due_date: "2026-08-02T00:00:00Z" },
  { id: 3, due_date: "2026-09-01T00:00:00Z" },
] as Assignment[];

const submissions = [
  { id: 10, assignment: 1, student: 7 },
  { id: 11, assignment: 2, student: 99 },
] as AssignmentSubmission[];

describe("countMissingAssignments", () => {
  it("does not count another student's submission as the current student's work", () => {
    const result = countMissingAssignments(
      assignments,
      submissions,
      7,
      Date.parse("2026-08-28T00:00:00Z"),
    );

    expect(result).toBe(1);
  });
});

import type {
  Assignment,
  AssignmentSubmission,
} from "@/features/assessments/types";

export function countMissingAssignments(
  assignments: Assignment[],
  submissions: AssignmentSubmission[],
  studentId: number,
  now: number = Date.now(),
): number {
  const submittedAssignmentIds = new Set(
    submissions
      .filter((submission) => submission.student === studentId)
      .map((submission) => submission.assignment),
  );

  return assignments.filter(
    (assignment) =>
      !submittedAssignmentIds.has(assignment.id) &&
      assignment.due_date !== null &&
      new Date(assignment.due_date).getTime() < now,
  ).length;
}

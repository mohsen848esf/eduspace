# Persona Entity: Teacher

The `Teacher` entity is a role-scoped persona representing the academic instructor of the platform.

---

## 1. Purpose

It grants access to lecture delivery, whiteboard tools, classroom management, student assessment grading, and attendance tracking.

---

## 2. Relationships

A `Teacher` connects to:
* **User**: Associated via `OrgMember` role mapping (`role.name = 'Teacher'`).
* **AcademyClass**: Assigned as `teacher` (ForeignKey) on zero or more classes.
* **Session**: Assigned as the `host` (ForeignKey) on academic lectures.
* **Recording**: Associated as the creator (`owner_id`) of room stream recordings.
* **Submission / AssignmentSubmission**: Linked as the grader (`graded_by_id`).

---

## 3. Lifecycle

1. **Assignment**: A user is added to an organization as a `Teacher` role. They are subsequently assigned as the primary teacher of one or more classes.
2. **Execution**: The teacher schedules sessions, launches live rooms, leads lectures, runs interactive classroom games, marks student attendance, and grades assignments.
3. **Deactivation**: If their contract terminates, the admin deactivates their membership or reassigns their active classes to another teacher.

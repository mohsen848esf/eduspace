# Persona Entity: Student

The `Student` entity is the primary consumer of learning content on the platform.

---

## 1. Purpose

It scopes the user interface to student-specific tasks: joining live video streams, reviewing grades, submitting homework assignments, taking online quizzes, and reviewing invoices.

---

## 2. Relationships

A `Student` connects to:
* **User**: Associated via `OrgMember` role mapping (`role.name = 'Student'`).
* **Enrollment**: Linked through `Enrollment` tables to their active classes.
* **TuitionInvoice**: Recipient of class fee invoices.
* **Submission / AssignmentSubmission**: Author of quiz attempts and homework uploads.

---

## 3. Lifecycle

1. **Onboarding**: Registered by an admin or self-registered and enrolled into a class.
2. **Participation**: Attends live sessions, submits homework, answers quizzes, and views grades.
3. **Completion**: Upon finishing the class, they receive a Certificate or complete their course program.

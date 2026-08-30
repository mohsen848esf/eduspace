# EduSpace Audit & Demo Preparation Master Index

Welcome to the EduSpace platform reverse-engineering, audit, and demo documentation suite. This document serves as the central directory for all audit reports, technical manuals, API guides, and role-based roadmaps generated to help a new repository owner understand and demonstrate the EduSpace platform.

---

## 1. Recommended Reading Order

For a new repository owner, we recommend going through the documentation in the following sequence:

### Step 1: User & Database Archetypes
Get acquainted with the user catalog, access levels, permissions, and entity schemas.
1. [01-user-inventory.md](file:///d:/Wrok/Projects/eduspace/docs/demo/01-user-inventory.md) — Map of seeded database users and permissions matrix.
2. [02-demo-users-roadmap.md](file:///d:/Wrok/Projects/eduspace/docs/demo/02-demo-users-roadmap.md) — Strategies for testing both standalone and organization-scoped users.
3. [Entity Directory (Step 2)](#2-entity-knowledge-base) — Individual structural models.

### Step 2: UI & Administration Framework
Understand the page router, role visibility rules, and setup workflows.
1. [page-inventory.md](file:///d:/Wrok/Projects/eduspace/docs/frontend/page-inventory.md) — Index of routes, permissions, and backend APIs for every page.
2. [organization-setup-guide.md](file:///d:/Wrok/Projects/eduspace/docs/demo/organization-setup-guide.md) — Step-by-step setup from organization creation to live teaching.

### Step 3: Interactive Demo & Role Walks
Simulate scenarios for clients or practice typical user workflows.
1. [director-demo-script.md](file:///d:/Wrok/Projects/eduspace/docs/demo/director-demo-script.md) — Complete 15-minute presenter script designed for educational directors.
2. [Role Guides (Step 3)](#3-role-based-roadmaps) — Day-in-the-life walkthroughs for each persona.

### Step 4: Backend API & Code Integrity
Review the API endpoint architecture and change-tracking checklists.
1. [api/README.md](file:///d:/Wrok/Projects/eduspace/docs/api/README.md) — Mapping files and checking changes before committing code.
2. [API Reference (Step 4)](#4-complete-api-reference) — In-depth endpoint specifications.

### Step 5: System Auditing
Inspect gaps, constraints, and operational bottlenecks.
1. [feature-gap-analysis.md](file:///d:/Wrok/Projects/eduspace/docs/audit/feature-gap-analysis.md) — Codebase audit detailing complete, partial, and missing features.

---

## 2. Entity Knowledge Base

An overview of every data model, relationship, lifecycle, and Mermaid diagrams.

* [Organization](file:///d:/Wrok/Projects/eduspace/docs/entities/organization.md) — Scope definition and tenant separation.
* [User](file:///d:/Wrok/Projects/eduspace/docs/entities/user.md) — Auth, profile settings, and credentials.
* [Membership (OrgMember)](file:///d:/Wrok/Projects/eduspace/docs/entities/membership.md) — Mapping users to tenants with roles.
* [Role](file:///d:/Wrok/Projects/eduspace/docs/entities/role.md) — RBAC grouping sets.
* [Permission](file:///d:/Wrok/Projects/eduspace/docs/entities/permission.md) — Atomic permission codenames.
* [Course](file:///d:/Wrok/Projects/eduspace/docs/entities/course.md) — Curricula blueprints.
* [Class (AcademyClass)](file:///d:/Wrok/Projects/eduspace/docs/entities/class.md) — Student cohort instances.
* [Enrollment](file:///d:/Wrok/Projects/eduspace/docs/entities/enrollment.md) — Class cohort registration links.
* [Teacher Persona](file:///d:/Wrok/Projects/eduspace/docs/entities/teacher.md) — Academic instruction permissions and assignments.
* [Mentor Persona](file:///d:/Wrok/Projects/eduspace/docs/entities/mentor.md) — Read-only monitoring and tutor assistant tasks.
* [Student Persona](file:///d:/Wrok/Projects/eduspace/docs/entities/student.md) — Dashboard learning cards and homework.
* [Session](file:///d:/Wrok/Projects/eduspace/docs/entities/session.md) — Individual lecture event scheduling and live streams.
* [Attendance](file:///d:/Wrok/Projects/eduspace/docs/entities/attendance.md) — Cohort join/leave telemetry.
* [Assignment](file:///d:/Wrok/Projects/eduspace/docs/entities/assignment.md) — Homework distribution.
* [Assignment Submission](file:///d:/Wrok/Projects/eduspace/docs/entities/assignment_submission.md) — Files, feedback, and grading scores.
* [Assessment](file:///d:/Wrok/Projects/eduspace/docs/entities/assessment.md) — Online quizzes and timers.
* [Assessment Attempt (Submission)](file:///d:/Wrok/Projects/eduspace/docs/entities/assessment_attempt.md) — Quiz attempts and anti-cheat tracking.
* [Invoice (TuitionInvoice)](file:///d:/Wrok/Projects/eduspace/docs/entities/invoice.md) — Fees, tuition bills, and payment processing.
* [Invoice Item (InvoiceLineItem)](file:///d:/Wrok/Projects/eduspace/docs/entities/invoice_item.md) — Pricing breakdowns.
* [Expense](file:///d:/Wrok/Projects/eduspace/docs/entities/expense.md) — Salaries, payouts, and utility tracking.
* [Ledger Entry](file:///d:/Wrok/Projects/eduspace/docs/entities/ledger_entry.md) — Polymorphic balance lists.
* [Recording](file:///d:/Wrok/Projects/eduspace/docs/entities/recording.md) — Egress capture, trimming, and viewer heartbeats.
* [Live Room (Room)](file:///d:/Wrok/Projects/eduspace/docs/entities/live_room.md) — WebRTC stream initialization and miniapps.
* [Notification](file:///d:/Wrok/Projects/eduspace/docs/entities/notification.md) — Alerts and reminders log.
* [Analytics](file:///d:/Wrok/Projects/eduspace/docs/entities/analytics.md) — Summaries and exports.
* [Dashboard Widgets](file:///d:/Wrok/Projects/eduspace/docs/entities/dashboard_widgets.md) — Dynamic components based on user role context.

---

## 3. Role-Based Roadmaps

Persona-specific guidelines explaining login, UI walks, daily scenarios, and boundaries:

* [Platform Admin Guide](file:///d:/Wrok/Projects/eduspace/docs/demo/role-guides/platform-admin.md)
* [Organization Manager Guide](file:///d:/Wrok/Projects/eduspace/docs/demo/role-guides/org-manager.md)
* [Teacher Guide](file:///d:/Wrok/Projects/eduspace/docs/demo/role-guides/teacher.md)
* [Mentor Guide](file:///d:/Wrok/Projects/eduspace/docs/demo/role-guides/mentor.md)
* [Student Guide](file:///d:/Wrok/Projects/eduspace/docs/demo/role-guides/student.md)

---

## 4. Complete API Reference

Detailed endpoint specs, request body schemas, response payloads, and query filters:

* [api/README.md](file:///d:/Wrok/Projects/eduspace/docs/api/README.md) — API Change Tracking Checklist
* [api/organizations.md](file:///d:/Wrok/Projects/eduspace/docs/api/organizations.md)
* [api/courses.md](file:///d:/Wrok/Projects/eduspace/docs/api/courses.md)
* [api/classes.md](file:///d:/Wrok/Projects/eduspace/docs/api/classes.md)
* [api/sessions.md](file:///d:/Wrok/Projects/eduspace/docs/api/sessions.md)
* [api/recordings.md](file:///d:/Wrok/Projects/eduspace/docs/api/recordings.md)
* [api/assignments.md](file:///d:/Wrok/Projects/eduspace/docs/api/assignments.md)
* [api/assessments.md](file:///d:/Wrok/Projects/eduspace/docs/api/assessments.md)

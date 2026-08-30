# Phase 3 — Roles

This section documents all system personas, their allowed/hidden pages, allowed/forbidden actions, and search, dashboard, and meeting permissions.

---

## 1. Platform Administrator (Superuser)
* **Purpose**: System-wide operations, monitoring, and database management.
* **Responsibilities**: Maintaining system health, activating/suspending tenants, reviewing audit logs.
* **Allowed Pages**:
  * `/sys-admin` (System Administration)
  * `/dashboard` (Platform-wide metrics dashboard)
  * All public directories
* **Hidden Pages**: Scoped operational spaces unless acting as a tenant admin.
* **Allowed Actions**:
  * Suspend/activate organizations system-wide.
  * Search and download platform-wide audit logs.
  * Access Django Admin portal directly.
* **Forbidden Actions**: None (bypasses RBAC verification checks).
* **Visible Sidebar Items**: "Sys Admin", "Global Metrics", "Audit Logs".
* **Dashboard Widgets**: Growth charts, active subscriptions, CPU/memory indicators, warning logs.
* **Permissions Scopes**: Platform-wide.

---

## 2. Organization Administrator (Org Owner)
* **Purpose**: Managing a single tenant workspace.
* **Responsibilities**: Onboarding staff/students, setting up billing, managing courses, classes, custom roles, and tracking finances.
* **Allowed Pages**:
  * `/dashboard`
  * `/academic/courses` & `/academic/courses/:courseId`
  * `/academic/classes` & `/academic/classes/:classId`
  * `/academic/sessions` & `/academic/sessions/:sessionId`
  * `/academic/assessments`
  * `/academic/reports`
  * `/crm/members`
  * `/finance/ledger` & `/finance/invoices/:invoiceId`
  * `/settings/organization`
  * `/settings/billing`
  * `/settings/templates`
  * `/settings/profile`
  * `/settings/notifications`
  * `/leaderboard`
  * `/recordings` & `/recordings/:token` & `/recordings/:token/edit`
  * `/room/:roomCode`
  * `/miniapps`
* **Hidden Pages**:
  * `/sys-admin`
* **Allowed Actions**:
  * Create, edit, and delete Courses, Classes, Sessions, and Assignments.
  * Generate, void, and record payments on Invoices.
  * Add organization Expenses.
  * Configure custom organization Roles and Permissions.
  * Edit organization metadata (name, logo, templates).
  * Suspend members and invite new staff/students.
* **Forbidden Actions**:
  * Perform platform-wide operations (e.g. suspending other organizations).
* **Visible Sidebar Items**: "Dashboard", "Courses", "Classes", "Sessions", "Assessments", "Members", "Finance", "Recordings", "Settings", "Leaderboard".
* **Dashboard Widgets**: Organization balance card, monthly recurring revenue (MRR) chart, active student counts, pending homework queue size, quick action panel.

---

## 3. Teacher
* **Purpose**: Managing academic deliveries and grading.
* **Responsibilities**: Scheduling classes, teaching live rooms, grading exams/homework, tracking attendance, creating question banks.
* **Allowed Pages**:
  * `/dashboard`
  * `/academic/courses` & `/academic/courses/:courseId`
  * `/academic/classes` & `/academic/classes/:classId`
  * `/academic/sessions` & `/academic/sessions/:sessionId`
  * `/academic/attendance`
  * `/academic/assessments`
  * `/crm/members`
  * `/settings/profile`
  * `/settings/notifications`
  * `/leaderboard`
  * `/recordings` & `/recordings/:token` & `/recordings/:token/edit`
  * `/room/:roomCode`
  * `/miniapps`
* **Hidden Pages**:
  * `/sys-admin`, `/finance/ledger`, `/settings/organization`, `/settings/billing`, `/settings/templates`
* **Allowed Actions**:
  * Create, edit, and delete Sessions and Assignments.
  * Create and publish Exams, Question Banks, and Questions.
  * Mark and update student Attendance.
  * Grade Homework submissions and Exam attempts.
  * Control Live Room status (WebRTC host permissions: start recording, whiteboard, mini-games, kick user).
* **Forbidden Actions**:
  * Modify organization billing, view financial summaries, custom roles, or configure tenants settings.
* **Visible Sidebar Items**: "Dashboard", "Courses", "Classes", "Sessions", "Attendance", "Assessments", "Members", "Recordings", "Leaderboard".
* **Dashboard Widgets**: Scheduled classes list, grading queue alert, quick links to live rooms, class engagement chart.

---

## 4. Student
* **Purpose**: Learner portal.
* **Responsibilities**: Attending live sessions, submitting homework, taking exams, checking grades.
* **Allowed Pages**:
  * `/dashboard`
  * `/academic/courses` & `/academic/courses/:courseId`
  * `/academic/classes` & `/academic/classes/:classId`
  * `/academic/assignments/:assignmentId`
  * `/academic/homework` (Homework List)
  * `/academic/payments` (Tuition Invoices List)
  * `/academic/sessions` & `/academic/sessions/:sessionId`
  * `/crm/members` (Directory)
  * `/settings/profile`
  * `/settings/notifications`
  * `/leaderboard`
  * `/recordings` & `/recordings/:token`
  * `/room/:roomCode`
  * `/miniapps`
  * `/assessments/take/:submissionId`
  * `/assessments/results/:submissionId`
  * `/finance/invoices/:invoiceId` (Their own invoices only)
* **Hidden Pages**:
  * `/sys-admin`, `/academic/attendance`, `/academic/assessments` (Management Panel), `/academic/reports`, `/finance/ledger`, `/settings/organization`, `/settings/billing`, `/settings/templates`, `/recordings/:token/edit`, `/assessments/review/:submissionId`
* **Allowed Actions**:
  * Upload homework submissions, submit feedback, complete exams.
  * View their own tuition invoices.
  * Interact in Live Rooms (chat, whiteboard, games).
* **Forbidden Actions**:
  * Manage members, create classes, schedule sessions, view other student invoices, grade submissions, start server recordings.
* **Visible Sidebar Items**: "Dashboard", "Courses", "Classes", "Sessions", "Homework", "Payments", "Recordings", "Leaderboard".
* **Dashboard Widgets**: Today's schedule, homework status card, grade average chart, gamified points widget.

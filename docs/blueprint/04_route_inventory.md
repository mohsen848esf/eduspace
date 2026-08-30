# Phase 4 — Route Inventory

This section lists every React route defined in the frontend application, mapped to components, required permissions, and backend endpoints.

---

This document lists every route declared in the frontend application router, details its purpose, specifies the RBAC constraints, and maps it to the corresponding backend APIs.

---

## 1. Authentication and Onboarding

### Login Page
* **Route**: `/login`
* **Purpose**: User login interface.
* **Accessible Roles**: All users (anonymous/guest).
* **Required Permissions**: *None*.
* **Actions Available**: Input username/password, submit login credentials.
* **Linked Entities**: `User`, `UserSession`.
* **Related APIs**:
  * `POST` `/api/auth/login/` (Creates session and retrieves JWT tokens).

### Register Page
* **Route**: `/register`
* **Purpose**: Institution registration and account creation.
* **Accessible Roles**: All users (anonymous/guest).
* **Required Permissions**: *None*.
* **Actions Available**: Select name, input email, choose password.
* **Linked Entities**: `User`, `Organization`.
* **Related APIs**:
  * `POST` `/api/auth/register/` (Registers user and default tenant structure).

---

## 2. Core Operational Pages

### Dashboard Page
* **Route**: `/dashboard`
* **Purpose**: Primary dashboard landing page. Renders appropriate layout widgets depending on role context.
* **Accessible Roles**: Admin, Teacher, Student, Mentor.
* **Required Permissions**: `can_view_dashboard`.
* **Actions Available**: View general metrics, click navigation drawers, check announcements, view schedules.
* **Linked Entities**: `User`, `Organization`, `Session`, `Assignment`.
* **Related APIs**:
  * `GET` `/api/auth/me/`
  * `GET` `/api/auth/org-context/`
  * `GET` `/api/auth/notifications/`

### System Administration Page
* **Route**: `/sys-admin`
* **Purpose**: Global platform health and monitoring workspace.
* **Accessible Roles**: Superuser only.
* **Required Permissions**: Platform-wide Superuser access (`is_superuser = True` check in `RouteGuard`).
* **Actions Available**: Review platform growth charts, suspend/activate organizations, view operators audit logs.
* **Linked Entities**: `Organization`, `AuditLog`.
* **Related APIs**:
  * `GET` `/api/sys-admin/dashboard/metrics/`
  * `GET` `/api/sys-admin/organizations/`
  * `GET` `/api/sys-admin/audit-logs/`

---

## 3. Academic CRM Modules

### Course List Page
* **Route**: `/academic/courses`
* **Purpose**: Course catalog list view.
* **Accessible Roles**: Admin, Teacher, Student, Mentor.
* **Required Permissions**: `can_view_dashboard`.
* **Actions Available**: View courses catalog, create course (Admin/Teacher only), toggle course status.
* **Linked Entities**: `Course`, `Organization`.
* **Related APIs**:
  * `GET` `/api/auth/courses/`
  * `POST` `/api/auth/courses/` (Admin/Teacher)

### Course Detail Page
* **Route**: `/academic/courses/:courseId`
* **Purpose**: Detail view of a single Course blueprint.
* **Accessible Roles**: Admin, Teacher, Student, Mentor.
* **Required Permissions**: `can_view_dashboard`.
* **Actions Available**: Edit course description/price, review all cohorts (classes) assigned to this course.
* **Linked Entities**: `Course`, `AcademyClass`.
* **Related APIs**:
  * `GET` `/api/auth/courses/<id>/`
  * `PUT`/`PATCH` `/api/auth/courses/<id>/` (Admin)

### Class Cohorts Page
* **Route**: `/academic/classes`
* **Purpose**: List of active and archived cohorts.
* **Accessible Roles**: Admin, Teacher, Student, Mentor.
* **Required Permissions**: `can_view_dashboard`.
* **Actions Available**: List cohorts, filter active/inactive, create class (Admin only).
* **Linked Entities**: `AcademyClass`, `Course`.
* **Related APIs**:
  * `GET` `/api/auth/classes/`
  * `POST` `/api/auth/classes/` (Admin)

### Class Detail Page
* **Route**: `/academic/classes/:classId`
* **Purpose**: Detailed dashboard of a single Class Cohort.
* **Accessible Roles**: Admin, Teacher, Student, Mentor.
* **Required Permissions**: `can_view_dashboard`.
* **Actions Available**:
  * **Admin/Teacher**: Add assignments, edit teacher/mentor, invite students.
  * **Student**: View active assignments, check schedule, see classroom recording link shelves.
* **Linked Entities**: `AcademyClass`, `Enrollment`, `Assignment`, `Session`.
* **Related APIs**:
  * `GET` `/api/auth/classes/<id>/`
  * `GET` `/api/auth/classes/<id>/enrollments/`
  * `GET` `/api/auth/classes/<id>/sessions/`

### Assignment Detail Page
* **Route**: `/academic/assignments/:assignmentId`
* **Purpose**: View assignment info, download materials, and submit work.
* **Accessible Roles**: Admin, Teacher, Student.
* **Required Permissions**: `can_view_dashboard`.
* **Actions Available**:
  * **Teacher/Admin**: Review student submissions grid, click to grade.
  * **Student**: Upload file attachments, write comments, submit homework.
* **Linked Entities**: `Assignment`, `AssignmentSubmission`.
* **Related APIs**:
  * `GET` `/api/assessments/assignments/<id>/`
  * `GET` `/api/assessments/assignments/<id>/submissions/` (Teacher/Admin only)
  * `POST` `/api/assessments/assignment-submissions/` (Student submission upload)

### Session Scheduling Page
* **Route**: `/academic/sessions`
* **Purpose**: Calendar/List of academic meetings.
* **Accessible Roles**: Admin, Teacher, Student, Mentor.
* **Required Permissions**: `can_view_sessions`.
* **Actions Available**:
  * **Teacher/Admin**: Schedule session, edit/cancel session, launch WebRTC live room.
  * **Student/Mentor**: Check session date/time, click join when live.
* **Linked Entities**: `Session`, `AcademyClass`.
* **Related APIs**:
  * `GET` `/api/auth/sessions/`
  * `POST` `/api/auth/sessions/` (Admin/Teacher)
  * `POST` `/api/auth/sessions/<id>/start_live/` (Teacher)

### Session Detail Page
* **Route**: `/academic/sessions/:sessionId`
* **Purpose**: Details of a past or upcoming session.
* **Accessible Roles**: Admin, Teacher, Student, Mentor.
* **Required Permissions**: `can_view_sessions`.
* **Actions Available**: Review attendance statistics, check associated recordings, preview quizzes.
* **Linked Entities**: `Session`, `Attendance`, `Recording`.
* **Related APIs**:
  * `GET` `/api/auth/sessions/<id>/`
  * `GET` `/api/auth/attendance/?session=<id>`

### Attendance Explorer
* **Route**: `/academic/attendance`
* **Purpose**: Unified attendance manager.
* **Accessible Roles**: Admin, Teacher, Mentor.
* **Required Permissions**: `can_view_sessions` (teachers and admins can update via write permissions).
* **Actions Available**: Mark students present/absent/late, add notes.
* **Linked Entities**: `Attendance`, `Session`, `User`.
* **Related APIs**:
  * `GET` `/api/auth/attendance/`
  * `PUT`/`PATCH` `/api/auth/attendance/<id>/`

---

## 4. Assessment Center

### Assessments Manager
* **Route**: `/academic/assessments`
* **Purpose**: Exams and Question Bank control panel.
* **Accessible Roles**: Admin, Teacher, Student, Mentor.
* **Required Permissions**: `can_view_dashboard`.
* **Actions Available**:
  * **Teacher/Admin**: Create assessments, publish quizzes, add questions to Question Banks.
  * **Student**: View published quiz list, click to initiate attempt.
* **Linked Entities**: `Assessment`, `QuestionBank`, `Question`.
* **Related APIs**:
  * `GET` `/api/assessments/assessments/`
  * `POST` `/api/assessments/assessments/` (Admin/Teacher)
  * `GET` `/api/assessments/question-banks/`

### Take Assessment Page
* **Route**: `/assessments/take/:submissionId`
* **Purpose**: Timer-locked student quiz interface.
* **Accessible Roles**: Student.
* **Required Permissions**: `can_view_dashboard`.
* **Actions Available**: Answer multiple choice / code / short questions, submit attempt, logs tab focus.
* **Linked Entities**: `Submission`, `Question`, `StudentAnswer`.
* **Related APIs**:
  * `GET` `/api/assessments/submissions/<id>/`
  * `POST` `/api/assessments/submissions/<id>/submit/`
  * `POST` `/api/assessments/answers/` (Saves selected option)

### Assessment Results Page
* **Route**: `/assessments/results/:submissionId`
* **Purpose**: Scored results preview.
* **Accessible Roles**: Student.
* **Required Permissions**: `can_view_dashboard`.
* **Actions Available**: Review score card, see which questions were correct, view teacher feedback.
* **Linked Entities**: `Submission`, `StudentAnswer`.
* **Related APIs**:
  * `GET` `/api/assessments/submissions/<id>/`

### Review Submission Page
* **Route**: `/assessments/review/:submissionId`
* **Purpose**: Manual grading workspace for written responses.
* **Accessible Roles**: Admin, Teacher.
* **Required Permissions**: `can_teach_class` OR `can_manage_members`.
* **Actions Available**: Grade questions, edit scores, save final evaluation grades.
* **Linked Entities**: `Submission`, `StudentAnswer`.
* **Related APIs**:
  * `GET` `/api/assessments/submissions/<id>/`
  * `POST` `/api/assessments/submissions/<id>/grade/`

---

## 5. CRM, Finance, & System Settings

### Member Directory
* **Route**: `/crm/members`
* **Purpose**: Institution directory.
* **Accessible Roles**: Admin, Teacher, Student, Mentor.
* **Required Permissions**: `can_view_dashboard`.
* **Actions Available**: Search members, view profiles. Admins can invite or suspend members.
* **Linked Entities**: `OrgMember`, `User`, `Role`.
* **Related APIs**:
  * `GET` `/api/auth/org-members/`
  * `POST` `/api/auth/org-members/` (Invite)
  * `PATCH` `/api/auth/org-members/<id>/` (Deactivate/Modify role)

### Ledger and Expenses Page
* **Route**: `/finance/ledger`
* **Purpose**: Central account ledger.
* **Accessible Roles**: Admin.
* **Required Permissions**: `can_view_financials`.
* **Actions Available**: Log expenditures, issue manual invoices, track balance logs.
* **Linked Entities**: `TuitionInvoice`, `ExpenseItem`.
* **Related APIs**:
  * `GET` `/api/auth/invoices/`
  * `POST` `/api/auth/invoices/`
  * `GET` `/api/auth/expenses/`
  * `POST` `/api/auth/expenses/`
  * `GET` `/api/auth/finance/summary/`

### Invoice Detail Page
* **Route**: `/finance/invoices/:invoiceId`
* **Purpose**: Tuition invoice preview.
* **Accessible Roles**: Admin, Student (if invoice matches user id).
* **Required Permissions**: `can_view_dashboard`.
* **Actions Available**: Print invoice statement, record payment processing (Admin only).
* **Linked Entities**: `TuitionInvoice`, `InvoiceLineItem`.
* **Related APIs**:
  * `GET` `/api/auth/invoices/<id>/`

---

## 6. Real-Time Rooms & Playback

### WebRTC Live Room
* **Route**: `/room/:roomCode`
* **Purpose**: Live stream video lecture space.
* **Accessible Roles**: Admin, Teacher, Student, Mentor.
* **Required Permissions**: `can_view_dashboard`.
* **Actions Available**:
  * **Host (Teacher)**: Grant permissions, launch whiteboard, start/pause/stop recording, kick user.
  * **Participant**: Stream audio/video, participate in chat/board/games.
* **Linked Entities**: `Room`, `RoomParticipant`, `Session`, `Recording`.
* **Related APIs**:
  * `GET` `/api/rooms/<roomCode>/`
  * `POST` `/api/rooms/<roomCode>/join/`
  * `POST` `/api/rooms/<roomCode>/recording/start/` (Checks `can_control_recording`)

### Recordings Library
* **Route**: `/recordings`
* **Purpose**: Archive library for finished class recordings.
* **Accessible Roles**: Admin, Teacher, Student.
* **Required Permissions**: `can_view_dashboard`.
* **Actions Available**: List recordings, share access, delete (Admin/Teacher only).
* **Linked Entities**: `Recording`, `AcademyClass`.
* **Related APIs**:
  * `GET` `/api/recordings/`

### Recording View Page
* **Route**: `/recordings/:token`
* **Purpose**: Stream video recording player.
* **Accessible Roles**: Admin, Teacher, Student.
* **Required Permissions**: `can_view_dashboard`.
* **Actions Available**: Play video, stream segments, post playback position heartbeats.
* **Linked Entities**: `Recording`, `RecordingView`.
* **Related APIs**:
  * `GET` `/api/recordings/<token>/stream/`
  * `POST` `/api/recordings/<token>/heartbeat/` (Audience analytics tracking)

### Recording Editor Page
* **Route**: `/recordings/:token/edit`
* **Purpose**: Video trimmer and publisher interface.
* **Accessible Roles**: Admin, Teacher (Owner only).
* **Required Permissions**: `can_view_dashboard`.
* **Actions Available**: Drag trim handles (adjusting start/end offsets), publish recording to class cohorts, enable link-share.
* **Linked Entities**: `Recording`.
* **Related APIs**:
  * `POST` `/api/recordings/<token>/publish/`
  * `POST` `/api/recordings/<token>/unpublish/`

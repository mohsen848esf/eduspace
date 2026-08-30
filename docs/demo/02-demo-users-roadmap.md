# EduSpace Demo Users Roadmap

This roadmap defines the ideal demo environment setup to showcase both multi-tenant organization flows and independent standalone user workflows.

---

## 1. Independent Users (No Organization Context)

Independent users do not belong to any tenant. They exist to test onboarding, registration, organization creation, and general public sandbox features.

### A. Platform Administrator
* **Role**: Platform Owner / Superuser
* **Purpose**: Demonstrates the global system settings, tenant suspension, registration approvals, and audit log analysis.
* **Flows to Test**:
  * View tenant health statistics at `/sys-admin` (System Admin page).
  * Suspend/activate organizations (e.g., suspending `Default Academy`).
  * Check the operator audit logs to verify security tracking.
  * Inspect the global database schemas at `/admin/`.

### B. Independent Organization Manager
* **Role**: Onboarding Owner
* **Purpose**: Demonstrates the new customer signup and SaaS setup experience.
* **Flows to Test**:
  * Registration on `/register`.
  * Initial dashboard landing page prompt to "Create or Join an Organization".
  * Create a new Organization via the dashboard onboarding portal.
  * Subscribe to a subscription plan (Basic/Pro/Enterprise) using Stripe Checkout.

### C. Independent Teacher / Mentor / Student
* **Role**: Sandbox Users
* **Purpose**: Demonstrates what external users see before being invited to a tenant.
* **Flows to Test**:
  * View personal profile settings at `/settings/profile` and notification preferences.
  * Join public game sessions or search for active public courses.
  * Attempt to access protected dashboard routes (e.g., `/academic/courses` or `/finance/ledger`), confirming they are redirected back to the profile completion / join-org warning state.

---

## 2. Demo Organization Users

The recommended demo organization setup uses `Default Academy` (ID: 1) with the following user profile structure:

### A. Organization Owner (Mohsen)
* **Simultaneous Teacher Role**:
  * **How it works in the database**: In the database, the `OrgMember` record binds a user to one and only one `Role`. Therefore, a user cannot have both the `Admin` and `Teacher` roles simultaneously *in the RBAC lookup*.
  * **Workaround / Default Config**: Because `AcademyClass` teacher assignments and `Session` host assignments are simple ForeignKeys to the `User` model, an Org Owner or Admin *can* be assigned to teach/host. However, since they lack the `can_teach_class` permission, they might be blocked from specific teacher actions.
  * **Solution**: To act as both, the owner can either create a custom organization role (e.g., "Principal") combining all permissions, or use separate login credentials for the owner/manager vs the teacher. For standard demos, keeping them separate is highly recommended to show clean RBAC boundaries.
* **Dashboard**: Admin Analytics & Management Dashboard.
* **Accessible Pages**: `/dashboard`, `/academic/courses`, `/academic/classes`, `/academic/sessions`, `/academic/attendance`, `/crm/members`, `/finance/ledger`, `/settings/organization`, `/settings/billing`.
* **Hidden Pages**: `/sys-admin` (unless they are a platform superuser like `mohsen`).
* **Available Actions**: Manage subscriptions, update organization details, invite members, issue invoices, approve expenses, create courses and classes, schedule sessions.

### B. Primary Teacher (Bob Miller - `teacher_bob`)
* **Role**: Teacher
* **Dashboard**: Teacher Academic Dashboard (displays active classes, upcoming sessions, and pending homework to grade).
* **Accessible Pages**: `/dashboard`, `/academic/courses`, `/academic/classes`, `/academic/sessions`, `/academic/attendance`, `/recordings` (with edit/trim access), `/miniapps` (to start classroom games), `/assessments/review/:id` (grading submissions).
* **Hidden Pages**: `/settings/organization`, `/settings/billing`, `/finance/ledger`.
* **Available Actions**: Create/edit sessions, take attendance, launch live rooms, trigger recording start/stop/pause/resume, trim/publish recordings, start interactive word games, grade submissions.

### C. Secondary Teacher (Teacher User - `teacher_test`)
* **Role**: Teacher (Co-Instructor / Backup)
* **Purpose**: Demonstrates collaborative teaching and permission delegation (e.g., the primary teacher granting recording control to the co-instructor).
* **Dashboard / Pages / Actions**: Same as the primary teacher, limited to classes where they are explicitly assigned.

### D. Mentor (Sarah Connor - `standalone_student` or custom mentor)
* **Role**: Mentor (Classroom Assistant)
* **Dashboard**: Read-only tracking dashboard showing upcoming sessions.
* **Accessible Pages**: `/dashboard`, `/academic/classes`, `/academic/sessions`, `/academic/attendance` (view-only).
* **Hidden Pages**: `/settings/organization`, `/settings/billing`, `/finance/ledger`, `/academic/reports`, `/recordings/:token/edit`.
* **Available Actions**: View schedule, join active live sessions as participant, check student attendance, review class details. Cannot create classes, issue invoices, start recordings, or modify attendance markers.

### E. Students (John Doe - `testuser`, Alice Green - `test1new`)
* **Role**: Student
* **Dashboard**: Student Learning Portal (displays enrolled courses, grade cards, next up countdown, and upcoming quiz notifications).
* **Accessible Pages**: `/dashboard`, `/academic/courses`, `/academic/classes`, `/academic/assignments/:id`, `/finance/invoices/:id` (viewing personal bills), `/recordings/:token` (stream-only).
* **Hidden Pages**: `/settings/organization`, `/settings/billing`, `/finance/ledger`, `/crm/members`, `/academic/reports`, `/settings/templates`.
* **Available Actions**: View class material, join live room as client viewer, submit homework, take online quizzes/assessments, play games launched by the teacher, and pay invoices.

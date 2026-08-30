# EduSpace User Inventory & Demo Data Map

This document maps all existing seeded users in the EduSpace database to assist in system walkthroughs, testing, and demonstrations.

---

## 1. Seeded User Directory

Below is the complete inventory of the 10 users currently seeded in the database. Where First Name, Last Name, or Full Name were blank or placeholder-like in the database, realistic defaults have been suggested.

| User ID | Username | Email | First Name (Suggested) | Last Name (Suggested) | Full Name (Suggested/Actual) | Organization Membership | Role(s) | Is Active | Is Staff | Is Superuser |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `mohsen` | `mohsen@gmail.com` | Mohsen | Esfandiari | Mohsen Esfandiari | `Default Academy` | Org Owner / Student | True | True | True |
| **2** | `testuser` | `test@test.com` | John | Doe | John Doe (Actual: *Test User*) | `Default Academy` | Student | True | False | False |
| **3** | `mohsen2` | `mohsen2@gmail.com` | Mohsen | Esfandiari | Mohsen Esfandiari | `Default Academy` | Student | True | False | False |
| **4** | `stranger` | `stranger@example.com` | Jane | Smith | Jane Smith (Actual: *Stranger Tester*) | `Default Academy` | Student | True | False | False |
| **5** | `mohsen_test` | `mohsen_test@gmail.com` | Mohsen | Tester | Mohsen Tester (Actual: *mohsen*) | *None (Independent)* | *None* | True | False | False |
| **10** | `test1new` | `test@gmail.com` | Alice | Green | Alice Green (Actual: *test1*) | `Default Academy` | Student | True | False | False |
| **11** | `teacher_bob` | `bob@test.com` | Bob | Miller | Bob Miller (Actual: *Bob Teacher*) | `Default Academy` | Teacher | True | False | False |
| **12** | `standalone_student` | `standalone@test.com` | Sarah | Connor | Sarah Connor | *None (Independent)* | *None* | True | False | False |
| **13** | `admin_test` | `admin@test.com` | Admin | User | Admin User | `Default Academy` | Admin | True | False | False |
| **14** | `teacher_test` | `teacher@test.com` | Teacher | User | Teacher User | `Default Academy` | Teacher | True | False | False |

---

## 2. Platform Permissions Matrix

Here are the standard permissions associated with each role in the system:

* **Admin Role Permissions**:
  * `can_view_dashboard` (Can view dashboard)
  * `can_manage_members` (Can invite, suspend, edit members)
  * `can_view_financials` (Can view ledger, invoices)
  * `can_manage_financials` (Can issue invoices, add expenses)
  * `can_control_recordings` (Can publish/delete/trim recordings)
  * `can_view_sessions` (Can see scheduled and live sessions)
  * `can_manage_sessions` (Can schedule, edit, or cancel academic sessions)
  * `can_view_attendance` (Can see attendance logs)
  * `can_manage_attendance` (Can modify attendance markers)
* **Teacher Role Permissions**:
  * `can_view_dashboard`
  * `can_teach_class` (Can launch live rooms, stream, use whiteboard/games)
  * `can_control_recordings`
  * `can_view_sessions`
  * `can_manage_sessions`
  * `can_view_attendance`
  * `can_manage_attendance`
* **Mentor Role Permissions**:
  * `can_view_dashboard`
  * `can_attend_class` (Can enter live rooms as participant)
  * `can_view_sessions`
  * `can_view_attendance`
* **Student Role Permissions**:
  * `can_view_dashboard`
  * `can_attend_class`
  * `can_view_sessions`

---

## 3. Core Role Definitions & Access Levels

To run a clean demo, it is essential to understand the difference between platform-wide administrative roles and tenant-scoped structural roles:

### Django Superuser (`is_superuser = True`)
* **What it is**: A standard Django security flag.
* **Scope**: Platform-wide (Bypasses multi-tenant check mechanisms).
* **Capabilities**:
  * Unrestricted database access via the Django Admin panel (`/admin/`).
  * Bypasses the RBAC evaluation for endpoints checking `has_org_permission` (automatically returns `True`).
  * *Exception*: For streaming a recorded classroom session, the Django superuser flag does not grant bypass rights in `can_be_viewed_by()` method on the model level (only the owner, permitted users, or link-shared guests are allowed to watch, preventing unpublish-revokes-access bypasses).

### Organization Owner
* **What it is**: The user who owns the organization instance (linked by `owner_id` on the `Organization` model).
* **Scope**: Tenant-wide.
* **Capabilities**:
  * Complete control over the tenant instance.
  * Cannot be suspended or deleted by other organization administrators.
  * Responsible for managing billing subscriptions, plan upgrades, and checkout sessions via Stripe.

### Organization Admin / Manager
* **What it is**: A user linked to an organization via `OrgMember` with the `Admin` role.
* **Scope**: Tenant-wide.
* **Capabilities**:
  * Complete operational authority. They can add/remove courses, classes, sessions, teachers, mentors, and students.
  * Access to the financial ledger, invoicing, expense tracking, and reporting suite.
  * Cannot modify the billing settings or delete/suspend the Organization Owner.

### Teacher
* **What it is**: A user linked to an organization via `OrgMember` with the `Teacher` role, or assigned as `teacher` on an `AcademyClass`.
* **Scope**: Tenant-wide, with focused class/session execution capabilities.
* **Capabilities**:
  * View dashboards, create and manage classroom sessions, take attendance, publish recordings, and review student homework submissions.
  * Launch live sessions and control interactive classroom features (interactive games, recording toggles, whiteboards).

### Mentor
* **What it is**: A user linked to an organization via `OrgMember` with the `Mentor` role, or assigned as `mentor` on an `AcademyClass`.
* **Scope**: Tenant-wide, read-mostly support role.
* **Capabilities**:
  * View upcoming academic schedules, view dashboard widgets, attend active classroom live rooms, and view (but not edit) class attendance records.
  * Banned from launching live classes, modifying financial invoices, or editing homework grades.

### Student
* **What it is**: A user linked to an organization via `OrgMember` with the `Student` role.
* **Scope**: Tenant-wide, consumer of academic items.
* **Capabilities**:
  * View their class schedule, join active live room sessions, answer question bank assessments, submit homework assignments, and view their tuition invoices.
  * Hidden from all dashboards containing tenant financial ledgers, member invites, configuration settings, or grading sheets.

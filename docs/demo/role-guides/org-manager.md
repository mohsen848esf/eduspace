# Role Guide: Organization Manager / Admin

This guide outlines the system walkthrough for an Organization Manager / Admin account (including Organization Owners).

---

## 1. First Login Experience

* **Landing Interface**: Logs into the organization dashboard (`/dashboard`) showing institution-specific stats.
* **Visual Widgets**:
  * **Summary KPI Tiles**: Enrolled student counts, active classes count, monthly incoming revenue, unpaid/overdue invoice totals.
  * **Recent Transactions Feed**: Listing latest tuition invoice receipts and approved business expenses.
  * **Member Invitations Drawer**: Quick tool to add new members.

---

## 2. Navigation Tour

* **Step 1: Main Dashboard (`/dashboard`)**: Preview operational health.
* **Step 2: Course & Class Manager (`/academic/courses` & `/academic/classes`)**: Define curriculum catalogs and schedule cohorts.
* **Step 3: Session Scheduler (`/academic/sessions`)**: View the schedules of active cohorts and schedule new lectures.
* **Step 4: Member Directory (`/crm/members`)**: Manage directory parameters, edit user profiles, change roles, invite new users.
* **Step 5: Ledger and Billing Workspace (`/finance/ledger` & `/settings/billing`)**: Review invoices, log expenses, and update subscriptions.

---

## 3. Typical Daily Workflow

1. Log in to check payment collections and approve payouts or operational expenses.
2. Review new course registrations and process enrollment requests.
3. Manage schedules, resolve room or host conflicts, and assign teachers to newly opened classes.
4. Update organization information, customize role permissions, or view exportable academic reports.

---

## 4. Permissions Summary

### Things They Can Create
* Courses, classes, academic sessions.
* Tuition invoices, expense items.
* New user invitation links.

### Things They Can Edit
* Institution settings (logo, name, slugs).
* Member profiles, contract details, and permissions.
* Invoices (marking paid/overdue/cancelled).
* Class schedules.

### Things They Can View
* Complete tenant ledger and financial dashboard.
* Class list, enrollment directories, student submissions.
* Operator audit logs scoped to their tenant.

### Things They Cannot Access
* Platform-wide system configurations or other tenants' dashboards (`/sys-admin`).
* Standard Django admin console (`/admin/`).

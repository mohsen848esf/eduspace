# Role Guide: Platform Admin

This guide outlines the system walkthrough for a Platform Administrator / Superuser account.

---

## 1. First Login Experience

* **Landing Interface**: Upon login, the Platform Admin bypasses the standard multi-tenant onboarding screen. They are presented with the primary System Administration Dashboard (`/sys-admin`).
* **Visual Widgets**:
  * **System KPI Tiles**: Total tenants registered, active subscriptions, total system users online, server CPU/memory/Redis cache status.
  * **Tenant Activity Feed**: Live feed of newly registered organizations and suspension statuses.
  * **Database Quick-Access**: Shortcut buttons pointing to Django Admin (`/admin/`).

---

## 2. Navigation Tour

* **Step 1: System Admin Dashboard (`/sys-admin`)**: Explore current platform statistics.
* **Step 2: Tenant Organizations List (`/sys-admin/organizations`)**: Search and filter institutions, click to view billing history or apply suspension flags.
* **Step 3: Global Audit Logs (`/sys-admin/audit-logs`)**: View operators' platform-wide audit trials.
* **Step 4: Django Database Panel (`/admin/`)**: Direct management of backend model tables.

---

## 3. Typical Daily Workflow

1. Log in to check platform performance metrics and server health indices.
2. Review audit logs to verify there are no unauthorized role changes or data leaks.
3. Manage billing exceptions or manually resolve suspended tenants who failed payments.
4. Update global platform system configurations (e.g., streaming resolution constraints, registration toggles).

---

## 4. Permissions Summary

### Things They Can Create
* Tenant organizations (manual creation).
* System configurations.
* Database rows directly (via Django admin).

### Things They Can Edit
* Organization statuses (`is_active`, `is_suspended`, name, slugs).
* Subscription plan quotas.
* User roles and details across all tenants.

### Things They Can View
* Global audit logs, analytics dashboards, server metrics.
* Any database table.

### Things They Cannot Access
* *Exception in WebRTC Recording Playback*: They cannot play a published recording unless they are the owner, a class member, or it is link-shared (protecting user data privacy in WebRTC feeds).

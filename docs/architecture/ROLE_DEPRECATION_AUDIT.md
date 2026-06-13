# Global Role Deprecation Audit — Sprint D.2

This document tracks all remaining occurrences of `user.role` and `activeRole` in the Eduspace frontend codebase. It provides reference classifications and evaluates readiness for Sprint D.4 (backend model and serializer role removal).

---

## Classification Guidelines

*   **Allowed Temporary Usage**: Properties used only for profile labels, layout greetings, or other presentation elements that do not enforce access control gates.
*   **D.5 Cleanup**: Fields and fallback configurations slated for permanent removal in Sprint D.5.
*   **Blocking**: References that must be resolved prior to Sprint D.4 launch to prevent runtime authorization crashes.

---

## 1. Remaining `user.role` Occurrences

| Location | Context | Classification | Remediation (Sprint D.5) |
| :--- | :--- | :---: | :--- |
| [auth.api.ts](file:///d:/Wrok/Projects/eduspace/frontend/src/features/auth/api/auth.api.ts#L9) | User payload schema definition: `role: "student" | "teacher" | "admin"` | **D.5 Cleanup** | Delete `role` property from TypeScript `User` type. |
| [auth.schema.ts](file:///d:/Wrok/Projects/eduspace/frontend/src/features/auth/schemas/auth.schema.ts#L31) | Registration validation schema: `role: z.enum(["student", "teacher"])` | **Allowed Temporary** | Remove role validation check once backend handles registration roles implicitly. |
| [useRegister.ts](file:///d:/Wrok/Projects/eduspace/frontend/src/features/auth/hooks/useRegister.ts#L26) | React Hook Form default registration value: `defaultValues: { role: "student" }` | **Allowed Temporary** | Remove role initialization. |
| [RegisterPage.tsx](file:///d:/Wrok/Projects/eduspace/frontend/src/features/auth/components/RegisterPage.tsx#L60) | UI radio select components mapping and watcher. | **Allowed Temporary** | Remove role picker radios from sign-up form. |
| [useOrgPermission.ts](file:///d:/Wrok/Projects/eduspace/frontend/src/hooks/useOrgPermission.ts#L36) | Internal local mapping from legacy role to permission arrays. | **D.5 Cleanup** | Toggle `ENABLE_ROLE_FALLBACK = false` and delete fallback logic block. |

---

## 2. Remaining `activeRole` Occurrences

All direct authorization flags derived from `activeRole` inside features (like `CRMTabs` or `PrivateRoute`) have been removed. The remaining `activeRole` references are restricted entirely to presentation, labels, or routing checks:

| Location | Context | Classification | Remediation (Sprint D.5) |
| :--- | :--- | :---: | :--- |
| [PrivateRoute.tsx](file:///d:/Wrok/Projects/eduspace/frontend/src/router/PrivateRoute.tsx#L11) | Normalizes role casing dynamically in case page definitions rely on legacy variables during stabilization. | **D.5 Cleanup** | Delete role fallback checks completely, relying purely on `requiredPermissions`. |
| [Sidebar.tsx](file:///d:/Wrok/Projects/eduspace/frontend/src/components/layout/Sidebar.tsx#L68) | Displays localized role translation in profile card (`userRoleTranslation`). | **Allowed Temporary** | Retrieve role name strictly from OrgContext. |
| [DashboardPage.tsx](file:///d:/Wrok/Projects/eduspace/frontend/src/features/dashboard/components/DashboardPage.tsx#L47) | Displays active role name inside the layout welcome card. | **Allowed Temporary** | Display role from OrgContext. |
| [CRMTabs.tsx](file:///d:/Wrok/Projects/eduspace/frontend/src/features/dashboard/components/CRMTabs.tsx#L515) | Renders active role label string in the dashboard general info box. | **Allowed Temporary** | Keep display or remove. |

---

## 3. Sprint D.4 Readiness Assessment

### **READY**

#### Blockers Resolved
- **Authorization Separation**: All authorization gates, route protections, and navigation item visibility configs are 100% permission-driven.
- **Stability Isolation**: The configuration constant `ENABLE_ROLE_FALLBACK` in [useOrgPermission.ts](file:///d:/Wrok/Projects/eduspace/frontend/src/hooks/useOrgPermission.ts) permits instant bypass of `user.role` fallbacks.
- **Tenancy and Auditing**: Navigation links dynamically hide when permissions are absent, protecting layouts against privilege exposure.

#### Action Items for Sprint D.5
- Toggle `ENABLE_ROLE_FALLBACK = false` inside `useOrgPermission.ts`.
- Delete all registration form role inputs, schemas, and API payload definitions.
- Purge case-insensitive role casing normalizations inside routing modules.

# EduSpace Feature Gap Analysis & Audit Report

This report provides a codebase-verified audit of the current implementation status of the EduSpace platform, detailing complete features, gaps between frontend and backend, broken flows, and recommended improvements.

---

## 1. Complete Features (Codebase Verified)

* **Multi-Tenant Scoping & Security**:
  * Scoped views using the custom `X-Organization-Slug` header.
  * Tenant-scoped rate throttling (`TenantScopedRateThrottle`).
* **Authentication & Session Tracking**:
  * Simple JWT token auth with custom token refresh validation (`SessionTokenRefreshView`).
  * Session-tracking table (`UserSession`) that logs client IP addresses, user agents, and supports token JTI deactivations.
* **Academic CRM**:
  * Course catalogs, cohort creation (`AcademyClass`), and student enrollments.
  * Schedule timeline tracking with validator checks preventing teacher/room booking overlaps.
* **Assessments & Question Banks**:
  * Question banks mapping multiple question types (single choice, multiple choice, written text, code).
  * Timed student quiz attempts (`TakeAssessmentPage`) logging focus loss telemetry.
* **Interactive Live Rooms & WebRTC**:
  * Video/audio streaming using LiveKit.
  * In-call whiteboard drawings syncing coordinates across participants.
  * Classroom minigames (Word Guess, Grammar, Vocabulary) mapped via an iframe bridge.
  * LiveKit WebRTC egress recording webhook catching and stitching segments (`webhook.py`).
* **Financial Accounting**:
  * Unified operational ledger displaying revenue (tuition invoices) vs costs (expenses) in real time.
* **In-App Notifications**:
  * Persistent database notifications (`Notification` model) synced via WebSocket channels.

---

## 2. Partially Implemented Features

### A. GDPR & Privacy Compliance
* **Backend Status**: Full compliance workflows are implemented in `privacy_views.py` and `privacy_services.py` (`PrivacyExportView` compiled zip archives, `AccountPurgeView` anonymizes fields to "Anonymized GDPR User" and releases references).
* **Frontend Status**: Helper functions exist in `/src/features/dashboard/api/reports.api.ts` to hit these endpoints, but **there are no buttons or settings UI components** to trigger them.
* **Gap**: User-facing privacy action buttons are missing.

### B. Stripe Subscriptions & Billing
* **Backend Status**: Full integration with Stripe Checkout and Stripe Webhooks.
* **Frontend Status**: Plan cards are displayed on `/settings/billing`, but clicking them redirects to Stripe Checkout URLs which fail if credentials (`STRIPE_SECRET_KEY`) are missing or configured in sandbox mode.
* **Gap**: Redirection depends on Stripe configurations; checkout lacks a fallback mock mode in development setups.

### C. Live Whiteboard Persistence
* **Status**: Coordinate paths are synced in real time between participants in-memory. However, **there is no database model** or file storage to record whiteboard history.
* **Gap**: Refreshing the browser or closing the call permanently purges whiteboard drawings.

---

## 3. Backend-Only Features (Missing from Frontend)

* **Operator Audit Log Viewer**:
  * The backend records fine-grained data state changes (`AuditLog` and `OperatorAuditLogViewSet` capturing `before_state` and `after_state`).
  * The frontend lacks UI dashboards for tenant admins to inspect logs, although a system-wide view exists for platform superusers at `/sys-admin`.
* **System Settings Configurator**:
  * Backend has `SystemConfigViewSet` to modify system parameters dynamically.
  * Frontend has no settings screen for managing these variables.

---

## 4. Frontend-Only Features (Missing from Backend)

* **Invoice PDF Downloads**:
  * The invoice detail view displays a "Download PDF" button.
  * The backend does not generate PDF files. The action is mocked client-side using browser print panels.

---

## 5. Broken or Complex Testing Flows

* **Live WebRTC Call Testing**:
  * Requires a running LiveKit server instance. Local development setups will fail to initiate video call streams unless mock environment overrides are toggled.
* **Recording Segment Webhooks**:
  * Testing recording completions requires triggering the egress worker webhook endpoint (`/api/recordings/webhook/`), which is difficult to execute locally without a mock payload generator tool.

---

## 6. Missing Enterprise features

* **SSO Authentication**: Lack of university-level integrations (SAML, OAuth2, LDAP).
* **Fine-Grained Role Builder**: Admins can assign default roles but cannot customize individual role permissions using a checklist.
* **Recurring Billing Runs**: Invoices are created manually or on enrollment, with no support for recurring monthly/weekly subscription runs.

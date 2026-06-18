# EduSpace API Reference & Documentation Maintenance Guide

This directory contains endpoint definitions, request schemas, permission requirements, and response structures for all major system models.

---

## 1. Documentation Map & Code Reference

Below is the architectural map linking frontend pages, API endpoint documents, backend Django ViewSets, Serializers, and Models.

| Domain | API Document | Backend ViewSet | Serializer | Django Model | Frontend Consumers |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Organizations** | [organizations.md](file:///d:/Wrok/Projects/eduspace/docs/api/organizations.md) | `OrganizationViewSet` | `OrganizationSerializer` | `Organization` | `/settings/organization` |
| **Courses** | [courses.md](file:///d:/Wrok/Projects/eduspace/docs/api/courses.md) | `CourseViewSet` | `CourseSerializer` | `Course` | `/academic/courses` |
| **Classes** | [classes.md](file:///d:/Wrok/Projects/eduspace/docs/api/classes.md) | `AcademyClassViewSet` | `AcademyClassSerializer` | `AcademyClass` | `/academic/classes` |
| **Sessions** | [sessions.md](file:///d:/Wrok/Projects/eduspace/docs/api/sessions.md) | `SessionViewSet` | `SessionSerializer` | `Session` | `/academic/sessions` |
| **Recordings** | [recordings.md](file:///d:/Wrok/Projects/eduspace/docs/api/recordings.md) | *Function Views* | *Manual Serialization* | `Recording` | `/recordings` |
| **Assignments** | [assignments.md](file:///d:/Wrok/Projects/eduspace/docs/api/assignments.md) | `AssignmentViewSet` | `AssignmentSerializer` | `Assignment` | `/academic/assignments` |
| **Assessments** | [assessments.md](file:///d:/Wrok/Projects/eduspace/docs/api/assessments.md) | `AssessmentViewSet` | `AssessmentSerializer` | `Assessment` | `/academic/assessments` |

---

## 2. API Change Tracking Checklist

Whenever a developer modifies backend endpoints or serializers, they **MUST** execute the following verification checklist before opening a Pull Request:

### Step 1: Model Modifications
* [ ] Did you add or modify a model field?
  * *Action*: Update the model schema in the corresponding file in `docs/entities/`.
  * *Action*: Update the request/response payloads in `docs/api/`.

### Step 2: Serializer / Payload Changes
* [ ] Did you add a field to a DRF Serializer?
  * *Action*: Update the Request Body Schema and Response Schema in the entity's API document in `docs/api/`.
* [ ] Did you change a field validation rule (e.g. `min_value` or `required=True`)?
  * *Action*: Update the Validation Rules sections in the corresponding `docs/api/` markdown file.

### Step 3: Endpoint Additions & URL Routing
* [ ] Did you register a new `@action` or function view URL route?
  * *Action*: Add a new subsection inside the relevant `docs/api/` file detailing Endpoint, Query Params, Headers, Body, and Response structures.
  * *Action*: Register the route in [page-inventory.md](file:///d:/Wrok/Projects/eduspace/docs/frontend/page-inventory.md) if it maps directly to a new UI path.

### Step 4: RBAC/Permission Modifications
* [ ] Did you change the `required_org_permission` codename or role permission mapping?
  * *Action*: Update the permission flags listed in [01-user-inventory.md](file:///d:/Wrok/Projects/eduspace/docs/demo/01-user-inventory.md).
  * *Action*: Verify and align frontend RouteGuard rules inside `routes.tsx` to match the new permission restrictions.

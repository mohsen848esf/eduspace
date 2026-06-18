# API: Classes

The classes endpoints manage classroom cohorts, student enrollments, and teacher assignments.

---

## 1. List Classes

### Endpoint
* **Method**: `GET`
* **URL**: `/api/auth/classes/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_view_dashboard`

### Response
* **Success (200 OK)**:
```json
[
  {
    "id": 1,
    "course": 1,
    "teacher": 11,
    "mentor": null,
    "name": "React Summer 2026",
    "start_date": "2026-06-01",
    "end_date": "2026-08-31",
    "room": null,
    "is_active": true,
    "max_students": 30,
    "session_count": 2,
    "latest_session": {
      "id": 1,
      "title": "React Components (Live)",
      "status": "live",
      "scheduled_start": "2026-06-18T10:00:00Z"
    }
  }
]
```

---

## 2. Create Class

### Endpoint
* **Method**: `POST`
* **URL**: `/api/auth/classes/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `Content-Type: application/json`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_manage_members`

### Request Body Schema
* **Fields**:
  * `course` (int, required)
  * `name` (string, required)
  * `teacher` (int, optional)
  * `mentor` (int, optional)
  * `start_date` (date string, optional)
  * `end_date` (date string, optional)
  * `max_students` (int, optional)
  * `is_active` (boolean, optional, default: true)

### Response
* **Success (201 Created)**:
```json
{
  "id": 3,
  "course": 1,
  "teacher": 11,
  "mentor": null,
  "name": "React Winter 2026",
  "start_date": "2026-11-01",
  "end_date": "2027-01-31",
  "room": null,
  "is_active": true,
  "max_students": 25,
  "session_count": 0,
  "latest_session": null
}
```

---

## 3. Retrieve Class Details

### Endpoint
* **Method**: `GET`
* **URL**: `/api/auth/classes/<id>/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_view_dashboard`

---

## Referenced Models
* `AcademyClass`
* `Course`
* `User`

## Frontend Consumers
* `/academic/classes` ([ClassesPage](file:///d:/Wrok/Projects/eduspace/frontend/src/features/dashboard/components/ClassesPage.tsx))
* `/academic/classes/:classId` ([ClassDetailPage](file:///d:/Wrok/Projects/eduspace/frontend/src/features/dashboard/components/ClassDetailPage.tsx))

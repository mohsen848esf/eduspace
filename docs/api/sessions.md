# API: Sessions

The sessions endpoints control scheduling, room initialization, and attendance logs.

---

## 1. List Sessions

### Endpoint
* **Method**: `GET`
* **URL**: `/api/auth/sessions/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_view_sessions`

### Query Parameters
* `class_id` (int, optional)
* `status` (string: `scheduled`, `live`, `completed`, `cancelled`, optional)

### Response
* **Success (200 OK)**:
```json
[
  {
    "id": 1,
    "academy_class": 1,
    "organization": 1,
    "host": 11,
    "active_room": null,
    "title": "React Components",
    "scheduled_start": "2026-06-18T10:00:00Z",
    "scheduled_end": "2026-06-18T11:00:00Z",
    "status": "scheduled",
    "created_at": "2026-06-18T09:00:00Z"
  }
]
```

---

## 2. Schedule Session

### Endpoint
* **Method**: `POST`
* **URL**: `/api/auth/sessions/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `Content-Type: application/json`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_manage_sessions`

### Request Body Schema
* **Fields**:
  * `academy_class` (int, optional; null for ad-hoc sessions)
  * `title` (string, required)
  * `host` (int, required)
  * `scheduled_start` (datetime string, optional)
  * `scheduled_end` (datetime string, optional)
  * `status` (string, optional, default: `scheduled`)

### Response
* **Success (201 Created)**:
```json
{
  "id": 2,
  "academy_class": 1,
  "organization": 1,
  "host": 11,
  "active_room": null,
  "title": "React State Management",
  "scheduled_start": "2026-06-19T10:00:00Z",
  "scheduled_end": "2026-06-19T11:30:00Z",
  "status": "scheduled",
  "created_at": "2026-06-18T12:00:00Z"
}
```

---

## 3. Custom Action: Start Session

### Endpoint
* **Method**: `POST`
* **URL**: `/api/auth/sessions/<id>/start/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_manage_sessions`

### Response
* **Success (200 OK)**:
```json
{
  "id": 1,
  "academy_class": 1,
  "organization": 1,
  "host": 11,
  "active_room": {
    "id": 1,
    "name": "React Components",
    "room_code": "AB12CD34"
  },
  "title": "React Components",
  "scheduled_start": "2026-06-18T10:00:00Z",
  "scheduled_end": "2026-06-18T11:00:00Z",
  "status": "live",
  "created_at": "2026-06-18T09:00:00Z"
}
```

---

## 4. Custom Action: Complete Session

### Endpoint
* **Method**: `POST`
* **URL**: `/api/auth/sessions/<id>/complete/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_manage_sessions`

### Response
* **Success (200 OK)**:
```json
{
  "id": 1,
  "status": "completed"
}
```

---

## 5. Custom Action: Get Attendance Records

### Endpoint
* **Method**: `GET`
* **URL**: `/api/auth/sessions/<id>/attendance/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_view_sessions` (If user lacks `can_view_attendance`, results are filtered to their own user id)

### Response
* **Success (200 OK)**:
```json
[
  {
    "id": 1,
    "student": {
      "id": 2,
      "username": "testuser",
      "full_name": "Test User"
    },
    "status": "present",
    "joined_at": "2026-06-18T10:01:00Z",
    "left_at": "2026-06-18T11:00:00Z",
    "note": ""
  }
]
```

---

## Referenced Models
* `Session`
* `Attendance`
* `AcademyClass`
* `Room`

## Frontend Consumers
* `/academic/sessions` ([SessionsPage](file:///d:/Wrok/Projects/eduspace/frontend/src/features/dashboard/components/SessionsPage.tsx))
* `/academic/sessions/:sessionId` ([SessionDetailPage](file:///d:/Wrok/Projects/eduspace/frontend/src/features/dashboard/components/SessionDetailPage.tsx))

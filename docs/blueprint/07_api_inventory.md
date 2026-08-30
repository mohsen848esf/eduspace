# Phase 7 — API Inventory

This section lists the Django REST framework (DRF) backend APIs grouped by module, detailing the HTTP methods, URL paths, permissions, and request/response structures.

---

## Module: Assessments

The assessments endpoints handle Question Banks, Question composition, Assessment exams, quiz attempts, grading, and anti-cheat telemetry.

---

## 1. Create Question Bank

### Endpoint
* **Method**: `POST`
* **URL**: `/api/assessments/question-banks/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_teach_class`

### Response
* **Success (201 Created)**:
```json
{
  "id": 1,
  "organization": 1,
  "title": "React Basics",
  "description": "Fundamental components and JSX queries.",
  "created_by": 11
}
```

---

## 2. Publish Assessment

### Endpoint
* **Method**: `POST`
* **URL**: `/api/assessments/assessments/<id>/publish/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_teach_class`

### Response
* **Success (200 OK)**:
```json
{
  "id": 1,
  "title": "React Midterm",
  "is_published": true
}
```

---

## 3. Start Assessment (Student)

### Endpoint
* **Method**: `POST`
* **URL**: `/api/assessments/assessments/<id>/start/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_view_dashboard` (Enrolled student)

### Response
* **Success (201 Created)**: Creates the student's `Submission` row.
```json
{
  "submission_id": 12,
  "assessment": 1,
  "student": 2,
  "status": "started",
  "started_at": "2026-06-18T13:00:00Z",
  "duration_minutes": 60
}
```

---

## 4. Log Anti-Cheat Telemetry (Tab Loss)

### Endpoint
* **Method**: `POST`
* **URL**: `/api/assessments/submissions/<id>/record-tab-loss/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_view_dashboard` (Attempting Student)

### Response
* **Success (200 OK)**: Increments tab loss logs.
```json
{
  "submission_id": 12,
  "tab_focus_losses": 3
}
```

---

## 5. Submit Assessment

### Endpoint
* **Method**: `POST`
* **URL**: `/api/assessments/submissions/<id>/submit/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_view_dashboard`

### Response
* **Success (200 OK)**:
```json
{
  "submission_id": 12,
  "status": "submitted",
  "submitted_at": "2026-06-18T13:45:00Z"
}
```

---

## 6. Grade Assessment (Manual Teacher Scoring)

### Endpoint
* **Method**: `POST`
* **URL**: `/api/assessments/submissions/<id>/grade/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_teach_class`

### Request Body Schema
* **Fields**:
  * `scores` (dict mapping `student_answer_id` to numeric scores, e.g. `{"15": 8.50}`)
  * `notes` (string, optional)

### Response
* **Success (200 OK)**:
```json
{
  "submission_id": 12,
  "status": "graded",
  "score": "18.50",
  "graded_by": 11,
  "graded_at": "2026-06-18T15:00:00Z"
}
```

---

## Referenced Models
* `Assessment`
* `QuestionBank`
* `Question`
* `Submission`
* `StudentAnswer`

## Frontend Consumers
* `/academic/assessments` ([AssessmentsPage](file:///d:/Wrok/Projects/eduspace/frontend/src/features/dashboard/components/AssessmentsPage.tsx))
* `/assessments/take/:submissionId` ([TakeAssessmentPage](file:///d:/Wrok/Projects/eduspace/frontend/src/features/assessments/pages/TakeAssessmentPage.tsx))
* `/assessments/results/:submissionId` ([AssessmentResultsPage](file:///d:/Wrok/Projects/eduspace/frontend/src/features/assessments/pages/AssessmentResultsPage.tsx))
* `/assessments/review/:submissionId` ([ReviewSubmissionPage](file:///d:/Wrok/Projects/eduspace/frontend/src/features/assessments/pages/ReviewSubmissionPage.tsx))

---

## Module: Assignments

The assignments endpoints manage homework issuing, student uploads, and grading.

---

## 1. List Assignments

### Endpoint
* **Method**: `GET`
* **URL**: `/api/assessments/assignments/`

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
    "organization": 1,
    "academy_class": 1,
    "title": "Build a Tic-Tac-Toe Game",
    "description": "Create a fully functional React components game.",
    "due_date": "2026-06-25T23:59:59Z",
    "attachment": null,
    "created_by": 11,
    "created_at": "2026-06-18T10:00:00Z"
  }
]
```

---

## 2. Issue Assignment

### Endpoint
* **Method**: `POST`
* **URL**: `/api/assessments/assignments/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `Content-Type: application/json`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_teach_class`

### Request Body Schema
* **Fields**:
  * `academy_class` (int, required)
  * `title` (string, required)
  * `description` (string, optional)
  * `due_date` (datetime string, optional)
  * `attachment` (file, optional)

### Response
* **Success (201 Created)**:
```json
{
  "id": 2,
  "organization": 1,
  "academy_class": 1,
  "title": "React Hooks Exercises",
  "description": "Submit homework in custom state hook structure.",
  "due_date": "2026-06-28T20:00:00Z",
  "attachment": null,
  "created_by": 11,
  "created_at": "2026-06-18T11:00:00Z"
}
```

---

## 3. Submit Homework (Student)

### Endpoint
* **Method**: `POST`
* **URL**: `/api/assessments/assignment-submissions/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `Content-Type: application/json` or multi-part/form-data
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_view_dashboard` (Student access)

### Request Body Schema
* **Fields**:
  * `assignment` (int, required)
  * `submission_text` (string, optional)
  * `submission_file` (file, optional)

### Response
* **Success (201 Created)**:
```json
{
  "id": 5,
  "assignment": 1,
  "student": 2,
  "status": "submitted",
  "submitted_at": "2026-06-18T12:00:00Z",
  "submission_file": "/media/submissions/tic-tac-toe.zip",
  "submission_text": "Completed the extra credit portion.",
  "grade": null,
  "feedback": "",
  "graded_by": null,
  "graded_at": null
}
```
* **Validation Rule**: A student cannot make duplicate submissions for the same assignment. If they try, the API returns a `400 Bad Request` saying `"You have already submitted this assignment."`

---

## 4. Grade Submission (Teacher/Admin)

### Endpoint
* **Method**: `PATCH` / `PUT`
* **URL**: `/api/assessments/assignment-submissions/<id>/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `Content-Type: application/json`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_teach_class`

### Request Body Schema
* **Fields**:
  * `grade` (decimal string, required, e.g. `9.50`)
  * `feedback` (string, optional)
  * `status` (string: `graded`, optional)

### Response
* **Success (200 OK)**:
```json
{
  "id": 5,
  "assignment": 1,
  "student": 2,
  "status": "graded",
  "submitted_at": "2026-06-18T12:00:00Z",
  "submission_file": "/media/submissions/tic-tac-toe.zip",
  "submission_text": "Completed the extra credit portion.",
  "grade": "9.50",
  "feedback": "Excellent work on code modularity and extra credit rules.",
  "graded_by": 11,
  "graded_at": "2026-06-18T14:30:00Z"
}
```

---

## Referenced Models
* `Assignment`
* `AssignmentSubmission`
* `User`

## Frontend Consumers
* `/academic/assignments/:assignmentId` ([AssignmentDetailPage](file:///d:/Wrok/Projects/eduspace/frontend/src/features/assessments/pages/AssignmentDetailPage.tsx))

---

## Module: Classes

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

---

## Module: Courses

The courses endpoints define course curricula templates and structural price tiers.

---

## 1. List Courses

### Endpoint
* **Method**: `GET`
* **URL**: `/api/auth/courses/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `X-Organization-Slug: default-academy` (Required for tenant scoping)
* **Permissions**: `can_view_dashboard`

### Response
* **Success (200 OK)**:
```json
[
  {
    "id": 1,
    "organization": 1,
    "title": "Introduction to React",
    "code": "REACT101",
    "description": "Learn the basics of React components.",
    "price": "150.00",
    "is_active": true,
    "thumbnail": null
  }
]
```

---

## 2. Create Course

### Endpoint
* **Method**: `POST`
* **URL**: `/api/auth/courses/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `Content-Type: application/json`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_manage_members`

### Request Body Schema
* **Fields**:
  * `title` (string, required)
  * `code` (string, required, unique per organization)
  * `description` (string, optional)
  * `price` (decimal/string, required)
  * `is_active` (boolean, optional, default: true)

### Response
* **Success (201 Created)**:
```json
{
  "id": 3,
  "organization": 1,
  "title": "React Advanced Techniques",
  "code": "REACT201",
  "description": "State management, performance, etc.",
  "price": "250.00",
  "is_active": true,
  "thumbnail": null
}
```

---

## 3. Update Course

### Endpoint
* **Method**: `PATCH` / `PUT`
* **URL**: `/api/auth/courses/<id>/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `Content-Type: application/json`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_manage_members`

### Response
* **Success (200 OK)**:
```json
{
  "id": 1,
  "organization": 1,
  "title": "Introduction to React v19",
  "code": "REACT101",
  "description": "Learn the basics of React 19.",
  "price": "170.00",
  "is_active": true,
  "thumbnail": null
}
```

---

## Referenced Models
* `Course`
* `Organization`

## Frontend Consumers
* `/academic/courses` ([CoursesPage](file:///d:/Wrok/Projects/eduspace/frontend/src/features/dashboard/components/CoursesPage.tsx))
* `/academic/courses/:courseId` ([CourseDetailPage](file:///d:/Wrok/Projects/eduspace/frontend/src/features/dashboard/components/CourseDetailPage.tsx))

---

## Module: Organizations

The organizations endpoints manage multi-tenant institution structures and configurations.

---

## 1. List Organizations

### Endpoint
* **Method**: `GET`
* **URL**: `/api/auth/organizations/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**: `Authorization: Bearer <token>`
* **Permissions**: `can_view_dashboard`

### Response
* **Success (200 OK)**:
```json
[
  {
    "id": 1,
    "name": "Default Academy",
    "slug": "default-academy",
    "type": "organization",
    "owner": 1,
    "is_active": true,
    "is_suspended": false,
    "logo": null,
    "created_at": "2026-06-18T10:00:00Z"
  }
]
```

---

## 2. Retrieve Organization Details

### Endpoint
* **Method**: `GET`
* **URL**: `/api/auth/organizations/<id>/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**: `Authorization: Bearer <token>`
* **Permissions**: `can_view_dashboard`

### Response
* **Success (200 OK)**:
```json
{
  "id": 1,
  "name": "Default Academy",
  "slug": "default-academy",
  "type": "organization",
  "owner": 1,
  "is_active": true,
  "is_suspended": false,
  "logo": null,
  "created_at": "2026-06-18T10:00:00Z"
}
```

---

## 3. Update Organization Settings

### Endpoint
* **Method**: `PATCH` / `PUT`
* **URL**: `/api/auth/organizations/<id>/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**: 
  * `Authorization: Bearer <token>`
  * `Content-Type: application/json`
  * `X-Organization-Slug: default-academy`
* **Permissions**: `can_manage_members`

### Request Body Schema
* **Fields**:
  * `name` (string, optional)
  * `logo` (binary file, optional)
  * `type` (string: `personal` or `organization`, optional)

### Response
* **Success (200 OK)**:
```json
{
  "id": 1,
  "name": "Updated Academy",
  "slug": "default-academy",
  "type": "organization",
  "owner": 1,
  "is_active": true,
  "is_suspended": false,
  "logo": "/media/org_logos/updated_logo.png",
  "created_at": "2026-06-18T10:00:00Z"
}
```
* **Error Response (403 Forbidden)**:
```json
{
  "error": "Required permission missing: can_manage_members"
}
```

---

## 4. Onboarding Context Retrieval

### Endpoint
* **Method**: `GET`
* **URL**: `/api/auth/org-context/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**: `Authorization: Bearer <token>`
* **Permissions**: Authenticated user.

### Response
* **Success (200 OK)**:
```json
{
  "active_organization": {
    "id": 1,
    "name": "Default Academy",
    "slug": "default-academy"
  },
  "available_organizations": [
    {
      "id": 1,
      "name": "Default Academy",
      "slug": "default-academy",
      "role": "Student"
    }
  ]
}
```

---

## Referenced Models
* `Organization`
* `OrgMember`
* `User`

## Frontend Consumers
* `/settings/organization` ([OrgSettingsPage](file:///d:/Wrok/Projects/eduspace/frontend/src/features/dashboard/components/OrgSettingsPage.tsx))
* `/dashboard` ([DashboardPage](file:///d:/Wrok/Projects/eduspace/frontend/src/features/dashboard/components/DashboardPage.tsx))

---

## Module: Recordings

The recordings endpoints manage video playback stream permissions, trimming, publishing, and playback heartbeat analytics.

---

## 1. List Recordings

### Endpoint
* **Method**: `GET`
* **URL**: `/api/recordings/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**: `Authorization: Bearer <token>`
* **Permissions**: `can_view_dashboard`

### Response
* **Success (200 OK)**:
```json
[
  {
    "public_token": "abc123xyz",
    "room_code": "AB12CD",
    "title": "React Components",
    "duration_seconds": 3600,
    "size_bytes": 104857600,
    "quality": "720p",
    "is_published": true,
    "is_link_shared": false,
    "started_at": "2026-06-18T10:00:00Z"
  }
]
```

---

## 2. Stream Video File

### Endpoint
* **Method**: `GET`
* **URL**: `/api/recordings/<token>/stream/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token or Public access (if `is_link_shared` is active)
* **Headers**:
  * `Authorization: Bearer <token>` (optional if link shared)
  * `Range: bytes=0-1048576` (supports HTTP Range headers for seekable video playback)
* **Permissions**: Evaluated via `can_be_viewed_by(user)`:
  * Owner (host) can always stream.
  * Authed users can stream if `is_link_shared` is true, or if they are in the `visible_to` whitelist.

### Response
* **Success (206 Partial Content)**: Stream chunk bytes with headers:
  * `Content-Range: bytes 0-1048576/104857600`
  * `Content-Type: video/mp4`

---

## 3. Publish Recording

### Endpoint
* **Method**: `POST`
* **URL**: `/api/recordings/<token>/publish/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `Content-Type: application/json`
* **Permissions**: Recording Owner or Admin

### Request Body Schema
* **Fields**:
  * `visible_to_users` (list of integers, optional; user IDs of students allowed to watch)
  * `is_link_shared` (boolean, optional; if true, any authed user with the URL can watch)
  * `trim_start_seconds` (float, optional, default: 0.0)
  * `trim_end_seconds` (float, optional)

### Response
* **Success (200 OK)**:
```json
{
  "public_token": "abc123xyz",
  "is_published": true,
  "is_link_shared": false,
  "trim_start_seconds": 15.5,
  "trim_end_seconds": 3585.0
}
```

---

## 4. Playback Heartbeat Tracking

### Endpoint
* **Method**: `POST`
* **URL**: `/api/recordings/<token>/heartbeat/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**:
  * `Authorization: Bearer <token>`
  * `Content-Type: application/json`
* **Permissions**: `can_view_dashboard` (Student viewer)

### Request Body Schema
* **Fields**:
  * `last_position` (float, required; current playback head time in seconds)

### Response
* **Success (200 OK)**:
```json
{
  "status": "success",
  "last_position_seconds": 120.5,
  "furthest_position_seconds": 120.5,
  "view_count": 1
}
```

---

## 5. Retrieve View Analytics (Teacher/Admin only)

### Endpoint
* **Method**: `GET`
* **URL**: `/api/recordings/<token>/views/`

### Authentication & Permissions
* **Authentication**: JWT Bearer Token
* **Headers**: `Authorization: Bearer <token>`
* **Permissions**: Recording Owner or Admin

### Response
* **Success (200 OK)**:
```json
[
  {
    "user": {
      "id": 2,
      "username": "testuser",
      "full_name": "Test User"
    },
    "last_position_seconds": 120.5,
    "furthest_position_seconds": 240.0,
    "view_count": 2,
    "last_watched_at": "2026-06-18T13:00:00Z"
  }
]
```

---

## Referenced Models
* `Recording`
* `RecordingSegment`
* `RecordingView`
* `User`

## Frontend Consumers
* `/recordings` ([RecordingsPage](file:///d:/Wrok/Projects/eduspace/frontend/src/features/recordings/components/RecordingsPage.tsx))
* `/recordings/:token` ([RecordingViewPage](file:///d:/Wrok/Projects/eduspace/frontend/src/features/recordings/components/RecordingViewPage.tsx))
* `/recordings/:token/edit` ([RecordingEditPage](file:///d:/Wrok/Projects/eduspace/frontend/src/features/recordings/components/RecordingEditPage.tsx))

---

## Module: Sessions

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

---

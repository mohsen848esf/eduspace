# API: Assignments & Submissions

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

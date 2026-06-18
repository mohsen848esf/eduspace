# API: Assessments

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

# API: Courses

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

# API: Organizations

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

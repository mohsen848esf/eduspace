# API: Recordings

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

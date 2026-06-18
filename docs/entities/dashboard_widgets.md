# Entity: Dashboard Widgets

The `DashboardWidgets` entity represents the modular layout components rendered on the main dashboard page depending on the user's role and organization status.

---

## 1. Purpose

It ensures that users see role-relevant metrics immediately upon logging in. Admins see member and financial statistics, teachers see grading tasks and schedules, and students see upcoming quizzes and recordings.

---

## 2. Relationships

Widgets are populated by:
* **Academic stats**: Enrolled classes, upcoming sessions, live streams, and assignments.
* **Financial stats**: Invoice status trackers and operational summaries.
* **Student-specific items**: Grade tracker charts, upcoming exams, next up countdown, and the recordings shelf.

---

## 3. Lifecycle

1. **Role Check**: When a user logs in, the frontend queries their organization role context.
2. **Component Mapping**: The frontend Dashboard router loads the corresponding widget panels:
   * **Admin View**: Member listings, billing plan quotas, finance logs.
   * **Teacher View**: Live session launcher, pending submissions grid, upcoming schedules.
   * **Student View**: Grade cards, next up session timer, recordings list.
3. **Real-time updates**: Alerts and notifications trigger dynamic status changes in widgets (e.g., displaying the "Live Now" banner when a session starts).

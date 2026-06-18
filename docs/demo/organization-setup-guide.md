# EduSpace Organization Setup Guide

This guide provides a step-by-step walkthrough to set up, configure, and manage an educational organization on EduSpace, covering administrative setup, live classrooms, assignments, grading, invoicing, and analytics.

---

## 1. Create Organization
* **Steps**:
  1. Log in as a user who does not belong to any organization.
  2. You will be greeted by the onboarding splash screen. Click **Create Organization**.
  3. Enter the organization's name (e.g. `Alpha Academy`), which automatically generates a URL-friendly slug.
  4. Select the organization type (e.g. `organization` or `personal`).
  5. Click **Submit**.
* **Expected Result**: The backend creates the `Organization` row, sets the current user as the `owner`, and redirects the user to the Stripe Checkout portal to establish a subscription plan.

---

## 2. Configure Organization
* **Steps**:
  1. Navigate to `/settings/organization` (Organization Settings).
  2. Upload an institution logo file.
  3. Customize standard tenant configuration templates (e.g., maximum live participant counts or default session lengths).
  4. Click **Save Changes**.
* **Expected Result**: The backend updates the `Organization` model fields and registers the preferences.

---

## 3. Invite Members & 4. Assign Roles
* **Steps**:
  1. Go to the Member Directory page at `/crm/members`.
  2. Click **Invite Member**.
  3. Enter the recipient's email address, select their contract type (Full Time, Part Time, contractor, guest), and assign their initial role (`Admin`, `Teacher`, `Mentor`, `Student`).
  4. Click **Send Invitation**.
* **Expected Result**: The backend registers an `OrgMember` record linked to the target user with `is_active = True`. If the user does not exist on the platform, an invitation link is generated.

---

## 5. Create Course
* **Steps**:
  1. Navigate to the Course catalog page at `/academic/courses`.
  2. Click **Create Course**.
  3. Enter the course name (e.g., `React Developer Bootcamp`), unique catalog code (e.g., `REACT2026`), description, and tuition cost (e.g., `250.00`).
  4. Click **Save**.
* **Expected Result**: The backend saves the `Course` model instance, validating that the catalog code is unique within the organization.

---

## 6. Create Class & 7. Add Teacher & 8. Add Mentor
* **Steps**:
  1. Navigate to `/academic/classes` and click **Create Class**.
  2. Enter the class name (e.g., `React Summer Cohort Section A`).
  3. Choose the parent Course catalog item (`React Developer Bootcamp`).
  4. Select the primary assigned **Teacher** and **Mentor** from the user dropdowns.
  5. Choose the start date, end date, and maximum class size.
  6. Click **Create Class**.
* **Expected Result**: The backend instantiates an `AcademyClass` record, linking the specified teacher and mentor users.

---

## 9. Add Students
* **Steps**:
  1. Open the Class Detail page of your new class (`/academic/classes/:id`).
  2. Scroll to the **Students** tab and click **Enroll Student**.
  3. Search for the student's username or email, then click **Enroll**.
* **Expected Result**: The backend creates an `Enrollment` record, setting `completion_status = 'in_progress'`. A corresponding tuition invoice is generated automatically.

---

## 10. Schedule Session
* **Steps**:
  1. Open the Class Detail page (`/academic/classes/:id`) and select the **Sessions** tab.
  2. Click **Schedule Session**.
  3. Enter the lecture title (e.g., `Introduction to React Components`).
  4. Select the scheduled start time and end time.
  5. Click **Schedule**.
* **Expected Result**: The backend runs validation checks to ensure the assigned teacher (host) and room do not have overlapping schedules, then creates the `Session` record in the `scheduled` state.

---

## 11. Start Live Class
* **Steps**:
  1. As the assigned Teacher, navigate to `/academic/sessions`.
  2. Locate your scheduled session and click **Start Session**.
  3. You will be redirected to the live room at `/room/:roomCode`.
  4. Grant microphone/camera browser permissions, then click **Join Call**.
* **Expected Result**: The backend updates the session status to `live` and initiates a LiveKit WebRTC room. Students see a red "Live Now" banner on their dashboards.

---

## 12. Publish Recording
* **Steps**:
  1. During the live class, the teacher clicks **Record** in the bottom panel to trigger recording.
  2. When the lecture ends, click **Stop Recording** and exit the room.
  3. Go to `/recordings` and find the processed recording.
  4. Click **Edit**. Adjust the trim handles to cut out dead air at the beginning or end of the video.
  5. Select the classes that are authorized to view this recording, then click **Publish**.
* **Expected Result**: The backend stitches the recording segments, applies the trim offsets, sets `is_published = True`, and updates the student dashboards.

---

## 13. Create Assignment & 14. Student Submission Flow
* **Steps**:
  1. On the Class Detail page, navigate to the **Assignments** tab and click **Create Assignment**.
  2. Enter the title (e.g., `Build a Tic-Tac-Toe Game`), instructions, and set a due date. Click **Save**.
  3. The student logs in, navigates to `/academic/assignments/:id`, reviews the instructions, uploads their source files, and clicks **Submit Assignment**.
* **Expected Result**: The backend registers an `Assignment` record. The student's submission creates an `AssignmentSubmission` row with status `submitted`.

---

## 15. Grading Flow
* **Steps**:
  1. The teacher logs in, opens the assignment page, and reviews the submissions grid.
  2. Click **Grade** next to a student's submission.
  3. Enter the numeric grade and write custom feedback in the notes field. Click **Submit Grade**.
* **Expected Result**: The backend saves the grade, updates the status to `graded`, and logs the grader's ID.

---

## 16. Attendance Flow
* **Steps**:
  1. After a live class completes, the teacher navigates to `/academic/attendance`.
  2. Locate the target session and review the automatically logged presence markers.
  3. Adjust any statuses manually (e.g., marking a late student as `excused` or adding absence notes).
  4. Click **Save Attendance**.
* **Expected Result**: The backend updates the `Attendance` records.

---

## 17. Invoicing Flow
* **Steps**:
  1. The admin navigates to `/finance/ledger`.
  2. Select the **Invoices** tab and click **Create Invoice**.
  3. Search for the target student, enter the line item description (e.g., `React Bootcamp Tuition Fee`), set the unit price, and specify a due date. Click **Issue Invoice**.
  4. The student logs in, goes to their billing page, reviews the invoice, and completes payment.
* **Expected Result**: The backend creates the `TuitionInvoice` and `InvoiceLineItem` records. Once paid, the invoice status changes to `paid`.

---

## 18. Analytics Flow
* **Steps**:
  1. Navigate to `/academic/reports` (Reports Page).
  2. Select academic or financial metrics to view (e.g., course averages, monthly cash flow charts).
  3. Click **Export Report** to download the summaries.
* **Expected Result**: The backend aggregates database values dynamically, calculates averages and margins, and returns a CSV/Excel file.

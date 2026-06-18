# EduSpace Director Demo Script (15-Minute Scenario)

This script is designed for a 15-minute walkthrough of the EduSpace platform, tailored for an Educational Institute Director.

---

## 1. Introduction & Dashboard (2 Minutes)

* **Goal**: Showcase the clean, premium dashboard design.
* **What to click**:
  1. Log in to `http://localhost:5173/login` using username `admin_test` and password `Pass123$`.
  2. Let the main dashboard load.
* **What to say**:
  > "Welcome to EduSpace. As an Institute Director, you need a high-level view of your academy's health. Upon logging in, our dashboard immediately shows your KPI tiles: total active students, upcoming live classes, monthly tuition income, and outstanding invoices. Everything is clean and accessible, giving you administrative control without clutter."
* **Expected Result**: Dashboard displays KPI widgets, active cohorts, calendar highlights, and recent financial transactions.

---

## 2. User & Course Administration (3 Minutes)

* **Goal**: Show how easy it is to manage members and schedule courses.
* **What to click**:
  1. Click **Members** in the sidebar to open `/crm/members`.
  2. Point to the student roster. Click **Invite Member**, fill out the fields (assigning a role), then close the drawer.
  3. Click **Courses** in the sidebar to open `/academic/courses`.
  4. Select `REACT101` (Introduction to React) to show the Course Detail page.
* **What to say**:
  > "Adding students and staff is seamless. You invite them, select their role (Student, Mentor, Teacher), and they receive their onboarding link. In the Course Catalog, we define the templates for our curriculum—setting tuition prices and descriptions once, which can then be reused to launch multiple class cohorts."
* **Expected Result**: Members directory drawer opens smoothly; Course catalog details display active class lists.

---

## 3. Live Teaching & Recording Launch (4 Minutes)

* **Goal**: Demonstrate WebRTC capabilities, whiteboard interaction, and recording.
* **What to click**:
  1. Click **Sessions** in the sidebar to go to `/academic/sessions`.
  2. Locate the active session and click **Start Session**.
  3. Enter the WebRTC Room page (`/room/:roomCode`).
  4. Turn on your camera/mic, click **Record** in the bottom control bar, type a message in the chat drawer, and draw a quick line on the whiteboard.
  5. Click **Stop Recording**, then end the room call.
* **What to say**:
  > "When it's time to teach, your instructors click 'Start Session' directly from their calendar. This spins up our secure, low-latency WebRTC live classroom. In addition to high-definition video and audio streaming, teachers can use our interactive whiteboard, launch vocabulary games, and trigger server-side recordings. Once class ends, the recording is automatically stitched and prepared for review."
* **Expected Result**: Live room opens, recording indicators toggle, and ending the call redirects back to the dashboard.

---

## 4. Homework & Grading Workflow (2 Minutes)

* **Goal**: Showcase quiz and assignment submission review.
* **What to click**:
  1. Go to `/academic/assessments`.
  2. Click on the Quiz list or select an active Assignment.
  3. Open a student quiz submission to view the grading page.
  4. Enter a score of `9.00` and a quick comment in the notes box, then click **Submit**.
* **What to say**:
  > "Grading homework and quizzes is centralized. Teachers can create structured question banks, publish exams with timers, and review submissions in a dedicated grading queue. Any manually graded questions can be scored here, complete with feedback notes that are immediately pushed to the student's portal."
* **Expected Result**: Grading form saves successfully and updates the student's score.

---

## 5. Finance & Revenue Ledger (2 Minutes)

* **Goal**: Display the billing dashboard, invoices, and expense tracking.
* **What to click**:
  1. Click **Ledger** in the sidebar to go to `/finance/ledger`.
  2. Hover over the balance chart, showing credit (tuition) vs debit (expenses).
  3. Click **Issue Invoice**, select student `testuser`, enter `200.00`, and click save.
* **What to say**:
  > "EduSpace keeps track of your cash flow. Our revenue ledger displays invoices issued to students alongside operational costs, like teacher payouts and utilities. You can issue manual bills, track payments, or review Stripe billing statuses dynamically."
* **Expected Result**: Invoice is added to the database and appears on the transaction table.

---

## 6. Analytics & Wrap-up (2 Minutes)

* **Goal**: View growth curves, class averages, and export data.
* **What to click**:
  1. Go to `/academic/reports` (Reports page).
  2. Review the academic metrics charts.
  3. Click **Export Report** to trigger a CSV download.
  4. Log out.
* **What to say**:
  > "Finally, our Reports section aggregates grades, attendance rates, and enrollment timelines to help you analyze institution performance. With one click, you can export all metrics to CSV for external audits. EduSpace provides a complete, modern workspace for your academy."
* **Expected Result**: CSV file starts downloading, showing aggregated data structures.

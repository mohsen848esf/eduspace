# Phase 8 — User Journeys

Detailed step-by-step navigation paths and system interactions for all primary user personas.

---

## 1. Student Journey: Attending a Class and Submitting Homework
1. **Login**: Launches `/login`, inputs credentials, lands on `/dashboard`.
2. **Review Roster**: Sees the active "Today's Schedule" widget. Taps the session card "React Hooks".
3. **Pre-Join Check**: Enters `/room/lobby` (part of the room route), triggers device selection. Selects Webcam, selects "Office blur" background filter. Click "Join Room".
4. **Attending Session**: In the live room (`/room/ROOM_CODE`), watches teacher stream, writes a question in chat, collaborates on the whiteboard.
5. **Leaving Room**: Taps "Leave". Lands on `/dashboard`.
6. **Submit Homework**: Navigates to `/academic/homework`. Finds "Assignment 1". Uploads a `.jpg` or `.pdf` file. Clicks "Submit". Emits a success toast notification.

---

## 2. Teacher Journey: Scheduling a Lesson and Grading Homework
1. **Login & Scheduling**: Logs in. Taps "Sessions" in the sidebar (`/academic/sessions`). Clicks "Schedule Session". Selects Cohort, defines "React Context", sets time, and hits save.
2. **Start Live Room**: At class time, clicks "Start Session" from dashboard. Lands on live room. Enters.
3. **Record Session**: Clicks "Record Class". The system starts backend egress worker. Shares whiteboard.
4. **End Session**: Clicks "End Room" at the end of class. The system terminates LiveKit connection and begins background rendering.
5. **Grading Homework**: Navigates to the Assignment detail page (`/academic/assignments/:id`). Sees submissions table. Clicks "Grade" on Student A. Reviews submission file, types feedback, awards `85/100`, and hits publish.

---

## 3. Organization Admin Journey: Onboarding and Financial Check
1. **Onboarding Staff**: Logs in. Navigates to `/crm/members`. Clicks "Invite Member". Enters email, selects role "Teacher", and copies the invite link containing the organization slug.
2. **Generate Invoices**: Navigates to `/finance/ledger`. Opens the invoice panel. Selects Student Cohort "Cohort 2026", defines tuition fee, and generates invoices.
3. **Audit Ledger**: Reviews operational cash flow charts. Adds a new expense "Server Overhead" of `$50.00`.

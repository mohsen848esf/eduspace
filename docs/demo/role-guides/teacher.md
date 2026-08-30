# Role Guide: Teacher

This guide outlines the system walkthrough for a Teacher account.

---

## 1. First Login Experience

* **Landing Interface**: Logs into the Teacher Dashboard (`/dashboard`) showing scheduling and grading tasks.
* **Visual Widgets**:
  * **Next Up Session Countdown**: Visual countdown timer to their next scheduled class lecture.
  * **Pending Homework Submissions**: Task list showing student uploads awaiting grading.
  * **Class Grid**: Direct links to classes they teach.

---

## 2. Navigation Tour

* **Step 1: Dashboard (`/dashboard`)**: Check daily schedules and grading queues.
* **Step 2: Session Calendar (`/academic/sessions`)**: View scheduled slots, click to schedule a meeting, or launch live teaching rooms.
* **Step 3: Attendance Explorer (`/academic/attendance`)**: Track student presence and review join/leave logs.
* **Step 4: Assessment Manager (`/academic/assessments`)**: Draft online quizzes, edit question banks, and review results.
* **Step 5: Recordings Hub (`/recordings`)**: Trim and publish recorded lectures.

---

## 3. Typical Daily Workflow

1. Log in to review the upcoming schedule.
2. Launch the scheduled session's WebRTC Live Room (`/room/:roomCode`), starting audio/video streams, showing whiteboards, and toggling recording.
3. Review and log attendance markers for the finished session.
4. Grade pending homework submissions at `/academic/assignments/:id` and essay quiz submissions at `/assessments/review/:id`.
5. Trim and publish the class recording for students to review.

---

## 4. Permissions Summary

### Things They Can Create
* Scheduled sessions.
* Assignments, assessments, questions, question banks.
* Classroom WebRTC live rooms.

### Things They Can Edit
* Assignments and assessments they created.
* Attendance records.
* Grades and feedback for student homework or quiz attempts.
* Recording trim bounds.

### Things They Can View
* Enrolled student profiles, class rosters.
* Attendance logs, quiz results, homework submissions.
* Recordings libraries.

### Things They Cannot Access
* Institution financial ledger page (`/finance/ledger`).
* Organization billing settings (`/settings/billing`).
* Invite/delete admin members.
* System configurations (`/sys-admin`).

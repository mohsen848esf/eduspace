# Phase 1 — Product Analysis

## 1. Executive Summary & Problem Space
EduSpace is a modern, multi-tenant Software-as-a-Service (SaaS) Learning Management System (LMS) and Virtual Classroom platform. Traditional learning tools are fragmented: educational institutions are forced to stitch together administrative databases (for enrollment and cohort tracking), financial software (for tuition tracking and expenses), standalone video conferencing tools (like Zoom or Google Meet), assessments systems, and third-party media hosting/editing tools.

EduSpace solves this fragmentation by offering a single, unified workspace. It provides:
1. **Multi-Tenant Separation**: Secure, logical partitioning of data, billing subscriptions, custom roles, and configurations for educational academies.
2. **Administrative Control**: Cohort, course, and enrollment databases.
3. **Financial Ledgering**: Invoicing for tuition fees and recording operational expenses in a central balance ledger.
4. **Interactive Virtual Rooms**: Integrated WebRTC meetings with shared virtual whiteboards, real-time mini-games, and screen sharing.
5. **Automated Recording & Trimming**: Live lectures are recorded on the server, processed, and immediately made available inside the platform with an integrated video trimmer.
6. **Unified Assessment Center**: Automated and manual grading pipelines, question banks, and focus-tracking online exams.

---

## 2. Target Audience & Personas
* **Platform Administrator (Superuser)**: Global operators responsible for platform health, organization onboarding, subscription monitoring, and reviewing system-wide audit logs.
* **Organization Administrator (Owner/Manager)**: Academy owners managing custom roles, staff recruitment, pricing tiers, billing templates, member rosters, and operational finances.
* **Teacher**: Classroom instructors responsible for scheduling lectures, managing attendance, grading assignments/exams, contributing to the question bank, and hosting live WebRTC rooms.
* **Mentor**: Teaching assistants or tutors who assist with student questions, grade submissions, moderate live rooms, and monitor student progress.
* **Student**: Learners who attend live WebRTC sessions, complete quizzes and exams, submit homework, view grade reports, and access recorded lecture libraries.

---

## 3. Primary Workflows
### A. Educational Workflow
1. **Course Definition**: Admins or teachers create courses, defining pricing, descriptions, and syllabi.
2. **Class Cohort Scheduling**: Classes (cohorts) are generated for a specific course, linking students, teachers, and mentors.
3. **Session Lifecycle**: Classes are divided into sessions (lessons). Sessions are scheduled, transitioned to "live" status (WebRTC rooms), and completed, which automatically generates attendance sheets and starts recording processing.

### B. Organization Workflow
1. **Registration**: An academy owner registers their organization and enters billing info.
2. **Onboarding & Configuration**: The owner configures branding (names, logos), setup custom roles (e.g. advanced teacher, assistant student), and adjusts global notification parameters.
3. **Staff & Student Invites**: Invitation links are generated (with automatic org slugs) to onboard members.

### C. Financial Workflow
1. **Tuition Invoicing**: Organization admins generate tuition invoices for enrolled students.
2. **Manual & Automatic Ledger Entry**: Invoices are recorded in the central ledger. When students submit payments, they are processed, and the organization balance updates.
3. **Expense Logging**: Admins log overhead expenses (e.g. server costs, teacher salaries), which are deducted from the organization's net balance.

### D. Assessment Workflow
1. **Question Banking**: Teachers create question banks scoped to courses or subjects, defining tags, difficulty, and type (multiple choice, written, coding).
2. **Exam Composition**: Exams are built from question banks, specifying time limits and publishing rules.
3. **Take Exam Interface**: Students launch timed exams. The system logs tab-focus events to deter cheating. Multiple-choice questions are graded automatically on submission; written and coding questions are queued for manual teacher evaluation.
4. **Grading & Review**: Teachers grade the queue, add comments, and publish final results.

### E. Meeting & Real-Time Classroom Workflow
1. **Joining Pre-Join Lobby**: Participants join a lobby to configure their webcam, microphone, and select virtual background filters (blur, office, nature).
2. **Live Interaction**: Host starts the meeting. Participants share screens, chat, interact on a collaborative SVG whiteboard, and launch interactive mini-games (e.g. click races, trivia) inside the frame.
3. **Recording Finalization**: Host terminates the meeting, triggering server-side recording consolidation.

### F. Analytics & Auditing Workflow
1. **Platform Audit Logs**: Every administrative and financial action is recorded in a tamper-evident audit table for security.
2. **Engagement Tracking**: In-browser video playback issues periodic heartbeats to log student watch duration, aggregating metrics for course completion reports.

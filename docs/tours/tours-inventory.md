# EduSpace Guided Tours Content Inventory

This inventory defines the guided tours for all primary views in the EduSpace platform. Tours are initialized via `driver.js`, filtered dynamically by role, and track completion states per page version.

---

## 1. Dashboard Page (`tour_dashboard`)
* **Role**: All Roles (Platform Admin, Org Manager, Teacher, Mentor, Student)
* **Trigger**: Automatic on first visit to `/dashboard` (Version `dashboard_v1.0`), or manual click of Help Button in Topbar.

### Steps
1. **Welcome Card**
   * *Target*: `body` (Centered Overlay)
   * *Title*: Welcome to EduSpace! / به ادواسپیس خوش آمدید!
   * *Description*: Welcome to your personalized dashboard. Let's take a quick tour of your workspace.
2. **Next Up / Live Now Banner**
   * *Target*: `#live-now-banner` / `#next-up-countdown`
   * *Title*: Live Classes & Deadlines / کلاس‌های زنده و مهلت‌ها
   * *Description*: View active sessions here and join directly. Countdown timers show your next scheduled events.
3. **Role-Specific Widgets**
   * *Target*: `#dashboard-widgets`
   * *Title*: Activity & Analytics / فعالیت‌ها و آمار
   * *Description (Teacher)*: Track your class sizes, upcoming exam submissions, and class activity feeds.
   * *Description (Student)*: Track your assignment grades, exams, and recently published class recordings.
   * *Description (Admin/Manager)*: Monitor student registrations, financial summaries, and invoice statuses.
4. **Theme and Language Toggles**
   * *Target*: `#topbar-actions`
   * *Title*: Interface Settings / تنظیمات رابط کاربری
   * *Description*: Customize your interface. Switch between Dark/Light mode and toggle language between English and Farsi instantly.
5. **Contextual Help Trigger**
   * *Target*: `#help-tour-button`
   * *Title*: Always Here to Help / راهنمای همیشه در دسترس
   * *Description*: Click this question mark icon anytime to replay this tour or view documentation articles about this page.

---

## 2. Courses Explorer (`tour_courses`)
* **Role**: Admin, Manager, Teacher
* **Trigger**: First visit to `/academic/courses` (Version `courses_v1.0`).

### Steps
1. **Course Catalogue**
   * *Target*: `#courses-grid`
   * *Title*: Active Courses / دوره‌های فعال
   * *Description*: Browse through all the academic courses registered in your organization.
2. **Add Course Button**
   * *Target*: `#add-course-btn` (Visible to Admins/Managers only)
   * *Title*: Create a Course / ایجاد دوره جدید
   * *Description*: Click here to define a new course, specify course codes, and write descriptions.

---

## 3. Course Details View (`tour_course_detail`)
* **Role**: Admin, Manager, Teacher
* **Trigger**: First visit to `/academic/courses/:courseId` (Version `course_detail_v1.0`).

### Steps
1. **Course Header Information**
   * *Target*: `#course-meta-header`
   * *Title*: Course Overview / اطلاعات دوره
   * *Description*: View course code, creation date, and metadata fields.
2. **Linked Classes Section**
   * *Target*: `#linked-classes-card`
   * *Title*: Classes Offering this Course / کلاس‌های ارائه شده
   * *Description*: View active classes mapped to this course syllabus. Click on any class to open its detail panel.

---

## 4. Classes Explorer (`tour_classes`)
* **Role**: Admin, Manager, Teacher, Mentor, Student
* **Trigger**: First visit to `/academic/classes` (Version `classes_v1.0`).

### Steps
1. **Class Listing**
   * *Target*: `#classes-grid`
   * *Title*: Your Registered Classes / کلاس‌های شما
   * *Description*: All classes you are enrolled in or teach are listed here.
2. **Class Creation Trigger**
   * *Target*: `#create-class-btn` (Admins/Managers only)
   * *Title*: Open a New Class / ایجاد کلاس جدید
   * *Description*: Launch the creation modal to set up a new class name, course, start date, and end date.

---

## 5. Class Details View (`tour_class_detail`)
* **Role**: All Roles (Tailored steps)
* **Trigger**: First visit to `/academic/classes/:classId` (Version `class_detail_v1.0`).

### Steps
1. **Class Header Context**
   * *Target*: `#class-header`
   * *Title*: Class Information / اطلاعات کلاس
   * *Description*: View start/end dates, active teacher, assigned mentor, and course details.
2. **Sub-Tables & Navigation tabs**
   * *Target*: `#class-tabs-navigation`
   * *Title*: Sessions & Assignments / جلسات و تکالیف
   * *Description*: Navigate between scheduled Sessions, Homework Assignments, and Student Attendance sheets.
3. **Session Scheduling Widget**
   * *Target*: `#schedule-session-btn` (Teachers/Admins only)
   * *Title*: Schedule a Session / زمان‌بندی جلسه جدید
   * *Description*: Book a live class session. Opens the unified date-time picker.

---

## 6. Sessions Grid (`tour_sessions`)
* **Role**: Admin, Manager, Teacher, Mentor, Student
* **Trigger**: First visit to `/academic/sessions` (Version `sessions_v1.0`).

### Steps
1. **Sessions Calendar/Table**
   * *Target*: `#sessions-table`
   * *Title*: Schedule Matrix / برنامه زمان‌بندی جلسات
   * *Description*: Monitor all upcoming and past class sessions, their durations, status, and room details.
2. **Join Live Room**
   * *Target*: `.btn-join-room` (Dynamic active button)
   * *Title*: Launch or Join Room / ورود به کلاس زنده
   * *Description (Teacher)*: Start the classroom stream, open whiteboards, and record.
   * *Description (Student)*: Enter the stream as a participant to watch and interact.

---

## 7. Attendance Explorer (`tour_attendance`)
* **Role**: Admin, Manager, Teacher, Mentor
* **Trigger**: First visit to `/academic/attendance` (Version `attendance_v1.0`).

### Steps
1. **Attendance Logs Table**
   * *Target*: `#attendance-matrix`
   * *Title*: Attendance Logs / دفاتر حضور و غیاب
   * *Description*: View student check-in times and statuses (Present, Absent, Excused, Late).
2. **Status Editing**
   * *Target*: `.attendance-status-cell` (Teachers/Admins only)
   * *Title*: Edit Attendance Status / ویرایش وضعیت حضور
   * *Description*: Click directly on any cell to update or excuse student presence.

---

## 8. Assignments & Homework (`tour_assignments`)
* **Role**: Teacher, Student
* **Trigger**: First visit to `/academic/assessments` (Version `assignments_v1.0`).

### Steps
1. **Assignment Lists**
   * *Target*: `#assignments-table`
   * *Title*: Active Assignments / تکالیف فعال
   * *Description*: View active questions, maximum grades, and close-out deadlines.
2. **Submit / Grade Action**
   * *Target*: `.btn-assignment-action`
   * *Title*: Submit or Grade / ارسال یا نمره‌دهی
   * *Description (Student)*: Upload homework files or write text before the due date.
   * *Description (Teacher)*: Review submitted files, write feedback comments, and assign grades.

---

## 9. Ledger & Finance Overview (`tour_ledger`)
* **Role**: Admin, Manager (Forbidden for Students/Mentors)
* **Trigger**: First visit to `/finance/ledger` (Version `ledger_v1.0`).

### Steps
1. **Ledger Summary Grid**
   * *Target*: `#ledger-summary`
   * *Title*: Cash Flow Overview / خلاصه وضعیت مالی
   * *Description*: Tracks total revenue, pending invoices, and operating expenses.
2. **Invoices List**
   * *Target*: `#invoices-tab`
   * *Title*: Invoices / فاکتورهای صادره
   * *Description*: Lists billing items for student tuition.
3. **Issue Invoice Button**
   * *Target*: `#issue-invoice-btn`
   * *Title*: Issue New Invoice / صدور فاکتور جدید
   * *Description*: Create a custom payment invoice for any student using the unified DatePicker for billing due dates.

---

## 10. Members Directory (`tour_members`)
* **Role**: Admin, Manager, Teacher
* **Trigger**: First visit to `/crm/members` (Version `members_v1.0`).

### Steps
1. **Members Table**
   * *Target*: `#members-table`
   * *Title*: Member Registry / لیست اعضا
   * *Description*: Manage organization profiles. View roles, status, and join dates.
2. **Invite Button**
   * *Target*: `#invite-member-btn` (Admins/Managers only)
   * *Title*: Invite New Users / دعوت از کاربر جدید
   * *Description*: Send membership invitations for students, teachers, or mentors.

---

## 11. Recordings Shelf (`tour_recordings`)
* **Role**: All Roles (Platform Admin, Org Manager, Teacher, Mentor, Student)
* **Trigger**: First visit to `/recordings` (Version `recordings_v1.0`).

### Steps
1. **Recordings Catalogue**
   * *Target*: `#recordings-shelf`
   * *Title*: Recorded Classes / آرشیو ویدئوی کلاس‌ها
   * *Description*: Stream published video files from past classroom sessions.
2. **Publish / Delete Operations**
   * *Target*: `.recordings-action-menu` (Teachers/Admins only)
   * *Title*: Publishing Controls / مدیریت انتشار ویدیوها
   * *Description*: Adjust access flags, rename links, or delete recording items.

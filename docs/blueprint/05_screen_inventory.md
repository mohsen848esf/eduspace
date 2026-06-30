# Phase 5 — Screen Inventory

This section details the layout, components, interactive menus, responsive structures, and loading/error states for every screen in EduSpace.

---

## 1. Authentication Screens (`/login`, `/register`)
* **Layout**: Centered card overlay against a dark, dynamic space background with orbital motion effects.
* **Sections**: Single sign-in card with responsive container width.
* **Forms**: Username/email input, password input, and a Farsi/English toggle in the top-right corner.
* **Responsive Behavior**: Stacked single-column on mobile.
* **Loading States**: Shimmer skeleton inside the button when submitting credentials.

---

## 2. Dashboard Page (`/dashboard`)
* **Layout**: Two-column layout on desktop: Left sidebar, Top header, Main content grid. On mobile: Bottom navigation tab bar, top header with search & notification indicators.
* **Sections**:
  * **Top Metrics Row**: Dynamic card listing organization stats (Admin: Revenue, active students, classes. Student: Completed courses, points, pending homework).
  * **Main Grid**: Activity feed, upcoming calendar/sessions list, recent recordings carousel.
* **Responsive Behavior**: Shifts to a single column on tablet/mobile. Metrics row becomes horizontally scrollable cards.
* **Loading States**: Skeletons for dashboard charts and recent session lists.

---

## 3. WebRTC Live Room (`/room/:roomCode`)
* **Layout**: Immersive dark mode layout. Large media viewport in the center, controls bar at the bottom, and a toggleable sidebar on the right (Chat, Whiteboard, Mini-apps, Participant roster).
* **Sections**:
  * **Media Grid**: Dynamically layouts video tiles using a CSS Grid. Includes self-preview and screen shares.
  * **Controls Bar**: Mute, Camera toggle, Share Screen, Sidebar toggles, Live Recording button (Host only), and "Leave Room".
* **Responsive Behavior**: Video grid tiles rearrange to fit tall aspect ratios on mobile. The right-hand sidebar collapses into a full-screen drawer on touch screens.
* **Animations**: Tiles scale and fade in (`.tile-enter` transition) as participants publish tracks.

---

## 4. Financial Ledger (`/finance/ledger`)
* **Layout**: Single-column table with sidebar filtering controls.
* **Sections**:
  * **Ledger Balance Header**: Cards showing Net Cash, Outstanding Invoices, and Total Expenses.
  * **Transactions Table**: Responsive data grid showing Date, Type (Debit/Credit), Description, Amount, and Actions.
  * **Invoicing Drawer**: Sliding panel to issue a new tuition invoice, selecting students and courses.
* **Filters**: Quick search input, transaction type toggle, date-range picker.
* **Export Options**: Excel & PDF export buttons calling `/api/auth/invoices/export/`.

---

## 5. Assessments Manager (`/academic/assessments`)
* **Layout**: Two-tab layout: "Exams" and "Question Banks".
* **Sections**:
  * **Exams Grid**: Grid of cards representing assessments.
  * **Question Bank Table**: List of banks with tag counts and search.
  * **Question Creator Drawer**: Step-by-step form to add questions to a bank.
* **Forms**: Rich question editors with options for MCQ choices, markdown descriptions, or code template inputs.

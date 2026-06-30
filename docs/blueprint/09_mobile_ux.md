# Phase 9 — Mobile UX

This guide documents the responsive behaviors, adaptations, and touch-optimized gestures for tablet and mobile devices in EduSpace.

---

## 1. Layout & Navigation Transitions
* **Desktop**: Full left-side drawer navigation with expand/collapse states. Global Topbar with Notifications, Search, and User dropdown.
* **Tablet**: Left sidebar collapses into a narrow icon-only bar. Topbar features remain.
* **Mobile**: Left sidebar is completely hidden. Replaced by a bottom navigation tab bar containing five items: "Home", "Classes", "Schedule", "Homework", "More" (which opens a drawer containing secondary settings links).

---

## 2. Table & Grid Adaptations
* **Desktop Tables (Ledger, Members, Attendance)**: Multi-column tables with inline action buttons.
* **Mobile Tables**: Shift to a card-based stacked layout. For example, in the Ledger, each row becomes a floating card showing Date, Amount, and Type, with a three-dot menu trigger for actions.
* **Scroll Containers**: Tables that must retain horizontal orientation (like Attendance grids) are wrapped in custom scroll areas with fading scrollbar indicators.

---

## 3. Gestures & Drawer Sheets
* **Sidebar Drawers**: Details drawers (like Inspection drawers or Help panels) slide in from the right on desktop. On mobile, they translate from the bottom of the viewport as Bottom Sheets, covering the lower 80% of the screen.
* **Touch Optimization**: Controls buttons in the WebRTC room are enlarged to a minimum tap target of `44x44px` on touch screens.

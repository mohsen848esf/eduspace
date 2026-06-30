# Phase 11 & 12 — UX Problems & Suggested Improvements

This section catalogs existing user-experience friction points alongside recommended solutions from a senior product designer perspective.

---

## 1. Diagnostic UX Audit (Problems)
1. **Broken Hot Module Replacement (HMR) Loops on Dev Errors**: When a runtime script crash occurs in the browser, the Vite HMR connection drops out silently. This leaves users/developers looking at stale code paths, requiring manual cache clears (`Ctrl+F5`).
2. **Context Switching in Live Rooms**: When a teacher toggles the virtual Whiteboard, students lose visibility of the main screen share layout. There is no PIP (Picture-in-Picture) window for active streams during whiteboard usage.
3. **Granular Financial Actions Visibility**: There is a lack of confirmation indicators when ledger logs are successfully committed. This results in users double-clicking "Submit Payment" and generating duplicate ledger records.
4. **Attendance Navigation Dead-Ends**: After marking attendance in `/academic/attendance`, there is no simple back-link to the specific Session detail page, forcing the user to navigate back through the calendar sessions list.

---

## 2. Proposed Product Enhancements (Improvements)
1. **Implement PIP Overlay for WebRTC Rooms**: When a whiteboard or interactive game is active, rendering small floating video avatars of the active speakers in a corner overlay keeps human engagement high.
2. **Audit & Confirmation Dialogs for Ledger Logs**: Add double-click protection and spin loading skeletons on all invoice payment recordings, locking the submit button immediately upon execution.
3. **Breadcrumbs Hierarchy**: Add breadcrumbs to `/academic/classes/:classId/assignments/:id` to allow quick navigation up one level to the Class Cohort.
4. **Unified Help Center Drawer**: Integrate the current `HelpDrawer` widget into a global "?" shortcut inside the BottomNav and Topbar to increase discoverability of system documentation tours.

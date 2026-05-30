# EduSpace — Responsive UI Implementation Plan

> Document for external review (e.g., second-opinion AI).  
> All decisions below were finalized with the product owner before implementation begins.

---

## 0. Context

**EduSpace** is an online education platform with the following confirmed features:

- **Group video calls** with screen sharing (any user can host)
- **Recording** + automatic distribution to participants
- **Scheduled calls** with calendar view (planned)
- **Mini Apps** (formerly "Bots"): pluggable in-call activities — games, polls, whiteboard, quick exam. Defaults provided; users can add custom ones following the platform structure (planned)
- **Online exams** — teachers create questions/options/correct answer/hints, set time, attempts, navigation rules, allowed participants. Can be standalone or run inside a call
- **Classes** (teacher-only feature) — teacher creates a class, adds students, has regular weekly calls, assignment tracking, and class chat (planned)

**Roles**: Teacher, Student. Both can host calls; only Teacher can create classes/exams.

**Stack**: React 19, TypeScript, Tailwind CSS v4, react-i18next (en/fa with RTL), Radix UI, LiveKit, Zustand, react-router v7.

**Existing branches**:
- `develop` — i18n already implemented, has all current pages
- `design/responsive-mockups-v2` — this branch, contains static HTML preview of agreed design
- (planned) `feature/responsive-ui` — for actual implementation

---

## 1. Confirmed Design Decisions

| # | Decision |
|---|---------|
| 1 | **Mobile-first** approach with breakpoints: `<640px` mobile, `640–1023px` tablet, `≥1024px` desktop |
| 2 | **RTL-aware** via logical properties (`ms-/me-/start-/end-/border-s/-e`) — already implemented in i18n |
| 3 | **Mobile In-Call** uses **swipe pages** (Video → People → Chat → Tools), bottom sheet alternative deferred |
| 4 | **Bottom Nav** in mobile: 4 items with center CTA (`Home | Calls | [+] | More`) |
| 5 | **Sidebar** — full on desktop, collapsed icon-only on tablet, drawer on mobile |
| 6 | **Mini Apps** is the new umbrella name for Games/Polls/Whiteboard/Quick-Exam in-call tools |
| 7 | **Class concept**: hybrid — calls work standalone for everyone; teachers can additionally organize calls under classes |
| 8 | **Gamification** (streak/level for students): optional, controlled in Settings |
| 9 | All texts come from existing i18n namespaces (`common, auth, dashboard, room, games, notifications`); new keys will be added for new sections |

---

## 2. New Sidebar (Information Architecture)

```
MAIN
├─ 🏠 Dashboard
├─ 📚 My Classes        (NEW route, Teacher creates / Student joins)
├─ 📅 Calendar          (NEW route, schedule + week/month view)
└─ 📹 Calls             (history + instant)

LEARN
├─ 📝 Exams             (existing concept, dedicated page)
├─ 🎬 Recordings        (existing concept, dedicated page)
└─ 🎮 Mini Apps         (renamed from Games)

MANAGE                  (Teacher only)
├─ 👥 Students
└─ 📊 Reports

PERSONAL
└─ ⚙️ Settings
```

**Mobile Bottom Nav** (4 items):
1. **Home** → Dashboard
2. **Calls** → Calls history + instant
3. **[+]** (center CTA) → opens action sheet: Start Call · Schedule (Teacher) · Join with Code · New Exam (Teacher)
4. **More** → drawer with full sidebar

---

## 3. Dashboard — Teacher

**Order of sections (top to bottom):**

1. **🟢 Live Now banner** — only visible when a call is currently active. Shows class name + Join button.
2. **Greeting** — "Hi {name} 👋" + date.
3. **⏰ Next Up (hero card)** — next scheduled call with countdown, participant count, primary actions: `▶ Start Early`, `Edit`, `···`.
4. **⚡ Quick Actions** (4 buttons):
   - 📅 Schedule Call
   - 📝 New Exam
   - 🎓 New Class
   - 📹 Start Now
5. **⚠️ Needs Attention** — actionable list (max 5 items): ungraded exams, join requests, unread messages, absent students.
6. **📚 My Classes** — horizontal scrollable cards: class name, student count, next session indicator, "+ New" tile at end.
7. **📅 This Week** — vertical list of upcoming sessions (days as headers), with "See all →" link to Calendar.
8. **📈 Stats · This Month** — 4 metrics: Sessions, Students, Attendance, Avg Score.
9. **📋 Recent Activity** (optional, lower priority) — feed of events.

---

## 4. Dashboard — Student

**Order of sections:**

1. **🟢 Live Now banner** — when a class the student is in just started.
2. **Greeting** — "Hi {name} 👋".
3. **⏰ Next Up (hero card)** — next class with countdown, teacher name, "🔔 Remind me".
4. **⚡ Quick Actions** (4 buttons):
   - 📹 Start Call
   - 🚪 Join with Code
   - 📝 My Exams (with pending count badge)
   - 📚 My Classes
5. **📝 Pending** — list of upcoming exams + assignments with deadlines and `Start`/`View` action.
6. **🎯 My Progress** — streak, avg score, level (only if Gamification toggle is ON in Settings).
7. **📚 My Classes** — horizontal scroll like Teacher, but read-only.
8. **🎬 New Recordings** — list of unwatched recordings from classes the student attends.
9. **⏪ Catch up** — appears when student missed a session: "You missed Grammar B1 — Watch the recording".
10. **📅 This Week** — student's upcoming classes/exams.

---

## 5. Quick Actions — Final

| Slot | Teacher | Student |
|------|---------|---------|
| 1 | 📅 Schedule Call | 📹 Start Call |
| 2 | 📝 New Exam | 🚪 Join with Code |
| 3 | 🎓 New Class | 📝 My Exams |
| 4 | 📹 Start Now | 📚 My Classes |

---

## 6. Pages — Responsive Behavior

### 6.1 Auth Pages (Sign In, Sign Up)

| Breakpoint | Behavior |
|-----------|----------|
| Mobile | Full-width inputs, no card border (merges with bg), `h-11` touch targets, sticky CTA |
| Tablet | Centered card 384–440px |
| Desktop | Same as tablet (current) |

### 6.2 Pre-Join

| Breakpoint | Behavior |
|-----------|----------|
| Mobile | Vertical stack (preview → background grid → device tabs), CTA pinned at bottom |
| Tablet | 2-column (preview/settings) |
| Desktop | Same as tablet (current) |

### 6.3 In-Call (Room)

| Breakpoint | Behavior |
|-----------|----------|
| Mobile | **Swipe pages**: 1) Video grid · 2) People · 3) Chat · 4) Mini Apps. Pagination dots. Mini video strip pinned on top of pages 2/3/4. Compact icon-only controls bar |
| Tablet | Side panel docked (240px), single tab: People/Chat/Mini Apps. Controls with labels |
| Desktop | Same as current (272px panel + thumb strip when needed) |

### 6.4 Dashboard

Already detailed in §3 / §4.

### 6.5 New Pages (Classes, Calendar, Calls, Mini Apps, Students, Reports)

These pages do not exist yet in code. Responsive plan:

- **My Classes**: card grid (1col mobile / 2col tablet / 3col desktop). Each card: name, student count, next session, role (host/member). Click → Class Detail.
- **Class Detail**: tabs `Overview | Sessions | Assignments | Chat | Members`. Mobile: tabs become a horizontally scrollable bar.
- **Calendar**: 
  - Mobile: agenda list (day-by-day vertical)
  - Tablet: week view
  - Desktop: month view + side panel for selected day
- **Calls**: list with filters (All / Mine / Recent). Mobile = full-width cards.
- **Mini Apps**: gallery grid (icon + name + Ready/Soon badge). Mobile 2col / Tablet 3col / Desktop 4col.
- **Students** (Teacher): table on desktop, cards on mobile. Filters: class, status.
- **Reports** (Teacher): chart-heavy. Charts stack vertically on mobile, side-by-side on desktop.

---

## 7. New / Updated Components

### Created (do not exist):
- `components/layout/BottomNav.tsx` — mobile 4-item nav with center CTA
- `components/layout/MobileDrawer.tsx` — sidebar in mobile (Radix Dialog)
- `components/layout/QuickActionSheet.tsx` — sheet from center CTA
- `components/ui/Sheet.tsx` — generic bottom sheet (used for action sheet, future room panels)
- `components/ui/SwipePager.tsx` — horizontal swipe with pagination dots (used in mobile In-Call)
- `lib/hooks/useBreakpoint.ts` — `useBreakpoint() : 'mobile' | 'tablet' | 'desktop'`
- `lib/hooks/useMediaQuery.ts` — generic hook
- `features/dashboard/components/sections/*` — one component per dashboard section, role-aware

### Updated (exist):
- `components/layout/AppShell.tsx` — branch by breakpoint
- `components/layout/Sidebar.tsx` — add new items, role-based visibility, collapsed mode
- `components/layout/Topbar.tsx` — hamburger trigger on mobile, hide some actions
- `features/dashboard/components/DashboardPage.tsx` — fully rewritten as section composition
- `features/dashboard/hooks/useDashboard.ts` — extend to provide Teacher / Student data shapes
- `features/auth/components/LoginPage.tsx`, `RegisterPage.tsx` — mobile padding/sizes
- `features/room/components/RoomPage.tsx` — branch mobile to swipe view
- `features/room/components/RoomSidebar.tsx` — also exposes content for swipe pages
- `features/room/components/RoomControls.tsx` — icon-only on mobile
- `features/room/components/RoomTopbar.tsx` — compact on mobile
- `features/room/components/VideoGrid.tsx` — adaptive grid (1/2/2x2/scrollable)
- `features/room/components/prejoin/PreJoinScreen.tsx` — stack on mobile

### i18n keys to add:
- New namespaces: `classes.json`, `calendar.json`, `calls.json`, `miniapps.json`, `reports.json`, `settings.json`
- New keys in `dashboard.json`: `liveNow`, `nextUp`, `quickActions.*`, `needsAttention.*`, `myClasses.*`, `thisWeek.*`, `stats.*`, `pending.*`, `myProgress.*`, `newRecordings.*`, `catchUp.*`
- All sidebar item keys in `common.json`

---

## 8. Routes

```
Existing (keep):              New (add):
/login                        /classes
/register                     /classes/:id
/dashboard                    /calendar
/room/:roomId                 /calls
                              /exams
                              /exams/:id/take
                              /recordings
                              /recordings/:id
                              /miniapps
                              /students        (Teacher)
                              /reports         (Teacher)
                              /settings
```

`PrivateRoute` and `PublicRoute` already exist — new routes will use them.

---

## 9. Implementation Phases

### Phase 0 — Mockup Update (this branch, no app code)
- Update `design-mockups/index.html` with new dashboard sections (Teacher + Student variants), Mini Apps name, new sidebar items, role toggle.

### Phase 1 — Foundation
- `useBreakpoint`, `useMediaQuery` hooks
- Generic `Sheet`, `SwipePager` UI components
- Responsive `AppShell` with mobile/tablet/desktop branches
- New `BottomNav` + `MobileDrawer` + `QuickActionSheet`

### Phase 2 — Sidebar & Topbar
- New sidebar items (gated by role for Manage section)
- Mobile drawer
- Topbar compact mode

### Phase 3 — Dashboard
- Build all sections as separate components
- Wire role-based ordering
- Mock data first; integrate API later

### Phase 4 — Auth + Pre-Join Polish
- Mobile-specific styles, sticky CTAs, touch targets

### Phase 5 — In-Call (Room) Mobile
- `SwipePager` integration
- Mini video strip
- Icon-only controls
- Mobile RoomTopbar

### Phase 6 — New Pages (skeleton + responsive layout)
- Calendar (agenda/week/month)
- Classes (list + detail tabs)
- Calls history
- Mini Apps gallery
- Settings (with Gamification toggle)

### Phase 7 — Stretch
- Streak/Level UI for students
- Catch-up cards
- AI Daily Brief
- Class Streak for teachers

---

## 10. Non-Functional Requirements

- **Touch targets**: ≥44×44px on mobile
- **Viewport**: use `100dvh` for full-height mobile, `pb-[env(safe-area-inset-bottom)]` for bottom nav (iOS notch safe)
- **Dark theme** preserved; `prefers-color-scheme` not in scope
- **Accessibility**: labels on icon-only buttons, aria-current on nav, focus rings, keyboard navigation
- **Performance**: mobile bundle should not bloat — code-split new routes (Calendar, Classes, Reports), lazy load chart libraries
- **No layout shift**: skeletons for async data, fixed sizes for hero cards
- **RTL**: every new component MUST use logical properties and be tested with FA locale

---

## 11. Risks & Open Questions

1. **SwipePager UX** — can we use CSS scroll snap instead of a JS library? Lower bundle, native feel. Decision needed before Phase 5.
2. **Mini video strip on mobile during call** — bandwidth concern. Should we lower-quality the strip thumbnails?
3. **Calendar library** — build from scratch or use `react-day-picker` / `@internationalized/date`? Need RTL + Persian (Jalali) calendar support — important for FA users.
4. **Class chat vs in-call chat** — same component? Same store? Or separate persisted store for class chat?
5. **Mini Apps SDK** — for user-extensible apps (future), what's the contract? Out of scope for this UI plan but the architecture should leave room.
6. **Gamification toggle** — server-side preference or local? If shared across devices, needs API.
7. **"Live Now" detection** — WebSocket push or polling? Already on Channels (Django).

---

## 12. Out of Scope (for now)

- Bottom Sheet alternative for In-Call mobile (will be added later as Settings option)
- Mini Apps SDK / custom user-uploaded apps
- AI Summary, AI Daily Brief
- Push notifications
- Offline mode
- Mobile native app

---

## 13. References

- Mockup preview: [`design-mockups/index.html`](./index.html) (this branch)
- PR (preview): https://github.com/mohsen848esf/eduspace/pull/5
- Source branch: `develop`

---

## 14. Reviewer Checklist

When reviewing this plan, please consider:

- [ ] Is the sidebar IA logical and scalable?
- [ ] Are dashboard sections in the right priority order?
- [ ] Are Quick Actions the right ones for each role?
- [ ] Does the Mobile In-Call swipe approach make sense vs. a bottom sheet?
- [ ] Are there any missing pages/features for an education platform?
- [ ] Are the implementation phases logically ordered?
- [ ] Any concerns about performance or accessibility?
- [ ] Should role-based content be more or less aggressive in hiding/showing?

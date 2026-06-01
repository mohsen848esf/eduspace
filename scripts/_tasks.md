# EduSpace — Task log

Living history of the work being done on the platform. Updated on
every PR and whenever you flag bugs or new tasks in chat. Hand this
file to an external LLM alongside the other ai-context.*.md
snapshots if you need it to plan against current state.

## Conventions

- Each task gets a stable id (T-NN, B-NN for bugs, E-NN for epics).
- Status is one of: `done`, `merged`, `in-progress`, `pending`,
  `blocked`, `deferred`.
- Each entry lists what was delivered or what's left and why.

---

## Done — merged into `develop`

- **TASK-03 — Mobile-first responsive shell** (PR #14)
- **B-01 — Recording superuser bypass** (PR #15)
- **B-03 — Persistent notifications inbox** (PR #16)
- **T-01 / T-02 — In-call tweaks (record badge for everyone, 2-tile mobile stack)** (PR #17)
- **T-05 — Host grants recording permission to participants** (PR #18)
- **T-06A→D — Screen share as separate tile, pinned layout, sidebar collapse, smooth join/leave** (PR #19)
- **T-07 + T-08 — Sidebar `Games → Mini Apps` rename + `/miniapps` gallery page** (PR #20)
- **B-02 — Bottom-nav `calls` route + Persian comment cleanup** (PR #21)
- **T-04 (partial) — Mini Apps SPA player route + bigger in-call game UX** (PR #22)
- **Mini-apps polish — unified selector inside the call + live score relay + invite resend, mini-app docs suite** (PR #23)
- **Persistent notifications — `Notification` model + REST inbox endpoints + WS+REST hydration on login** (PR #24)
- **Game in-call polish — Mini Apps labels everywhere, auto-roster from in-call participants, in-game `confirmModal` replacing `confirm()`/`alert()`, recording-active warning toast, dashboard quick-action cleanup** (PR #25)

## In progress

- **T-26 — Word Quest Classroom (in-call game variant)** —
  Part 1 in this PR; Part 2 follows.
  - **Part 1 (this PR, `feature/word-quest-classroom`):**
    AI-context docs system (`scripts/build_ai_context.py` +
    gitignored `ai-context.*.md`), classroom game folder copied to
    `word-quest-classroom`, registered as a Game with
    `is_in_call_only=true` and the `WORD_GUESS_CLASSROOM` type, new
    backend management command `seed_classroom_game`, gallery hides
    in-call-only games, generic `CLASSROOM_RELAY` data-channel
    envelope in `useGameBoard` plus `GameBridge.broadcast()` /
    `window.onClassroomEvent` plumbing, three new screens (role
    pick → lobby → 3-2-1 countdown) inside the classroom variant.
  - **Part 2 (next PR, `feature/word-quest-classroom-host-controls`):**
    Pause / Resume / Next host controls, blur-and-disable overlay
    for players, anti-inspect (right-click + F12 + DevTools detect),
    mid-game rejoin from current question, podium end screen with
    avatars, recording-game include/exclude toggle.

## Pending — not started

- **T-09 → T-13 — Dashboard chrome (shared blocks)** Live Now banner,
  Greeting + date, Next Up hero with countdown, Quick Actions row
  (role-aware), This Week sessions list. Role-agnostic foundation
  before splitting into teacher/student variants.
- **T-14 → T-17 — Dashboard (teacher-only)** Needs Attention, Stats
  this month, My Classes horizontal scroll, Recent Activity feed.
- **T-18 → T-22 — Dashboard (student-only)** Pending exams +
  assignments, My Progress (gated on gamification toggle), Catch Up
  card, My Classes read-only, New Recordings.
- **T-06E — Self-view PiP polish** Small follow-up on screen share.
- **Recording layout that captures mini-app iframe** Currently the
  egress only records the LiveKit room composite; the iframe lives
  in the React shell so it's not in the saved video. Tracked as a
  follow-up; PR #25 added a heads-up toast for the host meanwhile.
- **E-01 — Bots epic** Phase 2, deferred until 2-3 more games exist.

## Process notes

- Default branch on GitHub is now `develop`. PRs always target
  `develop`. After a PR merges into `develop`, sync `main` from
  `develop` periodically.
- Compare URL preselects the base:
  `https://github.com/<owner>/<repo>/compare/develop...<branch>?expand=1`
- Word-quest game files live in two synced places —
  `games/word-quest/` (source of truth) and
  `frontend/public/games/word-quest/` (Vite-served runtime copy).
  Keep them byte-for-byte identical.
- All in-app strings live in `frontend/src/i18n/locales/{en,fa}/*.json`.
  Persian appears only in fa locale files; everywhere else (code,
  comments, docs, commits) is English.
- `accounts.notifications.record_and_dispatch` is the single entry
  point for any feature that wants to deliver a notification —
  persists a row, then pushes to the live WS. Don't call
  `channel_layer.group_send` directly anymore.

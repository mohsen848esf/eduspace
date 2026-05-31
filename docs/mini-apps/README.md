# EduSpace Mini Apps

Mini Apps are small, embeddable web apps that run inside an EduSpace
session — games, whiteboards, quick exams, polls, and so on. They live
in their own iframe and talk to the platform through a small
`postMessage` protocol.

This folder hosts the spec and the per-category guides. If you're
about to build a new mini app, start here, then follow the link to the
guide for your category.

## Index

- **`structure.md`** — generic file structure and required files for
  any mini app.
- **`integration-protocol.md`** — the shared `postMessage` protocol
  used by every mini app to talk to the platform.
- **`installing-locally.md`** — how a project owner drops a finished
  mini app into the repo so it shows up in `/miniapps` and inside
  calls.
- **`ai-prompt.md`** — copy-paste prompt for AI-assisted mini-app
  development. Hand it to your AI tool alongside the structure spec.
- `categories/games.md` — game-specific spec (in-call vs solo, host
  controls, scoring relay).
- `categories/whiteboard.md` — TBD (placeholder for the whiteboard
  category).
- `categories/exams.md` — TBD (placeholder).
- `categories/polls.md` — TBD (placeholder).

## Categories at a glance

| Category   | Solo  | In-call (group) | Status |
| ---------- | ----- | --------------- | ------ |
| Games      | ✅    | ✅              | Ready  |
| Whiteboard | —     | planned         | Soon   |
| Exams      | ✅    | planned         | Soon   |
| Polls      | —     | planned         | Soon   |

## Lifecycle

1. The host opens the in-call **Mini Apps** panel (or the standalone
   `/miniapps` gallery) and picks an app.
2. The platform mounts the app's `index.html` in an iframe.
3. The app boots, then calls `GAME_READY` over `postMessage`.
4. The platform replies with `GAME_INIT` carrying the participant
   roster, the current player, and any settings.
5. The app runs as it normally would. Optional outbound messages
   (`SCORE_UPDATE`, `GAME_OVER`, etc.) keep the platform's roster
   panel in sync.
6. The host can stop the app via the End button on the platform UI;
   the iframe is unmounted on the next render.

See `integration-protocol.md` for the full message reference.

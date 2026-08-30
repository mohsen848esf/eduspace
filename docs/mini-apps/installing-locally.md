# Installing a Mini App Locally

This guide is for the **project owner** who receives a finished mini
app (a folder following `structure.md`) and needs to drop it into the
EduSpace repo so it shows up in `/miniapps` and inside calls.

There's no upload UI yet — installation is manual. It takes about two
minutes per app.

## Prerequisites

- Repo cloned and the dev environment runs (`./start.ps1` or your
  equivalent).
- Backend running (`python manage.py runserver` from `backend/`).
- Frontend running (`npm run dev` from `frontend/`).

## Step 1 — Copy the folder

Each mini app lives in **two** places (kept in sync until we move to
a single source of truth):

1. `games/<slug>/` — the source-of-truth folder.
2. `frontend/public/games/<slug>/` — the Vite-served copy that the
   iframe actually loads at runtime.

Copy your incoming folder into both:

```powershell
Copy-Item -Recurse path\to\incoming\my-mini-app games\my-mini-app
Copy-Item -Recurse path\to\incoming\my-mini-app frontend\public\games\my-mini-app
```

Replace `my-mini-app` with the slug from the folder name. Use the
exact same slug in both locations — the loader builds the URL from it
(`/games/my-mini-app/index.html`).

## Step 2 — Smoke test the static load

Open the iframe URL directly in a browser:

```
http://localhost:5173/games/my-mini-app/index.html
```

The app should load and render its solo-mode UI without errors. Open
DevTools and confirm no failed requests for assets inside the app
folder.

## Step 3 — Register the app in the backend catalogue

The Mini Apps gallery and in-call selector both pull from the
backend catalogue endpoint `GET /api/games/`. Add your mini app there
so it surfaces in the UI.

Open the Django admin (`http://localhost:8000/admin/`) → **Games**
→ **Add game**. Fill in:

- **Title:** human-readable name (e.g. `Word Quest`).
- **Game type:** matches a value in `GAME_TYPE_TO_SLUG` in
  `frontend/src/features/games/api/games.api.ts`. If your app is a new
  type, see step 4 below.
- **Description:** one-liner shown in the gallery.
- **Thumbnail:** optional; the gallery falls back to an emoji if
  empty.
- **Is free:** uncheck for premium apps. Premium apps get a Premium
  badge.

Save. The app will appear in the catalogue immediately on the next
fetch (the gallery refetches on mount, so a refresh is enough).

## Step 4 — Add a slug mapping (only if your `game_type` is new)

`frontend/src/features/games/api/games.api.ts` has a `GAME_TYPE_TO_SLUG`
map that translates the catalogue's `game_type` into the public folder
name. If your app uses a brand-new game type:

```ts
const GAME_TYPE_TO_SLUG: Record<string, string> = {
  word_guess: "word-quest",
  // Add your new type → folder mapping here.
  vocab: "vocab-rush",
};
```

After saving, the Vite dev server hot-reloads; the gallery will pick
up the new mapping on the next render.

## Step 5 — Test the full flow

1. Open `/miniapps` in the app. The new card should appear in the
   appropriate category, marked **Ready**.
2. Click the card. It should open in the SPA player with a Back
   button and a fullscreen toggle.
3. Open a call (`/dashboard` → Start Call), then go to **Tools** →
   **Mini Apps** and pick the same app. Confirm:
   - The participant strip shows everyone who accepted the invite.
   - The local user is highlighted with a "You" pill.
   - Scores update next to each participant when they earn points.
4. End the game from the host's End button. The iframe unmounts; the
   call returns to the video grid.

If any of those steps fail, re-read `integration-protocol.md` and
confirm the bridge messages match exactly.

## Step 6 — Commit

Commit both the `games/<slug>/` and `frontend/public/games/<slug>/`
copies. The two folders should be byte-for-byte identical.

```powershell
git checkout -b feat/install-my-mini-app
git add games/my-mini-app frontend/public/games/my-mini-app
git commit -m "feat(mini-apps): install My Mini App"
git push -u origin feat/install-my-mini-app
```

Open a PR against `develop`.

## Troubleshooting

- **Card shows as "Soon" instead of "Ready":** the catalogue's
  `game_type` doesn't match any slug in `GAME_TYPE_TO_SLUG`. Add the
  mapping (step 4).
- **Iframe loads but typing does nothing:** the in-call shell
  auto-focuses the iframe; if you opened it via the standalone player
  and it still doesn't take input, your app's `app.js` may be
  swallowing key events on a wrapper element. Add `tabindex="0"` and
  a focus listener to the relevant element.
- **Scores don't propagate to other participants:** the app must
  call `GameBridge.onScoreUpdate(userId, score, ...)` for the local
  player on every score change. Solo apps that just render a number
  on screen don't trigger the in-call relay.
- **Fullscreen button does nothing:** the platform requests
  fullscreen on the GameBoard wrapper; if your app uses
  `display: none` on the iframe at any point, the request is
  rejected. Keep the iframe always-rendered.

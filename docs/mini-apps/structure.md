# Mini App File Structure

This is the contract every mini app must follow. The platform
**will not** ship a mini app that doesn't match this structure — both
because the loader can't find it, and because the in-call surface
relies on the protocol described in `integration-protocol.md`.

## Folder layout

```
my-mini-app/
├── index.html        ← required entry point
├── styles.css        ← optional but recommended
├── app.js            ← your code (any name is fine; reference it from index.html)
├── app-bridge.js     ← required, see template below
├── assets/           ← optional images, sounds, etc.
└── README.md         ← short description + author + version
```

The folder name (`my-mini-app`) is also the **slug** the platform
uses to load the app:

```
/games/my-mini-app/index.html
```

Pick a slug that's URL-safe (lowercase, hyphenated, ASCII).

## `index.html`

Plain HTML, no build step required. Must:

- Use `<meta charset="utf-8">` and a `<meta name="viewport"
  content="width=device-width, initial-scale=1, viewport-fit=cover">`
  tag.
- Load `app-bridge.js` **before** your app code so the global
  `window.GameBridge` is available when the app boots.
- Run inside the sandbox the platform applies:
  `allow-scripts allow-same-origin allow-forms`. Any external network
  calls must already work under those rules.
- Avoid relying on cookies or `localStorage` shared with the parent
  page; the iframe is same-origin but logically separate.

## `app-bridge.js`

A copy of the bridge template:

```js
// app-bridge.js
const GameBridge = (() => {
  let isConnected = false;
  let mode = "solo";
  let players = [];
  let settings = {};
  let currentPlayer = null;

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    const { type, payload } = event.data || {};
    if (!type) return;

    switch (type) {
      case "GAME_INIT":
        mode = (payload && payload.mode) || "solo";
        players = (payload && payload.players) || [];
        settings = (payload && payload.settings) || {};
        currentPlayer = (payload && payload.currentPlayer) || null;
        isConnected = true;
        break;
      case "GAME_START":
        if (typeof startGame === "function") startGame();
        break;
      case "GAME_PAUSE":
        if (typeof pauseGame === "function") pauseGame();
        break;
      case "GAME_RESUME":
        if (typeof resumeGame === "function") resumeGame();
        break;
      case "GAME_NEXT_QUESTION":
        if (typeof nextQuestion === "function") nextQuestion();
        break;
    }
  });

  function send(type, payload = {}) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type, payload }, "*");
    }
  }

  // Tell the platform we're alive once the page has finished loading.
  window.addEventListener("load", () => {
    setTimeout(() => send("GAME_READY", { gameId: "my-mini-app" }), 1200);
  });

  return {
    isConnected: () => isConnected,
    getMode: () => mode,
    getPlayers: () => players,
    getSettings: () => settings,
    getCurrentPlayer: () => currentPlayer,
    isInCall: () => mode === "in-call",
    isHost: () => Boolean(currentPlayer && currentPlayer.isHost),

    onScoreUpdate(userId, score, questionIndex) {
      send("SCORE_UPDATE", { userId, score, questionIndex });
    },
    onCorrectAnswer(userId, word, timeLeft) {
      send("CORRECT_ANSWER", { userId, word, timeLeft });
    },
    onQuestionChange(index, total) {
      send("QUESTION_CHANGE", { index, total });
    },
    onGameOver(scores) {
      send("GAME_OVER", { scores });
    },
    onNeedNext() {
      send("NEED_NEXT", {});
    },
  };
})();

window.GameBridge = GameBridge;
```

You can rename `gameId` and tweak the load delay, but the message
shapes must match `integration-protocol.md` exactly.

## Required behaviour

- **Solo mode:** the app must be playable when `GameBridge.isInCall()`
  is `false` and the players list is empty. Default to a single-player
  experience.
- **In-call mode:** when `GameBridge.isInCall()` is `true`, every
  score change should call
  `GameBridge.onScoreUpdate(currentPlayer.userId, score, ...)` so the
  platform's roster panel updates live.
- **Keyboard:** the iframe receives focus automatically when the host
  launches the app. Don't override `tabindex` or steal focus on every
  keystroke; let the user type freely.
- **Touch + mouse + keyboard:** all interactions must work with mouse,
  keyboard, mobile touch, and (where useful) bluetooth keyboards on
  tablets.
- **Responsive:** support 360×640 (small phone portrait), 768×1024
  (tablet portrait), and 1280×720+ (desktop). Avoid fixed pixel
  layouts.
- **No external assets at runtime:** load fonts, images, sounds from
  inside your folder. The platform may host with a strict CSP.
- **Self-contained state:** persist user state in `localStorage` if
  needed; the platform won't sync it for you.

## Accessibility

- All interactive controls must be reachable by keyboard
  (`Tab` / `Enter` / `Space`).
- Provide visible focus states; never `outline: none` without a
  replacement.
- Use semantic HTML (`<button>`, `<nav>`, `<h1>`).
- Honour `prefers-reduced-motion`. If your app has shake or screen
  flash effects, fall back to a smaller cue.
- Audio must always be muteable inside your app (the platform doesn't
  control your `<audio>` tags).

## Versioning

Bump the version in your README when you change the public protocol
(message shapes, required `currentPlayer` fields, etc.). The platform
loader doesn't yet pin versions, but the field will be used soon.

## Submitting your mini app

See `installing-locally.md` for the install steps the project owner
will run when they receive your folder.

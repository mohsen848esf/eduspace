# Mini App Integration Protocol

This is the `window.postMessage` protocol every mini app uses to talk
to the EduSpace platform. The platform owns the iframe and is the
parent window.

> All messages share the same envelope: `{ type, payload }`. The
> origin is enforced (`event.origin === window.location.origin`); the
> platform serves both itself and the apps from the same origin so
> there's no cross-origin to worry about.

## Direction

- **Platform → App:** sent via `iframe.contentWindow.postMessage(...)`
  by the platform, received in the app via
  `window.addEventListener("message", ...)`.
- **App → Platform:** sent via
  `window.parent.postMessage({ type, payload }, "*")` and received in
  the platform's `GameBoard` (in-call) or `GameContainer`
  (standalone /miniapps player).

## Lifecycle messages

### `GAME_READY` (App → Platform)

```jsonc
{ "type": "GAME_READY", "payload": { "gameId": "word-quest" } }
```

Send once after `window.load`. The platform replies with `GAME_INIT`.

### `GAME_INIT` (Platform → App)

```jsonc
{
  "type": "GAME_INIT",
  "payload": {
    "mode": "in-call",            // "solo" | "in-call" | "class"
    "players": [
      { "userId": "alice", "username": "alice", "fullName": "Alice Z." }
    ],
    "currentPlayer": {            // null in solo mode
      "userId": "alice",
      "isHost": true
    },
    "settings": {                 // app-specific knobs
      "timePerQuestion": 30
    }
  }
}
```

Use `mode` to branch your UI (e.g. hide solo-only features in-call).
Use `currentPlayer.userId` when broadcasting scores so the platform
can attribute them.

### `GAME_START` / `GAME_PAUSE` / `GAME_RESUME` (Platform → App)

Empty payloads. Only the host can trigger these from the platform
side. If your app doesn't have these states, ignore the messages.

### `GAME_NEXT_QUESTION` (Platform → App)

Sent when the host advances the round in class mode. Apps that don't
use class mode can ignore it.

## Scoring messages

### `SCORE_UPDATE` (App → Platform)

```jsonc
{
  "type": "SCORE_UPDATE",
  "payload": {
    "userId": "alice",
    "score": 420,
    "questionIndex": 3
  }
}
```

The app emits this **for the local player** every time their score
changes. The platform broadcasts the value to every other peer over
the call's data channel so each peer's roster panel stays in sync.

### `CORRECT_ANSWER` (App → Platform, optional)

```jsonc
{
  "type": "CORRECT_ANSWER",
  "payload": { "userId": "alice", "word": "GAZELLE", "timeLeft": 12 }
}
```

Optional event for analytics surfaces. Not required for scoreboards.

### `QUESTION_CHANGE` (App → Platform, optional)

```jsonc
{ "type": "QUESTION_CHANGE", "payload": { "index": 2, "total": 10 } }
```

Optional. Future versions may show a progress bar in the platform UI.

### `GAME_OVER` (App → Platform)

```jsonc
{ "type": "GAME_OVER", "payload": { "scores": { "alice": 420 } } }
```

Send when the run finishes. The `scores` map should be keyed by
`userId`. Solo runs send a single-entry map.

### `NEED_NEXT` (App → Platform, class mode only)

Empty payload. Used in class mode to signal the host that the app is
waiting for `GAME_NEXT_QUESTION`.

## Sandbox + security

The iframe is created with:

```html
<iframe sandbox="allow-scripts allow-same-origin allow-forms" />
```

Plus `allow="autoplay; fullscreen"`. That gives apps:

- ✅ Run JavaScript
- ✅ Read same-origin storage (`localStorage`, etc.)
- ✅ Submit forms
- ✅ Request fullscreen
- ✅ Auto-play media
- ❌ Open popups
- ❌ Run plugins or top-level navigation
- ❌ Use service workers

If you need a permission outside this list, file an issue first; the
platform won't grant it ad-hoc.

## Message origin

The app **must** verify origin in its `message` listener:

```js
window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  // ...handle event
});
```

The bridge template in `structure.md` already does this.

## Backwards compatibility

We don't break the message shapes once they ship. Additive changes
(new optional fields, new opt-in event types) are fair game; renaming
or removing a field is not. If a future change requires a breaking
update, it'll go through a versioned message type
(`GAME_INIT_V2`, etc.) and the platform will dispatch on whichever
version the app supports.

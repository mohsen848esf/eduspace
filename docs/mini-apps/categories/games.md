# Mini App Category — Games

Games are interactive mini apps (word puzzles, math drills, vocab
quizzes, etc.) that run both **standalone** (one player on
`/miniapps/play/<slug>`) and **in-call** (group play streamed to
everyone in a LiveKit session).

This guide is in addition to `../structure.md` and
`../integration-protocol.md`. Read those first.

## What we provide

- An iframe with full screen real estate inside the platform's
  `GameBoard` (in-call) or `GameContainer` (standalone player).
- A focus-grabbing iframe so keyboard input works the moment the game
  loads.
- Auto-pin participant strip on the left of the in-call board with
  webcams + score badges + "You" highlight for the local player.
- A fullscreen toggle in the platform UI (your app doesn't need its
  own).
- Bridge plumbing: every `SCORE_UPDATE` your app sends gets relayed
  to all participants over the call's data channel automatically.
- Splash + loading shell on the standalone player route.

## What we expect

- **Solo runs are the default.** The game must be playable with
  `mode: "solo"` and an empty `players` array. Don't gate gameplay
  behind a network call.
- **In-call mode opts into the roster.** When `mode === "in-call"`,
  every game-side score change must call
  `GameBridge.onScoreUpdate(currentPlayer.userId, score, questionIndex)`.
  That's the only way the platform's roster panel updates.
- **One game session per call.** Don't run multiple game windows
  concurrently — the platform won't render more than one
  `GameBoard` and the second iframe would be ignored.
- **Don't leak state between sessions.** When the game ends or the
  user leaves, reset internal state on next mount. Persist only
  long-term progression (best score, achievements) via
  `localStorage`.
- **No microphone or camera capture from inside the game.** The
  platform owns both. If your game wants voice or vision input, file
  an issue first.
- **Streaming is implicit.** When the host launches in-call, every
  participant who accepts loads their own iframe. The platform does
  not pixel-stream the host's iframe to other participants — each
  client runs its own copy and stays in sync via score relays.
  Design for that: deterministic seeds, server-derived word lists if
  you need consistency, etc.

## Highlighting the local player

`GameBridge.getCurrentPlayer()` returns
`{ userId, isHost }` (or `null` in solo). Use `userId` to render
your in-game roster, and apply a visual treatment to the matching
entry — bold name, brand-colour border, "You" badge, whatever fits
the game's aesthetic. Word Quest, for example, applies a brand ring
in the platform's roster, but the game itself is also free to render
its own roster and highlight the local player.

## Score broadcasting

The minimal contract is:

```js
// Inside your game's "score went up" path:
if (GameBridge.isInCall()) {
  const me = GameBridge.getCurrentPlayer();
  if (me) {
    GameBridge.onScoreUpdate(me.userId, currentScore, questionIndex);
  }
}
```

The platform takes care of the rest. You don't need to track other
players' scores yourself — every iframe sees the same `players` list
on `GAME_INIT`, and the platform's roster panel is the source of
truth for live values.

## Class mode (optional)

If your game supports class mode (host advances rounds), respect
`GAME_PAUSE` / `GAME_RESUME` / `GAME_NEXT_QUESTION`:

```js
window.addEventListener("message", (event) => {
  // ...
  switch (type) {
    case "GAME_PAUSE": pauseGame(); break;
    case "GAME_RESUME": resumeGame(); break;
    case "GAME_NEXT_QUESTION": nextQuestion(); break;
  }
});
```

Tell the platform when you're idle and waiting for the next round:

```js
GameBridge.onNeedNext();
```

## Premium games

A premium game ships with the same structure as a free one — the
distinction is recorded in the backend catalogue (`is_free: false`).
The platform shows a **Premium** badge automatically; nothing changes
in your app code.

## Examples to look at

- `frontend/public/games/word-quest/` — full reference. Solo mode,
  in-call score relay, achievements, leaderboard.

## Known limitations

- **Mini apps don't appear in the call recording yet.** LiveKit
  Egress records the room composite (camera + screen-share tracks);
  the mini-app iframe lives inside the React shell, not the composite.
  We surface a heads-up toast to the host when they launch a mini app
  during an active recording so they don't expect it in the saved
  file. Fix path is a custom recorder layout that includes the iframe
  alongside participants — tracked as a follow-up.

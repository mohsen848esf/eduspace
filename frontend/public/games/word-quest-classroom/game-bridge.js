// game-bridge.js
// Bridge between Word Quest and the EduSpace platform.
// Communication happens through window.postMessage with this protocol:
//
//   Platform -> Game:
//     GAME_INIT           { mode, players, settings, currentPlayer }
//     GAME_START
//     GAME_PAUSE
//     GAME_RESUME
//     GAME_NEXT_QUESTION
//
//   Game -> Platform:
//     GAME_READY          { gameId }
//     SCORE_UPDATE        { userId, score, questionIndex }
//     QUESTION_CHANGE     { index, total }
//     CORRECT_ANSWER      { userId, word, timeLeft }
//     GAME_OVER           { scores }
//     NEED_NEXT           {}
//
// The platform serves both itself and the game from the same origin
// (vite dev server / production hosting), so we restrict postMessage
// to event.origin === window.location.origin.

const GameBridge = (() => {
  let isConnected = false;
  let gameMode = "solo"; // solo | battle | class | in-call
  let players = [];
  let settings = {};
  let currentPlayer = null;

  // ── Listen for messages from platform ──
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;

    const { type, payload } = event.data || {};
    if (!type) return;

    switch (type) {
      case "GAME_INIT":
        gameMode = (payload && payload.mode) || "solo";
        players = (payload && payload.players) || [];
        settings = (payload && payload.settings) || {};
        currentPlayer = (payload && payload.currentPlayer) || null;
        isConnected = true;
        applySettings(settings);
        // Notify game.js so it can swap into in-call mode (auto-roster,
        // hide solo-only UI, etc.) without polling.
        if (typeof window.onPlatformInit === "function") {
          try {
            window.onPlatformInit({
              mode: gameMode,
              players,
              settings,
              currentPlayer,
            });
          } catch (e) {
            console.warn("onPlatformInit handler threw", e);
          }
        }
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
      default:
        // Forward CLASSROOM_* messages to the game so it can build
        // any host-driven sync flow without us hard-coding cases here.
        if (
          typeof type === "string" &&
          type.startsWith("CLASSROOM_") &&
          typeof window.onClassroomEvent === "function"
        ) {
          try {
            window.onClassroomEvent(type, payload || {});
          } catch (e) {
            console.warn("onClassroomEvent handler threw", e);
          }
        }
        break;
    }
  });

  // ── Send messages to platform ──
  function sendToPlatform(type, payload = {}) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type, payload }, "*");
    }
  }

  // ── Apply settings from platform ──
  function applySettings(s) {
    if (s && s.timePerQuestion) {
      // Stash so the game's own startup can pick it up.
      window.__platformSettings = s;
    }
    if (s && s.mode === "class") {
      window.__classMode = true;
    }
  }

  // Tell the platform we're alive once the page has finished loading.
  // The 1.6s delay matches the splash animation; reducing it would
  // race the platform's GAME_INIT listener attachment.
  window.addEventListener("load", () => {
    setTimeout(() => {
      sendToPlatform("GAME_READY", { gameId: "word-quest" });
    }, 1600);
  });

  // ── Public API — game.js calls these ──
  return {
    isConnected: () => isConnected,
    getMode: () => gameMode,
    getPlayers: () => players,
    getSettings: () => settings,
    getCurrentPlayer: () => currentPlayer,
    isInCall: () => gameMode === "in-call",
    isHost: () => Boolean(currentPlayer && currentPlayer.isHost),

    onScoreUpdate(userId, score, questionIndex) {
      sendToPlatform("SCORE_UPDATE", { userId, score, questionIndex });
    },

    /**
     * Classroom-mode broadcast hook. The parent shell forwards the
     * envelope verbatim to every other peer's iframe, where it
     * arrives as a regular postMessage event with the same `type` and
     * `payload`. Apps add a `case` to their message switch to
     * receive it.
     *
     * Reserved for messages whose type starts with "CLASSROOM_". The
     * parent ignores any other type, so apps can't accidentally
     * spam unrelated channels.
     */
    broadcast(type, payload = {}) {
      if (typeof type !== "string" || !type.startsWith("CLASSROOM_")) {
        console.warn("GameBridge.broadcast: type must start with CLASSROOM_");
        return;
      }
      sendToPlatform(type, payload);
    },

    onQuestionChange(index, total) {
      sendToPlatform("QUESTION_CHANGE", { index, total });
    },

    onCorrectAnswer(userId, word, timeLeft) {
      sendToPlatform("CORRECT_ANSWER", { userId, word, timeLeft });
    },

    onGameOver(scores) {
      sendToPlatform("GAME_OVER", { scores });
    },

    onNeedNext() {
      sendToPlatform("NEED_NEXT", {});
    },
  };
})();

// Expose on window so game.js (which loads after this file) can find it.
window.GameBridge = GameBridge;

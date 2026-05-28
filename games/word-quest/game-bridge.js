// game-bridge.js
// Bridge between Word Quest and EduSpace platform
// Communication via postMessage protocol

const GameBridge = (() => {
  let isConnected = false;
  let gameMode = "solo"; // solo | battle | class
  let players = [];
  let settings = {};

  // ── Listen for messages from platform ──
  window.addEventListener("message", (event) => {
    // Security: only accept messages from same origin
    if (event.origin !== window.location.origin) return;

    const { type, payload } = event.data || {};
    if (!type) return;

    switch (type) {
      case "GAME_INIT":
        gameMode = payload.mode || "solo";
        players = payload.players || [];
        settings = payload.settings || {};
        isConnected = true;
        applySettings(settings);
        // پیام GAME_READY قبلاً از boot فرستاده شده
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

  // ── Send messages to platform ──
  function sendToPlatform(type, payload = {}) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type, payload }, "*");
    }
  }

  // ── Apply settings from platform ──
  function applySettings(s) {
    if (s.timePerQuestion) {
      // override default timer
      window.__platformSettings = s;
    }
    if (s.mode === "class") {
      // class mode: teacher controls next question
      window.__classMode = true;
    }
  }

  // وقتی بازی لود شد به پلتفرم اطلاع بده
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

    onScoreUpdate(userId, score, questionIndex) {
      sendToPlatform("SCORE_UPDATE", { userId, score, questionIndex });
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
      // class mode: tell teacher we're waiting for next
      sendToPlatform("NEED_NEXT", {});
    },
  };
})();

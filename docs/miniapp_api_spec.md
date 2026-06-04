# EduSpace Mini-App API & Communication Specification

This document defines the real-time communication protocol between the **EduSpace Platform** (parent window/shell) and **Mini-Apps / Games** (embedded iframes) using `window.postMessage`.

---

## 1. Architecture Overview

Mini-Apps are loaded in sandboxed iframes. Since the parent window and the iframe share the same origin, we use secure `postMessage` exchanges verified by origin checks. 

The communication is encapsulated in a client-side library `game-bridge.js` which exposes a structured global object `window.GameBridge`.

```
+------------------------------------------+
|            EduSpace Platform             |
|              (Parent Window)             |
+-------------------+----------------------+
                    |           ^
       postMessage  |           |  postMessage
  (e.g., GAME_INIT) |           |  (e.g., GAME_READY)
                    v           |
+-------------------+----------------------+
|            Mini-App / Game               |
|            (Embedded iFrame)             |
+------------------------------------------+
```

---

## 2. Lifecycle & Handshake Sequence

To ensure the iframe is fully loaded and listening before the platform transmits the initial state, a **handshake protocol** is enforced:

1. **Iframe Loaded**: The mini-app loads and initializes.
2. **`GAME_READY` (Child -> Parent)**: The mini-app sends a `GAME_READY` signal to notify the parent that it is active and listening.
3. **`GAME_INIT` (Parent -> Child)**: The platform responds with the game session state (mode, settings, roster, and current player).
4. **Gameplay loop**: Real-time scores, screen synchronization, and event broadcasts flow bidirectionally.

---

## 3. Message Types Reference

All messages are JSON objects sent through `postMessage` with the following structure:
```json
{
  "type": "MESSAGE_TYPE",
  "payload": { ... }
}
```

### 3.1. Platform -> Mini-App (Inbound)

#### `GAME_INIT`
Sent by the parent in response to `GAME_READY` to initialize the game session.
* **Payload Structure**:
  ```json
  {
    "mode": "solo" | "battle" | "class" | "in-call",
    "currentPlayer": {
      "id": 1,
      "username": "host_user",
      "isHost": true
    },
    "players": [
      { "id": 1, "username": "host_user" },
      { "id": 2, "username": "student_1" }
    ],
    "settings": {
      "timePerQuestion": 30,
      "mode": "class"
    }
  }
  ```

#### `GAME_START`
Sent by the parent when the host triggers the start of the game.

#### `GAME_PAUSE`
Sent by the parent when the game is paused (e.g., host pauses the session).

#### `GAME_RESUME`
Sent by the parent when the game is resumed from a pause.

#### `GAME_NEXT_QUESTION`
Sent by the parent to advance the active question in synchronization-based gameplay.

#### `CLASSROOM_*` (Custom Event Broadcasts)
Any broadcast event initiated by another client (prefix matches `CLASSROOM_`) is forwarded to the local mini-app.
* **Example**:
  ```json
  {
    "type": "CLASSROOM_NEXT",
    "payload": { "questionIndex": 2 }
  }
  ```

---

### 3.2. Mini-App -> Platform (Outbound)

#### `GAME_READY`
Sent by the child to initiate the handshake once the app is loaded.
* **Payload Structure**:
  ```json
  {
    "gameId": "word-quest"
  }
  ```

#### `SCORE_UPDATE`
Sent when a player's score changes.
* **Payload Structure**:
  ```json
  {
    "userId": 2,
    "score": 150,
    "questionIndex": 1
  }
  ```

#### `QUESTION_CHANGE`
Sent when the game transitions to a new question/stage.
* **Payload Structure**:
  ```json
  {
    "index": 2,
    "total": 10
  }
  ```

#### `CORRECT_ANSWER`
Sent when a player guesses the correct answer.
* **Payload Structure**:
  ```json
  {
    "userId": 2,
    "word": "gravity",
    "timeLeft": 18.5
  }
  ```

#### `GAME_OVER`
Sent when the game finishes and scores are finalized.
* **Payload Structure**:
  ```json
  {
    "scores": {
      "1": 400,
      "2": 250
    }
  }
  ```

#### `NEED_NEXT`
Sent when the player client has completed the question/round and is waiting for the host to proceed.

#### `CLASSROOM_*` (Custom Broadcasts)
Sent by a client to broadcast a state update to all other peers in the room. The platform intercepts it and broadcasts it over the WebRTC/LiveKit data channel to other clients' iframes.
* **Example**:
  ```json
  {
    "type": "CLASSROOM_NEXT",
    "payload": { "questionIndex": 2 }
  }
  ```

---

## 4. Implementation Example (`game-bridge.js`)

Below is the standard bridge implementation to be included in any EduSpace-compatible mini-app:

```javascript
const GameBridge = (() => {
  let isConnected = false;
  let gameMode = "solo";
  let players = [];
  let settings = {};
  let currentPlayer = null;

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;

    const { type, payload } = event.data || {};
    if (!type) return;

    switch (type) {
      case "GAME_INIT":
        gameMode = payload.mode || "solo";
        players = payload.players || [];
        settings = payload.settings || {};
        currentPlayer = payload.currentPlayer || null;
        isConnected = true;

        if (typeof window.onPlatformInit === "function") {
          window.onPlatformInit({ mode: gameMode, players, settings, currentPlayer });
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
        if (type.startsWith("CLASSROOM_") && typeof window.onClassroomEvent === "function") {
          window.onClassroomEvent(type, payload || {});
        }
        break;
    }
  });

  function sendToPlatform(type, payload = {}) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type, payload }, "*");
    }
  }

  // Auto-handshake on window load
  window.addEventListener("load", () => {
    setTimeout(() => {
      sendToPlatform("GAME_READY", { gameId: "word-quest" });
    }, 1000);
  });

  return {
    isConnected: () => isConnected,
    getMode: () => gameMode,
    isHost: () => !!(currentPlayer && currentPlayer.isHost),
    broadcast: (type, payload = {}) => {
      if (!type.startsWith("CLASSROOM_")) {
        console.warn("Custom broadcasts must start with CLASSROOM_");
        return;
      }
      sendToPlatform(type, payload);
    },
    onScoreUpdate: (userId, score, questionIndex) => sendToPlatform("SCORE_UPDATE", { userId, score, questionIndex }),
    onGameOver: (scores) => sendToPlatform("GAME_OVER", { scores }),
  };
})();

window.GameBridge = GameBridge;
```

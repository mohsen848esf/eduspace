import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

interface Player {
  userId: string;
  username: string;
  fullName: string;
}

interface GameSettings {
  timePerQuestion?: number;
  maxHints?: number;
  mode?: "solo" | "battle" | "class";
}

interface GameContainerProps {
  gameUrl: string;
  gameName: string;
  gameId: string;
  mode?: "solo" | "battle" | "class";
  players?: Player[];
  settings?: GameSettings;
  isHost?: boolean;
  onScoreUpdate?: (
    userId: string,
    score: number,
    questionIndex: number,
  ) => void;
  onCorrectAnswer?: (userId: string, word: string, timeLeft: number) => void;
  onGameOver?: (scores: Record<string, number>) => void;
  onNeedNext?: () => void;
}

type GameStatus =
  | "splash"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "finished";

export default function GameContainer({
  gameUrl,
  gameName,
  mode = "solo",
  players = [],
  settings = {},
  isHost = false,
  onScoreUpdate,
  onCorrectAnswer,
  onGameOver,
  onNeedNext,
}: GameContainerProps) {
  const { t } = useTranslation("games");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<GameStatus>("splash");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Send message to game ──
  const sendToGame = useCallback((type: string, payload = {}) => {
    iframeRef.current?.contentWindow?.postMessage({ type, payload }, "*");
  }, []);

  // ── Listen for messages from game ──
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const { type, payload } = event.data || {};
      if (!type) return;

      switch (type) {
        case "GAME_READY":
          setStatus("ready");
          sendToGame("GAME_INIT", { mode, players, settings });
          break;
        case "SCORE_UPDATE":
          onScoreUpdate?.(payload.userId, payload.score, payload.questionIndex);
          break;
        case "CORRECT_ANSWER":
          onCorrectAnswer?.(payload.userId, payload.word, payload.timeLeft);
          break;
        case "GAME_OVER":
          setStatus("finished");
          onGameOver?.(payload.scores);
          break;
        case "NEED_NEXT":
          onNeedNext?.();
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    mode,
    players,
    settings,
    sendToGame,
    onScoreUpdate,
    onCorrectAnswer,
    onGameOver,
    onNeedNext,
  ]);

  // ── Splash screen timer ──
  useEffect(() => {
    if (status !== "splash") return;
    const timer = setTimeout(() => setStatus("loading"), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  // ── Fullscreen ──
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── Host controls ──
  const startGame = () => {
    sendToGame("GAME_START");
    setStatus("playing");
  };

  const pauseGame = () => {
    sendToGame("GAME_PAUSE");
    setStatus("paused");
  };

  const resumeGame = () => {
    sendToGame("GAME_RESUME");
    setStatus("playing");
  };

  const nextQuestion = () => {
    sendToGame("GAME_NEXT_QUESTION");
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", height: "100%" }}
      className="bg-gray-950 rounded-xl overflow-hidden"
    >
      {/* ── Splash Screen ── */}
      {status === "splash" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-950 animate-fade-in">
          <div className="flex flex-col items-center gap-4">
            <div className="text-xs font-semibold tracking-widest text-gray-500 uppercase">
              {t("container.poweredBy")}
            </div>
            <div className="text-3xl font-bold text-white">
              {t("container.branding")}
            </div>
            <div className="text-sm text-gray-400">
              {t("container.loading", { name: gameName })}
            </div>
            <div className="w-32 h-1 bg-gray-800 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-indigo-500 rounded-full animate-loading-bar" />
            </div>
          </div>
        </div>
      )}

      {/* ── Loading spinner ── */}
      {status === "loading" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-400">
              {t("container.loadingGame")}
            </span>
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      {status !== "splash" && (
        <div className="absolute top-3 end-3 z-30 flex items-center gap-2">
          {/* Host controls */}
          {isHost && status === "ready" && (
            <button
              onClick={startGame}
              title={t("container.start")}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-all active:scale-95"
            >
              {t("container.start")}
            </button>
          )}
          {isHost && status === "playing" && (
            <button
              onClick={pauseGame}
              title={t("container.pause")}
              className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-semibold rounded-lg transition-all active:scale-95"
            >
              {t("container.pause")}
            </button>
          )}
          {isHost && status === "paused" && (
            <>
              <button
                onClick={resumeGame}
                title={t("container.resume")}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-all active:scale-95"
              >
                {t("container.resume")}
              </button>
              {mode === "class" && (
                <button
                  onClick={nextQuestion}
                  title={t("container.next")}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-all active:scale-95"
                >
                  {t("container.next")}
                </button>
              )}
            </>
          )}

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            title={
              isFullscreen
                ? t("container.exitFullscreen")
                : t("container.fullscreen")
            }
            className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all active:scale-95"
          >
            {isFullscreen ? (
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>
        </div>
      )}
      {/* ── Game iframe ── */}
      {status !== "splash" && (
        <iframe
          ref={iframeRef}
          src={gameUrl}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
          }}
          title={gameName}
          allow="autoplay; fullscreen"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      )}

      {/* ── EduSpace branding watermark ── */}
      {(status === "playing" || status === "paused") && (
        <div className="absolute bottom-3 start-3 z-30">
          <span className="text-xs text-gray-600 font-medium">
            {t("container.branding")}
          </span>
        </div>
      )}
    </div>
  );
}

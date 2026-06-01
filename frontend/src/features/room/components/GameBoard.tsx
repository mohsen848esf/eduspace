import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useParticipants,
  useLocalParticipant,
  VideoTrack,
  useTracks,
} from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import { type GameBoardState } from "../hooks/useGameBoard";
import { Tooltip } from "../../../components/ui/Tooltip";
import { Icons } from "../../../lib/constants/icons";
import { useRoomStore } from "../store/roomStore";
import { cn } from "../../../lib/utils";

interface GameBoardProps {
  gameBoard: GameBoardState;
  onEnd: () => void;
  /**
   * Called when the local iframe emits SCORE_UPDATE for the local
   * user. The shell wires this to `useGameBoard.relayScore` so the
   * score also goes out over the data channel to the rest of the
   * call. The optional second arg is the local user's score; the
   * legacy signature `(userId, score)` is still accepted for tests
   * that patched it before the relay existed.
   */
  onScoreUpdate?: (userId: string, score: number) => void;
  onGameOver?: (scores: Record<string, number>) => void;
  /**
   * Forward a classroom-mode event from the local iframe out to every
   * peer. Wired by the shell to `useGameBoard.broadcastClassroomEvent`.
   */
  onBroadcastClassroom?: (
    type: string,
    payload: Record<string, unknown>,
  ) => void;
  /**
   * Subscribe to classroom-mode events from the data channel. The
   * GameBoard re-emits each one into its iframe so the game's own
   * postMessage handler receives it. Wired by the shell to
   * `useGameBoard.subscribeClassroomEvents`.
   */
  subscribeClassroomEvents?: (
    fn: (type: string, payload: unknown, fromIdentity?: string) => void,
  ) => () => void;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getGradient(identity: string) {
  const gradients = [
    "from-[#6366f1] to-[#38bdf8]",
    "from-[#22c55e] to-[#38bdf8]",
    "from-[#f59e0b] to-[#f87171]",
    "from-[#e879f9] to-[#6366f1]",
  ];
  return gradients[identity.charCodeAt(0) % gradients.length];
}

interface RosterEntry {
  identity: string;
  name: string;
  isLocal: boolean;
  score: number;
}

/**
 * Mini participant strip rendered to the left of the in-call game.
 *
 * Shows the participant's webcam (or avatar fallback), highlights the
 * local user with a brand ring + "You" pill, and displays the user's
 * live game score next to the name. Scores are updated by the parent
 * component via the postMessage SCORE_UPDATE bridge.
 *
 * De-duplicates the participant list because some versions of
 * `@livekit/components-react` include the local participant in
 * `useParticipants()`; without dedup we'd render two tiles for one
 * user.
 */
function ParticipantStrip({
  roster,
  localIdentity,
}: {
  roster: RosterEntry[];
  localIdentity: string;
}) {
  const { t } = useTranslation("room");
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);

  return (
    // Wider rail than before (w-32) with aspect-square tiles so faces
    // are legible. Score badge sits at the top-right of each tile.
    <div className="flex flex-col gap-2 w-32 bg-[var(--s1)] border-e border-[var(--b)] p-2 overflow-y-auto flex-shrink-0">
      {roster.map((entry) => {
        const camTrack = tracks.find(
          (tr) =>
            tr.participant.identity === entry.identity &&
            tr.source === Track.Source.Camera,
        );
        const hasVideo =
          camTrack &&
          "publication" in camTrack &&
          camTrack.publication &&
          !camTrack.publication.isMuted;

        return (
          <div
            key={entry.identity}
            className={cn(
              "relative aspect-square bg-[var(--s2)] rounded-lg overflow-hidden flex-shrink-0",
              entry.isLocal &&
                "ring-2 ring-[var(--brand)] ring-offset-1 ring-offset-[var(--s1)]",
            )}
          >
            {hasVideo && camTrack ? (
              <VideoTrack
                trackRef={camTrack as any}
                className={cn(
                  "w-full h-full object-cover",
                  entry.isLocal && "scale-x-[-1]",
                )}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white bg-gradient-to-br",
                    getGradient(entry.identity),
                  )}
                >
                  {getInitials(entry.name)}
                </div>
              </div>
            )}

            {/* Score pill in the top-right corner. Hidden when score
                is 0 to keep the tile clean before any points land. */}
            {entry.score > 0 && (
              <div className="absolute top-1 end-1 bg-[var(--brand)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow">
                {entry.score}
              </div>
            )}

            {entry.isLocal && (
              <div className="absolute top-1 start-1 bg-[var(--brand-soft)] text-[var(--brand-text)] text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded-md">
                {t("tile.you").replace(/[()]/g, "")}
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
              <span
                className={cn(
                  "text-[10px] font-medium text-white truncate block",
                  entry.identity === localIdentity && "text-[var(--brand-text)]",
                )}
              >
                {entry.name}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function GameBoard({
  gameBoard,
  onEnd,
  onScoreUpdate,
  onGameOver,
  onBroadcastClassroom,
  subscribeClassroomEvents,
}: GameBoardProps) {
  const { t } = useTranslation(["games", "room"]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isHost } = useRoomStore();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useParticipants();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Live scores live in `gameBoard.scores`, populated by:
  //   1. local iframe SCORE_UPDATE (handled below + relayed via the
  //      data channel by `relayScore` in useGameBoard);
  //   2. remote participants' GAME_SCORE relays.

  // Dedupe the participant list: useParticipants() can include the
  // local user. Match by identity, then narrow to people who have
  // accepted the game invite.
  const roster: RosterEntry[] = useMemo(() => {
    const seen = new Set<string>();
    const ordered: Participant[] = [];
    const push = (p: Participant) => {
      if (!seen.has(p.identity)) {
        seen.add(p.identity);
        ordered.push(p);
      }
    };
    push(localParticipant);
    for (const p of remoteParticipants) push(p);
    return ordered
      .filter((p) => gameBoard.acceptedParticipants.includes(p.identity))
      .map((p) => ({
        identity: p.identity,
        name: p.name || p.identity,
        isLocal: p.identity === localParticipant.identity,
        score: gameBoard.scores[p.identity] ?? 0,
      }));
  }, [
    localParticipant,
    remoteParticipants,
    gameBoard.acceptedParticipants,
    gameBoard.scores,
  ]);

  // postMessage bridge to the iframe: send GAME_INIT on GAME_READY,
  // capture SCORE_UPDATE / GAME_OVER for the local player.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const { type, payload } = event.data || {};
      if (!type) return;

      switch (type) {
        case "GAME_READY":
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: "GAME_INIT",
              payload: {
                mode: "in-call",
                players: roster.map((r) => ({
                  userId: r.identity,
                  username: r.identity,
                  fullName: r.name,
                })),
                currentPlayer: {
                  userId: localParticipant.identity,
                  isHost,
                },
              },
            },
            "*",
          );
          // Pull focus into the iframe so subsequent keystrokes reach
          // the game. Without this, focus stays on whatever button
          // launched the game and typing goes nowhere.
          requestAnimationFrame(() => iframeRef.current?.focus());
          break;

        case "SCORE_UPDATE": {
          const userId = String(payload?.userId ?? "");
          const score = Number(payload?.score ?? 0);
          if (!userId) break;
          // Hand off to the shell (useGameBoard.relayScore wires this
          // through the data channel and updates the local scores
          // map). Remote peers see it via GAME_SCORE.
          onScoreUpdate?.(userId, score);
          break;
        }

        case "GAME_OVER":
          onGameOver?.(payload?.scores ?? {});
          break;

        default:
          // Forward CLASSROOM_* messages out to peers via the data
          // channel. The shell echoes them back into the local
          // iframe via the subscribeClassroomEvents path.
          if (
            typeof type === "string" &&
            type.startsWith("CLASSROOM_") &&
            onBroadcastClassroom
          ) {
            onBroadcastClassroom(type, payload || {});
          }
          break;
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [
    roster,
    localParticipant,
    isHost,
    onScoreUpdate,
    onGameOver,
    onBroadcastClassroom,
  ]);

  // Push CLASSROOM_* events from the data channel into the iframe.
  useEffect(() => {
    if (!subscribeClassroomEvents) return;
    return subscribeClassroomEvents((type, payload) => {
      iframeRef.current?.contentWindow?.postMessage(
        { type, payload: payload ?? {} },
        "*",
      );
    });
  }, [subscribeClassroomEvents]);

  // Auto-focus iframe on mount and on src changes so the user doesn't
  // have to click into it before typing.
  useEffect(() => {
    const id = window.setTimeout(() => iframeRef.current?.focus(), 200);
    return () => window.clearTimeout(id);
  }, [gameBoard.gameUrl]);

  // Reset scores happens upstream in useGameBoard (launchGame +
  // GAME_END both wipe the map), so no local cleanup is needed here.

  // Fullscreen plumbing wraps the whole container so the rail + topbar
  // come along — the host can still End Game while fullscreen.
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const playersLabel =
    gameBoard.acceptedParticipants.length === 1
      ? t("games:board.playersOne", {
          count: gameBoard.acceptedParticipants.length,
        })
      : t("games:board.playersOther", {
          count: gameBoard.acceptedParticipants.length,
        });

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden bg-[var(--s0)]">
      <ParticipantStrip
        roster={roster}
        localIdentity={localParticipant.identity}
      />

      <div className="flex-1 flex flex-col relative">
        <div className="h-10 bg-[var(--s1)] border-b border-[var(--b)] flex items-center justify-between px-3 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm" aria-hidden>
              🎮
            </span>
            <span className="text-sm font-semibold text-[var(--t1)] truncate">
              {gameBoard.gameTitle}
            </span>
            <span className="text-[10px] text-[var(--t3)] flex-shrink-0">
              {playersLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Tooltip
              content={
                isFullscreen
                  ? t("games:container.exitFullscreen")
                  : t("games:container.fullscreen")
              }
            >
              <button
                onClick={toggleFullscreen}
                aria-label={
                  isFullscreen
                    ? t("games:container.exitFullscreen")
                    : t("games:container.fullscreen")
                }
                className={cn(
                  "w-7 h-7 rounded-md border-none cursor-pointer flex items-center justify-center text-base",
                  "bg-[var(--s3)] text-[var(--t1)] hover:bg-[var(--s4)] transition-colors",
                )}
              >
                {isFullscreen ? "🗗" : "⛶"}
              </button>
            </Tooltip>

            {isHost && (
              <Tooltip content={t("games:board.endGameTooltip")}>
                <button
                  onClick={onEnd}
                  className="flex items-center gap-1.5 px-2.5 h-7 bg-[var(--red)]/10 hover:bg-[var(--red)]/20 text-[var(--red)] text-xs font-semibold rounded-lg border-none cursor-pointer transition-colors"
                >
                  {Icons.leave}
                  {t("games:board.endGame")}
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        <iframe
          ref={iframeRef}
          src={gameBoard.gameUrl || ""}
          className="flex-1 border-0 w-full"
          allow="autoplay; fullscreen"
          sandbox="allow-scripts allow-same-origin allow-forms"
          title={gameBoard.gameTitle || "Game"}
          tabIndex={0}
        />
      </div>
    </div>
  );
}

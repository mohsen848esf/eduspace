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
  onScoreUpdate?: (userId: string, score: number) => void;
  onGameOver?: (scores: any) => void;
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

/**
 * Mini participant strip rendered to the side of the in-call game.
 *
 * De-duplicates the participant list because some versions of
 * `@livekit/components-react` include the local participant in the
 * `useParticipants()` array; without the de-dupe the local user shows
 * up twice (once from `useLocalParticipant` and once from the remote
 * list). We dedupe by identity so the strip always matches the
 * participants count in the topbar.
 */
function ParticipantStrip({
  acceptedParticipants,
}: {
  acceptedParticipants: string[];
}) {
  const { t } = useTranslation("room");
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useParticipants();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);

  const allParticipants = useMemo<Participant[]>(() => {
    const seen = new Set<string>();
    const out: Participant[] = [];
    const push = (p: Participant) => {
      if (!seen.has(p.identity)) {
        seen.add(p.identity);
        out.push(p);
      }
    };
    push(localParticipant);
    for (const p of remoteParticipants) push(p);
    // The accepted list is authoritative — only show people who are in
    // the game board. When a single host launches a game and nobody
    // else has accepted yet, this collapses to just the local user.
    return out.filter((p) => acceptedParticipants.includes(p.identity));
  }, [localParticipant, remoteParticipants, acceptedParticipants]);

  return (
    // Wider rail than before (w-32 vs w-20) so the camera tile is
    // actually legible. Tile aspect-square keeps the face well-framed.
    <div className="flex flex-col gap-2 w-32 bg-[var(--s1)] border-e border-[var(--b)] p-2 overflow-y-auto flex-shrink-0">
      {allParticipants.map((participant) => {
        const camTrack = tracks.find(
          (tr) =>
            tr.participant.identity === participant.identity &&
            tr.source === Track.Source.Camera,
        );
        const hasVideo =
          camTrack &&
          "publication" in camTrack &&
          camTrack.publication &&
          !camTrack.publication.isMuted;
        const isLocal = participant.identity === localParticipant.identity;
        const name = participant.name || participant.identity;

        return (
          <div
            key={participant.identity}
            className="relative aspect-square bg-[var(--s2)] rounded-lg overflow-hidden flex-shrink-0"
          >
            {hasVideo && camTrack ? (
              <VideoTrack
                trackRef={camTrack as any}
                className={cn(
                  "w-full h-full object-cover",
                  isLocal && "scale-x-[-1]",
                )}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white bg-gradient-to-br",
                    getGradient(participant.identity),
                  )}
                >
                  {getInitials(name)}
                </div>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
              <span className="text-[10px] font-medium text-white truncate block">
                {isLocal ? t("tile.you").replace(/[()]/g, "") : name}
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
}: GameBoardProps) {
  const { t } = useTranslation(["games", "room"]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isHost } = useRoomStore();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useParticipants();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Build the player list for GAME_INIT. Same dedupe logic as the
  // strip — we don't want the local user counted twice.
  const players = useMemo(
    () => {
      const seen = new Set<string>();
      const out: Participant[] = [];
      const push = (p: Participant) => {
        if (!seen.has(p.identity)) {
          seen.add(p.identity);
          out.push(p);
        }
      };
      push(localParticipant);
      for (const p of remoteParticipants) push(p);
      return out
        .filter((p) => gameBoard.acceptedParticipants.includes(p.identity))
        .map((p) => ({
          userId: p.identity,
          username: p.identity,
          fullName: p.name || p.identity,
        }));
    },
    [localParticipant, remoteParticipants, gameBoard.acceptedParticipants],
  );

  // postMessage bridge to the game iframe.
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
                players,
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
          requestAnimationFrame(() => {
            iframeRef.current?.focus();
          });
          break;

        case "SCORE_UPDATE":
          onScoreUpdate?.(payload.userId, payload.score);
          break;

        case "GAME_OVER":
          onGameOver?.(payload.scores);
          break;
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [players, localParticipant, isHost, onScoreUpdate, onGameOver]);

  // Also focus the iframe immediately on mount so the user doesn't
  // have to click into it before typing — mirrors what users expect
  // from desktop game launchers.
  useEffect(() => {
    const id = window.setTimeout(() => iframeRef.current?.focus(), 200);
    return () => window.clearTimeout(id);
  }, [gameBoard.gameUrl]);

  // Fullscreen plumbing — wraps the container element (not the iframe
  // itself) so the participant strip + game topbar both go fullscreen
  // alongside the iframe. The user keeps mute/leave + end-game access.
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
      <ParticipantStrip acceptedParticipants={gameBoard.acceptedParticipants} />

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
          // tabIndex makes the iframe explicitly focusable so the
          // requestAnimationFrame focus call above actually lands on
          // it. Without this some browsers ignore focus on iframes.
          tabIndex={0}
        />
      </div>
    </div>
  );
}

import { useEffect, useRef } from "react";
import {
  useParticipants,
  useLocalParticipant,
  VideoTrack,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
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

// Mini participant strip
function ParticipantStrip({
  acceptedParticipants,
}: {
  acceptedParticipants: string[];
}) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useParticipants();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);

  const allParticipants = [localParticipant, ...remoteParticipants].filter(
    (p) => acceptedParticipants.includes(p.identity),
  );

  return (
    <div className="flex flex-col gap-1.5 w-20 bg-[var(--s1)] border-r border-[var(--b)] p-1.5 overflow-y-auto">
      {allParticipants.map((participant) => {
        const camTrack = tracks.find(
          (t) =>
            t.participant.identity === participant.identity &&
            t.source === Track.Source.Camera,
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
            className="relative aspect-video bg-[var(--s2)] rounded-lg overflow-hidden flex-shrink-0"
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
                    "w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white bg-gradient-to-br",
                    getGradient(participant.identity),
                  )}
                >
                  {getInitials(name)}
                </div>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
              <span className="text-[8px] text-white truncate block">
                {isLocal ? "You" : name}
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isHost } = useRoomStore();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useParticipants();

  // Handle postMessage from game
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const { type, payload } = event.data || {};
      if (!type) return;

      switch (type) {
        case "GAME_READY":
          // Init game with participants
          const allParticipants = [localParticipant, ...remoteParticipants]
            .filter((p) => gameBoard.acceptedParticipants.includes(p.identity))
            .map((p) => ({
              userId: p.identity,
              username: p.identity,
              fullName: p.name || p.identity,
            }));

          iframeRef.current?.contentWindow?.postMessage(
            {
              type: "GAME_INIT",
              payload: {
                mode: "in-call",
                players: allParticipants,
                currentPlayer: {
                  userId: localParticipant.identity,
                  isHost,
                },
              },
            },
            "*",
          );
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
  }, [
    localParticipant,
    remoteParticipants,
    gameBoard.acceptedParticipants,
    isHost,
  ]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Participant strip */}
      <ParticipantStrip acceptedParticipants={gameBoard.acceptedParticipants} />

      {/* Game area */}
      <div className="flex-1 flex flex-col relative">
        {/* Game topbar */}
        <div className="h-10 bg-[var(--s1)] border-b border-[var(--b)] flex items-center justify-between px-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm">🎮</span>
            <span className="text-sm font-semibold text-[var(--t1)]">
              {gameBoard.gameTitle}
            </span>
            <span className="text-[10px] text-[var(--t3)]">
              {gameBoard.acceptedParticipants.length} players
            </span>
          </div>

          {isHost && (
            <Tooltip content="End game">
              <button
                onClick={onEnd}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--red)]/10 hover:bg-[var(--red)]/20 text-[var(--red)] text-xs font-semibold rounded-lg border-none cursor-pointer transition-all"
              >
                {Icons.leave}
                End Game
              </button>
            </Tooltip>
          )}
        </div>

        {/* Game iframe */}
        <iframe
          ref={iframeRef}
          src={gameBoard.gameUrl || ""}
          className="flex-1 border-0 w-full"
          allow="autoplay"
          sandbox="allow-scripts allow-same-origin allow-forms"
          title={gameBoard.gameTitle || "Game"}
        />
      </div>
    </div>
  );
}

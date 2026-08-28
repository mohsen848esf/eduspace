import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  VideoTrack,
  isTrackReference,
  useIsSpeaking,
} from "@livekit/components-react";
import { Track, RemoteParticipant, type Participant } from "livekit-client";
import { Icons } from "../../../../lib/constants/icons";
import { Tooltip } from "../../../../components/ui/Tooltip";
import { cn } from "../../../../lib/utils";
import type { CallTile, UseCallTilesResult } from "../../hooks/useCallTiles";

function getInitials(name: string): string {
  if (!name) return "";
  const clean = name.replace(/[()[\]{}]/g, " ").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarGradient(identity: string): string {
  const gradients = [
    "from-[#0284c7] to-[#38bdf8]",
    "from-[#059669] to-[#34d399]",
    "from-[#d97706] to-[#f87171]",
    "from-[#9333ea] to-[#c084fc]",
    "from-[#e11d48] to-[#fb7185]",
    "from-[#4f46e5] to-[#818cf8]",
  ];
  return gradients[(identity || "").charCodeAt(0) % gradients.length];
}

function getCamRef(participant: Participant, tracks: UseCallTilesResult["tracks"]) {
  return tracks.find(
    (t) =>
      t.participant.identity === participant.identity &&
      t.source === Track.Source.Camera
  );
}

function getScreenRef(participant: Participant, tracks: UseCallTilesResult["tracks"]) {
  return tracks.find(
    (t) =>
      t.participant.identity === participant.identity &&
      t.source === Track.Source.ScreenShare
  );
}

export interface TileViewProps {
  tile: CallTile;
  tracks: UseCallTilesResult["tracks"];
  localIdentity: string;
  isHost?: boolean;
  onMute?: (p: RemoteParticipant) => void;
  onKick?: (p: RemoteParticipant) => void;
  mutedByHost?: Set<string>;
  onLowerHand?: (p: RemoteParticipant) => void;
  pinnedKey: string | null;
  onTogglePin: (key: string) => void;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function TileView({
  tile,
  tracks,
  localIdentity,
  isHost,
  onMute,
  onKick,
  mutedByHost,
  onLowerHand,
  pinnedKey,
  onTogglePin,
  compact = false,
  className,
  style,
}: TileViewProps) {
  const { t } = useTranslation("room");
  const { participant, kind, key } = tile;
  const isSpeaking = useIsSpeaking(participant);
  const [hovered, setHovered] = useState(false);
  const pinned = pinnedKey === key;
  const isLocal = participant.identity === localIdentity;
  const name = participant.name || participant.identity;
  const gradient = getAvatarGradient(participant.identity);

  // Parse participant metadata (hand raise, etc.)
  let handRaised = false;
  if (participant.metadata) {
    try {
      const meta = JSON.parse(participant.metadata);
      handRaised = !!meta.handRaised;
    } catch {
      // ignore
    }
  }

  const camRef = getCamRef(participant, tracks);
  const screenRef = getScreenRef(participant, tracks);

  const isLocalCamActive = isLocal && participant.isCameraEnabled;
  const isLocalScreenActive = isLocal && participant.isScreenShareEnabled;

  const hasCam =
    (camRef && isTrackReference(camRef) && !camRef.publication?.isMuted) ||
    isLocalCamActive;
  const hasScreen =
    (screenRef &&
      isTrackReference(screenRef) &&
      !screenRef.publication?.isMuted) ||
    isLocalScreenActive;

  // Decide which track to render
  const primaryTrackCandidate =
    kind === "screen" ? (hasScreen ? screenRef : null) : hasCam ? camRef : null;
  const primaryTrack =
    primaryTrackCandidate && isTrackReference(primaryTrackCandidate)
      ? primaryTrackCandidate
      : null;

  // Screen share uses object-contain with black bars; Camera uses object-cover with centered face
  const fitClass =
    kind === "screen" ? "object-contain bg-black" : "object-cover";

  return (
    <div
      style={{ ...style, isolation: "isolate" }}
      className={cn(
        "relative bg-[var(--s2)] rounded-2xl md:rounded-3xl overflow-hidden transition-all duration-200 w-full h-full tile-enter shadow-lg border border-white/5 select-none",
        isSpeaking &&
          kind === "camera" &&
          "ring-2 ring-inset ring-[#38bdf8] shadow-[0_0_15px_rgba(56,189,248,0.35)]",
        pinned &&
          "ring-2 ring-inset ring-[var(--brand)]",
        className
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Video stream or Avatar */}
      {primaryTrack ? (
        <div className="absolute inset-0 w-full h-full rounded-[inherit] overflow-hidden bg-transparent [&_video]:w-full [&_video]:h-full [&_video]:rounded-[inherit] [&_video]:object-cover">
          <VideoTrack
            trackRef={primaryTrack}
            className={cn("w-full h-full rounded-[inherit]", fitClass)}
            style={isLocal && kind === "camera" ? { transform: "scaleX(-1)" } : undefined}
          />
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--s1)] rounded-[inherit]">
          <div
            className={cn(
              "rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br shadow-inner transition-transform",
              compact ? "w-10 h-10 text-sm" : "w-20 h-20 md:w-24 md:h-24 text-2xl md:text-3xl",
              gradient
            )}
          >
            {getInitials(name)}
          </div>
        </div>
      )}

      {/* Top Badges */}
      <div className="absolute top-3 start-3 end-3 flex items-center justify-between pointer-events-none z-10">
        {/* Left top badges */}
        <div className="flex items-center gap-1.5">
          {kind === "screen" && (
            <div className="bg-[var(--brand)]/90 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-md">
              {Icons.screenShare}
              <span>{t("tile.sharing") || "Presenting"}</span>
            </div>
          )}

          {handRaised && kind === "camera" && (
            <div className="bg-[var(--amber)]/95 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-md animate-bounce">
              <span>✋</span>
              {!compact && <span>{t("controls.raiseHand") || "Raised hand"}</span>}
            </div>
          )}
        </div>

        {/* Right top badges (Audio Speaking Waveform / Pin) */}
        <div className="flex items-center gap-1.5">
          {isSpeaking && kind === "camera" && (
            <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1">
              <div className="flex gap-0.5 items-end h-3">
                {[1, 2, 3, 2, 1].map((h, i) => (
                  <div
                    key={i}
                    className="w-0.5 bg-[#38bdf8] rounded-full"
                    style={{
                      height: `${h * 30}%`,
                      animation: `pulse ${0.3 + i * 0.1}s ease-in-out infinite alternate`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {pinned && (
            <div className="bg-black/60 backdrop-blur-md text-white text-xs px-2 py-1 rounded-full shadow">
              📌
            </div>
          )}
        </div>
      </div>

      {/* Hover Action Overlay */}
      {hovered && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center gap-2.5 fade-in z-20">
          <Tooltip content={pinned ? t("tile.unpin") || "Unpin" : t("tile.pin") || "Pin"}>
            <button
              type="button"
              className={cn(
                "rounded-full border-none cursor-pointer text-white flex items-center justify-center transition-all active:scale-90 shadow-md",
                compact ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm",
                pinned
                  ? "bg-[var(--brand)] hover:brightness-110"
                  : "bg-white/20 hover:bg-white/30"
              )}
              onClick={() => onTogglePin(key)}
            >
              📌
            </button>
          </Tooltip>

          {/* Host moderation tools on camera tiles */}
          {isHost && kind === "camera" && !isLocal && (
            <>
              {handRaised && (
                <Tooltip content={t("host.lowerHand") || "Lower Hand"}>
                  <button
                    type="button"
                    className={cn(
                      "rounded-full border-none cursor-pointer text-white flex items-center justify-center transition-all active:scale-90 bg-[var(--amber)] hover:brightness-110 shadow-md",
                      compact ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm"
                    )}
                    onClick={() => onLowerHand?.(participant as RemoteParticipant)}
                  >
                    ✋
                  </button>
                </Tooltip>
              )}

              <Tooltip
                content={
                  mutedByHost?.has(participant.identity)
                    ? t("tile.unmute") || "Unmute"
                    : t("tile.mute") || "Mute"
                }
              >
                <button
                  type="button"
                  className={cn(
                    "rounded-full border-none cursor-pointer text-white flex items-center justify-center transition-all active:scale-90 shadow-md",
                    compact ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm",
                    mutedByHost?.has(participant.identity)
                      ? "bg-[var(--amber)] hover:brightness-110"
                      : "bg-white/20 hover:bg-[var(--amber)]/70"
                  )}
                  onClick={() => onMute?.(participant as RemoteParticipant)}
                >
                  {mutedByHost?.has(participant.identity) ? "🎙" : "🔇"}
                </button>
              </Tooltip>

              <Tooltip content={t("tile.remove") || "Remove"}>
                <button
                  type="button"
                  className={cn(
                    "rounded-full bg-white/20 hover:bg-[var(--red)] border-none cursor-pointer text-white flex items-center justify-center transition-all active:scale-90 shadow-md",
                    compact ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm"
                  )}
                  onClick={() => onKick?.(participant as RemoteParticipant)}
                >
                  ✕
                </button>
              </Tooltip>
            </>
          )}
        </div>
      )}

      {/* Bottom Name Pill (Google Meet Style) */}
      <div className="absolute bottom-3 start-3 end-3 flex items-center pointer-events-none z-10">
        <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 max-w-[85%] truncate shadow-md border border-white/5">
          <span
            className={cn(
              "font-medium text-white/95 truncate",
              compact ? "text-[11px]" : "text-xs md:text-sm"
            )}
          >
            {kind === "screen"
              ? `${name}${isLocal ? ` ${t("tile.you") || "(You)"}` : ""} · ${t("tile.presentation") || "Presentation"}`
              : isLocal
              ? `${name} ${t("tile.you") || "(You)"}`
              : name}
          </span>
        </div>
      </div>
    </div>
  );
}

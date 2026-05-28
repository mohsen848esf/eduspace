import {
  useParticipants,
  useLocalParticipant,
  useTracks,
  VideoTrack,
  isTrackReference,
  useIsSpeaking,
} from "@livekit/components-react";
import { RemoteParticipant, Track, type Participant } from "livekit-client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icons } from "../../../lib/constants/icons";
import { Tooltip } from "../../../components/ui/Tooltip";
import { cn } from "../../../lib/utils";
import { useHostControls } from "../hooks/useHostControls";
import { useRoomStore } from "../store/roomStore";

type LayoutMode = "grid" | "spotlight" | "sidebar";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarGradient(identity: string): string {
  const gradients = [
    "from-[#6366f1] to-[#38bdf8]",
    "from-[#22c55e] to-[#38bdf8]",
    "from-[#f59e0b] to-[#f87171]",
    "from-[#e879f9] to-[#6366f1]",
    "from-[#f59e0b] to-[#22c55e]",
    "from-[#38bdf8] to-[#6366f1]",
  ];
  return gradients[identity.charCodeAt(0) % gradients.length];
}

function getGridClass(count: number): string {
  if (count === 1) return "grid-cols-1 grid-rows-1";
  if (count === 2) return "grid-cols-2 grid-rows-1";
  if (count <= 4) return "grid-cols-2 grid-rows-2";
  if (count <= 6) return "grid-cols-3 grid-rows-2";
  if (count <= 9) return "grid-cols-3 grid-rows-3";
  return "grid-cols-4 grid-rows-3";
}

function getTrackRefs(participant: Participant, tracks: any[]) {
  return {
    cam: tracks.find(
      (t) =>
        t.participant.identity === participant.identity &&
        t.source === Track.Source.Camera,
    ),
    screen: tracks.find(
      (t) =>
        t.participant.identity === participant.identity &&
        t.source === Track.Source.ScreenShare,
    ),
  };
}

function ParticipantTile({
  participant,
  camTrackRef,
  screenTrackRef,
  compact = false,
  localIdentity,
  isHost,
  onMute,
  onKick,
  mutedByHost,
}: {
  participant: Participant;
  camTrackRef: any;
  screenTrackRef: any;
  isLocal: boolean;
  compact?: boolean;
  localIdentity: string;
  isHost?: boolean;
  onMute?: (p: RemoteParticipant) => void;
  onKick?: (p: RemoteParticipant) => void;
  mutedByHost?: Set<string>;
}) {
  const { t } = useTranslation("room");
  const isSpeaking = useIsSpeaking(participant);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);

  const gradient = getAvatarGradient(participant.identity);
  const hasScreen =
    screenTrackRef &&
    isTrackReference(screenTrackRef) &&
    !screenTrackRef.publication.isMuted;
  const hasVideo =
    camTrackRef &&
    isTrackReference(camTrackRef) &&
    !camTrackRef.publication.isMuted;
  const primaryTrack = hasScreen
    ? screenTrackRef
    : hasVideo
      ? camTrackRef
      : null;
  const isLocalParticipant = participant.identity === localIdentity;
  const name = participant.name || participant.identity;

  return (
    <div
      className={cn(
        "relative bg-[var(--s2)] rounded-xl overflow-hidden transition-all duration-200 w-full h-full",
        isSpeaking &&
          "ring-2 ring-[var(--green)] ring-offset-2 ring-offset-[var(--s0)]",
        pinned &&
          "ring-2 ring-[var(--brand)] ring-offset-2 ring-offset-[var(--s0)]",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {primaryTrack ? (
        <VideoTrack
          trackRef={primaryTrack}
          className={cn("absolute inset-0 w-full h-full object-cover")}
          style={{
            transform: "scaleX(-1)",
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br",
              compact ? "w-8 h-8 text-xs" : "w-14 h-14 text-xl",
              gradient,
            )}
          >
            {getInitials(name)}
          </div>
        </div>
      )}

      {hasScreen && hasVideo && !compact && (
        <div className="absolute bottom-10 right-2 w-20 h-14 rounded-lg overflow-hidden border-2 border-[var(--s0)] shadow-lg">
          <VideoTrack
            trackRef={camTrackRef}
            className={cn(
              "w-full h-full object-cover",
              isLocalParticipant && "scale-x-[-1]",
            )}
          />
        </div>
      )}

      {hasScreen && !compact && (
        <div className="absolute top-2 left-2 bg-[var(--brand)]/80 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
          {Icons.screenShare}
          <span>{t("tile.sharing")}</span>
        </div>
      )}

      {pinned && !compact && (
        <div className="absolute top-2 right-2 bg-[var(--brand)]/80 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
          📌
        </div>
      )}

      {isSpeaking && (
        <div className="absolute top-2 right-2 flex gap-0.5 items-end h-4">
          {[1, 2, 3, 2, 1].map((h, i) => (
            <div
              key={i}
              className="w-0.5 bg-[var(--green)] rounded-full"
              style={{
                height: `${h * 25}%`,
                animation: `pulse ${0.3 + i * 0.1}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
      )}

      {hovered && !compact && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center gap-2 fade-in">
          <Tooltip content={t("tile.zoomIn")}>
            <button className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 border-none cursor-pointer text-white text-base flex items-center justify-center transition-all active:scale-95">
              🔍
            </button>
          </Tooltip>
          <Tooltip content={pinned ? t("tile.unpin") : t("tile.pin")}>
            <button
              className={cn(
                "w-9 h-9 rounded-full border-none cursor-pointer text-white text-base flex items-center justify-center transition-all active:scale-95",
                pinned
                  ? "bg-[var(--brand)]/60 hover:bg-[var(--brand)]/80"
                  : "bg-white/15 hover:bg-white/25",
              )}
              onClick={() => setPinned((p) => !p)}
            >
              📌
            </button>
          </Tooltip>
          {isHost && !isLocalParticipant && (
            <>
              <Tooltip
                content={
                  mutedByHost?.has(participant.identity)
                    ? t("tile.unmute")
                    : t("tile.mute")
                }
              >
                <button
                  className={cn(
                    "w-9 h-9 rounded-full border-none cursor-pointer text-white text-base flex items-center justify-center transition-all active:scale-95",
                    mutedByHost?.has(participant.identity)
                      ? "bg-[var(--amber)]/60 hover:bg-[var(--amber)]/80"
                      : "bg-white/15 hover:bg-[var(--amber)]/50",
                  )}
                  onClick={() => onMute?.(participant as RemoteParticipant)}
                >
                  {mutedByHost?.has(participant.identity) ? "🎙" : "🔇"}
                </button>
              </Tooltip>
              <Tooltip content={t("tile.remove")}>
                <button
                  className="w-9 h-9 rounded-full bg-white/15 hover:bg-[var(--red)]/50 border-none cursor-pointer text-white text-base flex items-center justify-center transition-all active:scale-95"
                  onClick={() => onKick?.(participant as RemoteParticipant)}
                >
                  ✕
                </button>
              </Tooltip>
            </>
          )}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-1.5 flex items-center gap-1 bg-gradient-to-t from-black/60 to-transparent">
        <span
          className={cn(
            "font-semibold text-white bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-md truncate flex-1",
            compact ? "text-[9px]" : "text-[11px]",
          )}
        >
          {isLocalParticipant ? `${name} ${t("tile.you")}` : name}
        </span>
      </div>
    </div>
  );
}

function GridLayout({
  allParticipants,
  tracks,
  localIdentity,
  isHost,
  onMute,
  onKick,
  mutedByHost,
}: {
  allParticipants: Participant[];
  tracks: any[];
  localIdentity: string;
  isHost?: boolean;
  onMute?: (p: RemoteParticipant) => void;
  onKick?: (p: RemoteParticipant) => void;
  mutedByHost?: Set<string>;
}) {
  return (
    <div
      className={cn(
        "flex-1 grid gap-1.5 p-1.5 bg-[var(--s0)]",
        getGridClass(allParticipants.length),
      )}
    >
      {allParticipants.map((p) => {
        const { cam, screen } = getTrackRefs(p, tracks);
        return (
          <ParticipantTile
            key={p.identity}
            participant={p}
            camTrackRef={cam}
            screenTrackRef={screen}
            isLocal={p.identity === localIdentity}
            localIdentity={localIdentity}
            isHost={isHost}
            onMute={onMute}
            onKick={onKick}
            mutedByHost={mutedByHost}
          />
        );
      })}
    </div>
  );
}

function SpotlightLayout({
  allParticipants,
  tracks,
  localIdentity,
  isHost,
  onMute,
  onKick,
  mutedByHost,
}: {
  allParticipants: Participant[];
  tracks: any[];
  localIdentity: string;
  isHost?: boolean;
  onMute?: (p: RemoteParticipant) => void;
  onKick?: (p: RemoteParticipant) => void;
  mutedByHost?: Set<string>;
}) {
  const [spotlightId, setSpotlightId] = useState(localIdentity);
  const spotlight =
    allParticipants.find((p) => p.identity === spotlightId) ||
    allParticipants[0];
  const rest = allParticipants.filter((p) => p.identity !== spotlight.identity);
  const { cam, screen } = getTrackRefs(spotlight, tracks);

  return (
    <div className="flex-1 flex gap-1.5 p-1.5 bg-[var(--s0)]">
      <div className="flex-1 relative">
        <ParticipantTile
          participant={spotlight}
          camTrackRef={cam}
          screenTrackRef={screen}
          isLocal={spotlight.identity === localIdentity}
          localIdentity={localIdentity}
          isHost={isHost}
          onMute={onMute}
          onKick={onKick}
          mutedByHost={mutedByHost}
        />
      </div>
      {rest.length > 0 && (
        <div className="flex flex-col gap-1.5 w-32">
          {rest.map((p) => {
            const refs = getTrackRefs(p, tracks);
            return (
              <div
                key={p.identity}
                className="h-24 cursor-pointer rounded-xl overflow-hidden"
                onClick={() => setSpotlightId(p.identity)}
              >
                <ParticipantTile
                  participant={p}
                  camTrackRef={refs.cam}
                  screenTrackRef={refs.screen}
                  isLocal={p.identity === localIdentity}
                  localIdentity={localIdentity}
                  compact
                  mutedByHost={mutedByHost}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SidebarLayout({
  allParticipants,
  tracks,
  localIdentity,
  isHost,
  onMute,
  onKick,
  mutedByHost,
}: {
  allParticipants: Participant[];
  tracks: any[];
  localIdentity: string;
  isHost?: boolean;
  onMute?: (p: RemoteParticipant) => void;
  onKick?: (p: RemoteParticipant) => void;
  mutedByHost?: Set<string>;
}) {
  const main = allParticipants[0];
  const rest = allParticipants.slice(1);
  const { cam, screen } = getTrackRefs(main, tracks);

  return (
    <div className="flex-1 flex gap-1.5 p-1.5 bg-[var(--s0)]">
      <div className="flex-1 relative">
        <ParticipantTile
          participant={main}
          camTrackRef={cam}
          screenTrackRef={screen}
          isLocal={main.identity === localIdentity}
          localIdentity={localIdentity}
          isHost={isHost}
          onMute={onMute}
          onKick={onKick}
          mutedByHost={mutedByHost}
        />
      </div>
      <div className="flex flex-col gap-1.5 w-28">
        {rest.map((p) => {
          const refs = getTrackRefs(p, tracks);
          return (
            <div key={p.identity} className="h-20 rounded-xl overflow-hidden">
              <ParticipantTile
                key={p.identity}
                participant={p}
                camTrackRef={refs.cam}
                screenTrackRef={refs.screen}
                isLocal={p.identity === localIdentity}
                localIdentity={localIdentity}
                isHost={isHost}
                onMute={onMute}
                onKick={onKick}
                mutedByHost={mutedByHost}
                compact
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface VideoGridProps {
  layout: LayoutMode;
  onLayoutChange: (l: LayoutMode) => void;
}

export default function VideoGrid({ layout }: VideoGridProps) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useParticipants();
  const { isHost, muteParticipant, kickParticipant } = useHostControls();
  const { mutedByHost } = useRoomStore();

  const allParticipants = [
    localParticipant,
    ...remoteParticipants.filter(
      (p) => p.identity !== localParticipant.identity,
    ),
  ];

  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: true },
  ]);

  return (
    <div className="flex-1 relative flex overflow-hidden">
      {layout === "grid" && (
        <GridLayout
          allParticipants={allParticipants}
          tracks={tracks}
          localIdentity={localParticipant.identity}
          isHost={isHost}
          onMute={muteParticipant}
          onKick={kickParticipant}
        />
      )}
      {layout === "spotlight" && (
        <SpotlightLayout
          allParticipants={allParticipants}
          tracks={tracks}
          localIdentity={localParticipant.identity}
          isHost={isHost}
          onMute={muteParticipant}
          onKick={kickParticipant}
          mutedByHost={mutedByHost}
        />
      )}
      {layout === "sidebar" && (
        <SidebarLayout
          allParticipants={allParticipants}
          tracks={tracks}
          localIdentity={localParticipant.identity}
          isHost={isHost}
          onMute={muteParticipant}
          onKick={kickParticipant}
          mutedByHost={mutedByHost}
        />
      )}
    </div>
  );
}

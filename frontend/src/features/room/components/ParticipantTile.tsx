import { Participant, Track } from "livekit-client";
import {
  useIsSpeaking,
  VideoTrack,
  isTrackReference,
  type TrackReference,
  useParticipantTile,
} from "@livekit/components-react";
import { Icons } from "../../../lib/constants/icons";
import { cn } from "../../../lib/utils";

interface ParticipantTileProps {
  participant: Participant;
  isLocal?: boolean;
}

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

export default function ParticipantTile({
  participant,
  isLocal,
}: ParticipantTileProps) {
  const isSpeaking = useIsSpeaking(participant);

  const camPublication = participant.getTrackPublication(Track.Source.Camera);
  const micPublication = participant.getTrackPublication(
    Track.Source.Microphone,
  );

  const isMicMuted = !micPublication || micPublication.isMuted;
  const hasVideo =
    camPublication && !camPublication.isMuted && camPublication.track;

  const camTrackRef: TrackReference | null = hasVideo
    ? {
        participant,
        source: Track.Source.Camera,
        publication: camPublication,
      }
    : null;

  const name = participant.name || participant.identity;
  const gradient = getAvatarGradient(participant.identity);

  return (
    <div
      className={cn(
        "relative bg-[var(--s2)] rounded-xl overflow-hidden",
        "transition-all duration-200",
        isSpeaking &&
          "ring-2 ring-[var(--green)] ring-offset-1 ring-offset-[var(--s0)]",
      )}
    >
      {/* Video */}
      {camTrackRef ? (
        <VideoTrack
          trackRef={camTrackRef}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center",
              "text-white text-xl font-bold bg-gradient-to-br",
              gradient,
            )}
          >
            {getInitials(name)}
          </div>
        </div>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center gap-1.5 bg-gradient-to-t from-black/60 to-transparent">
        <span className="text-[11px] font-semibold text-white bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-md truncate flex-1">
          {isLocal ? `${name} (You)` : name}
        </span>
        <span
          className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
            "bg-black/40 backdrop-blur-sm",
            isMicMuted && "bg-[var(--red)]/70",
          )}
        >
          <span className="text-white" style={{ transform: "scale(0.65)" }}>
            {isMicMuted ? Icons.micOff : Icons.mic}
          </span>
        </span>
      </div>

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="absolute top-2 right-2 flex gap-0.5 items-end h-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-0.5 bg-[var(--green)] rounded-full animate-pulse"
              style={{ height: `${i * 33}%`, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

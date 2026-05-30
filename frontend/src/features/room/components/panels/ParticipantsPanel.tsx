import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useLocalParticipant,
  useParticipants,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Icons } from "../../../../lib/constants/icons";
import { cn } from "../../../../lib/utils";
import { useRoomStore } from "../../store/roomStore";
import InviteModal from "../InviteModal";
import { getAvatarGradient, getInitials } from "./avatarHelpers";

/**
 * Panel content listing the host and other participants.
 *
 * Reused by:
 *   - RoomSidebar (docked panel on tablet/desktop)
 *   - MobileSwipeShell page 2 (mobile swipe layout)
 *   - MobileSheetShell BottomSheet (mobile sheet layout)
 */
export default function ParticipantsPanel() {
  const { t } = useTranslation("room");
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [showInvite, setShowInvite] = useState(false);

  const host =
    participants.find((p) => p.permissions?.canPublish) || localParticipant;
  const others = participants.filter((p) => p.identity !== host.identity);

  const ParticipantRow = ({
    participant,
    isLocal,
  }: {
    participant: any;
    isLocal?: boolean;
  }) => {
    const name = participant.name || participant.identity;
    const gradient = getAvatarGradient(participant.identity);
    const { mutedByHost } = useRoomStore();
    const isMutedByHost = mutedByHost?.has(participant.identity);

    // Real publication state — preferred over the local "we asked the host
    // to mute" flag so the row never lies if the participant unmuted again.
    const tracks = useTracks([
      { source: Track.Source.Microphone, withPlaceholder: true },
    ]);
    const micTrack = tracks.find(
      (tr) => tr.participant.identity === participant.identity,
    );
    const isMicMuted =
      isMutedByHost || (micTrack?.publication?.isMuted ?? false);
    const isCamOff = !participant.isCameraEnabled;

    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--s3)] transition-colors cursor-pointer">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 bg-gradient-to-br relative",
            gradient,
          )}
        >
          {getInitials(name)}
          {isMutedByHost && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[var(--red)] rounded-full flex items-center justify-center text-[7px]">
              🔇
            </span>
          )}
        </div>
        <span className="text-xs font-medium text-[var(--t1)] flex-1 truncate">
          {isLocal ? `${name} ${t("tile.you")}` : name}
        </span>
        <div className="flex gap-1 items-center">
          <span
            className={cn(
              "text-xs",
              isMicMuted ? "text-[var(--red)]" : "text-[var(--t3)]",
            )}
          >
            {isMicMuted ? Icons.micOff : Icons.mic}
          </span>
          <span
            className={cn(
              "text-xs",
              isCamOff ? "text-[var(--red)]" : "text-[var(--t3)]",
            )}
          >
            {isCamOff ? Icons.cameraOff : Icons.camera}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1 h-full">
      <button
        onClick={() => setShowInvite(true)}
        className="flex items-center justify-center gap-2 w-full py-2 mb-2 bg-[var(--brand-soft)] hover:bg-[var(--brand)]/15 text-[var(--brand-text)] text-xs font-semibold rounded-lg border-none cursor-pointer transition-all"
      >
        <span>+</span>
        {t("sidebar.addPeople")}
      </button>
      <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider px-2 py-1.5">
        {t("sidebar.host")}
      </div>
      <ParticipantRow participant={localParticipant} isLocal />

      {others.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider px-2 py-1.5 mt-2">
            {t("sidebar.students", { count: others.length })}
          </div>
          {others.map((p) => (
            <ParticipantRow key={p.identity} participant={p} />
          ))}
        </>
      )}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}

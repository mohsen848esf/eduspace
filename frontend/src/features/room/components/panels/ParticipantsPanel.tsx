import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useLocalParticipant,
  useParticipants,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import toast from "react-hot-toast";
import { Icons } from "../../../../lib/constants/icons";
import { cn } from "../../../../lib/utils";
import { useRoomStore } from "../../store/roomStore";
import recordingsApi, {
  type RecordingGrantUser,
} from "../../../recordings/api/recordings.api";
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
  const { roomCode, isHost } = useRoomStore();
  const [showInvite, setShowInvite] = useState(false);
  const [grants, setGrants] = useState<RecordingGrantUser[]>([]);
  const [grantBusy, setGrantBusy] = useState<string | null>(null);

  // Index by username so the per-row toggle can resolve in O(1).
  const grantedUsernames = useMemo(
    () => new Set(grants.map((g) => g.username)),
    [grants],
  );

  // Hosts poll the recording-permission endpoint to keep the toggle
  // states honest if another host tab edits them. Non-hosts skip this
  // entirely — they don't need the grants list and the server would
  // 200 with `grants: null` anyway.
  useEffect(() => {
    if (!isHost || !roomCode) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await recordingsApi.getRecordingPermission(roomCode);
        if (!cancelled) setGrants(res.grants ?? []);
      } catch {
        // Silent — the toggle just stays unchecked if we can't read.
      }
    };
    load();
    const id = window.setInterval(load, 7000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isHost, roomCode]);

  const toggleGrant = async (username: string, nextGranted: boolean) => {
    if (!roomCode || grantBusy) return;
    setGrantBusy(username);
    try {
      const res = await recordingsApi.setRecordingPermission(
        roomCode,
        { username },
        nextGranted,
      );
      setGrants((prev) => {
        const without = prev.filter((g) => g.username !== res.username);
        return res.granted
          ? [
              ...without,
              {
                user_id: res.user_id,
                username: res.username,
                full_name: res.full_name,
              },
            ]
          : without;
      });
      toast.success(
        nextGranted
          ? t("recordingGrant.toastGranted", { name: res.full_name })
          : t("recordingGrant.toastRevoked", { name: res.full_name }),
      );
    } catch (err: any) {
      const detail = err?.response?.data?.error;
      toast.error(detail || t("recordingGrant.toastFailed"));
    } finally {
      setGrantBusy(null);
    }
  };

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
            <span className="absolute -bottom-0.5 -end-0.5 w-3 h-3 bg-[var(--red)] rounded-full flex items-center justify-center text-[7px]">
              🔇
            </span>
          )}
        </div>
        <span className="text-xs font-medium text-[var(--t1)] flex-1 truncate">
          {isLocal ? `${name} ${t("tile.you")}` : name}
        </span>
        <div className="flex gap-1 items-center">
          {/* Host-only: toggle to grant/revoke recording control. The
              host themselves is implicitly always allowed, so we only
              show the toggle on the "others" rows. */}
          {isHost && !isLocal && (
            <RecordingGrantToggle
              username={participant.identity}
              granted={grantedUsernames.has(participant.identity)}
              busy={grantBusy === participant.identity}
              onToggle={(next) => toggleGrant(participant.identity, next)}
              t={t}
            />
          )}
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

interface RecordingGrantToggleProps {
  username: string;
  granted: boolean;
  busy: boolean;
  onToggle: (next: boolean) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

/**
 * Tiny pill the host clicks to grant or revoke recording control for a
 * participant. Visually it's a red dot + "REC" so it reads as "this
 * person can record" at a glance, with a strong unset state to make
 * the toggle obvious. Wraps the whole thing in a tooltip via title for
 * keyboard users — we already have a styled Tooltip component but it
 * needs an absolutely positioned anchor and would shift the row layout.
 */
function RecordingGrantToggle({
  username,
  granted,
  busy,
  onToggle,
  t,
}: RecordingGrantToggleProps) {
  const label = granted
    ? t("recordingGrant.revoke", { username })
    : t("recordingGrant.grant", { username });
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(!granted);
      }}
      disabled={busy}
      aria-pressed={granted}
      aria-label={label}
      title={label}
      className={cn(
        "h-5 px-1.5 rounded-md border-none cursor-pointer flex items-center gap-1",
        "text-[9px] font-bold uppercase tracking-wider transition-colors",
        granted
          ? "bg-[var(--red)]/15 text-[var(--red)]"
          : "bg-[var(--s4)] text-[var(--t3)] hover:bg-[var(--s3)] hover:text-[var(--t1)]",
        busy && "opacity-60 cursor-wait",
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          granted ? "bg-[var(--red)]" : "bg-[var(--t3)]/60",
        )}
        aria-hidden
      />
      REC
    </button>
  );
}

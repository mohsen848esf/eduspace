import { getApiErrorData } from "@/lib/api/errors";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useLocalParticipant,
  useParticipants,
} from "@livekit/components-react";
import { RemoteParticipant, Track, type Participant } from "livekit-client";
import toast from "react-hot-toast";
import { Icons } from "../../../../lib/constants/icons";
import { cn } from "../../../../lib/utils";
import { useRoomStore } from "../../store/roomStore";
import { roomApi } from "../../api/room.api";
import recordingsApi, {
  type RecordingGrantUser,
} from "../../../recordings/api/recordings.api";
import InviteModal from "../InviteModal";
import { getAvatarGradient, getInitials } from "./avatarHelpers";
import { useHostControls } from "../../hooks/useHostControls";
import { useLobbyHost } from "../../hooks/useLobbyHost";

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
  const {
    lowerParticipantHand,
    lowerAllHands,
    grantCoHost,
    revokeCoHost,
    canModerate,
    coHosts,
  } = useHostControls();
  const lobby = useLobbyHost({
    roomCode: roomCode || "",
    canModerate,
  });
  const [showInvite, setShowInvite] = useState(false);
  const [grants, setGrants] = useState<RecordingGrantUser[]>([]);
  const [grantBusy, setGrantBusy] = useState<string | null>(null);
  const [presentationGrants, setPresentationGrants] = useState<Set<string>>(new Set());

  const togglePresentationGrant = async (identity: string) => {
    if (!roomCode || !canModerate) return;
    const nextVal = !presentationGrants.has(identity);
    try {
      await roomApi.grantPresentationPermission(roomCode, identity, nextVal);
      setPresentationGrants((prev) => {
        const next = new Set(prev);
        if (nextVal) next.add(identity);
        else next.delete(identity);
        return next;
      });
      toast.success(nextVal ? "اجازه ارائه فایل داده شد." : "اجازه ارائه فایل لغو شد.");
    } catch {
      toast.error("خطا در تغییر دسترسی ارائه فایل.");
    }
  };

  // Index by username so the per-row toggle can resolve in O(1).
  const grantedUsernames = useMemo(
    () => new Set(grants.map((g) => g.username)),
    [grants],
  );

  // Hosts poll the recording-permission endpoint to keep the toggle
  // states honest if another host tab edits them. Non-hosts skip this
  // entirely — they don't need the grants list and the server would
  useEffect(() => {
    const hasToken = typeof localStorage !== "undefined" && !!localStorage.getItem("access_token");
    if (!isHost || !roomCode || !hasToken) return;
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
        res.granted
          ? t("recordingGrant.toastGranted", { username })
          : t("recordingGrant.toastRevoked", { username }),
      );
    } catch (error: unknown) {
      const detail = getApiErrorData(error)?.error;
      toast.error(detail || t("recordingGrant.toastFailed"));
    } finally {
      setGrantBusy(null);
    }
  };

  const isParticipantHost = useCallback((p: Participant) => {
    if (p.identity === localParticipant.identity) {
      return isHost;
    }
    if (p.metadata) {
      try {
        const meta = JSON.parse(p.metadata);
        if (meta.is_host || meta.role === "host") return true;
      } catch {
        // Ignore malformed participant metadata and use role state instead.
      }
    }
    return false;
  }, [isHost, localParticipant.identity]);

  const isParticipantCoHost = useCallback((p: Participant) => {
    if (isParticipantHost(p)) return false;
    if (coHosts.includes(p.identity)) return true;
    if (p.metadata) {
      try {
        const meta = JSON.parse(p.metadata);
        if (meta.is_co_host || meta.role === "co_host") return true;
      } catch {
        // Ignore malformed participant metadata and use role state instead.
      }
    }
    return false;
  }, [coHosts, isParticipantHost]);

  const hosts = useMemo(
    () => participants.filter((p) => isParticipantHost(p) || isParticipantCoHost(p)),
    [participants, isParticipantHost, isParticipantCoHost],
  );
  const others = useMemo(
    () => participants.filter((p) => !isParticipantHost(p) && !isParticipantCoHost(p)),
    [participants, isParticipantHost, isParticipantCoHost],
  );

  const getHandRaiseInfo = (p: Participant) => {
    if (!p.metadata) return { raised: false, at: 0 };
    try {
      const meta = JSON.parse(p.metadata);
      return {
        raised: !!meta.handRaised,
        at: typeof meta.handRaisedAt === "number" ? meta.handRaisedAt : 0,
      };
    } catch {
      return { raised: false, at: 0 };
    }
  };

  const sortedOthers = useMemo(() => {
    return [...others].sort((a, b) => {
      const infoA = getHandRaiseInfo(a);
      const infoB = getHandRaiseInfo(b);
      if (infoA.raised && !infoB.raised) return -1;
      if (!infoA.raised && infoB.raised) return 1;
      if (infoA.raised && infoB.raised) {
        return infoA.at - infoB.at;
      }
      return 0;
    });
  }, [others]);

  const hasHandsRaised = useMemo(() => {
    return others.some((p) => {
      const info = getHandRaiseInfo(p);
      return info.raised;
    });
  }, [others]);

  const ParticipantRow = ({
    participant,
    isLocal,
  }: {
    participant: Participant;
    isLocal?: boolean;
  }) => {
    const name = participant.name || participant.identity;
    const gradient = getAvatarGradient(participant.identity);
    const { mutedByHost } = useRoomStore();
    const isMutedByHost = mutedByHost?.has(participant.identity);
    const isPCoHost = isParticipantCoHost(participant);
    const isPHost = isParticipantHost(participant);

    // Parse participant metadata
    let handRaised = false;
    if (participant.metadata) {
      try {
        const meta = JSON.parse(participant.metadata);
        handRaised = !!meta.handRaised;
      } catch {
        // Malformed metadata means there is no trustworthy hand-raise state.
      }
    }

    // Real publication state
    const audioTrackPub = participant.getTrackPublication(Track.Source.Microphone);
    const videoTrackPub = participant.getTrackPublication(Track.Source.Camera);
    const isMicMuted = !audioTrackPub || audioTrackPub.isMuted;
    const isCamOff = !videoTrackPub || videoTrackPub.isMuted;

    return (
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors group",
          "hover:bg-[var(--s3)]",
          isLocal && "bg-[var(--s2)]",
        )}
      >
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 relative",
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
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-xs font-medium text-[var(--t1)] truncate">
            {isLocal ? `${name} (${t("tile.you") || "You"})` : name}
          </span>
          {isPHost && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/30 flex-shrink-0">
              {t("topbar.host", "میزبان")}
            </span>
          )}
          {isPCoHost && (
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
              همیار میزبان
            </span>
          )}
        </div>

        {handRaised && (
          <span className="text-amber-500 text-xs animate-pulse" title={t("controls.raiseHand")}>
            ✋
          </span>
        )}

        <div className="flex gap-1 items-center ms-auto flex-shrink-0">
          {/* Host-only Co-Host delegation toggle */}
          {isHost && !isLocal && (
            <button
              type="button"
              onClick={() => {
                if (isPCoHost) {
                  revokeCoHost(participant.identity);
                } else {
                  grantCoHost(participant.identity);
                }
              }}
              title={isPCoHost ? "عزل از همیار میزبان" : "انتصاب به عنوان همیار میزبان"}
              className={cn(
                "h-5 px-1.5 rounded-md border-none cursor-pointer flex items-center text-[9px] font-bold transition-colors",
                isPCoHost
                  ? "bg-emerald-500/20 text-emerald-300 hover:bg-rose-500/20 hover:text-rose-300"
                  : "bg-[var(--s4)] text-[var(--t3)] hover:bg-emerald-500/20 hover:text-emerald-300",
              )}
            >
              {isPCoHost ? "همیار ✓" : "+ همیار"}
            </button>
          )}

          {/* Moderator: toggle presentation upload grant */}
          {canModerate && !isLocal && (
            <button
              type="button"
              onClick={() => togglePresentationGrant(participant.identity)}
              title={presentationGrants.has(participant.identity) ? "لغو اجازه ارائه فایل" : "اجازه ارائه فایل"}
              className={cn(
                "h-5 px-1.5 rounded-md border-none cursor-pointer flex items-center text-[9px] font-bold transition-colors",
                presentationGrants.has(participant.identity)
                  ? "bg-indigo-500/20 text-indigo-300 hover:bg-rose-500/20 hover:text-rose-300"
                  : "bg-[var(--s4)] text-[var(--t3)] hover:bg-indigo-500/20 hover:text-indigo-300",
              )}
            >
              {presentationGrants.has(participant.identity) ? "ارائه ✓" : "+ ارائه"}
            </button>
          )}

          {/* Host-only: toggle to grant/revoke recording control. */}
          {isHost && !isLocal && (
            <RecordingGrantToggle
              username={participant.identity}
              granted={grantedUsernames.has(participant.identity)}
              busy={grantBusy === participant.identity}
              onToggle={(next) => toggleGrant(participant.identity, next)}
              t={t}
            />
          )}

          {canModerate && participant instanceof RemoteParticipant && handRaised && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                lowerParticipantHand(participant);
              }}
              title={t("host.lowerHand") || "Lower Hand"}
              className="h-5 px-1.5 rounded-md border-none cursor-pointer flex items-center bg-[var(--amber)]/15 text-[var(--amber)] hover:bg-[var(--amber)]/25 text-[9px] font-bold transition-colors"
            >
              LOWER
            </button>
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
        className="flex items-center justify-center gap-2 w-full py-2.5 mb-2 bg-[var(--brand-soft)] hover:bg-[var(--brand)]/20 text-[var(--brand)] border border-[var(--brand)]/30 text-xs font-bold rounded-xl cursor-pointer transition-all active:scale-[0.98]"
      >
        <span className="text-sm font-bold">+</span>
        {t("sidebar.addPeople")}
      </button>

      {/* Waiting Room (Lobby) Section for Moderators */}
      {canModerate && lobby.count > 0 && (
        <div className="mb-3 p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-white space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-indigo-400 scale-90">{Icons.shield}</span>
              <span className="text-xs font-bold text-indigo-100">
                {t("lobby.waitingParticipants", "افراد در انتظار ورود")}
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                {lobby.count}
              </span>
            </div>

            {lobby.count >= 2 && (
              <button
                type="button"
                disabled={lobby.isBatchAction}
                onClick={lobby.admitAll}
                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold border-none cursor-pointer disabled:opacity-50 transition-colors"
              >
                {t("lobby.admitAll", "تأیید همه")}
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 scrollbar-none">
            {lobby.requests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {req.display_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-gray-200 truncate">
                    {req.display_name}
                  </span>
                  {req.is_guest && (
                    <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                      {t("lobby.guestBadge", "مهمان")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={lobby.admittingId === req.id || lobby.isBatchAction}
                    onClick={() => lobby.admit(req.id)}
                    title={t("lobby.admit", "تأیید")}
                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs border-none cursor-pointer disabled:opacity-50"
                  >
                    {Icons.check}
                  </button>
                  <button
                    type="button"
                    disabled={lobby.denyingId === req.id || lobby.isBatchAction}
                    onClick={() => lobby.deny(req.id)}
                    title={t("lobby.deny", "رد")}
                    className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs cursor-pointer disabled:opacity-50"
                  >
                    {Icons.x}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Host Section */}
      {hosts.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider px-2 py-1.5">
            {t("sidebar.host")}
          </div>
          {hosts.map((h) => (
            <ParticipantRow
              key={h.identity}
              participant={h}
              isLocal={h.identity === localParticipant.identity}
            />
          ))}
        </>
      )}

      {/* Members Section */}
      {sortedOthers.length > 0 && (
        <>
          <div className="flex items-center justify-between px-2 py-1.5 mt-2">
            <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider">
              {t("sidebar.members", { count: sortedOthers.length }) ||
                t("sidebar.students", { count: sortedOthers.length })}
            </div>
            {isHost && hasHandsRaised && (
              <button
                type="button"
                onClick={lowerAllHands}
                className="text-[9px] font-bold text-[var(--amber)] bg-[var(--amber)]/15 hover:bg-[var(--amber)]/25 px-2 py-0.5 rounded border-none cursor-pointer transition-colors"
              >
                {t("host.lowerAllHands") || "Lower all"}
              </button>
            )}
          </div>
          {sortedOthers.map((p) => (
            <ParticipantRow
              key={p.identity}
              participant={p}
              isLocal={p.identity === localParticipant.identity}
            />
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

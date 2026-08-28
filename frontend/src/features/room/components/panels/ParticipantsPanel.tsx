import { getApiErrorData } from "@/lib/api/errors";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
    muteParticipant,
    kickParticipant,
    grantScreenShare,
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
              t={t}
              isHost={isHost}
              canModerate={canModerate}
              coHosts={coHosts}
              isParticipantHost={isParticipantHost}
              isParticipantCoHost={isParticipantCoHost}
              presentationGrants={presentationGrants}
              grantedUsernames={grantedUsernames}
              grantBusy={grantBusy}
              onMute={muteParticipant}
              onKick={kickParticipant}
              onGrantScreenShare={grantScreenShare}
              onLowerHand={lowerParticipantHand}
              onGrantCoHost={grantCoHost}
              onRevokeCoHost={revokeCoHost}
              onTogglePresentationGrant={togglePresentationGrant}
              onToggleRecordingGrant={toggleGrant}
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
              t={t}
              isHost={isHost}
              canModerate={canModerate}
              coHosts={coHosts}
              isParticipantHost={isParticipantHost}
              isParticipantCoHost={isParticipantCoHost}
              presentationGrants={presentationGrants}
              grantedUsernames={grantedUsernames}
              grantBusy={grantBusy}
              onMute={muteParticipant}
              onKick={kickParticipant}
              onGrantScreenShare={grantScreenShare}
              onLowerHand={lowerParticipantHand}
              onGrantCoHost={grantCoHost}
              onRevokeCoHost={revokeCoHost}
              onTogglePresentationGrant={togglePresentationGrant}
              onToggleRecordingGrant={toggleGrant}
            />
          ))}
        </>
      )}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}
// ---------------------------------------------------------------------------
// ParticipantRow — extracted as a proper top-level component to avoid
// re-creation on every parent render (which was causing the kebab menu
// to lose its state and close unexpectedly).
// ---------------------------------------------------------------------------

interface ParticipantRowProps {
  participant: Participant;
  isLocal?: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
  isHost: boolean;
  canModerate: boolean;
  coHosts: string[];
  isParticipantHost: (p: Participant) => boolean;
  isParticipantCoHost: (p: Participant) => boolean;
  presentationGrants: Set<string>;
  grantedUsernames: Set<string>;
  grantBusy: string | null;
  onMute: (p: RemoteParticipant) => void;
  onKick: (p: RemoteParticipant) => void;
  onGrantScreenShare: (p: RemoteParticipant) => void;
  onLowerHand: (p: RemoteParticipant) => void;
  onGrantCoHost: (identity: string) => void;
  onRevokeCoHost: (identity: string) => void;
  onTogglePresentationGrant: (identity: string) => void;
  onToggleRecordingGrant: (username: string, next: boolean) => void;
}

function ParticipantRow({
  participant,
  isLocal,
  t,
  isHost,
  canModerate,
  isParticipantHost,
  isParticipantCoHost,
  presentationGrants,
  grantedUsernames,
  grantBusy,
  onMute,
  onKick,
  onGrantScreenShare,
  onLowerHand,
  onGrantCoHost,
  onRevokeCoHost,
  onTogglePresentationGrant,
  onToggleRecordingGrant,
}: ParticipantRowProps) {
  const name = participant.name || participant.identity;
  const gradient = getAvatarGradient(participant.identity);
  const { mutedByHost, lockScreenShare } = useRoomStore();
  const isMutedByHost = mutedByHost?.has(participant.identity);
  const isPCoHost = isParticipantCoHost(participant);
  const isPHost = isParticipantHost(participant);

  const [menuOpen, setMenuOpen] = useState(false);
  // Ref wrapping the entire kebab anchor + dropdown so we can detect outside clicks.
  const menuRef = useRef<HTMLDivElement>(null);
  // Flag that delays the outside-click listener registration by one event loop
  // tick so the very mousedown that opens the menu is not immediately caught.
  const justOpenedRef = useRef(false);

  // Parse participant metadata
  let handRaised = false;
  if (participant.metadata) {
    try {
      const meta = JSON.parse(participant.metadata);
      handRaised = !!meta.handRaised;
    } catch {
      // Malformed metadata — ignore.
    }
  }

  // Real publication state
  const audioTrackPub = participant.getTrackPublication(Track.Source.Microphone);
  const videoTrackPub = participant.getTrackPublication(Track.Source.Camera);
  const isMicMuted = !audioTrackPub || audioTrackPub.isMuted;
  const isCamOff = !videoTrackPub || videoTrackPub.isMuted;

  // Close the dropdown when a pointerdown event fires outside the menu anchor.
  // We use capture:true so the listener fires before any React handler and we
  // never miss a click that lands on a portal or a sibling row.
  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      // Skip the very event that just opened the menu
      if (justOpenedRef.current) {
        justOpenedRef.current = false;
        return;
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", handlePointerDown, { capture: true });
  }, [menuOpen]);

  const isRemote = participant instanceof RemoteParticipant;
  const showKebab = canModerate && !isLocal && isRemote;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors",
        // Use a stable hover that doesn't re-trigger when the dropdown opens
        "hover:bg-[var(--s3)]",
        isLocal && "bg-[var(--s2)]",
      )}
    >
      {/* Avatar */}
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

      {/* Name + badges */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className="text-xs font-medium text-[var(--t1)] truncate">
          {isLocal ? `${name} (${t("tile.you") || "You"})` : name}
        </span>
        {isPHost && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/30 flex-shrink-0">
            {t("topbar.host", { defaultValue: "میزبان" })}
          </span>
        )}
        {isPCoHost && (
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
            همیار میزبان
          </span>
        )}
      </div>

      {/* Hand raised indicator */}
      {handRaised && (
        <span className="text-amber-500 text-xs animate-pulse" title={t("controls.raiseHand")}>
          ✋
        </span>
      )}

      {/* Mic / Cam status icons */}
      <div className="flex gap-1 items-center flex-shrink-0">
        <span className={cn("text-xs", isMicMuted ? "text-[var(--red)]" : "text-[var(--t3)]")}>
          {isMicMuted ? Icons.micOff : Icons.mic}
        </span>
        <span className={cn("text-xs", isCamOff ? "text-[var(--red)]" : "text-[var(--t3)]")}>
          {isCamOff ? Icons.cameraOff : Icons.camera}
        </span>
      </div>

      {/* ⋮ Kebab menu — moderators only, remote participants only */}
      {showKebab && (
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            type="button"
            onPointerDown={() => {
              // Mark that the next pointerdown event from the document listener
              // belongs to this toggle — so we don't immediately close the menu.
              justOpenedRef.current = !menuOpen;
            }}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            className={cn(
              "w-6 h-6 rounded-md flex items-center justify-center border-none cursor-pointer transition-all",
              "text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--s4)]",
              menuOpen && "bg-[var(--s4)] text-[var(--t1)]",
            )}
            title="اقدامات"
            aria-label={`منوی اقدامات برای ${name}`}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <span className="text-xs leading-none select-none">⋮</span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className={cn(
                "absolute end-0 top-full mt-1 z-50 w-52",
                "bg-[var(--s2)] border border-[var(--b)] rounded-xl shadow-2xl overflow-hidden",
                "animate-in fade-in zoom-in-95 duration-100",
              )}
              style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.45)" }}
            >
              {/* Mute / Unmute */}
              <DropdownItem
                icon={isMutedByHost ? "🎙️" : "🔇"}
                label={isMutedByHost ? "رفع سکوت میکروفون" : "سکوت میکروفون"}
                onClick={() => {
                  onMute(participant as RemoteParticipant);
                  setMenuOpen(false);
                }}
              />

              {/* Lower hand — only when hand is raised */}
              {handRaised && (
                <DropdownItem
                  icon="✋"
                  label={t("host.lowerHand") || "پایین آوردن دست"}
                  onClick={() => {
                    onLowerHand(participant as RemoteParticipant);
                    setMenuOpen(false);
                  }}
                />
              )}

              {/* Co-host toggle — only host can do this */}
              {isHost && (
                <DropdownItem
                  icon={isPCoHost ? "🛡️" : "➕"}
                  label={isPCoHost ? "عزل از همیار میزبان" : "انتصاب به همیار میزبان"}
                  onClick={() => {
                    if (isPCoHost) onRevokeCoHost(participant.identity);
                    else onGrantCoHost(participant.identity);
                    setMenuOpen(false);
                  }}
                  variant={isPCoHost ? "danger-soft" : "default"}
                />
              )}

              {/* Presentation permission */}
              <DropdownItem
                icon="📄"
                label={
                  presentationGrants.has(participant.identity)
                    ? "لغو اجازه ارائه فایل"
                    : "اجازه ارائه فایل"
                }
                onClick={() => {
                  onTogglePresentationGrant(participant.identity);
                  setMenuOpen(false);
                }}
                variant={presentationGrants.has(participant.identity) ? "danger-soft" : "default"}
              />

              {/* Grant screen share — only visible when lockScreenShare is active */}
              {lockScreenShare && (
                <DropdownItem
                  icon="🖥️"
                  label="اجازه اشتراک صفحه"
                  onClick={() => {
                    onGrantScreenShare(participant as RemoteParticipant);
                    setMenuOpen(false);
                  }}
                  variant="success"
                />
              )}

              {/* Recording grant — host only */}
              {isHost && (
                <DropdownItem
                  icon="🔴"
                  label={
                    grantedUsernames.has(participant.identity)
                      ? t("recordingGrant.revoke", { username: name })
                      : t("recordingGrant.grant", { username: name })
                  }
                  onClick={() => {
                    onToggleRecordingGrant(
                      participant.identity,
                      !grantedUsernames.has(participant.identity),
                    );
                    setMenuOpen(false);
                  }}
                  disabled={grantBusy === participant.identity}
                  variant={grantedUsernames.has(participant.identity) ? "danger-soft" : "default"}
                />
              )}

              {/* Divider */}
              <div className="my-1 border-t border-[var(--b)]" />

              {/* Kick */}
              <DropdownItem
                icon="🚪"
                label="اخراج از تماس"
                onClick={() => {
                  onKick(participant as RemoteParticipant);
                  setMenuOpen(false);
                }}
                variant="danger"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal: Dropdown item component
// ---------------------------------------------------------------------------

type DropdownVariant = "default" | "danger" | "danger-soft" | "success";

interface DropdownItemProps {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: DropdownVariant;
}

function DropdownItem({
  icon,
  label,
  onClick,
  disabled = false,
  variant = "default",
}: DropdownItemProps) {
  const colorClass: Record<DropdownVariant, string> = {
    default: "text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[var(--s3)]",
    danger: "text-[var(--red)] hover:bg-[var(--red)]/10",
    "danger-soft": "text-rose-400 hover:bg-rose-500/10",
    success: "text-emerald-400 hover:bg-emerald-500/10",
  };

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()} // prevent outside-click handler from firing
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium border-none cursor-pointer transition-colors text-start",
        colorClass[variant],
        disabled && "opacity-40 cursor-wait pointer-events-none",
      )}
    >
      <span className="text-sm leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

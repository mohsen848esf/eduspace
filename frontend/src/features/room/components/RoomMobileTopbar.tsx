import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useLocalParticipant,
  useParticipants,
} from "@livekit/components-react";
import toast from "react-hot-toast";
import { useRoomStore } from "../store/roomStore";
import { Icons } from "../../../lib/constants/icons";
import { cn } from "../../../lib/utils";
import RecordControls from "../../recordings/components/room/RecordControls";
import { useRoomRecording } from "../../recordings/hooks/useRoomRecording";

function useDuration() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, []);
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Mobile in-call topbar.
 *
 * Single 12px-tall row that fits a 320px viewport without wrapping:
 *   [● Room name (truncate) | timer | 👥N · ⋯]
 *
 * The overflow ⋯ button opens a small popup with the room code (copy),
 * record controls (host only), and a tiny info block. This keeps the
 * always-visible chrome lean — desktop's Topbar is much busier and was
 * never going to fit a phone width.
 *
 * Recording state uses a single small red dot with no "REC" label, per
 * the user's request.
 */
export default function RoomMobileTopbar() {
  const { t } = useTranslation("room");
  const { roomCode, roomName, isHost } = useRoomStore();
  const remote = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const total = new Set([
    localParticipant.identity,
    ...remote.map((p) => p.identity),
  ]).size;
  const duration = useDuration();
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const recording = useRoomRecording({ roomCode, isHost });
  const isLiveRecording =
    recording.status.recording?.status === "recording" ||
    recording.status.recording?.status === "starting" ||
    recording.status.recording?.status === "paused";

  useEffect(() => {
    if (!showMenu) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showMenu]);

  const copyRoomLink = async () => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/room/${roomCode}`,
    );
    toast.success(t("topbar.copiedToast"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="h-12 flex-shrink-0 flex items-center gap-2 px-3 bg-[var(--s1)] border-b border-[var(--b)]">
      {/* Live + room name */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span
          className="w-2 h-2 rounded-full bg-[var(--green)] flex-shrink-0"
          aria-hidden
        />
        <span className="text-sm font-semibold text-[var(--t1)] truncate">
          {roomName || t("topbar.defaultRoomName")}
        </span>
      </div>

      {/* REC dot (recording only) */}
      {isLiveRecording && (
        <span
          aria-label={t("topbar.rec")}
          className={cn(
            "w-2 h-2 rounded-full bg-[var(--red)] flex-shrink-0",
            recording.status.recording?.status !== "paused" && "animate-pulse",
          )}
        />
      )}

      {/* Timer */}
      <span className="text-xs font-mono text-[var(--green)] font-semibold force-ltr flex-shrink-0">
        {duration}
      </span>

      {/* Participants pill */}
      <span className="flex items-center gap-1 text-[11px] text-[var(--t2)] font-semibold flex-shrink-0">
        <span aria-hidden>👥</span>
        {total}
      </span>

      {/* Overflow menu */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setShowMenu((p) => !p)}
          aria-label={t("topbar.info")}
          className={cn(
            "w-8 h-8 rounded-lg border-none cursor-pointer flex items-center justify-center text-base",
            showMenu
              ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
              : "bg-transparent text-[var(--t3)] hover:bg-[var(--s3)] hover:text-[var(--t1)]",
          )}
        >
          ⋯
        </button>

        {showMenu && (
          <div className="absolute top-10 end-0 z-50 bg-[var(--s2)] border border-[var(--b)] rounded-xl shadow-2xl p-3 w-64 fade-in flex flex-col gap-3">
            <div>
              <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider mb-1">
                {t("topbar.infoTitle")}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--t3)]">
                  {t("topbar.infoCode")}
                </span>
                <button
                  onClick={copyRoomLink}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md border-none cursor-pointer transition-colors text-xs font-mono force-ltr",
                    copied
                      ? "bg-[var(--green)]/15 text-[var(--green)]"
                      : "bg-[var(--s3)] text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[var(--s4)]",
                  )}
                >
                  {copied ? "✓" : Icons.copy}
                  {roomCode}
                </button>
              </div>
              <div className="flex items-center justify-between mt-1.5 text-xs">
                <span className="text-[var(--t3)]">
                  {t("topbar.infoYourRole")}
                </span>
                <span className="text-[var(--brand-text)] font-medium">
                  {isHost ? t("topbar.roleHost") : t("topbar.roleParticipant")}
                </span>
              </div>
            </div>

            {/* Host-only recording block */}
            {isHost && (
              <div className="border-t border-[var(--b)] pt-3">
                <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider mb-2">
                  {t("controls.start")}
                </div>
                <RecordControls
                  roomCode={roomCode}
                  isHost={isHost}
                  status={recording.status}
                  isMutating={recording.isMutating}
                  onStart={recording.start}
                  onStop={recording.stop}
                  onPause={recording.pause}
                  onResume={recording.resume}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

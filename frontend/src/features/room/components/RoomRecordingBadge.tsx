import { useTranslation } from "react-i18next";
import { useRoomStore } from "../store/roomStore";
import { useRoomRecording } from "../../recordings/hooks/useRoomRecording";
import { cn } from "../../../lib/utils";

interface RoomRecordingBadgeProps {
  /** Optional Tailwind classes for the absolutely-positioned wrapper. */
  className?: string;
}

/**
 * Pinned overlay shown to every participant whenever a recording is
 * active in the room. Mounts inside the call surface (mobile + desktop)
 * so the indicator is unmistakable: a pulsing red dot plus the word
 * REC, rendered with high contrast on top of the video tiles.
 *
 * The previous implementation only rendered a tiny dot inside the
 * topbar, and only the host's UI saw it on mobile / mobile sheet
 * shell. Non-hosts had no visual cue that the call was being captured.
 */
export default function RoomRecordingBadge({ className }: RoomRecordingBadgeProps) {
  const { t } = useTranslation("room");
  const { roomCode, isHost } = useRoomStore();
  const { status } = useRoomRecording({ roomCode, isHost });

  const recStatus = status.recording?.status;
  const isLive =
    recStatus === "recording" ||
    recStatus === "starting" ||
    recStatus === "paused";

  if (!isLive) return null;

  const isPaused = recStatus === "paused";

  return (
    <div
      role="status"
      aria-label={isPaused ? t("controls.paused") : t("controls.recording")}
      className={cn(
        "absolute top-2 end-2 z-20 flex items-center gap-1.5",
        "px-2 py-1 rounded-full",
        "bg-black/55 backdrop-blur-sm border border-white/10",
        "pointer-events-none select-none",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          isPaused ? "bg-[var(--amber)]" : "bg-[var(--red)] animate-pulse",
        )}
      />
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-wider force-ltr",
          isPaused ? "text-[var(--amber)]" : "text-[var(--red)]",
        )}
      >
        {isPaused ? t("controls.paused") : t("controls.rec")}
      </span>
    </div>
  );
}

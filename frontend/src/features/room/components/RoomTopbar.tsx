import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocalParticipant, useParticipants } from "@livekit/components-react";
import { ArrowLeft, Users } from "lucide-react";
import { useRoomStore } from "../store/roomStore";
import { cn } from "../../../lib/utils";

function useDuration() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${minutes}:${remainingSeconds}` : `${minutes}:${remainingSeconds}`;
}

export default function RoomTopbar({ onLeave }: { onLeave: () => void }) {
  const { t } = useTranslation("room");
  const { roomName, isHost, durationLimitMinutes, isDurationLimited } = useRoomStore();
  const remoteParticipants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const participantCount = new Set([
    localParticipant.identity,
    ...remoteParticipants.map((participant) => participant.identity),
  ]).size;
  const duration = useDuration();
  const durationParts = duration.split(":");
  const currentMinutes = Number(durationParts.at(-2) ?? 0) +
    (durationParts.length > 2 ? Number(durationParts[0]) * 60 : 0);
  const remainingMinutes = Math.max(0, (durationLimitMinutes || 60) - currentMinutes);
  const capped = isDurationLimited && participantCount > 3 && Boolean(durationLimitMinutes);

  return (
    <header dir="ltr" className="relative flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--b)] bg-[var(--s1)] px-4">
      <div className="flex min-w-0 items-center gap-2">
        <button type="button" onClick={onLeave} aria-label={t("tooltips.leave")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--s3)] text-[var(--t1)] transition-colors hover:bg-[var(--s4)]">
          <ArrowLeft size={21} />
        </button>
        <div className="flex h-10 min-w-0 max-w-72 items-center gap-2 rounded-xl bg-[var(--s3)] px-3 text-[var(--t1)]">
          <Users size={19} className="shrink-0" />
          <span dir="auto" className="truncate text-sm font-semibold">{roomName || t("topbar.defaultRoomName")}</span>
          {isHost && <span className="rounded-md bg-[var(--brand-soft)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--brand)]">{t("topbar.host")}</span>}
        </div>
      </div>

      <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-[var(--s0)]/60 px-3 py-2 shadow-sm">
        <span className="h-2 w-2 rounded-full bg-[var(--green)] shadow-[0_0_8px_var(--green)]" />
        <span className={cn("font-mono text-sm font-semibold", capped && remainingMinutes <= 5 ? "text-[var(--red)]" : capped && remainingMinutes <= 10 ? "text-amber-400" : "text-[var(--green)]")}>{duration}</span>
      </div>

      <div className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[var(--s3)] px-3 text-sm text-[var(--t1)]">
        <Users size={19} />
        <span>{participantCount}</span>
      </div>
    </header>
  );
}

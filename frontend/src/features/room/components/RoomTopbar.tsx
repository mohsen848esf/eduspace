import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocalParticipant, useParticipants } from "@livekit/components-react";
import { ArrowLeft, Circle, Users, X } from "lucide-react";
import { useRoomStore } from "../store/roomStore";
import { cn } from "../../../lib/utils";
import RecordControls from "../../recordings/components/room/RecordControls";
import { useRoomRecording } from "../../recordings/hooks/useRoomRecording";
import { formatRecordingElapsed, useRecordingElapsed } from "../../recordings/hooks/useRecordingElapsed";

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
  const { roomCode, roomName, isHost, durationLimitMinutes, isDurationLimited } = useRoomStore();
  const [recordingOpen, setRecordingOpen] = useState(false);
  const recording = useRoomRecording({ roomCode, isHost });
  const recordingState = recording.status.recording;
  const recordingLive = Boolean(recordingState && ["starting", "recording", "paused"].includes(recordingState.status));
  const recordingElapsed = useRecordingElapsed(recordingState);
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

  useEffect(() => {
    const open = () => {
      if (recording.canControl) setRecordingOpen(true);
    };
    window.addEventListener("eduspace:open-recording", open);
    return () => window.removeEventListener("eduspace:open-recording", open);
  }, [recording.canControl]);

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

      <div className="flex shrink-0 items-center gap-2">
        {recordingLive && (
          <button type="button" disabled={!recording.canControl} onClick={() => setRecordingOpen(true)} className="flex h-10 items-center gap-2 rounded-xl bg-[var(--red)]/15 px-3 text-[var(--red)] disabled:cursor-default" aria-label={t("controls.recording")}>
            <Circle size={9} fill="currentColor" className={recordingState?.status === "recording" ? "animate-pulse" : ""}/>
            <span className="force-ltr font-mono text-xs font-bold">{formatRecordingElapsed(recordingElapsed)}</span>
          </button>
        )}
        <div className="flex h-10 items-center gap-2 rounded-xl bg-[var(--s3)] px-3 text-sm text-[var(--t1)]"><Users size={19} /><span>{participantCount}</span></div>
      </div>

      {recordingOpen && recording.canControl && <>
        <button type="button" className="fixed inset-0 z-[65] cursor-default bg-black/25 backdrop-blur-[1px]" aria-label={t("mobile.close")} onClick={() => setRecordingOpen(false)}/>
        <div dir="auto" role="dialog" aria-label={t("controls.recording")} className="fixed end-4 top-20 z-[70] w-[min(380px,calc(100vw-32px))] rounded-3xl border border-[var(--b)] bg-[var(--s2)] p-5 pt-14 shadow-2xl font-[inherit]">
          <button type="button" onClick={() => setRecordingOpen(false)} aria-label={t("mobile.close")} className="absolute end-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--s3)] text-[var(--t1)] transition-colors hover:bg-[var(--s4)]"><X size={20}/></button>
          <RecordControls roomCode={roomCode} canControl={recording.canControl} status={recording.status} isMutating={recording.isMutating} onStart={recording.start} onStop={recording.stop} onPause={recording.pause} onResume={recording.resume}/>
        </div>
      </>}
    </header>
  );
}

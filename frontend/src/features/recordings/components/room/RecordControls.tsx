import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Circle, Pause, Play, Square } from "lucide-react";
import { cn } from "../../../../lib/utils";
import type { RecordingQuality, RoomRecordingStatus } from "../../api/recordings.api";
import { formatRecordingElapsed, useRecordingElapsed } from "../../hooks/useRecordingElapsed";

interface RecordControlsProps {
  placement?: "top" | "bottom";
  roomCode: string | null;
  canControl: boolean;
  status: RoomRecordingStatus;
  isMutating: boolean;
  onStart: (quality: RecordingQuality, mode: "server" | "client-upload" | "client-download") => Promise<unknown>;
  onStop: () => Promise<unknown>;
  onPause: () => Promise<unknown>;
  onResume: () => Promise<unknown>;
}

export default function RecordControls({ roomCode, canControl, status, isMutating, onStart, onStop, onPause, onResume }: RecordControlsProps) {
  const { t } = useTranslation("recordings");
  const [quality, setQuality] = useState<RecordingQuality>("720p");
  const recording = status.recording;
  const isIdle = !recording || recording.status === "completed" || recording.status === "failed";
  const isPaused = recording?.status === "paused";
  const isProcessing = recording?.status === "processing";
  const elapsed = useRecordingElapsed(recording);

  if (!canControl || !roomCode) return null;

  if (isIdle) {
    const captureSupported = typeof navigator.mediaDevices?.getDisplayMedia === "function" && typeof MediaRecorder !== "undefined";
    return (
      <div className="w-full space-y-4 font-[inherit]">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--red)]/15 text-[var(--red)]"><Circle size={21} fill="currentColor" /></span>
          <div><h3 className="text-base font-bold text-[var(--t1)]">{t("controls.start")}</h3><p className="mt-0.5 text-xs text-[var(--t3)]">{t("controls.localSaveHint")}</p></div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--t2)]">{t("controls.qualityLabel")}</p>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--s1)] p-1.5">
            {(["720p", "1080p"] as const).map((item) => <button key={item} type="button" aria-pressed={quality === item} onClick={() => setQuality(item)} className={cn("min-h-11 rounded-xl text-sm font-semibold transition-colors", quality === item ? "bg-[var(--brand)] text-white shadow-sm" : "text-[var(--t2)] hover:bg-[var(--s3)]")}>{item}</button>)}
          </div>
        </div>
        {!captureSupported && <p role="status" className="rounded-2xl bg-[var(--amber)]/10 px-3 py-2.5 text-xs leading-5 text-[var(--amber)]">{t("controls.mobileUnsupported")}</p>}
        <button type="button" disabled={isMutating || !captureSupported} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--red)] px-4 text-sm font-bold text-white disabled:opacity-45" onClick={() => void onStart(quality, "client-download")}><Circle size={14} fill="currentColor" />{isMutating ? t("controls.starting") : t("controls.start")}</button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 font-[inherit]">
      <div className={cn("flex items-center justify-center gap-2 rounded-2xl px-3 py-4", isPaused ? "bg-[var(--amber)]/15 text-[var(--amber)]" : "bg-[var(--red)]/15 text-[var(--red)]")}>
        <span className={cn("h-2.5 w-2.5 rounded-full", isPaused ? "bg-[var(--amber)]" : "animate-pulse bg-[var(--red)]")} />
        <span className="text-sm font-bold">{isPaused ? t("controls.paused") : isProcessing ? t("controls.processing") : recording?.status === "starting" ? t("controls.starting") : t("controls.recording")}</span>
        {!isProcessing && <span className="force-ltr font-mono text-sm text-[var(--t1)]">{formatRecordingElapsed(elapsed)}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {isPaused ? <button type="button" onClick={() => void onResume()} disabled={isMutating} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--s3)] text-sm font-semibold disabled:opacity-50"><Play size={18} fill="currentColor" />{t("controls.resume")}</button> : recording?.status === "recording" ? <button type="button" onClick={() => void onPause()} disabled={isMutating} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--s3)] text-sm font-semibold disabled:opacity-50"><Pause size={18} fill="currentColor" />{t("controls.pause")}</button> : <span />}
        {!isProcessing && <button type="button" onClick={() => void onStop()} disabled={isMutating} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--red)]/15 text-sm font-semibold text-[var(--red)] disabled:opacity-50"><Square size={17} fill="currentColor" />{t("controls.stop")}</button>}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "../../../../components/ui/Tooltip";
import { cn } from "../../../../lib/utils";
import {
  type RecordingQuality,
  type RoomRecordingStatus,
} from "../../api/recordings.api";

interface RecordControlsProps {
  placement?: "top" | "bottom";
  roomCode: string | null;
  /**
   * True when the current user is allowed to drive the recording —
   * either the host, or a participant the host has explicitly granted
   * recording control to. Renamed from `isHost` so grantees see the
   * same record buttons.
   */
  canControl: boolean;
  status: RoomRecordingStatus;
  isMutating: boolean;
  onStart: (
    quality: RecordingQuality,
    mode: "server" | "client-upload" | "client-download"
  ) => Promise<unknown>;
  onStop: () => Promise<unknown>;
  onPause: () => Promise<unknown>;
  onResume: () => Promise<unknown>;
}

function formatElapsed(secondsTotal: number): string {
  const s = Math.max(0, Math.floor(secondsTotal));
  const m = Math.floor(s / 60);
  const ss = (s % 60).toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Pause-aware elapsed timer.
 *
 * Tracks accumulated *active* time across pause/resume cycles instead of
 * deriving from wall clock minus original start_at, which would count
 * paused intervals as elapsed.
 *
 *   activeSinceKey  identity of the current recording. When it changes
 *                   we reset accumulated state.
 *   isActiveTicking true while the egress is actually capturing frames.
 */
function useElapsed(
  activeSinceKey: string | null,
  isActiveTicking: boolean,
): number {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const accumulatedRef = useRef(0); // total seconds of past active intervals
  const anchorRef = useRef<number | null>(null); // ms when current run started
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    let intervalId: number | null = null;
    const startTimer = window.setTimeout(() => {
      if (lastKey.current !== activeSinceKey) {
        accumulatedRef.current = 0;
        anchorRef.current = null;
        lastKey.current = activeSinceKey;
      }

      const updateDisplay = () => {
        const liveSeconds =
          isActiveTicking && anchorRef.current !== null
            ? (Date.now() - anchorRef.current) / 1000
            : 0;
        setElapsedSeconds(
          Math.max(0, Math.floor(accumulatedRef.current + liveSeconds)),
        );
      };

      if (isActiveTicking) {
        anchorRef.current = Date.now();
        intervalId = window.setInterval(updateDisplay, 1000);
      }
      updateDisplay();
    }, 0);

    return () => {
      window.clearTimeout(startTimer);
      if (intervalId !== null) window.clearInterval(intervalId);
      if (isActiveTicking && anchorRef.current !== null) {
        accumulatedRef.current += (Date.now() - anchorRef.current) / 1000;
        anchorRef.current = null;
      }
    };
  }, [isActiveTicking, activeSinceKey]);

  return activeSinceKey ? elapsedSeconds : 0;
}

export default function RecordControls({
  placement = "bottom",
  roomCode,
  canControl,
  status,
  isMutating,
  onStart,
  onStop,
  onPause,
  onResume,
}: RecordControlsProps) {
  const { t } = useTranslation("recordings");

  const [showModes, setShowModes] = useState(false);
  const [quality, setQuality] = useState<RecordingQuality>("720p");

  const recording = status.recording;
  const isIdle =
    !recording ||
    recording.status === "completed" ||
    recording.status === "failed";
  const isActive =
    recording &&
    (recording.status === "starting" ||
      recording.status === "recording" ||
      recording.status === "paused" ||
      recording.status === "processing");
  const isPaused = recording?.status === "paused";
  const isProcessing = recording?.status === "processing";

  // Tick only while genuinely capturing frames, not during starting / pause / processing.
  const isTicking =
    isActive &&
    recording.status === "recording";

  const elapsed = useElapsed(
    isActive && recording ? recording.public_token : null,
    Boolean(isTicking),
  );

  if (!canControl || !roomCode) return null;

  if (isIdle) return <div className="relative">
    <button className="h-9 px-3 rounded-lg text-[var(--red)] bg-[var(--s3)]" disabled={isMutating} aria-expanded={showModes} onClick={() => setShowModes((v) => !v)}>{t("controls.rec")} · {quality}</button>
    {showModes && <><div className="fixed inset-0 z-40" onClick={() => setShowModes(false)} /><div className={cn("absolute end-0 z-50 w-56 max-w-[calc(100vw-2rem)] rounded-xl bg-[var(--s2)] border border-[var(--b)] p-3 shadow-xl", placement === "top" ? "bottom-full mb-2" : "top-11")}>
      <p className="text-xs mb-2">{t("controls.qualityLabel")}</p>
      <div className="flex gap-2">{(["720p", "1080p"] as const).map((q) => <button key={q} aria-pressed={quality === q} onClick={() => setQuality(q)} className={cn("flex-1 p-2 rounded-lg", quality === q ? "bg-[var(--brand)] text-white" : "bg-[var(--s3)]")}>{q}</button>)}</div>
      <button disabled={isMutating} className="w-full mt-3 p-2 rounded-lg bg-[var(--red)] text-white text-xs" onClick={() => { setShowModes(false); void onStart(quality, "client-download"); }}>{t("controls.modeClientDownload")}</button>
    </div></>}
  </div>;

  // Active states.
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 h-7 rounded-lg",
          isPaused
            ? "bg-[var(--amber)]/15 text-[var(--amber)]"
            : "bg-[var(--red)]/15 text-[var(--red)]",
        )}
      >
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            isPaused
              ? "bg-[var(--amber)]"
              : "bg-[var(--red)] animate-pulse",
          )}
        />
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {isPaused
            ? t("controls.paused")
            : isProcessing
              ? t("controls.processing")
              : recording.status === "starting"
                ? t("controls.starting")
                : t("controls.recording")}
        </span>
        {!isProcessing && (
          <span className="text-[10px] font-mono text-[var(--t1)] force-ltr">
            {formatElapsed(elapsed)}
          </span>
        )}
      </div>

      {isPaused ? (
        <Tooltip content={t("controls.resume")}>
          <button
            onClick={() => onResume()}
            disabled={isMutating}
            className="w-7 h-7 rounded-md border-none cursor-pointer bg-[var(--s3)] text-[var(--t1)] hover:bg-[var(--s4)] flex items-center justify-center text-xs disabled:opacity-50"
          >
            ▶
          </button>
        </Tooltip>
      ) : (
        recording.status === "recording" && (
          <Tooltip content={t("controls.pause")}>
            <button
              onClick={() => onPause()}
              disabled={isMutating}
              className="w-7 h-7 rounded-md border-none cursor-pointer bg-[var(--s3)] text-[var(--t1)] hover:bg-[var(--s4)] flex items-center justify-center text-xs disabled:opacity-50"
            >
              ❚❚
            </button>
          </Tooltip>
        )
      )}

      {!isProcessing && (
        <Tooltip content={t("controls.stop")}>
          <button
            onClick={() => onStop()}
            disabled={isMutating}
            className="w-7 h-7 rounded-md border-none cursor-pointer bg-[var(--red)]/15 text-[var(--red)] hover:bg-[var(--red)]/25 flex items-center justify-center text-xs disabled:opacity-50"
          >
            ■
          </button>
        </Tooltip>
      )}
    </div>
  );
}

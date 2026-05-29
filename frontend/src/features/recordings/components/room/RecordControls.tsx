import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "../../../../components/ui/Tooltip";
import { cn } from "../../../../lib/utils";
import {
  type RecordingQuality,
  type RoomRecordingStatus,
} from "../../api/recordings.api";

interface RecordControlsProps {
  roomCode: string | null;
  isHost: boolean;
  status: RoomRecordingStatus;
  isMutating: boolean;
  onStart: (quality: RecordingQuality) => Promise<unknown>;
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
 * Active states: ticks once per second, anchored to `activeSince`.
 * Paused: returns the last value seen before pause and stops ticking.
 *
 * The simple `Date.now() - started_at` approach was wrong because it
 * treats the wall clock as the source of truth, so a paused recording
 * appeared to keep growing.
 */
function useElapsed(
  activeSince: string | null,
  isActiveTicking: boolean,
): number {
  const [now, setNow] = useState(() => Date.now());
  const frozen = useRef<number | null>(null);

  useEffect(() => {
    if (!isActiveTicking) {
      // Freeze whatever we last computed.
      if (activeSince && frozen.current === null) {
        frozen.current = Math.max(
          0,
          Math.floor((now - new Date(activeSince).getTime()) / 1000),
        );
      }
      return;
    }
    // Resuming: clear the freeze and start ticking again.
    frozen.current = null;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
    // We deliberately don't depend on `now` so the interval isn't
    // recreated every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSince, isActiveTicking]);

  if (!activeSince) return 0;
  if (frozen.current !== null) return frozen.current;
  return Math.floor((now - new Date(activeSince).getTime()) / 1000);
}

export default function RecordControls({
  roomCode,
  isHost,
  status,
  isMutating,
  onStart,
  onStop,
  onPause,
  onResume,
}: RecordControlsProps) {
  const { t } = useTranslation("recordings");
  const [showQuality, setShowQuality] = useState(false);
  const [quality, setQuality] = useState<RecordingQuality>("720p");

  if (!isHost || !roomCode) return null;

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

  // Tick only while genuinely capturing frames, not during pause / processing.
  const isTicking =
    isActive &&
    (recording.status === "starting" || recording.status === "recording");

  const elapsed = useElapsed(
    isActive && recording ? recording.started_at : null,
    Boolean(isTicking),
  );

  if (isIdle) {
    return (
      <div className="relative flex items-center">
        <Tooltip content={t("controls.start")}>
          <button
            onClick={async () => {
              await onStart(quality);
            }}
            disabled={isMutating}
            className={cn(
              "flex items-center gap-1.5 px-2.5 h-7 rounded-lg border-none cursor-pointer transition-all",
              "text-[11px] font-semibold uppercase tracking-wider",
              "bg-[var(--red)]/15 hover:bg-[var(--red)]/25 text-[var(--red)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            <span className="w-2 h-2 rounded-full bg-[var(--red)]" />
            {t("controls.rec")}
          </button>
        </Tooltip>

        <Tooltip content={t("controls.qualityLabel")}>
          <button
            onClick={() => setShowQuality((p) => !p)}
            className={cn(
              "ms-1 px-1.5 h-7 rounded-md border-none cursor-pointer text-[10px] font-semibold",
              "bg-[var(--s3)] text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[var(--s4)]",
            )}
          >
            {quality}
          </button>
        </Tooltip>

        {showQuality && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowQuality(false)}
            />
            <div className="absolute top-9 end-0 z-50 bg-[var(--s2)] border border-[var(--b)] rounded-xl shadow-2xl p-2 w-32 fade-in">
              {(["720p", "1080p"] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setQuality(q);
                    setShowQuality(false);
                  }}
                  className={cn(
                    "w-full text-start px-2 py-1.5 rounded-md text-xs cursor-pointer border-none transition-colors",
                    quality === q
                      ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
                      : "bg-transparent text-[var(--t2)] hover:bg-[var(--s3)]",
                  )}
                >
                  {t(`controls.quality${q === "720p" ? "720p" : "1080p"}`)}
                  {quality === q ? " ✓" : ""}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

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

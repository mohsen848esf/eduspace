import { Activity, AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  summarizePlaybackReadiness,
  type PlaybackHealthEntry,
} from "../lib/playbackHealth";

interface Props {
  entries: PlaybackHealthEntry[];
  totalParticipants: number;
  onOpenChange?: (open: boolean) => void;
}

const formatSeconds = (milliseconds: number) => `${(milliseconds / 1_000).toFixed(1)}s`;

export function SharedPlaybackReadiness({ entries, totalParticipants, onOpenChange }: Props) {
  const { t } = useTranslation("room");
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summary = summarizePlaybackReadiness(entries, totalParticipants);
  const hasProblem = summary.errors > 0 || summary.recovering > 0;
  const allSynced = summary.total > 0 && summary.synced === summary.total;
  const Icon = allSynced ? CheckCircle2 : hasProblem ? AlertTriangle : LoaderCircle;

  useEffect(() => {
    const closeWhenOutside = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (details?.open && event.target instanceof Node && !details.contains(event.target)) {
        details.open = false;
        onOpenChange?.(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const details = detailsRef.current;
      if (event.key !== "Escape" || !details?.open) return;
      details.open = false;
      onOpenChange?.(false);
      details.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onOpenChange]);

  return (
    <details
      ref={detailsRef}
      className="group absolute start-3 top-3 z-20 max-w-[calc(100%-1.5rem)] text-white"
      dir="rtl"
      onToggle={(event) => onOpenChange?.(event.currentTarget.open)}
    >
      <summary
        className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-lg backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white [&::-webkit-details-marker]:hidden ${
          allSynced
            ? "border-emerald-300/35 bg-emerald-950/85 text-emerald-100"
            : hasProblem
              ? "border-red-300/35 bg-red-950/85 text-red-100"
              : "border-amber-300/35 bg-slate-950/85 text-amber-100"
        }`}
        aria-label={t("sharedMedia.readinessDetails", "جزئیات همگامی پخش")}
      >
        <Icon className={allSynced ? "" : hasProblem ? "" : "animate-spin"} size={18} aria-hidden />
        <span className="font-semibold">
          {t("sharedMedia.syncedCount", "همگام {{synced}} از {{total}}", {
            synced: summary.synced,
            total: summary.total,
          })}
        </span>
        {summary.buffering > 0 && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
            {t("sharedMedia.bufferingCount", "{{count}} بافر", { count: summary.buffering })}
          </span>
        )}
      </summary>

      <div className="mt-2 max-h-72 w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-white/15 bg-slate-950/95 p-2 shadow-2xl backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-3 px-2 py-1 text-xs text-white/65">
          <span>{t("sharedMedia.readinessReporting", "گزارش‌دهنده: {{count}}", { count: summary.reporting })}</span>
          {summary.unknown > 0 && (
            <span>{t("sharedMedia.readinessUnknown", "نامشخص: {{count}}", { count: summary.unknown })}</span>
          )}
        </div>
        <ul className="space-y-1" aria-label={t("sharedMedia.readinessParticipants", "وضعیت پخش شرکت‌کنندگان")}>
          {entries.map((entry) => {
            const synced = entry.status === "ready" && Math.abs(entry.drift_ms) <= 1_000;
            return (
              <li key={entry.identity} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-white/5 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{entry.displayName}</p>
                  <p className="mt-0.5 text-white/60">
                    {t(`sharedMedia.health.${entry.status}`, entry.status)} · {entry.quality_label || "Auto"}
                  </p>
                </div>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className={synced ? "text-emerald-300" : "text-amber-300"} title={t("sharedMedia.drift", "اختلاف زمانی")}>
                    {entry.drift_ms > 0 ? "+" : ""}{formatSeconds(entry.drift_ms)}
                  </span>
                  <span className="flex items-center gap-1 text-sky-200" title={t("sharedMedia.bufferAhead", "بافر آماده")}>
                    <Activity size={13} aria-hidden />
                    {formatSeconds(entry.buffered_ahead_ms)}
                  </span>
                </div>
              </li>
            );
          })}
          {entries.length === 0 && (
            <li className="px-3 py-5 text-center text-xs text-white/60">
              {t("sharedMedia.readinessWaiting", "در انتظار اولین گزارش پخش…")}
            </li>
          )}
        </ul>
      </div>
    </details>
  );
}

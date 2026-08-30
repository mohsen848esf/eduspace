import type { SharedPlaybackHealth } from "../schemas/shared-media.schema";

export const PLAYBACK_HEALTH_INTERVAL_MS = 2_000;
export const PLAYBACK_HEALTH_STALE_MS = 7_000;
export const SYNCED_DRIFT_LIMIT_MS = 1_000;
export const STRICT_UNHEALTHY_GRACE_MS = 5_000;
export const STRICT_HEALTHY_STABILITY_MS = 3_000;

export interface PlaybackHealthEntry extends SharedPlaybackHealth {
  identity: string;
  displayName: string;
  receivedAt: number;
}

export interface PlaybackReadinessSummary {
  total: number;
  reporting: number;
  synced: number;
  buffering: number;
  recovering: number;
  errors: number;
  unknown: number;
}

export function bufferedAheadMs(video: HTMLVideoElement): number {
  const position = video.currentTime;
  for (let index = 0; index < video.buffered.length; index += 1) {
    if (video.buffered.start(index) <= position && video.buffered.end(index) >= position) {
      return Math.max(0, Math.round((video.buffered.end(index) - position) * 1_000));
    }
  }
  return 0;
}

export function summarizePlaybackReadiness(
  entries: PlaybackHealthEntry[],
  totalParticipants: number,
): PlaybackReadinessSummary {
  const reporting = Math.min(totalParticipants, entries.length);
  return {
    total: totalParticipants,
    reporting,
    synced: entries.filter(
      (entry) => entry.status === "ready" && Math.abs(entry.drift_ms) <= SYNCED_DRIFT_LIMIT_MS,
    ).length,
    buffering: entries.filter((entry) => entry.status === "buffering").length,
    recovering: entries.filter((entry) => entry.status === "recovering").length,
    errors: entries.filter((entry) => entry.status === "error" || entry.status === "gesture").length,
    unknown: Math.max(0, totalParticipants - reporting),
  };
}

export function requiredStrictReadyParticipants(totalParticipants: number): number {
  if (totalParticipants <= 1) return totalParticipants;
  return totalParticipants <= 5
    ? totalParticipants
    : Math.ceil(totalParticipants * 0.9);
}

export function strictReadinessState(summary: PlaybackReadinessSummary) {
  const required = requiredStrictReadyParticipants(summary.total);
  return {
    required,
    shouldBuffer: summary.total > 1 && summary.synced < required,
    canResume: summary.reporting >= required && summary.synced >= required,
  };
}

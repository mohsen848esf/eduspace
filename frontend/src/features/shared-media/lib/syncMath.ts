import type { SharedPlayback } from "../schemas/shared-media.schema";

export const SOFT_DRIFT_THRESHOLD_MS = 250;
export const HARD_DRIFT_THRESHOLD_MS = 1_000;
export const FRONTIER_PAUSE_MARGIN_MS = 1_500;
export const FRONTIER_RESUME_BUFFER_MS = 10_000;

export type DriftCorrection =
  | { kind: "none"; expectedPositionMs: number; playbackRate: number }
  | { kind: "rate"; expectedPositionMs: number; playbackRate: number }
  | { kind: "seek"; expectedPositionMs: number; playbackRate: number };

export type FrontierAction =
  | { kind: "none" }
  | { kind: "buffer"; positionMs: number }
  | { kind: "resume"; positionMs: number };

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export const estimateServerNowMs = (clientNowMs: number, clockOffsetMs: number) =>
  clientNowMs + clockOffsetMs;

export const expectedPlaybackPositionMs = (
  playback: SharedPlayback,
  estimatedServerNowMs: number,
): number => {
  const nominalRate = Number(playback.playback_rate);
  const effectiveAtMs = Date.parse(playback.effective_at);
  const elapsedMs =
    playback.state === "playing"
      ? Math.max(0, estimatedServerNowMs - effectiveAtMs) * nominalRate
      : 0;
  const upperBound = Math.min(
    playback.asset.duration_ms || playback.published_duration_ms,
    playback.published_duration_ms,
  );
  return clamp(playback.anchor_position_ms + elapsedMs, 0, upperBound);
};

export const chooseDriftCorrection = (
  playback: SharedPlayback,
  actualPositionMs: number,
  estimatedServerNowMs: number,
): DriftCorrection => {
  const expectedPositionMs = expectedPlaybackPositionMs(playback, estimatedServerNowMs);
  const nominalRate = Number(playback.playback_rate);
  const driftMs = expectedPositionMs - actualPositionMs;

  if (Math.abs(driftMs) >= HARD_DRIFT_THRESHOLD_MS) {
    return { kind: "seek", expectedPositionMs, playbackRate: nominalRate };
  }
  if (
    playback.state === "playing" &&
    Math.abs(driftMs) >= SOFT_DRIFT_THRESHOLD_MS
  ) {
    return {
      kind: "rate",
      expectedPositionMs,
      playbackRate: clamp(nominalRate + driftMs / 20_000, nominalRate - 0.03, nominalRate + 0.03),
    };
  }
  return { kind: "none", expectedPositionMs, playbackRate: nominalRate };
};

export const chooseFrontierAction = (
  playback: SharedPlayback,
  expectedPositionMs: number,
): FrontierAction => {
  if (
    playback.is_growing &&
    playback.state === "playing" &&
    expectedPositionMs >= Math.max(0, playback.seekable_until_ms - FRONTIER_PAUSE_MARGIN_MS)
  ) {
    return {
      kind: "buffer",
      positionMs: Math.min(expectedPositionMs, playback.seekable_until_ms),
    };
  }
  if (
    playback.state === "buffering" &&
    playback.buffer_reason === "frontier" &&
    (!playback.is_growing || playback.seekable_until_ms - playback.anchor_position_ms >= FRONTIER_RESUME_BUFFER_MS)
  ) {
    return { kind: "resume", positionMs: playback.anchor_position_ms };
  }
  return { kind: "none" };
};

export const calculateClockOffsetMs = (
  serverNow: string,
  requestStartedMs: number,
  responseEndedMs: number,
) => Date.parse(serverNow) - (requestStartedMs + responseEndedMs) / 2;

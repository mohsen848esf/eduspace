import { describe, expect, it } from "vitest";
import type { SharedPlayback } from "../../schemas/shared-media.schema";
import {
  calculateClockOffsetMs,
  chooseDriftCorrection,
  chooseFrontierAction,
  expectedPlaybackPositionMs,
} from "../syncMath";

const playback = {
  state: "playing",
  sync_policy: "continuous",
  buffer_reason: "",
  playback_rate: "1.00",
  effective_at: "2026-08-29T10:00:00.000Z",
  anchor_position_ms: 10_000,
  published_duration_ms: 60_000,
  seekable_until_ms: 60_000,
  is_growing: false,
  asset: { duration_ms: 120_000 },
} as SharedPlayback;

describe("shared playback sync math", () => {
  it("advances from the server-owned effective time", () => {
    expect(expectedPlaybackPositionMs(playback, Date.parse(playback.effective_at) + 2_500)).toBe(12_500);
  });

  it("never advances beyond the published frontier", () => {
    expect(expectedPlaybackPositionMs(playback, Date.parse(playback.effective_at) + 90_000)).toBe(60_000);
  });

  it("uses bounded rate correction for moderate drift and seek for large drift", () => {
    const now = Date.parse(playback.effective_at) + 2_000;
    expect(chooseDriftCorrection(playback, 11_500, now)).toMatchObject({ kind: "rate", playbackRate: 1.025 });
    expect(chooseDriftCorrection(playback, 9_000, now)).toMatchObject({ kind: "seek", expectedPositionMs: 12_000 });
  });

  it("estimates the clock offset at the request midpoint", () => {
    expect(calculateClockOffsetMs("2026-08-29T10:00:01.100Z", Date.parse("2026-08-29T10:00:01.000Z"), Date.parse("2026-08-29T10:00:01.200Z"))).toBe(0);
  });

  it("buffers everyone before a growing stream frontier and resumes with a safe lead", () => {
    const nearFrontier = {
      ...playback,
      is_growing: true,
      seekable_until_ms: 20_000,
      anchor_position_ms: 10_000,
    } as SharedPlayback;
    expect(chooseFrontierAction(nearFrontier, 19_000)).toEqual({
      kind: "buffer",
      positionMs: 19_000,
    });

    const waiting = {
      ...nearFrontier,
      state: "buffering",
      buffer_reason: "frontier",
      anchor_position_ms: 19_000,
      seekable_until_ms: 25_000,
    } as SharedPlayback;
    expect(chooseFrontierAction(waiting, 19_000)).toEqual({ kind: "none" });
    expect(chooseFrontierAction({ ...waiting, seekable_until_ms: 30_000 }, 19_000)).toEqual({
      kind: "resume",
      positionMs: 19_000,
    });
  });
});

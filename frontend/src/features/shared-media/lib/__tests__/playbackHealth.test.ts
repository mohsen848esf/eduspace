import { describe, expect, it } from "vitest";
import type { PlaybackHealthEntry } from "../playbackHealth";
import {
  requiredStrictReadyParticipants,
  strictReadinessState,
  summarizePlaybackReadiness,
} from "../playbackHealth";

const entry = (overrides: Partial<PlaybackHealthEntry>): PlaybackHealthEntry => ({
  v: 1,
  type: "SHARED_PLAYBACK_HEALTH",
  room_code: "MOVIE1",
  playback_id: 9,
  position_ms: 10_000,
  expected_position_ms: 10_000,
  drift_ms: 0,
  buffered_ahead_ms: 8_000,
  status: "ready",
  quality_label: "Auto · 360p",
  emitted_at: 1_788_000_000_000,
  identity: "user",
  displayName: "User",
  receivedAt: 1_788_000_000_000,
  ...overrides,
});

describe("playback readiness summary", () => {
  it("separates synced, buffering, recovering, errors, and missing reporters", () => {
    expect(summarizePlaybackReadiness([
      entry({ identity: "a", drift_ms: 900 }),
      entry({ identity: "b", status: "buffering" }),
      entry({ identity: "c", status: "recovering" }),
      entry({ identity: "d", status: "error" }),
      entry({ identity: "e", drift_ms: 1_500 }),
    ], 6)).toEqual({
      total: 6,
      reporting: 5,
      synced: 1,
      buffering: 1,
      recovering: 1,
      errors: 1,
      unknown: 1,
    });
  });

  it("requires everyone in small rooms and a ninety-percent quorum in larger rooms", () => {
    expect(requiredStrictReadyParticipants(3)).toBe(3);
    expect(requiredStrictReadyParticipants(10)).toBe(9);
    expect(strictReadinessState({
      total: 3, reporting: 3, synced: 2, buffering: 1, recovering: 0, errors: 0, unknown: 0,
    })).toEqual({ required: 3, shouldBuffer: true, canResume: false });
    expect(strictReadinessState({
      total: 10, reporting: 9, synced: 9, buffering: 0, recovering: 0, errors: 0, unknown: 1,
    })).toEqual({ required: 9, shouldBuffer: false, canResume: true });
  });
});

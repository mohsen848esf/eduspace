import { describe, expect, it } from "vitest";
import {
  decodePlaybackInvalidation,
  decodePlaybackHealth,
  encodePlaybackHealth,
  encodePlaybackInvalidation,
} from "../realtime";

describe("shared playback invalidation protocol", () => {
  const message = {
    v: 1 as const,
    type: "SHARED_PLAYBACK_INVALIDATED" as const,
    room_code: "MOVIE1",
    playback_id: 42,
    version: 7,
    emitted_at: "2026-08-29T02:00:00.000Z",
  };

  it("round-trips the small versioned invalidation packet", () => {
    expect(decodePlaybackInvalidation(encodePlaybackInvalidation(message))).toEqual(message);
  });

  it("rejects malformed and future protocol packets", () => {
    expect(decodePlaybackInvalidation("not-json")).toBeNull();
    expect(decodePlaybackInvalidation(JSON.stringify({ ...message, v: 2 }))).toBeNull();
    expect(
      decodePlaybackInvalidation(JSON.stringify({ ...message, type: "PLAY" })),
    ).toBeNull();
  });

  it("round-trips bounded ephemeral playback health packets", () => {
    const health = {
      v: 1 as const,
      type: "SHARED_PLAYBACK_HEALTH" as const,
      room_code: "MOVIE1",
      playback_id: 42,
      position_ms: 12_000,
      expected_position_ms: 12_250,
      drift_ms: 250,
      buffered_ahead_ms: 8_000,
      status: "ready" as const,
      quality_label: "Auto · 720p",
      emitted_at: 1_788_000_000_000,
    };
    expect(decodePlaybackHealth(encodePlaybackHealth(health))).toEqual(health);
    expect(decodePlaybackHealth(JSON.stringify({ ...health, drift_ms: Number.MAX_SAFE_INTEGER }))).toBeNull();
  });
});

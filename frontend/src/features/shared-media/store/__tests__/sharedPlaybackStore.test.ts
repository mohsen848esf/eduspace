import { beforeEach, describe, expect, it } from "vitest";
import type { SharedPlayback } from "../../schemas/shared-media.schema";
import { useSharedPlaybackStore } from "../sharedPlaybackStore";

const playback = (overrides: Partial<SharedPlayback> = {}): SharedPlayback => ({
  id: 10,
  room_id: 1,
  room_code: "MOVIE1",
  asset: {
    public_token: "asset-token",
    title: "Film",
    original_filename: "film.mp4",
    status: "ready",
    content_type: "video/mp4",
    container: "mp4",
    video_codec: "h264",
    audio_codec: "aac",
    duration_ms: 7_200_000,
    size_bytes: 1_000_000_000,
    width: 1920,
    height: 1080,
    failure_code: "",
    retention_policy: "manual",
    expires_at: null,
    is_deleted: false,
    created_at: "2026-08-29T01:00:00.000Z",
    updated_at: "2026-08-29T01:00:00.000Z",
    uploader_name: "Host",
    can_start_playback: true,
    renditions: [],
  },
  controller_identity: "host",
  resumed_from_id: null,
  state: "paused",
  sync_policy: "continuous",
  buffer_reason: "",
  version: 1,
  anchor_position_ms: 0,
  expected_position_ms: 0,
  effective_at: "2026-08-29T02:00:00.000Z",
  playback_rate: "1.00",
  published_duration_ms: 7_200_000,
  seekable_until_ms: 7_200_000,
  is_growing: false,
  server_now: "2026-08-29T02:00:00.000Z",
  started_at: "2026-08-29T01:59:00.000Z",
  ended_at: null,
  updated_at: "2026-08-29T02:00:00.000Z",
  ...overrides,
});

describe("shared playback authoritative store", () => {
  beforeEach(() => useSharedPlaybackStore.getState().reset());

  it("accepts a newer version and rejects a delayed older version", () => {
    const store = useSharedPlaybackStore.getState();
    expect(store.applyPlayback("MOVIE1", playback({ version: 3 }))).toBe(true);
    expect(
      useSharedPlaybackStore.getState().applyPlayback(
        "MOVIE1",
        playback({ version: 2, server_now: "2026-08-29T02:00:01.000Z" }),
      ),
    ).toBe(false);
    expect(useSharedPlaybackStore.getState().playback?.version).toBe(3);
  });

  it("rejects a cross-room payload", () => {
    expect(useSharedPlaybackStore.getState().applyPlayback("OTHER1", playback())).toBe(false);
    expect(useSharedPlaybackStore.getState().playback).toBeNull();
  });

  it("does not let an older empty snapshot erase newer state", () => {
    useSharedPlaybackStore.getState().applyPlayback(
      "MOVIE1",
      playback({ server_now: "2026-08-29T02:00:05.000Z" }),
    );
    expect(
      useSharedPlaybackStore.getState().applySnapshot("MOVIE1", {
        playback: null,
        server_now: "2026-08-29T02:00:04.000Z",
      }),
    ).toBe(false);
    expect(useSharedPlaybackStore.getState().playback?.id).toBe(10);
  });

  it("clears state from a newer authoritative empty snapshot", () => {
    useSharedPlaybackStore.getState().applyPlayback("MOVIE1", playback());
    expect(
      useSharedPlaybackStore.getState().applySnapshot("MOVIE1", {
        playback: null,
        server_now: "2026-08-29T02:00:01.000Z",
      }),
    ).toBe(true);
    expect(useSharedPlaybackStore.getState().playback).toBeNull();
  });
});

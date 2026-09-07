import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Recording } from "../../api/recordings.api";
import { useRecordingElapsed } from "../useRecordingElapsed";

const recording = (token: string): Recording => ({
  public_token: token,
  status: "recording",
  quality: "720p",
  duration_seconds: 0,
  size_bytes: 0,
  started_at: new Date("2026-09-06T10:00:00Z").toISOString(),
  completed_at: null,
  is_published: false,
  segment_count: 0,
});

describe("useRecordingElapsed", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the same timer when recording controls are unmounted and opened again", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T10:00:00Z"));
    const active = recording("persistent-timer-token");
    const first = renderHook(() => useRecordingElapsed(active));

    act(() => vi.advanceTimersByTime(5000));
    expect(first.result.current).toBe(5);
    first.unmount();

    act(() => vi.advanceTimersByTime(3000));
    const reopened = renderHook(() => useRecordingElapsed(active));
    expect(reopened.result.current).toBe(8);
    reopened.unmount();
  });
});

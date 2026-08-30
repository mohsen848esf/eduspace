import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Room } from "livekit-client";
import { sharedMediaApi } from "../../api/shared-media.api";
import type { SharedPlayback } from "../../schemas/shared-media.schema";
import { useSharedPlaybackStore } from "../../store/sharedPlaybackStore";
import { SharedMediaPlayer } from "../SharedMediaPlayer";

const hls = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => void>(),
  attachMedia: vi.fn(),
  loadSource: vi.fn(),
  destroy: vi.fn(),
  recoverMediaError: vi.fn(),
  startLoad: vi.fn(),
  instance: null as { nextLevel: number; currentLevel: number } | null,
}));

vi.mock("hls.js", () => {
  class HlsMock {
    static isSupported = () => true;
    static Events = {
      MEDIA_ATTACHED: "mediaAttached",
      MANIFEST_PARSED: "manifestParsed",
      ERROR: "error",
    };
    static ErrorTypes = {
      NETWORK_ERROR: "networkError",
      MEDIA_ERROR: "mediaError",
    };
    on(event: string, handler: (...args: unknown[]) => void) {
      hls.handlers.set(event, handler);
    }
    attachMedia = hls.attachMedia;
    loadSource = hls.loadSource;
    destroy = hls.destroy;
    recoverMediaError = hls.recoverMediaError;
    startLoad = hls.startLoad;
    levels = [
      { height: 360, bitrate: 700_000 },
      { height: 360, bitrate: 700_000 },
      { height: 720, bitrate: 2_000_000 },
      { height: 900, bitrate: 3_000_000 },
    ];
    currentLevel = -1;
    nextLevel = -1;
    constructor() {
      hls.instance = this;
    }
  }
  return { default: HlsMock };
});

vi.mock("../../api/shared-media.api", () => ({
  sharedMediaApi: {
    getPlaybackDelivery: vi.fn().mockResolvedValue({
      playback_id: 7,
      asset_public_token: "asset-token",
      master_url: "http://127.0.0.1:8000/api/media/playback/master.m3u8?ticket=test",
      expires_in_seconds: 900,
    }),
    commandPlayback: vi.fn(),
    getSnapshot: vi.fn(),
  },
}));

const playback = {
  id: 7,
  room_id: 1,
  room_code: "ROOM1",
  state: "idle",
  sync_policy: "continuous",
  buffer_reason: "",
  version: 1,
  server_now: "2026-08-29T10:00:00Z",
  effective_at: "2026-08-29T10:00:00Z",
  started_at: "2026-08-29T10:00:00Z",
  updated_at: "2026-08-29T10:00:00Z",
  published_duration_ms: 90_000,
  seekable_until_ms: 60_000,
  is_growing: true,
  asset: {
    public_token: "asset-token",
    title: "Test film",
    status: "ready",
    renditions: [
      { label: "progressive", status: "ready", width: 640, height: 360, bitrate_bps: 700_000, published_duration_ms: 90_000, is_default: false },
      { label: "360p", status: "ready", width: 640, height: 360, bitrate_bps: 700_000, published_duration_ms: 90_000, is_default: false },
      { label: "720p", status: "ready", width: 1280, height: 720, bitrate_bps: 2_000_000, published_duration_ms: 90_000, is_default: true },
      { label: "source", status: "ready", width: 1600, height: 900, bitrate_bps: 3_000_000, published_duration_ms: 90_000, is_default: false },
    ],
  },
} as SharedPlayback;

const room = {
  localParticipant: {
    identity: "host",
    name: "Host",
    publishData: vi.fn().mockResolvedValue(undefined),
  },
  remoteParticipants: new Map(),
  on: vi.fn(),
  off: vi.fn(),
} as unknown as Room;

const revealControls = () => {
  fireEvent.pointerEnter(screen.getByTestId("shared-media-stage"), { pointerType: "mouse" });
};

describe("SharedMediaPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hls.handlers.clear();
    hls.instance = null;
    useSharedPlaybackStore.getState().reset();
    useSharedPlaybackStore.getState().applyPlayback("ROOM1", playback);
    vi.mocked(sharedMediaApi.commandPlayback).mockResolvedValue({
      ...playback,
      version: 2,
      sync_policy: "strict",
    });
  });

  it("attaches MediaSource before loading the signed HLS manifest", async () => {
    render(<SharedMediaPlayer room={room} roomCode="ROOM1" canModerate />);

    await waitFor(() => expect(hls.attachMedia).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent("در حال دریافت جریان ویدئو");

    act(() => hls.handlers.get("mediaAttached")?.());
    expect(hls.loadSource).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/media/playback/master.m3u8?ticket=test",
    );

    act(() => hls.handlers.get("manifestParsed")?.());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("recovers fatal network errors automatically before showing manual retry", async () => {
    render(<SharedMediaPlayer room={room} roomCode="ROOM1" canModerate />);
    await waitFor(() => expect(hls.attachMedia).toHaveBeenCalledOnce());

    act(() => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        hls.handlers.get("error")?.({}, {
          fatal: true,
          type: "networkError",
        });
      }
    });

    expect(hls.startLoad).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("button", { name: "تلاش دوباره" })).toBeVisible();
  });

  it("offers local quality and volume controls after the manifest loads", async () => {
    render(<SharedMediaPlayer room={room} roomCode="ROOM1" canModerate />);
    await waitFor(() => expect(hls.attachMedia).toHaveBeenCalledOnce());

    act(() => hls.handlers.get("manifestParsed")?.());
    revealControls();

    const quality = screen.getByRole("combobox", { name: "کیفیت ویدئو" });
    expect(quality).toHaveTextContent("720p");
    expect(quality).toHaveTextContent("900p");
    expect(screen.getAllByRole("option", { name: "360p" })).toHaveLength(1);
    expect(screen.getByRole("slider", { name: "صدای ویدئو" })).toHaveValue("100");
  });

  it("shows authoritative quality options to viewers before the HLS manifest event", () => {
    render(<SharedMediaPlayer room={room} roomCode="ROOM1" canModerate={false} />);
    revealControls();

    const quality = screen.getByRole("combobox", { name: "کیفیت ویدئو" });
    expect(quality).toHaveTextContent("360p");
    expect(quality).toHaveTextContent("720p");
    expect(quality).toHaveTextContent("900p");
    expect(screen.getAllByRole("option", { name: "360p" })).toHaveLength(1);
  });

  it("switches quality without flushing the current playback buffer", async () => {
    render(<SharedMediaPlayer room={room} roomCode="ROOM1" canModerate={false} />);
    await waitFor(() => expect(hls.attachMedia).toHaveBeenCalledOnce());
    act(() => hls.handlers.get("manifestParsed")?.());
    revealControls();

    fireEvent.change(screen.getByRole("combobox", { name: "کیفیت ویدئو" }), {
      target: { value: "720" },
    });

    expect(hls.instance?.nextLevel).toBe(2);
    expect(hls.instance?.currentLevel).toBe(-1);
  });

  it("keeps the playback heading on one ellipsized line with its full tooltip", () => {
    render(<SharedMediaPlayer room={room} roomCode="ROOM1" canModerate />);
    revealControls();

    const heading = screen.getByTitle(/Test film/);
    expect(heading.querySelector("p")).toHaveClass("truncate", "whitespace-nowrap");
  });

  it("uses wrapped touch-friendly control groups instead of horizontal scrolling on mobile", () => {
    render(<SharedMediaPlayer room={room} roomCode="ROOM1" canModerate />);
    revealControls();

    const controls = screen.getByTestId("shared-media-controls");
    expect(controls).toHaveClass("flex-col", "overflow-hidden", "md:flex-row");
    expect(controls).not.toHaveClass("overflow-x-auto");
    expect(screen.getByTestId("shared-media-primary-controls")).toHaveClass("justify-center", "gap-2", "md:contents");
    expect(screen.getByTestId("shared-media-secondary-controls")).toHaveClass("flex-wrap", "gap-2", "md:contents");
  });

  it("shows a timeline and limits host seeking to the safe uploaded frontier", async () => {
    render(<SharedMediaPlayer room={room} roomCode="ROOM1" canModerate />);

    const timeline = screen.getByRole("slider", { name: "خط زمانی ویدئو" });
    expect(timeline).toBeEnabled();
    expect(timeline).toHaveAttribute("max", "60000");
    expect(screen.getByText("1:30")).toBeVisible();
  });

  it("changes the authoritative synchronization policy without sending a local position", async () => {
    render(<SharedMediaPlayer room={room} roomCode="ROOM1" canModerate moderatorIdentities={["host"]} />);
    revealControls();

    fireEvent.change(screen.getByRole("combobox", { name: "سیاست همگامی" }), {
      target: { value: "strict" },
    });

    await waitFor(() => expect(sharedMediaApi.commandPlayback).toHaveBeenCalledWith(
      "ROOM1",
      expect.objectContaining({
        command: "SET_SYNC_POLICY",
        expected_version: 1,
        position_ms: undefined,
        sync_policy: "strict",
      }),
    ));
  });

  it("keeps only the timeline visible until the viewer interacts with the video", () => {
    render(<SharedMediaPlayer room={room} roomCode="ROOM1" canModerate />);

    const stage = screen.getByTestId("shared-media-stage");
    const controlDetails = screen.getByTestId("shared-media-control-details");
    expect(screen.getByRole("slider", { name: "خط زمانی ویدئو" })).toBeVisible();
    expect(controlDetails).toHaveAttribute("data-state", "hidden");
    expect(controlDetails).toHaveClass("grid-rows-[0fr]", "translate-y-2", "opacity-0", "duration-150", "ease-in");
    expect(controlDetails).toHaveAttribute("inert");
    expect(screen.getByTestId("shared-playback-readiness-chrome")).toHaveClass("opacity-0", "pointer-events-none");

    fireEvent.pointerEnter(stage, { pointerType: "mouse" });
    expect(controlDetails).toHaveAttribute("data-state", "visible");
    expect(controlDetails).toHaveClass("grid-rows-[1fr]", "translate-y-0", "opacity-100", "duration-200", "ease-out");
    expect(controlDetails).not.toHaveAttribute("inert");
    expect(screen.getByTestId("shared-playback-readiness-chrome")).toHaveClass("opacity-100");

    fireEvent.pointerLeave(stage, { pointerType: "mouse" });
    expect(controlDetails).toHaveAttribute("data-state", "hidden");
    expect(screen.getByRole("slider", { name: "خط زمانی ویدئو" })).toBeVisible();
  });

  it("pins the expanded controls below the video until the viewer unpins them", () => {
    render(<SharedMediaPlayer room={room} roomCode="ROOM1" canModerate />);
    revealControls();

    fireEvent.click(screen.getByRole("button", { name: "ثابت کردن نوار زیر ویدئو" }));
    const toolbar = screen.getByTestId("shared-media-toolbar");
    expect(toolbar).toHaveAttribute("data-pinned", "true");
    expect(toolbar).toHaveClass("relative", "shrink-0");

    fireEvent.pointerLeave(screen.getByTestId("shared-media-stage"), { pointerType: "mouse" });
    expect(screen.getByTestId("shared-media-controls")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "نمایش نوار روی ویدئو" }));
    expect(toolbar).toHaveAttribute("data-pinned", "false");
  });

  it("lets touch users reveal and dismiss the controls by tapping the video", () => {
    render(<SharedMediaPlayer room={room} roomCode="ROOM1" canModerate={false} />);
    const video = screen.getByLabelText("Test film");

    fireEvent.pointerDown(video, { pointerType: "touch" });
    expect(screen.getByTestId("shared-media-control-details")).toHaveAttribute("data-state", "visible");
    fireEvent.pointerDown(video, { pointerType: "touch" });
    expect(screen.getByTestId("shared-media-control-details")).toHaveAttribute("data-state", "hidden");
  });

  it("uses the browser fullscreen state to switch icon and exit on the second click", async () => {
    let fullscreenElement: Element | null = null;
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: vi.fn(async () => {
        fullscreenElement = null;
        document.dispatchEvent(new Event("fullscreenchange"));
      }),
    });
    render(<SharedMediaPlayer room={room} roomCode="ROOM1" canModerate />);
    revealControls();
    const stage = screen.getByTestId("shared-media-stage");
    const requestFullscreen = vi.fn(async () => {
      fullscreenElement = stage;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    Object.defineProperty(stage, "requestFullscreen", { configurable: true, value: requestFullscreen });

    fireEvent.click(screen.getByRole("button", { name: "تمام‌صفحه" }));
    await waitFor(() => expect(requestFullscreen).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "خروج از تمام‌صفحه" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "خروج از تمام‌صفحه" }));
    await waitFor(() => expect(document.exitFullscreen).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "تمام‌صفحه" })).toBeVisible();
  });
});

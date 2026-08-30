import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Room } from "livekit-client";
import { sharedMediaApi } from "../../api/shared-media.api";
import type { MediaAsset, SharedPlayback } from "../../schemas/shared-media.schema";
import { useSharedPlaybackStore } from "../../store/sharedPlaybackStore";
import { SharedMediaLibraryModal } from "../SharedMediaLibraryModal";

vi.mock("../../api/shared-media.api", () => ({
  sharedMediaApi: {
    listAssets: vi.fn(),
    getHistory: vi.fn(),
    openPlayback: vi.fn(),
    deleteAsset: vi.fn(),
  },
}));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const asset = {
  public_token: "asset-token",
  title: "Cinema test",
  status: "ready",
  size_bytes: 50 * 1024 ** 2,
  can_start_playback: true,
  failure_code: "",
} as MediaAsset;

const playback = {
  id: 9,
  room_code: "room-1",
  version: 1,
  server_now: "2026-08-29T10:00:00Z",
  asset,
} as SharedPlayback;

const publishData = vi.fn().mockResolvedValue(undefined);
const room = { localParticipant: { publishData } } as unknown as Room;

describe("SharedMediaLibraryModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSharedPlaybackStore.getState().reset();
    vi.mocked(sharedMediaApi.listAssets).mockResolvedValue({ count: 1, results: [asset] });
    vi.mocked(sharedMediaApi.getHistory).mockResolvedValue({ count: 0, results: [] });
    vi.mocked(sharedMediaApi.openPlayback).mockResolvedValue(playback);
    vi.mocked(sharedMediaApi.deleteAsset).mockResolvedValue(undefined);
  });

  it("starts a ready asset through REST then emits only an invalidation", async () => {
    const onOpenChange = vi.fn();
    render(<SharedMediaLibraryModal open onOpenChange={onOpenChange} room={room} roomCode="room-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "شروع" }));

    await waitFor(() => expect(sharedMediaApi.openPlayback).toHaveBeenCalledWith("room-1", {
      asset_public_token: "asset-token",
      resumed_from_id: null,
    }));
    expect(useSharedPlaybackStore.getState().playback?.id).toBe(9);
    expect(publishData).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("requires confirmation before manually deleting an asset", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<SharedMediaLibraryModal open onOpenChange={vi.fn()} room={room} roomCode="room-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "حذف ویدئو" }));

    await waitFor(() => expect(sharedMediaApi.deleteAsset).toHaveBeenCalledWith("asset-token"));
    expect(screen.queryByText("Cinema test")).not.toBeInTheDocument();
  });

  it("enables start without reopening the room when processing becomes playable", async () => {
    vi.useFakeTimers();
    const processing = {
      ...asset,
      status: "processing",
      can_start_playback: false,
    } as MediaAsset;
    vi.mocked(sharedMediaApi.listAssets)
      .mockResolvedValueOnce({ count: 1, results: [processing] })
      .mockResolvedValue({ count: 1, results: [asset] });

    render(<SharedMediaLibraryModal open onOpenChange={vi.fn()} room={room} roomCode="room-1" />);
    await act(async () => Promise.resolve());
    expect(screen.getByRole("button", { name: "شروع" })).toBeDisabled();

    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(screen.getByRole("button", { name: "شروع" })).toBeEnabled();
    vi.useRealTimers();
  });
});

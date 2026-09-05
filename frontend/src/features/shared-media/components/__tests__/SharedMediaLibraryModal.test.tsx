import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Room } from "livekit-client";
import { sharedMediaApi } from "../../api/shared-media.api";
import { resumeMultipartUpload } from "../../lib/multipartUpload";
import type { MediaAsset, SharedPlayback } from "../../schemas/shared-media.schema";
import { useSharedPlaybackStore } from "../../store/sharedPlaybackStore";
import { SharedMediaLibraryModal } from "../SharedMediaLibraryModal";

vi.mock("../../api/shared-media.api", () => ({
  sharedMediaApi: {
    listAssets: vi.fn(),
    getHistory: vi.fn(),
    getSnapshot: vi.fn(),
    openPlayback: vi.fn(),
    deleteAsset: vi.fn(),
    createAsset: vi.fn(),
    getProgressiveUploadCapability: vi.fn(),
    initiateUpload: vi.fn(),
  },
}));
vi.mock("../../lib/multipartUpload", () => ({ resumeMultipartUpload: vi.fn() }));
vi.mock("../../lib/progressiveUpload", () => ({ resumeProgressiveUpload: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const UPLOAD_DRAFT_KEY = "eduspace:shared-media-upload:v1";

const makeVideoFile = () =>
  new File([new Uint8Array([1, 2, 3])], "movie.webm", { type: "video/webm" });

const selectFile = (file: File) => {
  // Modal renders into a Radix portal attached to document.body, outside
  // the render() container, so query the whole document.
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
};

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
    localStorage.clear();
    useSharedPlaybackStore.getState().reset();
    vi.mocked(sharedMediaApi.listAssets).mockResolvedValue({ count: 1, results: [asset] });
    vi.mocked(sharedMediaApi.getHistory).mockResolvedValue({ count: 0, results: [] });
    vi.mocked(sharedMediaApi.getSnapshot).mockResolvedValue({ playback: null, server_now: "2026-08-29T10:00:00Z" });
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

  it("reuses the current room playback instead of opening a duplicate session", async () => {
    vi.mocked(sharedMediaApi.getSnapshot).mockResolvedValue({
      playback,
      server_now: "2026-08-29T10:00:00Z",
    });
    const onOpenChange = vi.fn();
    render(<SharedMediaLibraryModal open onOpenChange={onOpenChange} room={room} roomCode="room-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "شروع" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(sharedMediaApi.openPlayback).not.toHaveBeenCalled();
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

  it("creates a new asset and uploads when there is no saved draft", async () => {
    vi.mocked(sharedMediaApi.createAsset).mockResolvedValue({ public_token: "new-asset" } as MediaAsset);
    vi.mocked(sharedMediaApi.initiateUpload).mockResolvedValue({ public_token: "new-upload" } as never);
    vi.mocked(resumeMultipartUpload).mockResolvedValue(undefined as never);

    render(
      <SharedMediaLibraryModal open onOpenChange={vi.fn()} room={room} roomCode="room-1" />,
    );
    selectFile(makeVideoFile());

    await waitFor(() => expect(resumeMultipartUpload).toHaveBeenCalledWith(
      expect.objectContaining({ assetToken: "new-asset", uploadToken: "new-upload" }),
    ));
    expect(sharedMediaApi.createAsset).toHaveBeenCalledOnce();
    expect(localStorage.getItem(UPLOAD_DRAFT_KEY)).toBeNull();
  });

  it("falls back to a fresh upload when the saved draft's session no longer exists", async () => {
    const file = makeVideoFile();
    localStorage.setItem(UPLOAD_DRAFT_KEY, JSON.stringify({
      assetToken: "stale-asset",
      uploadToken: "stale-upload",
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
      mode: "multipart",
    }));

    const notFound = Object.assign(new Error("Not Found"), {
      isAxiosError: true,
      response: { status: 404 },
    });
    vi.mocked(resumeMultipartUpload)
      .mockRejectedValueOnce(notFound)
      .mockResolvedValueOnce(undefined as never);
    vi.mocked(sharedMediaApi.createAsset).mockResolvedValue({ public_token: "fresh-asset" } as MediaAsset);
    vi.mocked(sharedMediaApi.initiateUpload).mockResolvedValue({ public_token: "fresh-upload" } as never);

    render(
      <SharedMediaLibraryModal open onOpenChange={vi.fn()} room={room} roomCode="room-1" />,
    );
    selectFile(file);

    await waitFor(() => expect(resumeMultipartUpload).toHaveBeenCalledTimes(2));
    expect(resumeMultipartUpload).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ assetToken: "stale-asset", uploadToken: "stale-upload" }),
    );
    expect(resumeMultipartUpload).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ assetToken: "fresh-asset", uploadToken: "fresh-upload" }),
    );
    expect(sharedMediaApi.createAsset).toHaveBeenCalledOnce();
    expect(localStorage.getItem(UPLOAD_DRAFT_KEY)).toBeNull();
  });

  it("does not retry a fresh (non-resumed) upload that fails with a 404", async () => {
    vi.mocked(sharedMediaApi.createAsset).mockResolvedValue({ public_token: "new-asset" } as MediaAsset);
    vi.mocked(sharedMediaApi.initiateUpload).mockResolvedValue({ public_token: "new-upload" } as never);
    const notFound = Object.assign(new Error("Not Found"), {
      isAxiosError: true,
      response: { status: 404 },
    });
    vi.mocked(resumeMultipartUpload).mockRejectedValue(notFound);

    render(
      <SharedMediaLibraryModal open onOpenChange={vi.fn()} room={room} roomCode="room-1" />,
    );
    selectFile(makeVideoFile());

    await waitFor(() => expect(resumeMultipartUpload).toHaveBeenCalledTimes(1));
    await act(async () => Promise.resolve());
    expect(resumeMultipartUpload).toHaveBeenCalledTimes(1);
    expect(sharedMediaApi.createAsset).toHaveBeenCalledOnce();
  });
});

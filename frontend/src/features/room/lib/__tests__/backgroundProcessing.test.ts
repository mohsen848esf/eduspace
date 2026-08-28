import type {
  LocalParticipant,
  LocalTrackPublication,
  LocalVideoTrack,
} from "livekit-client";
import { describe, expect, it, vi } from "vitest";

import {
  observePublishedCameraTracks,
  replaceBackgroundProcessor,
  supportsBackgroundProcessing,
  type BackgroundProcessorInstance,
  type BackgroundProcessingCapabilities,
} from "../backgroundProcessing";

const supportedCapabilities: BackgroundProcessingCapabilities = {
  hasModernTrackApi: true,
  hasCanvasFallback: false,
  hasOffscreenCanvas: true,
  hasVideoFrame: true,
  hasCreateImageBitmap: true,
  hasWebGl2: true,
};

describe("supportsBackgroundProcessing", () => {
  it("accepts the modern track processing path", () => {
    expect(supportsBackgroundProcessing(supportedCapabilities)).toBe(true);
  });

  it("accepts the canvas fallback when the modern API is unavailable", () => {
    expect(
      supportsBackgroundProcessing({
        ...supportedCapabilities,
        hasModernTrackApi: false,
        hasCanvasFallback: true,
      }),
    ).toBe(true);
  });

  it.each([
    "hasOffscreenCanvas",
    "hasVideoFrame",
    "hasCreateImageBitmap",
    "hasWebGl2",
  ] as const)("rejects missing %s support", (capability) => {
    expect(
      supportsBackgroundProcessing({
        ...supportedCapabilities,
        [capability]: false,
      }),
    ).toBe(false);
  });

  it("rejects browsers without either track processing path", () => {
    expect(
      supportsBackgroundProcessing({
        ...supportedCapabilities,
        hasModernTrackApi: false,
        hasCanvasFallback: false,
      }),
    ).toBe(false);
  });
});

function makeProcessor() {
  return {
    destroy: vi.fn(async () => undefined),
  } as unknown as BackgroundProcessorInstance;
}

function makeTrack() {
  return {
    stopProcessor: vi.fn(async () => undefined),
    setProcessor: vi.fn(async () => undefined),
  } as unknown as LocalVideoTrack;
}

describe("replaceBackgroundProcessor", () => {
  it("deduplicates the same background request for one camera track", async () => {
    const track = makeTrack();
    const processor = makeProcessor();
    const factory = vi.fn(async () => processor);

    const first = replaceBackgroundProcessor(track, "office", factory);
    const duplicate = replaceBackgroundProcessor(track, "office", factory);

    expect(duplicate).toBe(first);
    await expect(first).resolves.toBe(true);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(track.stopProcessor).toHaveBeenCalledTimes(1);
    expect(track.setProcessor).toHaveBeenCalledTimes(1);
  });

  it("discards stale processor work when a newer background wins", async () => {
    const track = makeTrack();
    const staleProcessor = makeProcessor();
    const latestProcessor = makeProcessor();
    let releaseStale: ((processor: BackgroundProcessorInstance) => void) | undefined;
    const staleFactory = vi.fn(
      () => new Promise<BackgroundProcessorInstance>((resolve) => {
        releaseStale = resolve;
      }),
    );

    const staleRequest = replaceBackgroundProcessor(track, "office", staleFactory);
    await vi.waitFor(() => expect(staleFactory).toHaveBeenCalledTimes(1));
    const latestRequest = replaceBackgroundProcessor(
      track,
      "nature",
      async () => latestProcessor,
    );
    releaseStale?.(staleProcessor);

    await expect(staleRequest).resolves.toBe(false);
    await expect(latestRequest).resolves.toBe(true);
    expect(staleProcessor.destroy).toHaveBeenCalledTimes(1);
    expect(track.setProcessor).toHaveBeenCalledTimes(1);
    expect(track.setProcessor).toHaveBeenCalledWith(latestProcessor);
  });
});

describe("observePublishedCameraTracks", () => {
  it("applies once to an existing track and once to each replacement", async () => {
    const firstTrack = makeTrack();
    const secondTrack = makeTrack();
    let currentTrack = firstTrack;
    let publishedHandler: ((publication: LocalTrackPublication) => void) | undefined;
    const participant = {
      getTrackPublication: vi.fn(() => ({ track: currentTrack })),
      on: vi.fn((_event, handler) => {
        publishedHandler = handler;
      }),
      off: vi.fn(),
    } as unknown as Pick<LocalParticipant, "getTrackPublication" | "on" | "off">;
    const apply = vi.fn(async () => true);

    const dispose = observePublishedCameraTracks(participant, apply);
    await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(1));

    publishedHandler?.({ source: "camera", track: firstTrack } as LocalTrackPublication);
    await Promise.resolve();
    expect(apply).toHaveBeenCalledTimes(1);

    currentTrack = secondTrack;
    publishedHandler?.({ source: "camera", track: secondTrack } as LocalTrackPublication);
    await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(2));

    dispose();
    expect(participant.off).toHaveBeenCalledTimes(1);
  });
});

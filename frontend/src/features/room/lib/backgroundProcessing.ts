import {
  ParticipantEvent,
  Track,
  type LocalParticipant,
  type LocalTrackPublication,
  type LocalVideoTrack,
} from "livekit-client";

export interface BackgroundProcessingCapabilities {
  hasModernTrackApi: boolean;
  hasCanvasFallback: boolean;
  hasOffscreenCanvas: boolean;
  hasVideoFrame: boolean;
  hasCreateImageBitmap: boolean;
  hasWebGl2: boolean;
}

export type BackgroundProcessorInstance = ReturnType<
  typeof import("@livekit/track-processors").BackgroundProcessor
>;

type BackgroundProcessorFactory = () => Promise<BackgroundProcessorInstance>;

interface TrackProcessorOperation {
  version: number;
  requestedKey: string | null;
  operation: Promise<boolean>;
}

const trackProcessorOperations = new WeakMap<
  LocalVideoTrack,
  TrackProcessorOperation
>();

type CameraTrackParticipant = Pick<
  LocalParticipant,
  "getTrackPublication" | "on" | "off"
>;

type BackgroundProcessorOptions = Parameters<
  typeof import("@livekit/track-processors").BackgroundProcessor
>[0];

function getBrowserCapabilities(): BackgroundProcessingCapabilities {
  const browser = globalThis as typeof globalThis & {
    MediaStreamTrackGenerator?: unknown;
    MediaStreamTrackProcessor?: unknown;
    OffscreenCanvas?: unknown;
    VideoFrame?: unknown;
  };
  const hasCanvas = typeof HTMLCanvasElement !== "undefined";
  const hasVideoFrame = typeof browser.VideoFrame !== "undefined";
  let hasWebGl2 = false;

  if (typeof document !== "undefined") {
    hasWebGl2 = Boolean(document.createElement("canvas").getContext("webgl2"));
  }

  return {
    hasModernTrackApi:
      typeof browser.MediaStreamTrackGenerator !== "undefined" &&
      typeof browser.MediaStreamTrackProcessor !== "undefined",
    hasCanvasFallback:
      hasCanvas &&
      hasVideoFrame &&
      "captureStream" in HTMLCanvasElement.prototype,
    hasOffscreenCanvas: typeof browser.OffscreenCanvas !== "undefined",
    hasVideoFrame,
    hasCreateImageBitmap: typeof globalThis.createImageBitmap !== "undefined",
    hasWebGl2,
  };
}

export function supportsBackgroundProcessing(
  capabilities: BackgroundProcessingCapabilities = getBrowserCapabilities(),
): boolean {
  const canTransformBackground =
    capabilities.hasOffscreenCanvas &&
    capabilities.hasVideoFrame &&
    capabilities.hasCreateImageBitmap &&
    capabilities.hasWebGl2;

  return (
    canTransformBackground &&
    (capabilities.hasModernTrackApi || capabilities.hasCanvasFallback)
  );
}

export async function createBackgroundProcessor(
  options: BackgroundProcessorOptions,
): Promise<BackgroundProcessorInstance> {
  const { BackgroundProcessor } = await import("@livekit/track-processors");
  return BackgroundProcessor(options);
}

/**
 * Serializes processor replacement for a camera track. React effects and UI
 * controls can request the same background concurrently during room startup;
 * duplicate requests share one operation and newer choices supersede stale
 * work before it can be attached to the track.
 */
export function replaceBackgroundProcessor(
  track: LocalVideoTrack,
  requestKey: string,
  createProcessor: BackgroundProcessorFactory | null,
): Promise<boolean> {
  let state = trackProcessorOperations.get(track);
  if (!state) {
    state = {
      version: 0,
      requestedKey: null,
      operation: Promise.resolve(false),
    };
    trackProcessorOperations.set(track, state);
  }

  if (state.requestedKey === requestKey) {
    return state.operation;
  }

  const version = ++state.version;
  state.requestedKey = requestKey;

  const operation = state.operation
    .catch(() => false)
    .then(async () => {
      if (version !== state.version) return false;

      await track.stopProcessor();
      if (version !== state.version) return false;
      if (!createProcessor) return true;

      const processor = await createProcessor();
      if (version !== state.version) {
        await processor.destroy();
        return false;
      }

      await track.setProcessor(processor);
      return version === state.version;
    });

  state.operation = operation.catch((error: unknown) => {
    if (version === state.version) {
      state.requestedKey = null;
    }
    throw error;
  });

  return state.operation;
}

/**
 * Applies setup once for every camera track published by a local participant.
 * The immediate check covers tracks published before React mounted the effect;
 * the event covers tracks created later or recreated after a camera restart.
 */
export function observePublishedCameraTracks(
  participant: CameraTrackParticipant,
  onCameraTrack: (track: LocalVideoTrack) => Promise<boolean>,
): () => void {
  let disposed = false;
  const appliedTracks = new WeakSet<LocalVideoTrack>();
  const pendingTracks = new WeakSet<LocalVideoTrack>();

  const apply = (publication?: LocalTrackPublication) => {
    const cameraPublication = publication?.source === Track.Source.Camera
      ? publication
      : participant.getTrackPublication(Track.Source.Camera);
    const cameraTrack = cameraPublication?.track as LocalVideoTrack | undefined;
    if (
      disposed ||
      !cameraTrack ||
      appliedTracks.has(cameraTrack) ||
      pendingTracks.has(cameraTrack)
    ) {
      return;
    }

    pendingTracks.add(cameraTrack);
    void onCameraTrack(cameraTrack)
      .then((applied) => {
        if (!disposed && applied) appliedTracks.add(cameraTrack);
      })
      .finally(() => {
        pendingTracks.delete(cameraTrack);
      });
  };

  const handleTrackPublished = (publication: LocalTrackPublication) => {
    apply(publication);
  };

  participant.on(ParticipantEvent.LocalTrackPublished, handleTrackPublished);
  apply();

  return () => {
    disposed = true;
    participant.off(ParticipantEvent.LocalTrackPublished, handleTrackPublished);
  };
}

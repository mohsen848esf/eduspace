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

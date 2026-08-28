import { describe, expect, it } from "vitest";

import {
  supportsBackgroundProcessing,
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

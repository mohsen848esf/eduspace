import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useVisualViewportBounds } from "../useVisualViewportBounds";

const originalVisualViewport = Object.getOwnPropertyDescriptor(window, "visualViewport");

afterEach(() => {
  if (originalVisualViewport) {
    Object.defineProperty(window, "visualViewport", originalVisualViewport);
  } else {
    Reflect.deleteProperty(window, "visualViewport");
  }
});

describe("useVisualViewportBounds", () => {
  it("tracks the visible WebView area instead of the layout viewport", () => {
    const viewport = new EventTarget();
    Object.assign(viewport, { height: 640, offsetLeft: 4, offsetTop: 72, width: 367 });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });

    const { result } = renderHook(() => useVisualViewportBounds());
    expect(result.current).toEqual({ height: 640, left: 4, top: 72, width: 367 });

    Object.assign(viewport, { height: 600, offsetTop: 40 });
    act(() => viewport.dispatchEvent(new Event("resize")));

    expect(result.current).toEqual({ height: 600, left: 4, top: 40, width: 367 });
  });
});

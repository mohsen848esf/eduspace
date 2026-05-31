import { useEffect, useState } from "react";

/**
 * Reports the device's current orientation, derived from the viewport's
 * aspect ratio. We don't trust `screen.orientation` directly because
 * desktop browsers report `landscape-primary` even on a portrait laptop
 * monitor when the resolution is wider than tall (which is most of
 * them). The aspect-ratio check matches what the user actually sees.
 *
 * The hook re-renders only when the orientation crosses the boundary,
 * not on every resize within the same orientation.
 */
export type Orientation = "portrait" | "landscape";

const PORTRAIT_QUERY = "(orientation: portrait)";

function readOrientation(): Orientation {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "landscape";
  }
  return window.matchMedia(PORTRAIT_QUERY).matches ? "portrait" : "landscape";
}

export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(readOrientation);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia(PORTRAIT_QUERY);
    const update = () => setOrientation(readOrientation());

    mql.addEventListener("change", update);
    update();

    return () => mql.removeEventListener("change", update);
  }, []);

  return orientation;
}

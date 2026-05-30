import { useEffect, useState } from "react";

/**
 * Three-tier breakpoint label aligned with Tailwind's defaults:
 *   mobile  — base (< 768px)
 *   tablet  — md   (768–1023px)
 *   desktop — lg+  (>= 1024px)
 *
 * The mobile-first style contract says CSS should handle 95% of cases via
 * `md:` / `lg:` utilities. Use this hook only when render output must
 * branch on viewport width (e.g., RoomPage picking which shell to mount).
 */
export type Breakpoint = "mobile" | "tablet" | "desktop";

const TABLET_QUERY = "(min-width: 768px)";
const DESKTOP_QUERY = "(min-width: 1024px)";

function readBreakpoint(): Breakpoint {
  // Defensive default for non-DOM contexts (we don't SSR today, but tests
  // and Vitest-style harnesses run without `window`). Default to desktop
  // because that's the existing layout — if anything stubs the window, the
  // app keeps rendering today's UI rather than flashing a mobile shell.
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "desktop";
  }
  if (window.matchMedia(DESKTOP_QUERY).matches) return "desktop";
  if (window.matchMedia(TABLET_QUERY).matches) return "tablet";
  return "mobile";
}

/**
 * Subscribes to the two breakpoint media queries and returns the current
 * tier. The hook re-renders only when the tier *crosses a boundary* —
 * passive resize within the same tier does nothing.
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(readBreakpoint);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const tabletMql = window.matchMedia(TABLET_QUERY);
    const desktopMql = window.matchMedia(DESKTOP_QUERY);

    const update = () => setBreakpoint(readBreakpoint());

    // Both listeners point at the same updater; either query firing is
    // enough to cause a re-read.
    tabletMql.addEventListener("change", update);
    desktopMql.addEventListener("change", update);

    // Sync once in case the initial SSR fallback differed from reality.
    update();

    return () => {
      tabletMql.removeEventListener("change", update);
      desktopMql.removeEventListener("change", update);
    };
  }, []);

  return breakpoint;
}

/** True when the current viewport is the mobile tier. */
export function useIsMobile(): boolean {
  return useBreakpoint() === "mobile";
}

const BREAKPOINT_ORDER: Record<Breakpoint, number> = {
  mobile: 0,
  tablet: 1,
  desktop: 2,
};

/**
 * Returns true when the current breakpoint is at or above the given tier.
 * Example:
 *   useIsAtLeast("tablet")  -> true on tablet AND desktop
 *   useIsAtLeast("desktop") -> true only on desktop
 */
export function useIsAtLeast(min: Breakpoint): boolean {
  return BREAKPOINT_ORDER[useBreakpoint()] >= BREAKPOINT_ORDER[min];
}

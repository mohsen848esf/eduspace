import { useEffect, useRef, useState } from "react";
import recordingsApi from "../api/recordings.api";

interface UseAccessGuardOptions {
  /** Enabled is false until the page has resolved its initial detail load. */
  enabled: boolean;
  /** Public token to revalidate. */
  token: string | null;
  /** How often to revalidate while the page is visible. */
  intervalMs?: number;
}

interface UseAccessGuardResult {
  /** True once the server returns 403/404 — caller should tear down the player. */
  revoked: boolean;
}

/**
 * Periodic access revalidation for the watch page.
 *
 * The /stream/ endpoint authorizes per-request, so an unpublish on the
 * server immediately blocks fresh fetches. But once the viewer has the
 * file as a Blob URL, they can keep playing it locally. This hook makes
 * sure we notice the revocation and react: the page redirects out and
 * the player tears down, so the user can no longer keep watching simply
 * by staying on the tab.
 *
 * Triggers a check:
 *   * every `intervalMs` while the document is visible
 *   * immediately when the tab regains focus
 *   * on mount (covers the case where unpublish happened mid-load)
 */
export function useAccessGuard({
  enabled,
  token,
  intervalMs = 15_000,
}: UseAccessGuardOptions): UseAccessGuardResult {
  const [revoked, setRevoked] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !token || revoked) return;

    let timer: number | null = null;

    const check = async () => {
      if (cancelled.current) return;
      try {
        await recordingsApi.detail(token);
      } catch (err: any) {
        const status = err?.response?.status;
        // 403 (unpublished / removed from visible_to / link-share turned off
        // and not owner / not superuser) and 404 (deleted) both mean the
        // current viewer has lost access.
        if (status === 403 || status === 404) {
          // eslint-disable-next-line no-console
          console.info(
            "[recording] access revoked for token=%s (status=%d)",
            token,
            status,
          );
          setRevoked(true);
        }
        // Network errors / 5xx etc. — leave the existing access alone, try again next tick.
      }
    };

    const start = () => {
      if (timer != null) window.clearInterval(timer);
      timer = window.setInterval(check, intervalMs);
    };
    const stop = () => {
      if (timer != null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        check();
        start();
      } else {
        stop();
      }
    };

    // Initial fire + start.
    check();
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", check);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", check);
    };
  }, [enabled, token, intervalMs, revoked]);

  return { revoked };
}

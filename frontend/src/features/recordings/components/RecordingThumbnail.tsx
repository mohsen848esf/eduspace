import { useEffect, useRef, useState } from "react";
import recordingsApi from "../api/recordings.api";

interface RecordingThumbnailProps {
  token: string;
  durationSeconds: number;
  className?: string;
}

const CACHE_PREFIX = "eduspace_thumb_v1_";
const FETCH_TIMEOUT_MS = 8_000;
const CAPTURE_RANGE_BYTES = 512 * 1024; // first 512 KB is plenty for the moov + first I-frame

/**
 * Renders a small frame snapshot of a recording.
 *
 * Strategy:
 *   1. Look up sessionStorage for a cached data: URL for this token.
 *   2. Otherwise, fetch a Range slice of the stream URL with the user's
 *      JWT, build a hidden <video>, seek a bit past the first byte,
 *      paint that frame onto a canvas, and stash the data: URL.
 *
 * If anything fails (network, CORS, codec quirks) we fall back to the
 * generic placeholder so the card still renders.
 */
export default function RecordingThumbnail({
  token,
  durationSeconds,
  className,
}: RecordingThumbnailProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setFailed(false);

    const cacheKey = CACHE_PREFIX + token;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setSrc(cached);
      return () => {
        cancelledRef.current = true;
      };
    }

    let blobUrl: string | null = null;
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT_MS,
    );

    const capture = async () => {
      try {
        const accessToken = localStorage.getItem("access_token");
        if (!accessToken) throw new Error("not authenticated");
        const res = await fetch(recordingsApi.streamUrl(token), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            // We only need the head of the file to extract one frame.
            Range: `bytes=0-${CAPTURE_RANGE_BYTES - 1}`,
          },
          signal: controller.signal,
        });
        if (!res.ok && res.status !== 206) {
          throw new Error(`thumb fetch ${res.status}`);
        }
        const blob = await res.blob();
        if (cancelledRef.current) return;
        blobUrl = URL.createObjectURL(blob);

        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = "anonymous";
        video.src = blobUrl;

        await new Promise<void>((resolve, reject) => {
          const onError = () => reject(new Error("video decode failed"));
          video.addEventListener("error", onError, { once: true });
          video.addEventListener(
            "loadedmetadata",
            () => {
              // Seek a tiny bit in to land on a non-black I-frame.
              const target = Math.min(
                Math.max(0.5, durationSeconds * 0.1),
                video.duration || durationSeconds || 1,
              );
              video.currentTime = isFinite(target) ? target : 0;
            },
            { once: true },
          );
          video.addEventListener("seeked", () => resolve(), { once: true });
        });

        if (cancelledRef.current) return;

        const canvas = document.createElement("canvas");
        const w = video.videoWidth || 320;
        const h = video.videoHeight || 180;
        // Cap at 480px wide — sessionStorage has a 5MB budget per origin
        // and we don't want full-resolution thumbnails eating it.
        const scale = Math.min(1, 480 / w);
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

        if (cancelledRef.current) return;
        try {
          sessionStorage.setItem(cacheKey, dataUrl);
        } catch {
          /* quota exceeded — ignore, render this session only */
        }
        setSrc(dataUrl);
      } catch {
        if (!cancelledRef.current) setFailed(true);
      } finally {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        window.clearTimeout(timer);
      }
    };

    capture();

    return () => {
      cancelledRef.current = true;
      controller.abort();
      window.clearTimeout(timer);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [token, durationSeconds]);

  if (failed || !src) {
    return (
      <div
        className={
          className ??
          "aspect-video bg-black flex items-center justify-center text-3xl text-[var(--t3)]"
        }
      >
        🎬
      </div>
    );
  }

  return (
    <div className={className ?? "aspect-video bg-black overflow-hidden"}>
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover"
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}

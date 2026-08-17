import { useState, useEffect, useRef, useCallback } from "react";
import { createLocalVideoTrack, LocalVideoTrack } from "livekit-client";
import { supportsBackgroundProcessors } from "@livekit/track-processors";
import type { BackgroundType } from "./useBackgroundBlur";
import { useBackgroundStore } from "../store/backgroundStore";
import { useLocale } from "../../../i18n/useLocale";
import { toast } from "react-hot-toast";

// Self-hosted background images — no external CDN dependency.
// Served from public/backgrounds/ by Vite / Nginx (works on internal servers).
const BG_IMAGES: Partial<Record<BackgroundType, string>> = {
  office:  "/backgrounds/office.jpg",
  nature:  "/backgrounds/nature.jpg",
  studio:  "/backgrounds/studio.jpg",
  minimal: "/backgrounds/minimal.jpg",
};

export function usePreJoinTrack(camEnabled: boolean = true, selectedCam?: string) {
  const { language } = useLocale();
  const [track, setTrack] = useState<LocalVideoTrack | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraError, setCameraError] = useState<"busy" | "unavailable" | null>(null);
  const { background, setBackground } = useBackgroundStore();
  const [isSupported] = useState(() => supportsBackgroundProcessors());
  const processorRef = useRef<any>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retryCamera = useCallback(() => {
    setRetryCount((prev) => prev + 1);
  }, []);

  // Manage camera track lifecycle reactively
  useEffect(() => {
    let cancelled = false;
    let localTrack: LocalVideoTrack | null = null;

    if (!camEnabled) {
      setCameraError(null);
      if (track) {
        track.stopProcessor().catch(() => {});
        track.mediaStreamTrack?.stop();
        track.stop();
        setTrack(null);
      }
      return;
    }

    const init = async () => {
      try {
        const options: Parameters<typeof createLocalVideoTrack>[0] = {
          facingMode: "user",
        };
        if (selectedCam) {
          options.deviceId = selectedCam;
        }

        const t = await createLocalVideoTrack(options);
        if (cancelled) {
          t.stopProcessor().catch(() => {});
          t.mediaStreamTrack?.stop();
          t.stop();
          return;
        }
        localTrack = t;
        setCameraError(null);
        setTrack(t);
      } catch (err: any) {
        if (cancelled) return;
        console.warn("Camera init warning (prejoin):", err);
        const isBusy =
          err?.name === "NotReadableError" ||
          err?.name === "AbortError" ||
          err?.name === "TrackStartError" ||
          err?.message?.toLowerCase?.()?.includes("in use") ||
          err?.message?.toLowerCase?.()?.includes("could not start video source");
        setCameraError(isBusy ? "busy" : "unavailable");
        setTrack(null);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (localTrack) {
        localTrack.stopProcessor().catch(() => {});
        localTrack.mediaStreamTrack?.stop();
        localTrack.stop();
      }
    };
  }, [camEnabled, selectedCam, retryCount]);

  // Auto-retry polling when camera is busy and user wants camera on
  useEffect(() => {
    if (!camEnabled || cameraError !== "busy" || track) {
      return;
    }

    const timer = setInterval(() => {
      retryCamera();
    }, 2500);

    return () => {
      clearInterval(timer);
    };
  }, [camEnabled, cameraError, track, retryCamera]);

  const videoElRef = useRef<HTMLVideoElement | null>(null);

  // Attach track to video element
  const attachToVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      if (videoElRef.current && videoElRef.current !== el) {
        try {
          track?.detach(videoElRef.current);
        } catch {}
      }
      videoElRef.current = el;
      if (el && track) {
        try {
          track.attach(el);
        } catch (e) {
          console.warn("Could not attach track to video:", e);
        }
      }
    },
    [track],
  );

  // Auto-attach whenever track instance becomes available
  useEffect(() => {
    if (videoElRef.current && track) {
      try {
        track.attach(videoElRef.current);
      } catch (e) {
        console.warn("Could not attach track in useEffect:", e);
      }
    }
  }, [track]);

  // Change background
  const changeBackground = useCallback(
    async (bg: BackgroundType) => {
      if (!track || !isSupported) {
        return;
      }

      setBackground(bg);
      setIsLoading(true);

      try {
        // Stop existing processor first
        await Promise.race([
          track.stopProcessor(),
          new Promise<void>((resolve) => setTimeout(resolve, 2000)),
        ]);
        processorRef.current = null;

        if (bg === "none") return;

        // Check track is still live
        if (track.mediaStreamTrack.readyState !== "live") {
          return;
        }

        const { BackgroundProcessor } =
          await import("@livekit/track-processors");

        let processor;
        if (bg === "blur") {
          processor = BackgroundProcessor({
            mode: "background-blur",
            blurRadius: 10,
          });
        } else {
          const imageUrl = BG_IMAGES[bg];
          if (!imageUrl) return;
          processor = BackgroundProcessor({
            mode: "virtual-background",
            imagePath: imageUrl,
          });
        }

        // Timeout to keep the processor swap from hanging the call.
        await Promise.race([
          track.setProcessor(processor),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error("Processor timeout")), 20000),
          ),
        ]);

        processorRef.current = processor;
      } catch (err) {
        console.error("Background error:", err);
        processorRef.current = null;
        setBackground("none");
        
        const isFarsi = language === "fa";
        toast.error(
          isFarsi
            ? "بارگذاری فیلتر دوربین با خطا مواجه شد یا زمان زیادی برد. لطفاً مجدداً تلاش کنید."
            : "Camera filter loading failed or timed out. Please try again."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [track, isSupported, setBackground, language],
  );

  const trackRef = useRef<LocalVideoTrack | null>(null);
  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  // Cleanup processor on unmount
  useEffect(() => {
    return () => {
      const currentTrack = trackRef.current;
      if (currentTrack) {
        currentTrack.stopProcessor().catch(() => {});
        currentTrack.mediaStreamTrack?.stop();
        currentTrack.stop();
      }
    };
  }, []);

  // Explicitly release track before joining room
  const stopTrack = useCallback(async () => {
    if (track) {
      try {
        await Promise.race([
          track.stopProcessor().catch(() => {}),
          new Promise<void>((resolve) => setTimeout(resolve, 500)),
        ]);
        track.mediaStreamTrack?.stop();
        track.stop();
        // Wait a tick to let the OS camera hardware be released
        await new Promise<void>((resolve) => setTimeout(resolve, 150));
      } catch (e) {
        console.warn("Error stopping pre-join track:", e);
      }
      setTrack(null);
    }
  }, [track]);

  return {
    track,
    background,
    isLoading,
    isSupported,
    cameraError,
    attachToVideo,
    changeBackground,
    stopTrack,
    retryCamera,
  };
}

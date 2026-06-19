import { useState, useEffect, useRef, useCallback } from "react";
import { createLocalVideoTrack, LocalVideoTrack } from "livekit-client";
import { supportsBackgroundProcessors } from "@livekit/track-processors";
import type { BackgroundType } from "./useBackgroundBlur";
import { useBackgroundStore } from "../store/backgroundStore";
import { useLocale } from "../../../i18n/useLocale";
import { toast } from "react-hot-toast";

const BG_IMAGES: Partial<Record<BackgroundType, string>> = {
  office:
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280&q=80",
  nature:
    "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1280&q=80",
  studio:
    "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1280&q=80",
  minimal:
    "https://images.unsplash.com/photo-1557683316-973673baf926?w=1280&q=80",
};

export function usePreJoinTrack() {
  const { language } = useLocale();
  const [track, setTrack] = useState<LocalVideoTrack | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { background, setBackground } = useBackgroundStore();
  const [isSupported] = useState(() => supportsBackgroundProcessors());
  const processorRef = useRef<any>(null);

  // Create track on mount
  useEffect(() => {
    let cancelled = false;
    let localTrack: LocalVideoTrack | null = null;

    const init = async () => {
      try {
        const t = await createLocalVideoTrack({ facingMode: "user" });
        if (cancelled) {
          t.stopProcessor().catch(() => {});
          t.mediaStreamTrack?.stop();
          t.stop();
          return;
        }
        localTrack = t;
        setTrack(t);
      } catch (err) {
        console.error("Camera init error:", err);
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
  }, []);

  // Attach track to video element
  const attachToVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      if (!el || !track) return;
      track.attach(el);
      return () => track.detach(el);
    },
    [track],
  );

  // Change background
  const changeBackground = useCallback(
    async (bg: BackgroundType) => {
      if (!track || !isSupported) {
        // console.log("No track or not supported:", {
        //   track: !!track,
        //   isSupported,
        // });
        return;
      }
      // console.log("Applying background:", bg);
      // console.log("Track state:", track.mediaStreamTrack?.readyState);

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
          // console.error("Track not live:", track.mediaStreamTrack.readyState);
          return;
        }

        const { BackgroundProcessor } =
          await import("@livekit/track-processors");
        // console.log("BackgroundProcessor imported");

        let processor;
        if (bg === "blur") {
          processor = BackgroundProcessor({
            mode: "background-blur",
            blurRadius: 10,
          });
        } else {
          const imageUrl = BG_IMAGES[bg];
          // console.log("Image URL:", imageUrl);

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
        // Reset to "none" if the processor swap failed.
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
    [track, isSupported, setBackground],
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
  return {
    track,
    background,
    isLoading,
    isSupported,
    attachToVideo,
    changeBackground,
  };
}

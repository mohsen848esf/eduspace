import { useState, useEffect, useRef, useCallback } from "react";
import { createLocalVideoTrack, LocalVideoTrack } from "livekit-client";
import { supportsBackgroundProcessors } from "@livekit/track-processors";
import type { BackgroundType } from "./useBackgroundBlur";
import { useBackgroundStore } from "../store/backgroundStore";

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
  const [track, setTrack] = useState<LocalVideoTrack | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { background, setBackground } = useBackgroundStore();
  const [isSupported] = useState(() => supportsBackgroundProcessors());
  const processorRef = useRef<any>(null);

  // Create track on mount
  useEffect(() => {
    let localTrack: LocalVideoTrack | null = null;

    const init = async () => {
      try {
        localTrack = await createLocalVideoTrack({ facingMode: "user" });
        setTrack(localTrack);
      } catch (err) {
        console.error("Camera init error:", err);
      }
    };

    init();

    return () => {
      if (localTrack) {
        // Stop processor اگه داره
        localTrack.stopProcessor().catch(() => {});
        // Stop mediaStreamTrack
        localTrack.mediaStreamTrack?.stop();
        // Stop LiveKit track
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

        // Timeout برای جلوگیری از hang

        await Promise.race([
          track.setProcessor(processor),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error("Processor timeout")), 8000),
          ),
        ]);

        processorRef.current = processor;
      } catch (err) {
        console.error("Background error:", err);
        processorRef.current = null;
        // Reset به none اگه fail شد
        setBackground("none");
      } finally {
        setIsLoading(false);
      }
    },
    [track, isSupported, setBackground],
  );
  // Cleanup processor on unmount
  useEffect(() => {
    return () => {
      if (processorRef.current && track) {
        track.stopProcessor().catch(() => {});
        track.mediaStreamTrack?.stop();
      }
    };
  }, [track]);
  return {
    track,
    background,
    isLoading,
    isSupported,
    attachToVideo,
    changeBackground,
  };
}

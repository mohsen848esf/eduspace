import { useCallback } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  useBackgroundStore,
  type BackgroundType,
} from "../store/backgroundStore";
import { createBackgroundProcessor } from "../lib/backgroundProcessing";

// Self-hosted background images — no external CDN dependency.
// Images live in public/backgrounds/ and are served by Vite / Nginx.
export const BG_IMAGES: Partial<Record<BackgroundType, string>> = {
  office:  "/backgrounds/office.jpg",
  nature:  "/backgrounds/nature.jpg",
  studio:  "/backgrounds/studio.jpg",
  minimal: "/backgrounds/minimal.jpg",
};

export { type BackgroundType };

export function useBackgroundBlur() {
  const { localParticipant } = useLocalParticipant();
  const { background, setBackground } = useBackgroundStore();

  const changeBackground = useCallback(
    async (bg: BackgroundType) => {
      if (!localParticipant) return;
      setBackground(bg);
      console.log("changeBackground called:", bg);

      try {
        const camPublication = localParticipant.getTrackPublication(
          Track.Source.Camera,
        );
        console.log(
          "cam track:",
          camPublication?.track?.mediaStreamTrack?.readyState,
        );

        const track = camPublication?.track;
        if (!track) return;

        await track.stopProcessor();

        if (bg === "none") return;

        let processor;
        if (bg === "blur") {
          processor = await createBackgroundProcessor({
            mode: "background-blur",
            blurRadius: 10,
          });
        } else {
          const imageUrl = BG_IMAGES[bg];
          if (!imageUrl) return;
          processor = await createBackgroundProcessor({
            mode: "virtual-background",
            imagePath: imageUrl,
          });
        }

        await track.setProcessor(processor);
      } catch (err) {
        console.error("Background error:", err);
      }
    },
    [localParticipant, setBackground],
  );

  return { background, isSupported: true, changeBackground };
}

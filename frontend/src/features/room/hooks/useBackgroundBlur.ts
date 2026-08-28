import { useCallback } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Track, type LocalVideoTrack } from "livekit-client";
import {
  useBackgroundStore,
  type BackgroundType,
} from "../store/backgroundStore";
import {
  createBackgroundProcessor,
  replaceBackgroundProcessor,
} from "../lib/backgroundProcessing";

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
  const background = useBackgroundStore((state) => state.background);
  const setBackground = useBackgroundStore((state) => state.setBackground);

  const changeBackground = useCallback(
    async (bg: BackgroundType, targetTrack?: LocalVideoTrack) => {
      setBackground(bg);

      try {
        const publication = localParticipant?.getTrackPublication(
          Track.Source.Camera,
        );
        const track = targetTrack ?? (publication?.track as LocalVideoTrack | undefined);
        if (!track || track.mediaStreamTrack?.readyState !== "live") return false;

        if (bg === "none") {
          return await replaceBackgroundProcessor(track, bg, null);
        }

        const imageUrl = BG_IMAGES[bg];
        return await replaceBackgroundProcessor(track, bg, async () => {
          if (bg === "blur") {
            return createBackgroundProcessor({
              mode: "background-blur",
              blurRadius: 10,
            });
          }
          if (!imageUrl) {
            throw new Error(`Unknown background: ${bg}`);
          }
          return createBackgroundProcessor({
            mode: "virtual-background",
            imagePath: imageUrl,
          });
        });
      } catch (err) {
        console.error("Background error:", err);
        if (useBackgroundStore.getState().background === bg) {
          setBackground("none");
        }
        return false;
      }
    },
    [localParticipant, setBackground],
  );

  return { background, isSupported: true, changeBackground };
}

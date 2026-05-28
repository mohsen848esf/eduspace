// import { useState, useCallback } from "react";
// import { useLocalParticipant } from "@livekit/components-react";
// import { Track } from "livekit-client";
// import { BackgroundBlur, VirtualBackground } from "@livekit/track-processors";

// export type BackgroundType =
//   | "none"
//   | "blur"
//   | "office"
//   | "nature"
//   | "studio"
//   | "minimal";

// const BG_IMAGES: Partial<Record<BackgroundType, string>> = {
//   office:
//     "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280&q=80",
//   nature:
//     "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1280&q=80",
//   studio:
//     "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1280&q=80",
//   minimal:
//     "https://images.unsplash.com/photo-1557683316-973673baf926?w=1280&q=80",
// };

// export function useBackgroundBlur() {
//   const { localParticipant } = useLocalParticipant();
//   const [background, setBackground] = useState<BackgroundType>("none");
//   const [isLoading, setIsLoading] = useState(false);

//   const changeBackground = useCallback(
//     async (bg: BackgroundType) => {
//       console.log("changeBackground called:", bg);
//       console.log("localParticipant:", localParticipant?.identity);

//       if (!localParticipant) {
//         console.log("No localParticipant!");
//         return;
//       }

//       setIsLoading(true);
//       setBackground(bg);

//       try {
//         const camPublication = localParticipant.getTrackPublication(
//           Track.Source.Camera,
//         );
//         const track = camPublication?.track;
//         console.log("camPublication:", camPublication);
//         console.log("track:", track);
//         console.log("track readyState:", track?.mediaStreamTrack?.readyState);

//         if (!track) {
//           console.log("No track found!");
//           return;
//         }
//         // Remove existing processor
//         await track.stopProcessor();

//         if (bg === "none") return;

//         if (bg === "blur") {
//           await track.setProcessor(BackgroundBlur(10));
//           return;
//         }

//         const imageUrl = BG_IMAGES[bg];
//         if (imageUrl) {
//           await track.setProcessor(VirtualBackground(imageUrl));
//         }
//       } catch (err) {
//         console.error("Background error:", err);
//       } finally {
//         setIsLoading(false);
//       }
//     },
//     [localParticipant],
//   );

//   return {
//     background,
//     isLoading,
//     isSupported: true,
//     changeBackground,
//   };
// }
import { useCallback } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { BackgroundProcessor } from "@livekit/track-processors";
import {
  useBackgroundStore,
  type BackgroundType,
} from "../store/backgroundStore";

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

        await track.setProcessor(processor);
      } catch (err) {
        console.error("Background error:", err);
      }
    },
    [localParticipant, setBackground],
  );

  return { background, isSupported: true, changeBackground };
}

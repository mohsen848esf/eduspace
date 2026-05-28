import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { useRoomStore } from "../store/roomStore";
import { useRoom } from "../hooks/useRoom";
import { useRoomControls } from "../hooks/useRoomControls";
import VideoGrid from "./VideoGrid";
import RoomSidebar from "./RoomSidebar";
import RoomControls from "./RoomControls";
import PreJoinScreen, { type PreJoinSettings } from "./prejoin/PreJoinScreen";
import Spinner from "../../../components/ui/Spinner";
import { Strings } from "../../../lib/constants/strings";
import RoomTopbar from "./RoomTopbar";
import { useRoomDisconnect } from "../hooks/useRoomDisconnect";
import { useBackgroundStore } from "../store/backgroundStore";
import { Track } from "livekit-client";
import { useBackgroundBlur } from "../hooks/useBackgroundBlur";

type LayoutMode = "grid" | "spotlight" | "sidebar";

function RoomContent({
  preJoinSettings,
}: {
  preJoinSettings: PreJoinSettings | null;
}) {
  const hasBg =
    preJoinSettings?.background && preJoinSettings.background !== "none";
  const controls = useRoomControls(
    preJoinSettings?.camEnabled ?? true,
    preJoinSettings?.micEnabled ?? true,
  );
  const [layout, setLayout] = useState<LayoutMode>("grid");
  const { localParticipant } = useLocalParticipant();
  const setupDone = useRef(false);
  const { disconnect } = useRoomDisconnect();
  const { roomCode } = useRoomStore();
  const { changeBackground } = useBackgroundBlur();
  useEffect(() => {
    if (setupDone.current) return;
    if (!localParticipant) return;
    setupDone.current = true;

    const setup = async () => {
      try {
        const camEnabled = preJoinSettings?.camEnabled ?? true;
        const bg = preJoinSettings?.background || "none";

        if (!camEnabled) return;

        // صبر کن track live بشه
        const waitForLive = async (attempts = 0): Promise<boolean> => {
          const camPub = localParticipant.getTrackPublication(
            Track.Source.Camera,
          );
          if (camPub?.track?.mediaStreamTrack?.readyState === "live")
            return true;
          if (attempts < 30) {
            await new Promise((r) => setTimeout(r, 300));
            return waitForLive(attempts + 1);
          }
          return false;
        };

        const ready = await waitForLive();
        if (!ready) {
          console.error("Track never became live");
          return;
        }

        if (bg !== "none") {
          // همون تابعی که تو settings کار میکنه
          await changeBackground(bg);
        }

        controls.setIsCamOn(true);
      } catch (err) {
        console.error("Camera setup error:", err);
        controls.setIsCamOn(true);
      }
    };

    setup();
  }, [localParticipant]);
  // useEffect(() => {
  //   if (setupDone.current) return;
  //   if (!localParticipant) return;
  //   if (!preJoinSettings?.camEnabled) return;
  //   console.log("creating video track with bg...", hasBg);

  //   if (!hasBg) return; // بدون background نیازی به setup نیست
  //   setupDone.current = true;

  //   const setup = async () => {
  //     console.log("setup started, hasBg:", hasBg);
  //     console.log("preJoinSettings:", preJoinSettings);
  //     try {
  //       // صبر کن track زنده بشه
  //       const waitForLive = async (attempts = 0): Promise<boolean> => {
  //         const camPub = localParticipant.getTrackPublication(
  //           Track.Source.Camera,
  //         );
  //         if (camPub?.track?.mediaStreamTrack?.readyState === "live")
  //           return true;
  //         if (attempts < 20) {
  //           await new Promise((r) => setTimeout(r, 200));
  //           return waitForLive(attempts + 1);
  //         }
  //         return false;
  //       };

  //       // Mute کن تا processor آماده بشه
  //       await localParticipant.setCameraEnabled(false);

  //       // Track جدید بساز با processor
  //       const { createLocalVideoTrack } = await import("livekit-client");
  //       const { BackgroundProcessor } =
  //         await import("@livekit/track-processors");

  //       const videoTrack = await createLocalVideoTrack({ facingMode: "user" });

  //       let processor;
  //       const BG_IMAGES: Record<string, string> = {
  //         office:
  //           "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280&q=80",
  //         nature:
  //           "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1280&q=80",
  //         studio:
  //           "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1280&q=80",
  //         minimal:
  //           "https://images.unsplash.com/photo-1557683316-973673baf926?w=1280&q=80",
  //       };

  //       if (preJoinSettings!.background === "blur") {
  //         processor = BackgroundProcessor({
  //           mode: "background-blur",
  //           blurRadius: 10,
  //         });
  //       } else {
  //         const imageUrl = BG_IMAGES[preJoinSettings!.background];
  //         if (imageUrl) {
  //           processor = BackgroundProcessor({
  //             mode: "virtual-background",
  //             imagePath: imageUrl,
  //           });
  //         }
  //         console.log(
  //           "preJoinSettings!.background...",
  //           preJoinSettings!.background,
  //         );
  //         console.log("imageUrl...", imageUrl);
  //         console.log("processor...", processor);
  //       }

  //       if (processor) {
  //         await videoTrack.setProcessor(processor);
  //       }

  //       // Unpublish track قبلی و publish جدید
  //       const oldPub = localParticipant.getTrackPublication(
  //         Track.Source.Camera,
  //       );
  //       if (oldPub) {
  //         await localParticipant.unpublishTrack(oldPub.track!);
  //       }

  //       await localParticipant.publishTrack(videoTrack);
  //       useBackgroundStore
  //         .getState()
  //         .setBackground(preJoinSettings!.background);
  //       controls.setIsCamOn(true);
  //     } catch (err) {
  //       console.error("Camera setup error:", err);
  //       await localParticipant.setCameraEnabled(true).catch(() => {});
  //       useBackgroundStore.getState().setBackground("none");

  //       controls.setIsCamOn(true);
  //     }
  //   };

  //   setup();
  // }, [localParticipant]);

  return (
    <div className="flex flex-col w-full h-full">
      <RoomTopbar />
      <div className="flex flex-1 overflow-hidden">
        <VideoGrid layout={layout} onLayoutChange={setLayout} />
        <RoomSidebar
          activeTab={controls.sidebarTab}
          onTabChange={controls.toggleSidebar}
          roomCode={roomCode || ""}
        />
      </div>
      <RoomControls
        isMicOn={controls.isMicOn}
        isCamOn={controls.isCamOn}
        isScreenSharing={controls.isScreenSharing}
        isPushToTalk={controls.isPushToTalk}
        sidebarTab={controls.sidebarTab}
        settingsOpen={controls.settingsOpen}
        layout={layout}
        onToggleMic={controls.toggleMic}
        onToggleCam={controls.toggleCam}
        onToggleScreenShare={controls.toggleScreenShare}
        onToggleSidebar={controls.toggleSidebar}
        onToggleSettings={controls.toggleSettings}
        onTogglePushToTalk={controls.togglePushToTalk}
        onLayoutChange={setLayout}
        onLeave={disconnect}
      />
    </div>
  );
}
export default function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { token, livekitUrl, roomName } = useRoomStore();
  const { joinRoom, leaveRoom, isLoading, error } = useRoom();
  const [preJoinDone, setPreJoinDone] = useState(false);
  const [preJoinSettings, setPreJoinSettings] =
    useState<PreJoinSettings | null>(null);
  const hasBg =
    preJoinSettings?.background && preJoinSettings.background !== "none";

  useEffect(() => {
    if (!token && roomCode && preJoinDone) {
      joinRoom(roomCode);
    }
  }, [roomCode, preJoinDone]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--s0)] gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-[var(--t2)]">Joining room...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--s0)] gap-4">
        <span className="text-4xl">⚠️</span>
        <p className="text-[var(--red)] text-sm">{error}</p>
        <button
          onClick={leaveRoom}
          className="text-[var(--brand-text)] hover:underline text-sm bg-transparent border-none cursor-pointer"
        >
          ← {Strings.common.back}
        </button>
      </div>
    );
  }

  if (!preJoinDone) {
    return (
      <PreJoinScreen
        roomName={roomName || "EduSpace Room"}
        roomCode={roomCode || ""}
        onJoin={(settings) => {
          setPreJoinSettings(settings);
          setPreJoinDone(true);
        }}
        onCancel={leaveRoom}
      />
    );
  }

  if (!token || !livekitUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--s0)]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-[var(--s0)] overflow-hidden">
      {/* <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        connect={true}
        video={false}
        audio={preJoinSettings?.micEnabled ?? true}
        onDisconnected={leaveRoom}
        style={{ height: "100vh", display: "flex", flexDirection: "column" }}
      > */}
      {/* <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        connect={true}
        video={false}
        audio={preJoinSettings?.micEnabled ?? true}
        onDisconnected={() => {
          useBackgroundStore.getState().setBackground("none");
          leaveRoom();
        }}
        style={{ height: "100vh", display: "flex", flexDirection: "column" }}
      > */}
      <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        connect={true}
        video={preJoinSettings?.camEnabled ?? true}
        audio={preJoinSettings?.micEnabled ?? true}
        onDisconnected={() => {
          useBackgroundStore.getState().setBackground("none");
          leaveRoom();
        }}
        style={{ height: "100vh", display: "flex", flexDirection: "column" }}
      >
        <RoomAudioRenderer />
        <RoomContent preJoinSettings={preJoinSettings} />
      </LiveKitRoom>
    </div>
  );
}

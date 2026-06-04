import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useRoomStore } from "../store/roomStore";
import { useRoom } from "../hooks/useRoom";
import { useRoomControls } from "../hooks/useRoomControls";
import PreJoinScreen, { type PreJoinSettings } from "./prejoin/PreJoinScreen";
import Spinner from "../../../components/ui/Spinner";
import { useRoomDisconnect } from "../hooks/useRoomDisconnect";
import { useBackgroundStore } from "../store/backgroundStore";
import { useBackgroundBlur } from "../hooks/useBackgroundBlur";
import { useActiveRecordingStore } from "../../recordings/store/activeRecordingStore";
import { useGameBoard } from "../hooks/useGameBoard";
import { RoomGameProvider } from "../hooks/useRoomGameContext";
import { useWhiteboard } from "../hooks/useWhiteboard";
import { RoomWhiteboardProvider } from "../hooks/useRoomWhiteboardContext";
import UnifiedRoomShell from "./UnifiedRoomShell";

type LayoutMode = "grid" | "spotlight" | "sidebar";

function RoomContent({
  preJoinSettings,
}: {
  preJoinSettings: PreJoinSettings | null;
}) {
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

  // Recording-aware leave flow.
  const inFlightToken = useActiveRecordingStore((s) => s.inFlightToken);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleLeaveRequest = useCallback(() => {
    if (inFlightToken) {
      setShowLeaveConfirm(true);
    } else {
      disconnect();
    }
  }, [disconnect, inFlightToken]);

  const handleLeaveConfirm = useCallback(async () => {
    setIsLeaving(true);
    try {
      await disconnect({ stopRecordingFirst: true });
    } finally {
      setIsLeaving(false);
      setShowLeaveConfirm(false);
    }
  }, [disconnect]);

  // Game & Whiteboard state.
  const game = useGameBoard();
  const whiteboard = useWhiteboard();
  const room = useRoomContext();

  // Wire LiveKit data channel into the game and whiteboard hooks.
  useEffect(() => {
    if (!room) return;
    const handler = (payload: Uint8Array, participant?: any) => {
      game.handleDataMessage(payload, participant);
      whiteboard.handleDataMessage(payload, participant);
    };
    room.on("dataReceived", handler);
    return () => {
      room.off("dataReceived", handler);
    };
  }, [room, game.handleDataMessage, whiteboard.handleDataMessage]);

  // Camera + background setup once the local participant is ready.
  useEffect(() => {
    if (setupDone.current) return;
    if (!localParticipant) return;
    setupDone.current = true;

    const setup = async () => {
      try {
        const camEnabled = preJoinSettings?.camEnabled ?? true;
        const bg = preJoinSettings?.background || "none";

        if (!camEnabled) return;

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

  const sharedShellProps = {
    controls: {
      isMicOn: controls.isMicOn,
      isCamOn: controls.isCamOn,
      isScreenSharing: controls.isScreenSharing,
      isPushToTalk: controls.isPushToTalk,
      sidebarTab: controls.sidebarTab,
      settingsOpen: controls.settingsOpen,
      toggleMic: controls.toggleMic,
      toggleCam: controls.toggleCam,
      toggleScreenShare: controls.toggleScreenShare,
      toggleSidebar: controls.toggleSidebar,
      toggleSettings: controls.toggleSettings,
      togglePushToTalk: controls.togglePushToTalk,
    },
    layout,
    onLayoutChange: setLayout,
    onLeaveRequest: handleLeaveRequest,
    showLeaveConfirm,
    onOpenChange: setShowLeaveConfirm,
    onLeaveConfirmOpenChange: setShowLeaveConfirm,
    onLeaveConfirm: handleLeaveConfirm,
    isLeaving,
    game,
    whiteboard,
    roomCode: roomCode || "",
  };

  const shell = <UnifiedRoomShell {...sharedShellProps} />;

  return (
    <RoomGameProvider value={game}>
      <RoomWhiteboardProvider value={whiteboard}>
        {shell}
      </RoomWhiteboardProvider>
    </RoomGameProvider>
  );
}

export default function RoomPage() {
  const { t } = useTranslation(["room", "common"]);
  const { roomCode } = useParams<{ roomCode: string }>();
  const { token, livekitUrl, roomName } = useRoomStore();
  const { joinRoom, leaveRoom, isLoading, error } = useRoom();
  const [preJoinDone, setPreJoinDone] = useState(false);
  const [preJoinSettings, setPreJoinSettings] =
    useState<PreJoinSettings | null>(null);

  useEffect(() => {
    if (!token && roomCode && preJoinDone) {
      joinRoom(roomCode);
    }
  }, [roomCode, preJoinDone]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--s0)] gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-[var(--t2)]">{t("join.joining")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--s0)] gap-4">
        <span className="text-4xl">⚠️</span>
        <p className="text-[var(--red)] text-sm">{error}</p>
        <button
          onClick={() => leaveRoom()}
          className="text-[var(--brand-text)] hover:underline text-sm bg-transparent border-none cursor-pointer"
        >
          ← {t("common:actions.back")}
        </button>
      </div>
    );
  }

  if (!preJoinDone) {
    return (
      <PreJoinScreen
        roomName={roomName || t("topbar.defaultRoomName")}
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

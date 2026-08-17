import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import {
  VideoPresets,
  AudioPresets,
  ConnectionQuality,
  RoomEvent,
} from "livekit-client";
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
import { useReactions } from "../hooks/useReactions";
import UnifiedRoomShell from "./UnifiedRoomShell";
import { useRoomLayoutStore } from "../store/roomLayoutStore";

function RoomContent({
  preJoinSettings,
}: {
  preJoinSettings: PreJoinSettings | null;
}) {
  const controls = useRoomControls(
    preJoinSettings?.camEnabled ?? true,
    preJoinSettings?.micEnabled ?? true,
  );
  const layout = useRoomLayoutStore((s) => s.layoutMode);
  const setLayout = useRoomLayoutStore((s) => s.setLayoutMode);
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

  // Game, Whiteboard & Reactions state.
  const game = useGameBoard();
  const whiteboard = useWhiteboard();
  const reactions = useReactions();
  const room = useRoomContext();

  // Wire LiveKit data channel into the game, whiteboard, and reactions hooks.
  useEffect(() => {
    if (!room) return;
    const handler = (payload: Uint8Array, participant?: any) => {
      game.handleDataMessage(payload, participant);
      whiteboard.handleDataMessage(payload, participant);
      reactions.handleDataMessage(payload, participant);
    };
    room.on("dataReceived", handler);
    return () => {
      room.off("dataReceived", handler);
    };
  }, [room, game.handleDataMessage, whiteboard.handleDataMessage, reactions.handleDataMessage]);

  // Monitor connection quality — auto-disable camera on poor networks.
  // This keeps audio alive when bandwidth is critically low.
  useEffect(() => {
    if (!room) return;
    const handleQuality = (quality: ConnectionQuality) => {
      if (quality === ConnectionQuality.Poor) {
        // If camera is on and quality is critically poor, mute video to save bandwidth.
        // The user's mic stays active so they can still communicate.
        if (room.localParticipant.isCameraEnabled) {
          room.localParticipant.setCameraEnabled(false);
        }
      }
    };
    room.localParticipant.on(RoomEvent.ConnectionQualityChanged, handleQuality);
    return () => {
      room.localParticipant.off(RoomEvent.ConnectionQualityChanged, handleQuality);
    };
  }, [room]);

  // Clean up and release media devices when the room page is unmounted (navigating away)
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Virtual background setup once the local participant camera is active.
  useEffect(() => {
    if (setupDone.current) return;
    if (!localParticipant) return;
    const bg = preJoinSettings?.background || "none";
    if (bg !== "none" && preJoinSettings?.camEnabled) {
      setupDone.current = true;
      const timer = setTimeout(() => {
        changeBackground(bg).catch(() => {});
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [localParticipant, preJoinSettings, changeBackground]);

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
      handRaised: controls.handRaised,
      onToggleHandRaise: controls.toggleHandRaise,
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
    reactions,
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
  const { joinRoom, joinRoomGuest, leaveRoom, isLoading, error } = useRoom();
  const [preJoinDone, setPreJoinDone] = useState(false);
  const [preJoinSettings, setPreJoinSettings] =
    useState<PreJoinSettings | null>(null);

  const joinedRef = useRef(false);

  useEffect(() => {
    if (preJoinDone) {
      joinedRef.current = true;
    }
  }, [preJoinDone]);

  useEffect(() => {
    if (!token && roomCode && preJoinDone) {
      const guestName = preJoinSettings?.guestName;
      if (guestName) {
        joinRoomGuest(roomCode, guestName);
      } else {
        joinRoom(roomCode);
      }
    }
  }, [roomCode, preJoinDone, preJoinSettings?.guestName]);

  useEffect(() => {
    return () => {
      if (joinedRef.current) {
        leaveRoom({ redirectTo: null });
      }
    };
  }, [leaveRoom]);

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
        options={{
          // Adaptive stream: downscale subscribed video to match the display
          // element size — prevents wasting bandwidth on invisible high-res frames.
          adaptiveStream: true,
          // Dynacast: pause video layers that have zero subscribers — saves
          // publisher upload bandwidth in multi-party calls.
          dynacast: true,
          publishDefaults: {
            // Simulcast: publish 3 quality layers simultaneously.
            // The SFU selects the best layer per subscriber on the fly.
            simulcast: true,
            videoSimulcastLayers: [
              VideoPresets.h720, // ~1.5 Mbps — good network
              VideoPresets.h360, // ~400 kbps — average network
              VideoPresets.h180, // ~150 kbps — weak network / mobile data
            ],
            audioPreset: AudioPresets.speech, // 24 kbps Opus optimised for voice
            // RED: redundant audio encoding — survives up to 30% packet loss
            // without audible glitches. Enabled by default in livekit-client
            // but declared explicitly for clarity.
            red: true,
            // DTX: discontinuous transmission — stops sending audio packets
            // during silence. Cuts audio bandwidth by ~50% for typical calls.
            dtx: true,
          },
        }}
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

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
  type Participant,
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
import { RoomGameProvider } from "../hooks/RoomGameProvider";
import { useWhiteboard } from "../hooks/useWhiteboard";
import { RoomWhiteboardProvider } from "../hooks/RoomWhiteboardProvider";
import { useReactions } from "../hooks/useReactions";
import UnifiedRoomShell from "./UnifiedRoomShell";
import { useRoomLayoutStore } from "../store/roomLayoutStore";
import { LobbyWaitingScreen } from "./LobbyWaitingScreen";
import { useLobbyWaiting } from "../hooks/useLobbyWaiting";
import CallEndedScreen from "./CallEndedScreen";

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
  const handleGameDataMessage = game.handleDataMessage;
  const handleWhiteboardDataMessage = whiteboard.handleDataMessage;
  const handleReactionDataMessage = reactions.handleDataMessage;
  const room = useRoomContext();

  // Wire LiveKit data channel into the game, whiteboard, and reactions hooks.
  useEffect(() => {
    if (!room) return;
    const handler = (payload: Uint8Array, participant?: Participant) => {
      handleGameDataMessage(payload, participant);
      handleWhiteboardDataMessage(payload, participant);
      handleReactionDataMessage(payload, participant);
    };
    room.on("dataReceived", handler);
    return () => {
      room.off("dataReceived", handler);
    };
  }, [
    room,
    handleGameDataMessage,
    handleWhiteboardDataMessage,
    handleReactionDataMessage,
  ]);

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
  const {
    token,
    livekitUrl,
    roomName,
    isHost,
    isCoHost,
    muteMicOnJoin,
    muteCamOnJoin,
    lockMicrophone,
    lockCamera,
    canUseMicrophone,
    canUseCamera,
  } = useRoomStore();
  const { joinRoom, joinRoomGuest, leaveRoom, isLoading, error, clearError } = useRoom();
  const [preJoinDone, setPreJoinDone] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [preJoinSettings, setPreJoinSettings] =
    useState<PreJoinSettings | null>(null);

  const [lobbyRequestId, setLobbyRequestId] = useState<number | null>(null);
  const [lobbyGuestAccessToken, setLobbyGuestAccessToken] = useState<string | null>(null);
  const [isWaitingInLobby, setIsWaitingInLobby] = useState(false);
  const [roomAccessError, setRoomAccessError] = useState<
    "locked" | "room_ended" | null
  >(null);

  const joinedRef = useRef(false);

  const handleJoinAttempt = useCallback(async (guestNameOverride?: string) => {
    if (!roomCode) return;
    const guestName = guestNameOverride ?? preJoinSettings?.guestName;
    try {
      const res = guestName
        ? await joinRoomGuest(roomCode, guestName)
        : await joinRoom(roomCode);

      if (res && "waiting" in res && res.waiting) {
        setLobbyRequestId(res.request_id);
        setLobbyGuestAccessToken(res.guest_access_token || null);
        setIsWaitingInLobby(true);
      }
    } catch (err: unknown) {
      const roomError = err as { code?: string; status?: number };
      if (roomError.code === "ROOM_LOCKED" || roomError.status === 423) {
        setRoomAccessError("locked");
      } else if (roomError.status === 410) {
        setRoomAccessError("room_ended");
      }
    }
  }, [roomCode, preJoinSettings?.guestName, joinRoom, joinRoomGuest]);

  // Polling when waiting in lobby
  const { status: lobbyStatus, elapsedSeconds } = useLobbyWaiting({
    roomCode: roomCode || "",
    requestId: lobbyRequestId,
    guestAccessToken: lobbyGuestAccessToken,
    enabled: isWaitingInLobby,
    onAdmitted: (admittedData) => {
      useRoomStore.getState().setRoom({
        token: admittedData.token,
        livekitUrl: admittedData.livekitUrl,
        roomCode: admittedData.roomCode,
        roomName: admittedData.name,
        isHost: false,
        isGuest: admittedData.isGuest || false,
        guestIdentity: admittedData.guestIdentity || null,
        guestAccessToken: admittedData.guestAccessToken || null,
        lockDocumentPresentation: admittedData.lockDocumentPresentation,
        canUploadPresentation: admittedData.canUploadPresentation,
      });
      setLobbyGuestAccessToken(null);
      setIsWaitingInLobby(false);
    },
  });

  useEffect(() => {
    return () => {
      if (joinedRef.current) {
        leaveRoom({ redirectTo: null });
      }
    };
  }, [leaveRoom]);

  // Access Error (Room Locked or Room Ended)
  if (roomAccessError) {
    return (
      <LobbyWaitingScreen
        status={roomAccessError}
        roomCode={roomCode || ""}
        roomName={roomName || ""}
        onLeave={() => leaveRoom()}
      />
    );
  }

  // Waiting in Lobby State
  if (isWaitingInLobby) {
    return (
      <LobbyWaitingScreen
        status={lobbyStatus}
        roomCode={roomCode || ""}
        roomName={roomName || ""}
        elapsedSeconds={elapsedSeconds}
        displayName={preJoinSettings?.guestName}
        onRetry={() => {
          setIsWaitingInLobby(false);
          setLobbyRequestId(null);
          setLobbyGuestAccessToken(null);
          handleJoinAttempt();
        }}
        onLeave={() => {
          setIsWaitingInLobby(false);
          leaveRoom();
        }}
      />
    );
  }

  if (callEnded) {
    return (
      <CallEndedScreen
        roomCode={roomCode || ""}
        roomName={roomName || ""}
        onRejoin={() => {
          setCallEnded(false);
          setPreJoinDone(false);
          useRoomStore.getState().setIsUserLeaving(false);
          clearError();
        }}
        onExit={() => {
          leaveRoom();
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--s0)] text-[var(--t1)] gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-[var(--t2)]">{t("join.joining")}</p>
      </div>
    );
  }

  if (error && !roomAccessError && !isWaitingInLobby) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--s0)] text-[var(--t1)] gap-4">
        <span className="text-4xl">⚠️</span>
        <p className="text-[var(--red)] text-sm">{error}</p>
        <button
          onClick={() => leaveRoom()}
          className="text-[var(--brand)] font-semibold hover:underline text-sm bg-transparent border-none cursor-pointer"
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
          joinedRef.current = true;
          void handleJoinAttempt(settings.guestName);
        }}
        onCancel={() => {
          leaveRoom();
        }}
      />
    );
  }

  if (!token || !livekitUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--s0)] text-[var(--t1)]">
        <Spinner size="lg" />
      </div>
    );
  }

  const isModerator = isHost || isCoHost;
  const initialCamOn = isModerator
    ? (preJoinSettings?.camEnabled ?? true)
    : (muteCamOnJoin || lockCamera || !canUseCamera)
      ? false
      : (preJoinSettings?.camEnabled ?? true);

  const initialMicOn = isModerator
    ? (preJoinSettings?.micEnabled ?? true)
    : (muteMicOnJoin || lockMicrophone || !canUseMicrophone)
      ? false
      : (preJoinSettings?.micEnabled ?? true);

  return (
    <div className="w-screen h-screen bg-[var(--s0)] text-[var(--t1)] overflow-hidden">
      <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        connect={true}
        video={initialCamOn}
        audio={initialMicOn}
        options={{
          adaptiveStream: true,
          dynacast: true,
          publishDefaults: {
            simulcast: true,
            videoSimulcastLayers: [
              VideoPresets.h720,
              VideoPresets.h360,
              VideoPresets.h180,
            ],
            audioPreset: AudioPresets.speech,
            red: true,
            dtx: true,
          },
        }}
        onDisconnected={() => {
          useBackgroundStore.getState().setBackground("none");
          setCallEnded(true);
        }}
        style={{ height: "100vh", display: "flex", flexDirection: "column" }}
      >
        <RoomAudioRenderer />
        <RoomContent preJoinSettings={preJoinSettings} />
      </LiveKitRoom>
    </div>
  );
}

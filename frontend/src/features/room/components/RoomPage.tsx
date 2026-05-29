import { useEffect, useRef, useState } from "react";
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
import VideoGrid from "./VideoGrid";
import RoomSidebar from "./RoomSidebar";
import RoomControls from "./RoomControls";
import GameBoard from "./GameBoard";
import GameInviteToast from "./GameInviteToast";
import PreJoinScreen, { type PreJoinSettings } from "./prejoin/PreJoinScreen";
import Spinner from "../../../components/ui/Spinner";
import RoomTopbar from "./RoomTopbar";
import { useRoomDisconnect } from "../hooks/useRoomDisconnect";
import { useBackgroundStore } from "../store/backgroundStore";
import { useBackgroundBlur } from "../hooks/useBackgroundBlur";
import { useGameBoard } from "../hooks/useGameBoard";
import { RoomGameProvider } from "../hooks/useRoomGameContext";

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

  // Game state for this room. Lives at this level so VideoGrid can be
  // swapped for GameBoard when a game is active and the sidebar's Tools
  // tab can launch new games via context.
  const game = useGameBoard();
  const room = useRoomContext();

  // Wire LiveKit's data channel into the game hook so GAME_INVITE /
  // GAME_ACCEPT / GAME_END messages broadcast over publishData() reach
  // every participant.
  useEffect(() => {
    if (!room) return;
    const handler = (payload: Uint8Array, participant?: any) => {
      game.handleDataMessage(payload, participant);
    };
    room.on("dataReceived", handler);
    return () => {
      room.off("dataReceived", handler);
    };
  }, [room, game.handleDataMessage]);

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

  return (
    <RoomGameProvider value={game}>
      <div className="flex flex-col w-full h-full">
        <RoomTopbar />
        <div className="flex flex-1 overflow-hidden">
          {game.gameBoard.isActive ? (
            <GameBoard gameBoard={game.gameBoard} onEnd={game.endGame} />
          ) : (
            <VideoGrid layout={layout} onLayoutChange={setLayout} />
          )}
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
        <GameInviteToast
          invite={game.pendingInvite}
          onAccept={game.acceptGame}
          onDecline={game.declineGame}
        />
      </div>
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
          onClick={leaveRoom}
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

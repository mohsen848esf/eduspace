import { useTranslation } from "react-i18next";
import { useRoomStore } from "../store/roomStore";
import { type SidebarTab } from "../hooks/useRoomControls";
import VideoGrid from "./VideoGrid";
import GameBoard from "./GameBoard";
import GameInviteToast from "./GameInviteToast";
import RoomTopbar from "./RoomTopbar";
import RoomControls from "./RoomControls";
import RoomSidebar from "./RoomSidebar";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import { type useGameBoard } from "../hooks/useGameBoard";

type LayoutMode = "grid" | "spotlight" | "sidebar";

interface DockedPanelShellProps {
  controls: {
    isMicOn: boolean;
    isCamOn: boolean;
    isScreenSharing: boolean;
    isPushToTalk: boolean;
    sidebarTab: SidebarTab;
    settingsOpen: boolean;
    toggleMic: () => void;
    toggleCam: () => void;
    toggleScreenShare: () => void;
    toggleSidebar: (tab: SidebarTab) => void;
    toggleSettings: () => void;
    togglePushToTalk: () => void;
  };
  layout: LayoutMode;
  onLayoutChange: (l: LayoutMode) => void;
  onLeaveRequest: () => void;
  showLeaveConfirm: boolean;
  onLeaveConfirmOpenChange: (v: boolean) => void;
  onLeaveConfirm: () => void | Promise<void>;
  isLeaving: boolean;
  game: ReturnType<typeof useGameBoard>;
  /** Tablet uses the slimmer panel; desktop uses the wider one. */
  size: "md" | "lg";
}

/**
 * In-call layout for tablet (md) and desktop (lg+).
 *
 * Mirrors today's RoomContent body — header at the top, video grid +
 * docked side panel in the middle, refreshed control bar at the bottom.
 * The two breakpoints differ only in panel width and control-button size;
 * the structure is identical.
 *
 * Lifted into its own file so RoomPage can swap shells based on the
 * current breakpoint without an enormous switch in the page component.
 */
export default function DockedPanelShell({
  controls,
  layout,
  onLayoutChange,
  onLeaveRequest,
  showLeaveConfirm,
  onLeaveConfirmOpenChange,
  onLeaveConfirm,
  isLeaving,
  game,
  size,
}: DockedPanelShellProps) {
  const { t } = useTranslation("recordings");
  const { roomCode } = useRoomStore();

  return (
    <div className="flex flex-col w-full h-full">
      <RoomTopbar />
      <div className="flex flex-1 overflow-hidden">
        {game.gameBoard.isActive ? (
          <GameBoard gameBoard={game.gameBoard} onEnd={game.endGame} />
        ) : (
          <VideoGrid layout={layout} onLayoutChange={onLayoutChange} />
        )}
        <RoomSidebar
          activeTab={controls.sidebarTab}
          onTabChange={controls.toggleSidebar}
          roomCode={roomCode || ""}
          width={size === "md" ? "tablet" : "desktop"}
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
        onLayoutChange={onLayoutChange}
        onLeave={onLeaveRequest}
        size={size}
      />

      <GameInviteToast
        invite={game.pendingInvite}
        onAccept={game.acceptGame}
        onDecline={game.declineGame}
      />

      <ConfirmModal
        open={showLeaveConfirm}
        onOpenChange={onLeaveConfirmOpenChange}
        title={t("leaveModal.title")}
        description={t("leaveModal.description")}
        confirmLabel={t("leaveModal.confirm")}
        cancelLabel={t("leaveModal.cancel")}
        confirmVariant="danger"
        isLoading={isLeaving}
        blocking
        onConfirm={onLeaveConfirm}
      />
    </div>
  );
}

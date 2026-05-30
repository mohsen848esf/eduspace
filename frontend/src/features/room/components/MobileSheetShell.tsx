import { useTranslation } from "react-i18next";
import { useRoomStore } from "../store/roomStore";
import { useRoomLayoutStore, type ActivePanel } from "../store/roomLayoutStore";
import { type SidebarTab } from "../hooks/useRoomControls";
import VideoGrid from "./VideoGrid";
import GameBoard from "./GameBoard";
import GameInviteToast from "./GameInviteToast";
import RoomTopbar from "./RoomTopbar";
import RoomControls from "./RoomControls";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import BottomSheet from "../../../components/layout/BottomSheet";
import ParticipantsPanel from "./panels/ParticipantsPanel";
import ChatPanel from "./panels/ChatPanel";
import ToolsPanel from "./panels/ToolsPanel";
import { type useGameBoard } from "../hooks/useGameBoard";

type LayoutMode = "grid" | "spotlight" | "sidebar";

interface MobileSheetShellProps {
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
  roomCode: string;
}

/**
 * Mobile in-call layout — bottom-sheets variant.
 *
 * Video grid stays full-screen. Tapping a panel button (People / Chat /
 * Tools) opens a BottomSheet for that panel. The active panel is mirrored
 * into useRoomLayoutStore so the bottom-bar's highlight follows the open
 * sheet, and closing a sheet snaps the user back to the "video" panel.
 */
export default function MobileSheetShell({
  controls,
  layout,
  onLayoutChange,
  onLeaveRequest,
  showLeaveConfirm,
  onLeaveConfirmOpenChange,
  onLeaveConfirm,
  isLeaving,
  game,
  roomCode,
}: MobileSheetShellProps) {
  const { t } = useTranslation(["room", "recordings"]);
  const { roomCode: storeRoomCode } = useRoomStore();
  const activeRoomCode = roomCode || storeRoomCode || "";

  const activePanel = useRoomLayoutStore((s) => s.activePanel);
  const setActivePanel = useRoomLayoutStore((s) => s.setActivePanel);

  const handleSheetOpenChange = (panel: ActivePanel) => (open: boolean) => {
    if (!open && activePanel === panel) {
      setActivePanel("video");
    }
  };

  const handlePanelButtonClick = (panel: "people" | "chat" | "tools") => {
    setActivePanel(activePanel === panel ? "video" : panel);
  };

  return (
    <>
      <div className="flex flex-col w-full h-full">
        <RoomTopbar />

        {/* Full-screen video grid (or game when active). */}
        <div className="flex-1 overflow-hidden">
          {game.gameBoard.isActive ? (
            <GameBoard gameBoard={game.gameBoard} onEnd={game.endGame} />
          ) : (
            <VideoGrid layout={layout} onLayoutChange={onLayoutChange} />
          )}
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
          activePanelOverride={
            activePanel === "video" ? undefined : activePanel
          }
          onPanelButtonClick={handlePanelButtonClick}
          size="sm"
        />

        <GameInviteToast
          invite={game.pendingInvite}
          onAccept={game.acceptGame}
          onDecline={game.declineGame}
        />

        <ConfirmModal
          open={showLeaveConfirm}
          onOpenChange={onLeaveConfirmOpenChange}
          title={t("recordings:leaveModal.title")}
          description={t("recordings:leaveModal.description")}
          confirmLabel={t("recordings:leaveModal.confirm")}
          cancelLabel={t("recordings:leaveModal.cancel")}
          confirmVariant="danger"
          isLoading={isLeaving}
          blocking
          onConfirm={onLeaveConfirm}
        />
      </div>

      {/* Three independent bottom sheets keyed off activePanel. */}
      <BottomSheet
        open={activePanel === "people"}
        onOpenChange={handleSheetOpenChange("people")}
        title={t("room:tooltips.participants")}
      >
        <ParticipantsPanel />
      </BottomSheet>

      <BottomSheet
        open={activePanel === "chat"}
        onOpenChange={handleSheetOpenChange("chat")}
        title={t("room:tooltips.chat")}
      >
        <ChatPanel roomCode={activeRoomCode} />
      </BottomSheet>

      <BottomSheet
        open={activePanel === "tools"}
        onOpenChange={handleSheetOpenChange("tools")}
        title={t("room:tooltips.tools")}
      >
        <ToolsPanel />
      </BottomSheet>
    </>
  );
}

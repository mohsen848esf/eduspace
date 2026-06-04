import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { useRoomStore } from "../store/roomStore";
import { useRoomLayoutStore, type ActivePanel } from "../store/roomLayoutStore";
import { type SidebarTab } from "../hooks/useRoomControls";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import VideoGrid from "./VideoGrid";
import GameBoard from "./GameBoard";
import Whiteboard from "./Whiteboard";
import GameInviteToast from "./GameInviteToast";
import RoomTopbar from "./RoomTopbar";
import RoomMobileTopbar from "./RoomMobileTopbar";
import RoomControls from "./RoomControls";
import RoomMobileControls from "./RoomMobileControls";
import RoomRecordingBadge from "./RoomRecordingBadge";
import RoomSidebar from "./RoomSidebar";
import SettingsPanel from "./SettingsPanel";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import BottomSheet from "../../../components/layout/BottomSheet";
import ParticipantsPanel from "./panels/ParticipantsPanel";
import ChatPanel from "./panels/ChatPanel";
import ToolsPanel from "./panels/ToolsPanel";
import { type useGameBoard } from "../hooks/useGameBoard";
import { type useWhiteboard } from "../hooks/useWhiteboard";
import { cn } from "../../../lib/utils";

type LayoutMode = "grid" | "spotlight" | "sidebar";

interface UnifiedRoomShellProps {
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
  whiteboard: ReturnType<typeof useWhiteboard>;
  roomCode: string;
}

export default function UnifiedRoomShell({
  controls,
  layout,
  onLayoutChange,
  onLeaveRequest,
  showLeaveConfirm,
  onLeaveConfirmOpenChange,
  onLeaveConfirm,
  isLeaving,
  game,
  whiteboard,
  roomCode,
}: UnifiedRoomShellProps) {
  const { t } = useTranslation("recordings");
  const { t: t_room } = useTranslation("room");
  const { roomCode: storeRoomCode } = useRoomStore();
  const activeRoomCode = roomCode || storeRoomCode || "";

  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  const activePanel = useRoomLayoutStore((s) => s.activePanel);
  const setActivePanel = useRoomLayoutStore((s) => s.setActivePanel);

  // Reset to Video on mount so re-entering a mobile call starts fresh
  useEffect(() => {
    if (isMobile) {
      setActivePanel("video");
    }
  }, [isMobile, setActivePanel]);

  // Mobile: blur input when bottom sheet closes
  useEffect(() => {
    if (!isMobile || activePanel !== "video") return;
    const el = document.activeElement;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.blur();
    }
  }, [isMobile, activePanel]);

  // Unified eduspace:open-people-tab handler
  useEffect(() => {
    const handler = () => {
      if (isMobile) {
        setActivePanel("people");
      } else {
        controls.toggleSidebar("participants");
      }
    };
    window.addEventListener("eduspace:open-people-tab", handler);
    return () =>
      window.removeEventListener("eduspace:open-people-tab", handler);
  }, [isMobile, controls.toggleSidebar, setActivePanel]);

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
      <div className="relative flex flex-col w-full h-full">
        {/* Topbar */}
        {isMobile ? <RoomMobileTopbar /> : <RoomTopbar />}

        {/* Middle Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main Game/Video Container - stable in the React DOM tree */}
          <div
            className={cn(
              "relative flex-1 flex",
              isMobile && "flex-col min-h-0 overflow-hidden"
            )}
          >
            {game.gameBoard.isActive ? (
              <GameBoard
                gameBoard={game.gameBoard}
                onEnd={game.endGame}
                onScoreUpdate={(userId, score) => {
                  if (userId) game.relayScore(score);
                }}
                onBroadcastClassroom={game.broadcastClassroomEvent}
                subscribeClassroomEvents={game.subscribeClassroomEvents}
              />
            ) : whiteboard.whiteboard.isActive ? (
              <Whiteboard
                whiteboard={whiteboard.whiteboard}
                onEnd={whiteboard.endWhiteboard}
                toggleDrawingPermission={whiteboard.toggleDrawingPermission}
                broadcastWhiteboardEvent={whiteboard.broadcastWhiteboardEvent}
                subscribeWhiteboardEvents={whiteboard.subscribeWhiteboardEvents}
                requestSyncState={whiteboard.requestSyncState}
              />
            ) : (
              <VideoGrid layout={layout} onLayoutChange={onLayoutChange} />
            )}
            <RoomRecordingBadge
              className={
                game.gameBoard.isActive || whiteboard.whiteboard.isActive
                  ? "top-12 end-3"
                  : undefined
              }
            />
          </div>

          {/* Desktop/Tablet Sidebar */}
          {!isMobile && (
            <RoomSidebar
              activeTab={controls.sidebarTab}
              onTabChange={controls.toggleSidebar}
              roomCode={activeRoomCode}
              width={breakpoint === "tablet" ? "tablet" : "desktop"}
            />
          )}
        </div>

        {/* Controls */}
        {isMobile ? (
          <RoomMobileControls
            isMicOn={controls.isMicOn}
            isCamOn={controls.isCamOn}
            isScreenSharing={controls.isScreenSharing}
            layout={layout}
            settingsOpen={controls.settingsOpen}
            activePanel={activePanel === "video" ? null : activePanel}
            onPanelClick={handlePanelButtonClick}
            onToggleMic={controls.toggleMic}
            onToggleCam={controls.toggleCam}
            onToggleScreenShare={controls.toggleScreenShare}
            onLayoutChange={onLayoutChange}
            onToggleSettings={controls.toggleSettings}
            onLeave={onLeaveRequest}
          />
        ) : (
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
            size={breakpoint === "tablet" ? "md" : "lg"}
          />
        )}

        {/* Mobile Settings Panel */}
        {isMobile && (
          <SettingsPanel
            isOpen={controls.settingsOpen}
            onClose={controls.toggleSettings}
            isPushToTalk={controls.isPushToTalk}
            onTogglePushToTalk={controls.togglePushToTalk}
          />
        )}

        {/* Game Invite Toast */}
        <GameInviteToast
          invite={game.pendingInvite}
          onAccept={game.acceptGame}
          onDecline={game.declineGame}
        />

        {/* Leave Confirmation Modal */}
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

      {/* Mobile Bottom Sheets */}
      {isMobile && (
        <>
          <BottomSheet
            open={activePanel === "people"}
            onOpenChange={handleSheetOpenChange("people")}
            title={t_room("tooltips.participants")}
          >
            <ParticipantsPanel />
          </BottomSheet>

          <BottomSheet
            open={activePanel === "chat"}
            onOpenChange={handleSheetOpenChange("chat")}
            title={t_room("tooltips.chat")}
          >
            <ChatPanel roomCode={activeRoomCode} />
          </BottomSheet>

          <BottomSheet
            open={activePanel === "tools"}
            onOpenChange={handleSheetOpenChange("tools")}
            title={t_room("tooltips.tools")}
          >
            <ToolsPanel />
          </BottomSheet>
        </>
      )}
    </>
  );
}

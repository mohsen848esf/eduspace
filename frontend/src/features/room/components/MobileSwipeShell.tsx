import { useCallback, useEffect } from "react";
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
import MobileSwipeStage from "./MobileSwipeStage";
import MobileSwipeDots from "./MobileSwipeDots";
import ParticipantsPanel from "./panels/ParticipantsPanel";
import ChatPanel from "./panels/ChatPanel";
import ToolsPanel from "./panels/ToolsPanel";
import { type useGameBoard } from "../hooks/useGameBoard";

type LayoutMode = "grid" | "spotlight" | "sidebar";

interface MobileSwipeShellProps {
  // Shared between docked + mobile shells. Kept as a flat prop bag so each
  // shell explicitly declares what it needs from the parent RoomContent.
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

const PANEL_ORDER: ActivePanel[] = ["video", "people", "chat", "tools"];

const panelToIndex = (panel: ActivePanel): number => {
  const i = PANEL_ORDER.indexOf(panel);
  return i === -1 ? 0 : i;
};
const indexToPanel = (i: number): ActivePanel =>
  PANEL_ORDER[Math.max(0, Math.min(PANEL_ORDER.length - 1, i))];

/**
 * Mobile in-call layout — swipe pages variant.
 *
 * Renders four full-screen pages (Video, People, Chat, Tools) inside a
 * MobileSwipeStage, plus pagination dots and the refreshed bottom
 * control bar. The active panel is mirrored into useRoomLayoutStore so
 * other components (e.g., the bottom-sheet shell that may take over if
 * the user resizes) can read it.
 *
 * The leave-confirm modal lives here too, mirroring the docked shell so
 * the recording-aware leave flow keeps working on mobile.
 */
export default function MobileSwipeShell({
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
}: MobileSwipeShellProps) {
  const { t } = useTranslation("recordings");
  const { roomCode: storeRoomCode } = useRoomStore();
  const activeRoomCode = roomCode || storeRoomCode || "";

  const activePanel = useRoomLayoutStore((s) => s.activePanel);
  const setActivePanel = useRoomLayoutStore((s) => s.setActivePanel);

  // Keep the store and the swipe stage's index in sync.
  const onIndexChange = useCallback(
    (next: number) => setActivePanel(indexToPanel(next)),
    [setActivePanel],
  );

  // When a game launches, jump to the Video page so the host doesn't
  // have to swipe back from People/Chat/Tools to see it.
  useEffect(() => {
    if (game.gameBoard.isActive && activePanel !== "video") {
      setActivePanel("video");
    }
  }, [game.gameBoard.isActive, activePanel, setActivePanel]);

  return (
    <>
      <div className="flex flex-col w-full h-full">
        <RoomTopbar />

        <MobileSwipeStage
          activeIndex={panelToIndex(activePanel)}
          onActiveIndexChange={onIndexChange}
          ariaLabel="Call panels"
        >
          {/* Page 1 — video grid (or game when active). */}
          <div className="w-full h-full">
            {game.gameBoard.isActive ? (
              <GameBoard gameBoard={game.gameBoard} onEnd={game.endGame} />
            ) : (
              <VideoGrid layout={layout} onLayoutChange={onLayoutChange} />
            )}
          </div>

          {/* Pages 2-4 — panels with a mini video strip pinned on top. */}
          <div className="w-full h-full flex flex-col bg-[var(--s0)]">
            <MiniVideoStrip />
            <div className="flex-1 overflow-y-auto p-3">
              <ParticipantsPanel />
            </div>
          </div>

          <div className="w-full h-full flex flex-col bg-[var(--s0)]">
            <MiniVideoStrip />
            <div className="flex-1 overflow-hidden p-3">
              <ChatPanel roomCode={activeRoomCode} />
            </div>
          </div>

          <div className="w-full h-full flex flex-col bg-[var(--s0)]">
            <MiniVideoStrip />
            <div className="flex-1 overflow-y-auto p-3">
              <ToolsPanel />
            </div>
          </div>
        </MobileSwipeStage>

        <MobileSwipeDots
          count={PANEL_ORDER.length}
          active={panelToIndex(activePanel)}
          onSelect={onIndexChange}
          ariaLabel="Call pages"
        />

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
          onPanelButtonClick={(panel) => setActivePanel(panel)}
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
    </>
  );
}

/**
 * Mini video strip pinned to the top of People / Chat / Tools pages.
 *
 * Shows compact participant tiles in a horizontally scrollable row so
 * the user still has eyes on the call while interacting with a panel.
 *
 * Implementation note: we render VideoGrid in a tiny height-constrained
 * wrapper rather than reimplementing tile layout. The grid handles the
 * tile rendering itself; here we just give it a small viewport.
 */
function MiniVideoStrip() {
  return (
    <div className="h-20 flex-shrink-0 border-b border-[var(--b)] bg-[var(--s1)] overflow-hidden">
      <VideoGrid layout="grid" onLayoutChange={() => undefined} />
    </div>
  );
}

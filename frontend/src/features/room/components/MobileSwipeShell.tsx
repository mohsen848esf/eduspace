import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRoomStore } from "../store/roomStore";
import { useRoomLayoutStore, type ActivePanel } from "../store/roomLayoutStore";
import { type SidebarTab } from "../hooks/useRoomControls";
import VideoGrid from "./VideoGrid";
import GameBoard from "./GameBoard";
import GameInviteToast from "./GameInviteToast";
import RoomMobileTopbar from "./RoomMobileTopbar";
import RoomMobileControls from "./RoomMobileControls";
import SettingsPanel from "./SettingsPanel";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import MobileSwipeStage from "./MobileSwipeStage";
import MobilePanelTabs from "./MobilePanelTabs";
import ParticipantsPanel from "./panels/ParticipantsPanel";
import ChatPanel from "./panels/ChatPanel";
import ToolsPanel from "./panels/ToolsPanel";
import { type useGameBoard } from "../hooks/useGameBoard";

type LayoutMode = "grid" | "spotlight" | "sidebar";

interface MobileSwipeShellProps {
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
 * Layout (top → bottom):
 *   1. RoomMobileTopbar       — compact, single-line, overflow menu.
 *   2. MobilePanelTabs        — Video / People / Chat / Tools tab strip.
 *   3. MobileSwipeStage       — full-width, full-height pages.
 *   4. RoomMobileControls     — Mic, Camera, More, Leave only.
 *
 * Differences from the previous version:
 *   - Always opens on the Video page; activePanel is reset on mount so a
 *     stale store value can't land us in chat first.
 *   - No swipe-dot indicator (replaced by the top tab strip).
 *   - When the user leaves the Chat page (typing in the chat input was
 *     bouncing them back because the input kept focus), we explicitly
 *     blur any active element on every panel change.
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

  // Force-start on the Video page so re-entering a call never lands the
  // user on a stale panel choice.
  useEffect(() => {
    setActivePanel("video");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When a game launches, jump to the Video page so the host doesn't
  // have to swipe back from People/Chat/Tools to see it.
  useEffect(() => {
    if (game.gameBoard.isActive && activePanel !== "video") {
      setActivePanel("video");
    }
  }, [game.gameBoard.isActive, activePanel, setActivePanel]);

  // Whenever the panel changes, blur any focused input. Otherwise the
  // chat input stays focused after swiping away — typing on another
  // page keeps writing into the chat field, which we don't want.
  useEffect(() => {
    const el = document.activeElement;
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement
    ) {
      el.blur();
    }
  }, [activePanel]);

  const onIndexChange = useCallback(
    (next: number) => setActivePanel(indexToPanel(next)),
    [setActivePanel],
  );

  return (
    <>
      <div className="relative flex flex-col w-full h-full">
        <RoomMobileTopbar />

        <MobilePanelTabs
          active={activePanel}
          onChange={(panel) => setActivePanel(panel)}
        />

        <MobileSwipeStage
          activeIndex={panelToIndex(activePanel)}
          onActiveIndexChange={onIndexChange}
          ariaLabel="Call panels"
        >
          {/* Page 1 — Video grid (or the active game board). */}
          <div className="flex w-full h-full">
            {game.gameBoard.isActive ? (
              <GameBoard gameBoard={game.gameBoard} onEnd={game.endGame} />
            ) : (
              <VideoGrid layout={layout} onLayoutChange={onLayoutChange} />
            )}
          </div>

          {/* Page 2 — Participants. */}
          <div className="flex w-full h-full bg-[var(--s0)]">
            <div className="flex-1 overflow-y-auto p-3">
              <ParticipantsPanel />
            </div>
          </div>

          {/* Page 3 — Chat. */}
          <div className="flex w-full h-full bg-[var(--s0)]">
            <div className="flex-1 overflow-hidden p-3">
              <ChatPanel roomCode={activeRoomCode} />
            </div>
          </div>

          {/* Page 4 — Tools. */}
          <div className="flex w-full h-full bg-[var(--s0)]">
            <div className="flex-1 overflow-y-auto p-3">
              <ToolsPanel />
            </div>
          </div>
        </MobileSwipeStage>

        <RoomMobileControls
          isMicOn={controls.isMicOn}
          isCamOn={controls.isCamOn}
          isScreenSharing={controls.isScreenSharing}
          layout={layout}
          settingsOpen={controls.settingsOpen}
          onToggleMic={controls.toggleMic}
          onToggleCam={controls.toggleCam}
          onToggleScreenShare={controls.toggleScreenShare}
          onLayoutChange={onLayoutChange}
          onToggleSettings={controls.toggleSettings}
          onLeave={onLeaveRequest}
        />

        {/* SettingsPanel renders its own popover positioning; mounted
            here so the Settings button in the More menu can open it. */}
        <SettingsPanel
          isOpen={controls.settingsOpen}
          onClose={controls.toggleSettings}
          isPushToTalk={controls.isPushToTalk}
          onTogglePushToTalk={controls.togglePushToTalk}
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

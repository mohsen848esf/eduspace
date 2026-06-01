import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRoomStore } from "../store/roomStore";
import { useRoomLayoutStore, type ActivePanel } from "../store/roomLayoutStore";
import { type SidebarTab } from "../hooks/useRoomControls";
import VideoGrid from "./VideoGrid";
import GameBoard from "./GameBoard";
import GameInviteToast from "./GameInviteToast";
import RoomMobileTopbar from "./RoomMobileTopbar";
import RoomMobileControls from "./RoomMobileControls";
import RoomRecordingBadge from "./RoomRecordingBadge";
import SettingsPanel from "./SettingsPanel";
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
 * Mobile in-call layout — the single mobile mode for the project.
 *
 * The earlier swipe-pages variant was fragile: a transformed track
 * captured `position: fixed` modals and `scrollIntoView` calls dragged
 * the track sideways, leading to the "tab says one thing, content shows
 * another" bug. We replaced it with a much simpler design:
 *
 *   - Video grid is permanently full-screen behind everything.
 *   - The control bar in the bottom strip carries the panel buttons
 *     (People / Chat / Tools) alongside Mic / Cam / Leave etc.
 *   - Tapping a panel button opens a BottomSheet that covers most of
 *     the screen and hosts the panel's content. Closing the sheet
 *     returns focus to the call.
 *
 * Modals (Invite, etc.) inside panels work correctly because there are
 * no transformed ancestors to trap their `position: fixed` layer.
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

  // Reset to Video on mount so re-entering a call always starts on the
  // call surface rather than reopening a sheet.
  useEffect(() => {
    setActivePanel("video");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Blur any focused input when the sheet closes — otherwise the user
  // can keep typing into the chat input that was last focused.
  useEffect(() => {
    if (activePanel !== "video") return;
    const el = document.activeElement;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.blur();
    }
  }, [activePanel]);

  // Close the active sheet when its dialog asks to close (backdrop / esc /
  // drag-to-dismiss). Each sheet is bound to a panel id so we can match.
  const handleSheetOpenChange = (panel: ActivePanel) => (open: boolean) => {
    if (!open && activePanel === panel) {
      setActivePanel("video");
    }
  };

  // Panel-button click on the bottom bar toggles its sheet.
  const handlePanelButtonClick = (panel: "people" | "chat" | "tools") => {
    setActivePanel(activePanel === panel ? "video" : panel);
  };

  // The +N overflow button on the pinned-share layout dispatches this
  // event — open the People sheet so the user can see everyone.
  useEffect(() => {
    const handler = () => setActivePanel("people");
    window.addEventListener("eduspace:open-people-tab", handler);
    return () =>
      window.removeEventListener("eduspace:open-people-tab", handler);
  }, [setActivePanel]);

  return (
    <>
      <div className="relative flex flex-col w-full h-full">
        <RoomMobileTopbar />

        {/* Full-screen video grid (or game) — sheets cover it on demand.
            The wrapper is a flex column so VideoGrid's `flex-1` actually
            stretches; without `flex flex-col` here, VideoGrid would
            collapse to its content height and leave the bottom 2/3 of
            the screen black. */}
        <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
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
          ) : (
            <VideoGrid layout={layout} onLayoutChange={onLayoutChange} />
          )}
          <RoomRecordingBadge
            className={
              game.gameBoard.isActive ? "top-12 end-3" : undefined
            }
          />
        </div>

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

      {/* Three independent sheets keyed off activePanel. Each lives at the
          page root (BottomSheet uses a Radix Portal) so nothing inside a
          panel — modals, popovers, etc. — gets trapped by an ancestor
          transform. */}
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

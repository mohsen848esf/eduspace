import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "../../../components/ui/Tooltip";
import { Icons } from "../../../lib/constants/icons";
import { cn } from "../../../lib/utils";
import { type LayoutMode } from "../store/roomLayoutStore";
import { useRoomWhiteboard } from "../hooks/useRoomWhiteboardContext";
import ReactionsPopover from "./reactions/ReactionsPopover";

type PanelId = "people" | "chat" | "tools";

interface RoomMobileControlsProps {
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  layout?: LayoutMode;
  settingsOpen: boolean;
  activePanel: PanelId | null;
  onPanelClick: (panel: PanelId) => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onLayoutChange?: (l: LayoutMode) => void;
  onToggleSettings: () => void;
  onLeave: () => void;
  handRaised: boolean;
  onToggleHandRaise?: () => void;
  onSendReaction?: (emoji: string) => void;
}

export default function RoomMobileControls({
  isMicOn,
  isCamOn,
  isScreenSharing,
  settingsOpen,
  activePanel,
  onPanelClick,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onToggleSettings,
  onLeave,
  handRaised,
  onToggleHandRaise,
  onSendReaction,
}: RoomMobileControlsProps) {
  const { t } = useTranslation("room");
  const [reactionsOpen, setReactionsOpen] = useState(false);

  const {
    whiteboard: whiteboardState,
    restoreWhiteboard,
  } = useRoomWhiteboard();
  const isWhiteboardActive = whiteboardState?.isActive;
  const isWhiteboardMinimized = whiteboardState?.isMinimized;

  return (
    <div className="relative flex-shrink-0 flex flex-col items-center select-none z-30 pb-[max(env(safe-area-inset-bottom),0.5rem)] px-2">
      {/* ── Active Whiteboard Floating Pill (when minimized on mobile) ── */}
      {isWhiteboardActive && isWhiteboardMinimized && (
        <div className="mb-2 animate-bounce-subtle">
          <button
            type="button"
            onClick={restoreWhiteboard}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-full border shadow-lg cursor-pointer transition-all",
              "bg-[#064e3b]/95 border-emerald-400/60 text-emerald-100 shadow-emerald-950/40 active:scale-95 text-xs font-semibold"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>✏️ {t("whiteboard.viewActiveBoard", "وایت‌برد فعال (لمس برای باز کردن)")}</span>
          </button>
        </div>
      )}

      {/* ── Floating Reactions Tray for Mobile ── */}
      <div className="relative w-full flex justify-center">
        <ReactionsPopover
          isOpen={reactionsOpen}
          onClose={() => setReactionsOpen(false)}
          onSelectEmoji={(emoji) => {
            if (onSendReaction) onSendReaction(emoji);
          }}
        />
      </div>

      {/* ── Floating Glassmorphic Mobile Controls Dock ── */}
      <div
        className={cn(
          "w-full max-w-[480px] flex items-center justify-between gap-1 sm:gap-1.5 p-1 sm:p-1.5 rounded-2xl border shadow-2xl backdrop-blur-2xl",
          "bg-[var(--s2)]/95 border-[var(--b)] text-[var(--t1)] shadow-2xl overflow-x-auto scrollbar-none"
        )}
      >
        {/* Mic Toggle */}
        <MobileDockBtn
          tooltip={isMicOn ? t("tooltips.muteOn") : t("tooltips.muteOff")}
          icon={isMicOn ? Icons.mic : Icons.micOff}
          onClick={onToggleMic}
          variant={isMicOn ? "emerald" : "danger"}
          ariaLabel={t("controls.mic")}
        />

        {/* Cam Toggle */}
        <MobileDockBtn
          tooltip={isCamOn ? t("tooltips.cameraOn") : t("tooltips.cameraOff")}
          icon={isCamOn ? Icons.camera : Icons.cameraOff}
          onClick={onToggleCam}
          variant={isCamOn ? "emerald" : "danger"}
          ariaLabel={t("controls.camera")}
        />

        {/* Live Reactions */}
        <MobileDockBtn
          tooltip={t("controls.reactions", "واکنش")}
          icon={<span className="text-base sm:text-lg leading-none">😊</span>}
          onClick={() => setReactionsOpen((prev) => !prev)}
          variant={reactionsOpen ? "active" : "default"}
          ariaLabel={t("controls.reactions")}
        />

        {/* Screen Share */}
        <MobileDockBtn
          tooltip={t("tooltips.screenShare")}
          icon={Icons.screenShare}
          onClick={onToggleScreenShare}
          variant={isScreenSharing ? "active" : "default"}
          ariaLabel={t("controls.share")}
        />

        {/* Raise Hand */}
        <MobileDockBtn
          tooltip={handRaised ? t("tooltips.lowerHand") : t("tooltips.raiseHand")}
          icon={handRaised ? Icons.handFilled : Icons.hand}
          onClick={onToggleHandRaise || (() => {})}
          variant={handRaised ? "amber" : "default"}
          ariaLabel={t("controls.raiseHand")}
        />

        {/* Tools Sheet Trigger */}
        <MobileDockBtn
          tooltip={t("controls.tools", "ابزارها")}
          icon={Icons.tools}
          onClick={() => onPanelClick("tools")}
          variant={activePanel === "tools" ? "active" : "default"}
          ariaLabel={t("controls.tools")}
        />

        {/* Chat Sheet Trigger */}
        <MobileDockBtn
          tooltip={t("controls.chat", "گفتگو")}
          icon={Icons.chat}
          onClick={() => onPanelClick("chat")}
          variant={activePanel === "chat" ? "active" : "default"}
          ariaLabel={t("controls.chat")}
        />

        {/* People Sheet Trigger */}
        <MobileDockBtn
          tooltip={t("controls.people", "حاضرین")}
          icon={Icons.people}
          onClick={() => onPanelClick("people")}
          variant={activePanel === "people" ? "active" : "default"}
          ariaLabel={t("controls.people")}
        />

        {/* Settings */}
        <MobileDockBtn
          tooltip={t("controls.settings", "تنظیمات")}
          icon={Icons.settings}
          onClick={onToggleSettings}
          variant={settingsOpen ? "active" : "default"}
          ariaLabel={t("controls.settings")}
        />

        {/* Leave Call (Red Accent) */}
        <Tooltip content={t("tooltips.leave")}>
          <button
            type="button"
            onClick={onLeave}
            aria-label={t("tooltips.leave")}
            className={cn(
              "w-8.5 h-8.5 sm:w-10 sm:h-10 min-w-8.5 sm:min-w-10 rounded-xl flex items-center justify-center border-none cursor-pointer shrink-0",
              "bg-rose-600 hover:bg-rose-700 active:scale-90 text-white shadow-md shadow-rose-600/40 transition-transform duration-150"
            )}
          >
            {Icons.leave}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

interface MobileDockBtnProps {
  tooltip: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "active" | "danger" | "emerald" | "amber";
  ariaLabel?: string;
}

function MobileDockBtn({
  tooltip,
  icon,
  onClick,
  variant = "default",
  ariaLabel,
}: MobileDockBtnProps) {
  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel || tooltip}
        className={cn(
          "w-8.5 h-8.5 sm:w-10 sm:h-10 min-w-8.5 sm:min-w-10 rounded-xl flex items-center justify-center border transition-all duration-150 cursor-pointer shrink-0",
          "active:scale-90 select-none [&>svg]:w-4 [&>svg]:h-4 sm:[&>svg]:w-5 sm:[&>svg]:h-5 [&>svg]:stroke-current [&>svg]:fill-none",
          variant === "default" &&
            "bg-[var(--s3)] hover:bg-[var(--s4)] border-[var(--b)] text-[var(--t2)] hover:text-[var(--t1)]",
          variant === "active" &&
            "bg-[var(--brand-soft)] border-[var(--brand)]/60 text-[var(--brand-dark)] dark:text-white shadow-xs ring-2 ring-[var(--brand)]/40",
          variant === "emerald" &&
            "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
          variant === "danger" &&
            "bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400",
          variant === "amber" &&
            "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400"
        )}
      >
        {icon}
      </button>
    </Tooltip>
  );
}

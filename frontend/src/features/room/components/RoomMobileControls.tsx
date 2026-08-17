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
          "w-full max-w-[460px] flex items-center justify-between gap-1 p-1.5 rounded-2xl border shadow-2xl backdrop-blur-2xl",
          "bg-[#0f172a]/95 dark:bg-[#0f172a]/95 border-white/15 text-white shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
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
          icon={<span className="text-lg leading-none">😊</span>}
          onClick={() => setReactionsOpen((prev) => !prev)}
          variant={reactionsOpen ? "active" : "default"}
          ariaLabel={t("controls.reactions")}
        />

        {/* Screen Share (shown when active or on wider mobile screens) */}
        {isScreenSharing && (
          <MobileDockBtn
            tooltip={t("tooltips.screenShare")}
            icon={Icons.screenShare}
            onClick={onToggleScreenShare}
            variant="active"
            ariaLabel={t("controls.share")}
          />
        )}

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
              "w-10 h-10 min-w-10 rounded-xl flex items-center justify-center border-none cursor-pointer",
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
          "w-10 h-10 min-w-10 rounded-xl flex items-center justify-center border transition-all duration-150 cursor-pointer",
          "active:scale-90 select-none",
          variant === "default" &&
            "bg-white/10 hover:bg-white/15 border-white/10 text-gray-200",
          variant === "active" &&
            "bg-indigo-600 border-indigo-400 text-white shadow-[0_0_12px_rgba(99,102,241,0.5)]",
          variant === "emerald" &&
            "bg-emerald-600/90 border-emerald-400 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]",
          variant === "danger" &&
            "bg-rose-600/90 border-rose-400 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)]",
          variant === "amber" &&
            "bg-amber-600 border-amber-400 text-white shadow-[0_0_12px_rgba(245,158,11,0.5)]"
        )}
      >
        {icon}
      </button>
    </Tooltip>
  );
}

import { useTranslation } from "react-i18next";
import { Tooltip } from "../../../components/ui/Tooltip";
import { Icons } from "../../../lib/constants/icons";
import { cn } from "../../../lib/utils";

type LayoutMode = "grid" | "spotlight" | "sidebar";
type PanelId = "people" | "chat" | "tools";

interface RoomMobileControlsProps {
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  layout: LayoutMode;
  settingsOpen: boolean;
  /**
   * The panel whose sheet is currently open, or null when the user is
   * looking at the call surface. Drives the panel-button highlight.
   */
  activePanel: PanelId | null;
  onPanelClick: (panel: PanelId) => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onLayoutChange: (l: LayoutMode) => void;
  onToggleSettings: () => void;
  onLeave: () => void;
}

/**
 * Mobile-only in-call control bar.
 *
 * One centered row of icon-only controls plus a circular Leave button
 * pinned at the end. Panel buttons (People / Chat / Tools) live here
 * too — tapping one opens its bottom sheet.
 *
 * Layout (LTR):
 *   |              [mic][cam][share][people][chat][tools][⊞][⚙]            [leave] |
 */
export default function RoomMobileControls({
  isMicOn,
  isCamOn,
  isScreenSharing,
  layout,
  settingsOpen,
  activePanel,
  onPanelClick,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onLayoutChange,
  onToggleSettings,
  onLeave,
}: RoomMobileControlsProps) {
  const { t } = useTranslation("room");

  const cycleLayout = () => {
    const next: LayoutMode =
      layout === "grid"
        ? "spotlight"
        : layout === "spotlight"
          ? "sidebar"
          : "grid";
    onLayoutChange(next);
  };
  const layoutIcon =
    layout === "grid" ? "⊞" : layout === "spotlight" ? "□" : "▤";

  return (
    <div
      className={cn(
        "relative flex-shrink-0 bg-[var(--s1)] border-t border-[var(--b)]",
        "flex items-center justify-center gap-1 px-3 py-2",
        "pb-[max(env(safe-area-inset-bottom),0.5rem)]",
      )}
    >
      <IconButton
        tooltip={isMicOn ? t("tooltips.muteOn") : t("tooltips.muteOff")}
        icon={isMicOn ? Icons.mic : Icons.micOff}
        onClick={onToggleMic}
        variant={isMicOn ? "default" : "danger"}
      />
      <IconButton
        tooltip={isCamOn ? t("tooltips.cameraOn") : t("tooltips.cameraOff")}
        icon={isCamOn ? Icons.camera : Icons.cameraOff}
        onClick={onToggleCam}
        variant={isCamOn ? "default" : "danger"}
      />
      <IconButton
        tooltip={t("tooltips.screenShare")}
        icon={Icons.screenShare}
        onClick={onToggleScreenShare}
        variant={isScreenSharing ? "active" : "default"}
      />

      <span className="w-px h-6 bg-[var(--b)] mx-0.5" aria-hidden />

      <IconButton
        tooltip={t("tooltips.participants")}
        icon={Icons.people}
        onClick={() => onPanelClick("people")}
        variant={activePanel === "people" ? "active" : "default"}
      />
      <IconButton
        tooltip={t("tooltips.chat")}
        icon={Icons.chat}
        onClick={() => onPanelClick("chat")}
        variant={activePanel === "chat" ? "active" : "default"}
      />
      <IconButton
        tooltip={t("tooltips.tools")}
        icon={Icons.tools}
        onClick={() => onPanelClick("tools")}
        variant={activePanel === "tools" ? "active" : "default"}
      />

      <span className="w-px h-6 bg-[var(--b)] mx-0.5" aria-hidden />

      <IconButton
        tooltip={t("tooltips.layout")}
        icon={<span className="text-base leading-none">{layoutIcon}</span>}
        onClick={cycleLayout}
      />
      <IconButton
        tooltip={t("tooltips.settings")}
        icon={Icons.settings}
        onClick={onToggleSettings}
        variant={settingsOpen ? "active" : "default"}
      />

      {/* Leave is pinned to the end side via absolute so the row stays
          visually centered around its content. */}
      <Tooltip content={t("tooltips.leave")}>
        <button
          onClick={onLeave}
          aria-label={t("tooltips.leave")}
          className={cn(
            "absolute end-3 top-1/2 -translate-y-1/2",
            "w-10 h-10 rounded-full border-none cursor-pointer",
            "bg-[var(--red)] text-white shadow-md shadow-[var(--red)]/30",
            "flex items-center justify-center",
            "transition-colors duration-150 active:scale-[0.96]",
            "hover:bg-[var(--red)]/90",
          )}
        >
          {Icons.leave}
        </button>
      </Tooltip>
    </div>
  );
}

interface IconButtonProps {
  tooltip: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "active" | "danger";
}

function IconButton({
  tooltip,
  icon,
  onClick,
  variant = "default",
}: IconButtonProps) {
  return (
    <Tooltip content={tooltip}>
      <button
        onClick={onClick}
        aria-label={tooltip}
        className={cn(
          "w-9 h-9 rounded-lg border-none cursor-pointer",
          "flex items-center justify-center",
          "transition-colors duration-150 active:scale-[0.96]",
          "[&>svg]:w-[18px] [&>svg]:h-[18px]",
          variant === "active" &&
            "bg-[var(--brand-soft)] text-[var(--brand-text)]",
          variant === "danger" && "bg-[var(--red)]/15 text-[var(--red)]",
          variant === "default" &&
            "bg-transparent text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)]",
        )}
      >
        {icon}
      </button>
    </Tooltip>
  );
}

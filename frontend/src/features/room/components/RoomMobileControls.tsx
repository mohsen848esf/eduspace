import { useTranslation } from "react-i18next";
import { Tooltip } from "../../../components/ui/Tooltip";
import { Icons } from "../../../lib/constants/icons";
import { cn } from "../../../lib/utils";

type LayoutMode = "grid" | "spotlight" | "sidebar";

interface RoomMobileControlsProps {
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  layout: LayoutMode;
  settingsOpen: boolean;
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
 * Icon-only row matching the user's reference design:
 *
 *   [ mic ] [ cam ] [ share ] [ layout ] [ settings ]      [ leave ]
 *
 * Panel switching (People / Chat / Tools) lives in MobilePanelTabs at
 * the top of the screen, not here. Keeping the bar lean prevents the
 * cramped look the previous version had at 320–375px viewports.
 */
export default function RoomMobileControls({
  isMicOn,
  isCamOn,
  isScreenSharing,
  layout,
  settingsOpen,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onLayoutChange,
  onToggleSettings,
  onLeave,
}: RoomMobileControlsProps) {
  const { t } = useTranslation("room");

  // Cycle layout modes on each tap. Mobile users don't need a popover;
  // the layout difference at small widths is mostly cosmetic anyway.
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
        "flex-shrink-0 bg-[var(--s1)] border-t border-[var(--b)]",
        "flex items-center justify-between gap-2 px-3 py-2",
        "pb-[max(env(safe-area-inset-bottom),0.5rem)]",
      )}
    >
      <div className="flex items-center gap-1.5">
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
      </div>

      <Tooltip content={t("tooltips.leave")}>
        <button
          onClick={onLeave}
          aria-label={t("tooltips.leave")}
          className={cn(
            "w-11 h-11 rounded-full border-none cursor-pointer",
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
          "w-10 h-10 rounded-xl border-none cursor-pointer",
          "flex items-center justify-center",
          "transition-colors duration-150 active:scale-[0.96]",
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

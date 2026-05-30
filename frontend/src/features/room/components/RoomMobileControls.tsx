import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icons } from "../../../lib/constants/icons";
import { cn } from "../../../lib/utils";
import ControlButton from "../../../components/ui/ControlButton";

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
 * Surfaces only the four absolutely-essential controls so the row fits
 * a 320px viewport without crowding:
 *
 *   [ Mic ] [ Camera ] [ ⋯ More ]   |   [ Leave ]
 *
 * The "More" button opens a small popup with the rest (screen share,
 * layout picker, settings). Panel switching (People / Chat / Tools) is
 * driven by the per-page top tab strip in MobileSwipeShell, not by
 * this bar — that's why those controls are absent here.
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
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMore) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMore]);

  const layoutIcon =
    layout === "grid" ? "⊞" : layout === "spotlight" ? "□" : "▤";

  return (
    <div
      className={cn(
        "h-16 flex-shrink-0 bg-[var(--s1)] border-t border-[var(--b)]",
        "flex items-center justify-between gap-2 px-3",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="flex items-center gap-1.5">
        <ControlButton
          icon={isMicOn ? Icons.mic : Icons.micOff}
          label={t("controls.mic")}
          onClick={onToggleMic}
          variant={isMicOn ? "default" : "danger"}
          size="sm"
        />
        <ControlButton
          icon={isCamOn ? Icons.camera : Icons.cameraOff}
          label={t("controls.camera")}
          onClick={onToggleCam}
          variant={isCamOn ? "default" : "danger"}
          size="sm"
        />
        <div ref={moreRef} className="relative">
          <ControlButton
            icon={<span className="text-base leading-none">⋯</span>}
            label={t("dashboard:nav.more", { defaultValue: "More" })}
            onClick={() => setShowMore((p) => !p)}
            variant={showMore ? "active" : "default"}
            size="sm"
          />
          {showMore && (
            <div className="absolute bottom-[68px] start-0 z-50 bg-[var(--s2)] border border-[var(--b)] rounded-xl shadow-2xl p-2 w-56 fade-in flex flex-col gap-1">
              {/* Screen share */}
              <button
                onClick={() => {
                  setShowMore(false);
                  onToggleScreenShare();
                }}
                className={cn(
                  "flex items-center gap-2.5 px-2 py-2 rounded-lg border-none cursor-pointer text-start transition-colors min-h-11",
                  isScreenSharing
                    ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
                    : "bg-transparent text-[var(--t1)] hover:bg-[var(--s3)]",
                )}
              >
                <span className="w-5 flex items-center justify-center">
                  {Icons.screenShare}
                </span>
                <span className="text-sm font-medium flex-1">
                  {t("controls.share")}
                </span>
                {isScreenSharing && (
                  <span className="text-xs text-[var(--brand-text)]">●</span>
                )}
              </button>

              {/* Layout — cycles through grid → spotlight → sidebar */}
              <button
                onClick={() => {
                  const next: LayoutMode =
                    layout === "grid"
                      ? "spotlight"
                      : layout === "spotlight"
                        ? "sidebar"
                        : "grid";
                  onLayoutChange(next);
                  setShowMore(false);
                }}
                className="flex items-center gap-2.5 px-2 py-2 rounded-lg border-none cursor-pointer text-start transition-colors min-h-11 bg-transparent text-[var(--t1)] hover:bg-[var(--s3)]"
              >
                <span className="w-5 flex items-center justify-center text-base">
                  {layoutIcon}
                </span>
                <span className="text-sm font-medium flex-1">
                  {t("controls.layout")}
                </span>
                <span className="text-[10px] text-[var(--t3)] uppercase tracking-wider">
                  {t(`layouts.${layout}`)}
                </span>
              </button>

              {/* Settings */}
              <button
                onClick={() => {
                  setShowMore(false);
                  onToggleSettings();
                }}
                className={cn(
                  "flex items-center gap-2.5 px-2 py-2 rounded-lg border-none cursor-pointer text-start transition-colors min-h-11",
                  settingsOpen
                    ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
                    : "bg-transparent text-[var(--t1)] hover:bg-[var(--s3)]",
                )}
              >
                <span className="w-5 flex items-center justify-center">
                  {Icons.settings}
                </span>
                <span className="text-sm font-medium flex-1">
                  {t("controls.settings")}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      <ControlButton
        icon={Icons.leave}
        label={t("controls.leave")}
        onClick={onLeave}
        variant="leave"
        size="sm"
      />
    </div>
  );
}

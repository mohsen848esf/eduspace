import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../../lib/utils";
import { Tooltip } from "../../../../components/ui/Tooltip";
import { Icons } from "../../../../lib/constants/icons";
import { useRoomWhiteboard } from "../../hooks/useRoomWhiteboardContext";
import { useRoomStore } from "../../store/roomStore";

interface DockStackFanOutProps {
  onOpenPanel: (panel: "tools") => void;
  onOpenMiniApps?: () => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
}

interface StackItem {
  id: string;
  labelKey: string;
  defaultLabel: string;
  icon: string | React.ReactNode;
  action: () => void;
}

export default function DockStackFanOut({
  onOpenPanel,
  onOpenMiniApps,
  isOpen,
  onToggle,
  onClose,
  size = "md",
}: DockStackFanOutProps) {
  const { t } = useTranslation("room");
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const {
    whiteboard,
    restoreWhiteboard,
    minimizeWhiteboard,
    launchWhiteboard,
  } = useRoomWhiteboard();
  const {
    isHost,
    activePresentation,
    isPresentationMinimized,
    setIsPresentationMinimized,
  } = useRoomStore();

  const isRtl =
    typeof document !== "undefined" &&
    (document.documentElement.dir === "rtl" ||
      document.body.getAttribute("dir") === "rtl");

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  const handleWhiteboardAction = useCallback(() => {
    onClose();
    if (whiteboard.isActive) {
      if (whiteboard.isMinimized) {
        restoreWhiteboard();
      } else {
        minimizeWhiteboard();
      }
    } else {
      if (isHost) {
        launchWhiteboard();
      } else {
        onOpenPanel("tools");
      }
    }
  }, [
    whiteboard.isActive,
    whiteboard.isMinimized,
    isHost,
    launchWhiteboard,
    restoreWhiteboard,
    minimizeWhiteboard,
    onOpenPanel,
    onClose,
  ]);

  const handlePresentationAction = useCallback(() => {
    onClose();
    if (activePresentation) {
      if (isPresentationMinimized) {
        setIsPresentationMinimized(false);
      } else {
        setIsPresentationMinimized(true);
      }
    } else {
      window.dispatchEvent(new CustomEvent("eduspace:open-presentation-modal"));
    }
  }, [
    activePresentation,
    isPresentationMinimized,
    setIsPresentationMinimized,
    onClose,
  ]);

  const handleMiniAppsAction = useCallback(() => {
    onClose();
    if (onOpenMiniApps) {
      onOpenMiniApps();
    } else {
      onOpenPanel("tools");
    }
  }, [onOpenMiniApps, onOpenPanel, onClose]);

  // 5 Classroom Tools Items
  const stackItems: StackItem[] = [
    {
      id: "whiteboard",
      labelKey: "tools.whiteboard",
      defaultLabel: "تخته وایت‌برد هوشمند",
      icon: "✏️",
      action: handleWhiteboardAction,
    },
    {
      id: "presentation",
      labelKey: "tools.presentationShare",
      defaultLabel: "اشتراک و ارائه فایل و اسلاید",
      icon: "📑",
      action: handlePresentationAction,
    },
    {
      id: "miniapps",
      labelKey: "tools.miniApps",
      defaultLabel: "مینی‌اپ‌ها و بازی‌ها",
      icon: "🎮",
      action: handleMiniAppsAction,
    },
    {
      id: "quiz",
      labelKey: "tools.quickQuiz",
      defaultLabel: "آزمون سریع و پرسش",
      icon: "📊",
      action: () => {
        onClose();
        onOpenPanel("tools");
      },
    },
    {
      id: "all_tools",
      labelKey: "tools.allTools",
      defaultLabel: "تمامی ابزارها و فعالیت‌ها",
      icon: "🧰",
      action: () => {
        onClose();
        onOpenPanel("tools");
      },
    },
  ];

  const buttonSizeClass =
    size === "sm"
      ? "w-10 h-10 min-w-10 rounded-xl text-base"
      : size === "md"
      ? "w-11 h-11 min-w-11 rounded-xl text-lg"
      : "w-12 h-12 min-w-12 rounded-xl text-xl";

  // Inward direction multiplier:
  // In RTL: dock is on bottom-left, so fan RIGHT (+1) into screen center
  // In LTR: dock is on bottom-right, so fan LEFT (-1) into screen center
  const dirFactor = isRtl ? 1 : -1;

  // Slant rotation angle:
  // In RTL: fanning right -> -10deg
  // In LTR: fanning left -> +10deg
  const rotationAngle = isRtl ? -10 : 10;

  // Origin point of the SVG branches anchor
  const originX = isRtl ? 20 : 265;
  const originY = 265;

  return (
    <div ref={containerRef} className="relative select-none inline-flex items-center">
      {/* ── Slanted Fan-Out Container (Inward In-Viewport Trajectory) ── */}
      <div
        className={cn(
          "absolute bottom-full mb-3 pointer-events-none z-50",
          isRtl ? "left-0" : "right-0",
          isOpen ? "pointer-events-auto" : "invisible"
        )}
        style={{
          perspective: "1000px",
          width: "290px",
          height: "260px",
        }}
      >
        {/* ── Connecting Curved SVG Branch Lines ── */}
        {isOpen && (
          <svg
            className={cn(
              "absolute bottom-0 w-[320px] h-[280px] overflow-visible pointer-events-none -z-10",
              isRtl ? "-left-4" : "-right-4"
            )}
            style={{
              filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.15))",
            }}
          >
            {stackItems.map((_, i) => {
              // Target connection coordinate on card:
              // i = 0 is Top (Whiteboard), i = 4 is Bottom (All Tools)
              const cardOffsetY = 210 - i * 44;
              const cardOffsetX = isRtl
                ? 175 + (4 - i) * 12
                : 115 - (4 - i) * 12;

              // Control points for organic branch curve
              const ctrl1X = originX + dirFactor * (25 + (4 - i) * 10);
              const ctrl1Y = originY - (30 + (4 - i) * 20);
              const ctrl2X = cardOffsetX - dirFactor * 35;
              const ctrl2Y = cardOffsetY + 15;

              const isHovered = hoveredIdx === i;

              return (
                <path
                  key={i}
                  d={`M ${originX} ${originY} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${cardOffsetX} ${cardOffsetY}`}
                  fill="none"
                  stroke={
                    isHovered
                      ? "rgba(59, 130, 246, 0.95)"
                      : "rgba(148, 163, 184, 0.4)"
                  }
                  strokeWidth={isHovered ? "2.5" : "1.5"}
                  strokeLinecap="round"
                  className="transition-all duration-200"
                />
              );
            })}
          </svg>
        )}

        {/* ── Stacked Slanted Cards ── */}
        <div className="relative w-full h-full">
          {stackItems.map((item, i) => {
            const isHovered = hoveredIdx === i;

            // Geometry: i = 0 (top) down to i = 4 (bottom)
            const translateY = isOpen ? -(45 + (4 - i) * 44) : 0;
            const translateX = isOpen ? dirFactor * (28 + (4 - i) * 12) : 0;

            const scale = isOpen ? (isHovered ? 1.06 : 1) : 0.4;
            const opacity = isOpen ? 1 : 0;
            const zIndex = isHovered ? 60 : 40 + i;
            const delay = isOpen ? `${(4 - i) * 35}ms` : `${i * 20}ms`;

            return (
              <div
                key={item.id}
                className="absolute bottom-0 transition-all cursor-pointer"
                style={{
                  transform: `translate3d(${translateX}px, ${translateY}px, ${
                    isHovered ? 25 : 0
                  }px) rotateZ(${rotationAngle}deg) scale(${scale})`,
                  transformOrigin: isRtl ? "bottom left" : "bottom right",
                  transitionDuration: isOpen ? "340ms" : "220ms",
                  transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                  transitionDelay: delay,
                  opacity,
                  zIndex,
                }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={item.action}
              >
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-200 shadow-xl border",
                    isHovered
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400/80 shadow-[0_10px_28px_rgba(37,99,235,0.5)] ring-2 ring-blue-400"
                      : "bg-[#1e293b]/95 text-slate-100 border-white/10 hover:border-white/25 hover:bg-[#283548]"
                  )}
                  style={{ minWidth: "185px", maxWidth: "230px" }}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "flex items-center justify-center text-lg transition-transform duration-200 flex-shrink-0",
                      isHovered ? "scale-115" : ""
                    )}
                  >
                    {item.icon}
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      "text-xs font-semibold tracking-tight truncate",
                      isHovered ? "text-white" : "text-slate-100"
                    )}
                  >
                    {t(item.labelKey, item.defaultLabel)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Trigger Button in the Dock ── */}
      <Tooltip
        content={
          isOpen
            ? t("tools.closeStack", "بستن منوی ابزارها")
            : t("tools.stackTooltip", "ابزارها و فعالیت‌های کلاس")
        }
      >
        <button
          type="button"
          onClick={onToggle}
          aria-label={t("controls.tools", "ابزارها")}
          className={cn(
            "relative flex items-center justify-center border border-[var(--b)] cursor-pointer transition-all duration-200 ease-out shadow-xs",
            buttonSizeClass,
            "hover:-translate-y-0.5 hover:scale-105 active:scale-95",
            isOpen
              ? "bg-[var(--brand-soft)] text-[var(--brand-text)] ring-2 ring-[var(--brand)] shadow-[0_0_15px_var(--brand)]"
              : "bg-[var(--s2)] text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)]"
          )}
        >
          <span className="flex items-center justify-center">
            {Icons.tools}
          </span>

          {/* Active Tool Corner Badge */}
          {whiteboard.isActive ? (
            <span
              className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center shadow-md ring-2 ring-[var(--s1)] animate-in zoom-in"
              title={t("whiteboard.title", "تخته وایت‌برد فعال")}
            >
              ✏️
            </span>
          ) : activePresentation ? (
            <span
              className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center shadow-md ring-2 ring-[var(--s1)] animate-in zoom-in"
              title={activePresentation.title}
            >
              📑
            </span>
          ) : null}

          {/* Active Indicator Dot */}
          {isOpen && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[var(--brand)] shadow-[0_0_6px_var(--brand)] animate-in fade-in zoom-in" />
          )}
        </button>
      </Tooltip>
    </div>
  );
}

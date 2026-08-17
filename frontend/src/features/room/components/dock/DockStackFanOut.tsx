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
  badge?: string;
  color: string;
  bgGradient: string;
  subLabel: string;
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
  const [isPeekHovered, setIsPeekHovered] = useState(false);

  const {
    whiteboard,
    launchWhiteboard,
    restoreWhiteboard,
    minimizeWhiteboard,
  } = useRoomWhiteboard();
  const { isHost } = useRoomStore();

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

  const handleMiniAppsAction = useCallback(() => {
    onClose();
    if (onOpenMiniApps) {
      onOpenMiniApps();
    } else {
      onOpenPanel("tools");
    }
  }, [onOpenMiniApps, onOpenPanel, onClose]);

  // Primary top tools + Summary card for remaining tools
  const stackItems: StackItem[] = [
    {
      id: "whiteboard",
      labelKey: "tools.whiteboard",
      defaultLabel: "تخته وایت‌برد هوشمند",
      icon: "✏️",
      badge: whiteboard.isActive
        ? whiteboard.isMinimized
          ? "فعال (کوچک)"
          : "در حال نمایش"
        : undefined,
      color: "#10b981",
      bgGradient: "from-emerald-500/30 to-teal-600/30",
      subLabel: "تخته تعاملی و ترسیم",
      action: handleWhiteboardAction,
    },
    {
      id: "miniapps",
      labelKey: "tools.miniApps",
      defaultLabel: "مینی‌اپ‌ها و بازی‌ها",
      icon: "🎮",
      color: "#8b5cf6",
      bgGradient: "from-purple-500/30 to-indigo-600/30",
      subLabel: "بازی‌های کلاسی و آموزشی",
      action: handleMiniAppsAction,
    },
    {
      id: "quiz",
      labelKey: "tools.quickQuiz",
      defaultLabel: "آزمون سریع و پرسش",
      icon: "📊",
      color: "#f59e0b",
      bgGradient: "from-amber-500/30 to-orange-600/30",
      subLabel: "سنجش و کوئیز لحظه‌ای",
      action: () => {
        onClose();
        onOpenPanel("tools");
      },
    },
    {
      id: "more_tools",
      labelKey: "tools.moreToolsCount",
      defaultLabel: "+۲ ابزار دیگر (مشاهده همه)",
      icon: "🧰",
      color: "#ec4899",
      bgGradient: "from-pink-500/30 to-rose-600/30",
      subLabel: "تایمر، نظرسنجی و امکانات",
      action: () => {
        onClose();
        onOpenPanel("tools");
      },
    },
  ];

  const totalItems = stackItems.length;

  const buttonSizeClass =
    size === "sm"
      ? "w-10 h-10 min-w-10 rounded-xl text-base"
      : size === "md"
      ? "w-11 h-11 min-w-11 rounded-xl text-lg"
      : "w-12 h-12 min-w-12 rounded-xl text-xl";

  return (
    <div ref={containerRef} className="relative select-none inline-flex items-center">
      {/* ── Active Whiteboard Semi-Open Peek Card (when minimized & stack closed) ── */}
      {whiteboard.isActive && whiteboard.isMinimized && !isOpen && (
        <div
          className={cn(
            "absolute bottom-full mb-2 z-40 transition-all duration-300 ease-out cursor-pointer",
            isRtl ? "right-0" : "left-0",
            isPeekHovered
              ? "transform -translate-y-2 scale-105"
              : "transform translate-y-0 scale-100"
          )}
          onMouseEnter={() => setIsPeekHovered(true)}
          onMouseLeave={() => setIsPeekHovered(false)}
          onClick={restoreWhiteboard}
        >
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-2xl backdrop-blur-2xl border shadow-xl transition-all duration-300",
              "bg-[#064e3b]/95 hover:bg-[#065f46] border-emerald-400/50 text-white",
              isPeekHovered
                ? "shadow-[0_0_20px_rgba(16,185,129,0.45)] ring-2 ring-emerald-400/40"
                : "shadow-lg"
            )}
            style={{ minWidth: isPeekHovered ? "180px" : "140px" }}
          >
            <div className="relative flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500/30 text-sm">
              <span>✏️</span>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>

            <div className="flex flex-col text-start overflow-hidden">
              <span className="text-[11px] font-bold text-emerald-100 truncate">
                {t("tools.whiteboard", "تخته وایت‌برد")}
              </span>
              <span className="text-[9px] text-emerald-300/80 truncate">
                {isPeekHovered
                  ? t("whiteboard.clickToOpen", "کلیک برای باز کردن")
                  : t("whiteboard.activeBoard", "در حال اجرا")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Vertical Clean-Anchored Stack Container (Zero Clipping) ── */}
      <div
        className={cn(
          "absolute bottom-full mb-3 pointer-events-none z-50",
          isRtl ? "right-0" : "left-0",
          isOpen ? "pointer-events-auto" : "invisible"
        )}
        style={{ perspective: "800px" }}
      >
        <div
          className={cn(
            "relative flex flex-col",
            isRtl ? "items-end" : "items-start"
          )}
        >
          {stackItems.map((item, i) => {
            const isHovered = hoveredIdx === i;
            const translateY = isOpen ? -(58 + i * 52) : 0;
            const scale = isOpen ? (isHovered ? 1.08 : 1 - i * 0.02) : 0.4;
            const rotateX = isOpen ? 6 - i * 1.5 : 0;
            const opacity = isOpen ? 1 : 0;
            const zIndex = isHovered ? 60 : 50 - i;
            const delay = isOpen ? `${i * 30}ms` : `${(totalItems - i) * 15}ms`;

            return (
              <div
                key={item.id}
                className="absolute bottom-0 transition-all cursor-pointer"
                style={{
                  transform: `translate3d(0, ${translateY}px, ${
                    isHovered ? 25 : 0
                  }px) rotateX(${rotateX}deg) scale(${scale})`,
                  transformOrigin: isRtl ? "bottom right" : "bottom left",
                  transitionDuration: isOpen ? "320ms" : "200ms",
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
                    "flex items-center gap-3 p-1.5 px-3 rounded-2xl backdrop-blur-2xl border transition-all duration-200 shadow-xl group",
                    "bg-[#0f172a]/95 hover:bg-[#1e293b] text-white",
                    isHovered
                      ? "border-indigo-400/80 shadow-[0_0_25px_rgba(99,102,241,0.5)] ring-2 ring-indigo-400/30"
                      : "border-white/15 hover:border-white/30"
                  )}
                  style={{ minWidth: "195px", maxWidth: "230px" }}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center text-lg bg-gradient-to-br shadow-inner border border-white/10 transition-transform duration-200 flex-shrink-0",
                      item.bgGradient,
                      isHovered && "scale-110"
                    )}
                  >
                    {item.icon}
                  </div>

                  {/* Text Details */}
                  <div className="flex flex-col text-start min-w-0 flex-1">
                    <span className="text-xs font-bold text-gray-100 group-hover:text-indigo-200 transition-colors truncate">
                      {t(item.labelKey, item.defaultLabel)}
                    </span>
                    {item.badge ? (
                      <span className="text-[10px] font-semibold text-emerald-400 animate-pulse truncate">
                        {item.badge}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 group-hover:text-gray-300 truncate">
                        {item.subLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Trigger Button in the Dock (Standard Tools Icon & Exact Sizing) ── */}
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
          {/* Standard Clean Tools Icon */}
          <span className="flex items-center justify-center">
            {Icons.tools}
          </span>

          {/* Active Indicator Dot */}
          {isOpen && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[var(--brand)] shadow-[0_0_6px_var(--brand)] animate-in fade-in zoom-in" />
          )}
        </button>
      </Tooltip>
    </div>
  );
}

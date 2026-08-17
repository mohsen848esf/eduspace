import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../../lib/utils";
import { Tooltip } from "../../../../components/ui/Tooltip";
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
  icon: string;
  badge?: string;
  color: string;
  bgGradient: string;
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
    launchWhiteboard,
    restoreWhiteboard,
    minimizeWhiteboard,
  } = useRoomWhiteboard();
  const { isHost } = useRoomStore();

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

  const stackItems: StackItem[] = [
    {
      id: "whiteboard",
      labelKey: "tools.whiteboard",
      defaultLabel: "تخته وایت‌برد هوشمند",
      icon: "✏️",
      badge: whiteboard.isActive ? (whiteboard.isMinimized ? "فعال (کوچک)" : "در حال نمایش") : undefined,
      color: "#10b981",
      bgGradient: "from-emerald-500/30 to-teal-600/30",
      action: handleWhiteboardAction,
    },
    {
      id: "miniapps",
      labelKey: "tools.miniApps",
      defaultLabel: "مینی‌اپ‌ها و بازی‌ها",
      icon: "🎮",
      color: "#8b5cf6",
      bgGradient: "from-purple-500/30 to-indigo-600/30",
      action: handleMiniAppsAction,
    },
    {
      id: "quiz",
      labelKey: "tools.quickQuiz",
      defaultLabel: "آزمون سریع و پرسش",
      icon: "📊",
      color: "#f59e0b",
      bgGradient: "from-amber-500/30 to-orange-600/30",
      action: () => {
        onClose();
        onOpenPanel("tools");
      },
    },
    {
      id: "timer",
      labelKey: "tools.focusTimer",
      defaultLabel: "تایمر و زمان‌سنج تمرکز",
      icon: "⏱️",
      color: "#38bdf8",
      bgGradient: "from-sky-500/30 to-blue-600/30",
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
      color: "#ec4899",
      bgGradient: "from-pink-500/30 to-rose-600/30",
      action: () => {
        onClose();
        onOpenPanel("tools");
      },
    },
  ];

  const totalItems = stackItems.length;

  const buttonSizeClass =
    size === "sm"
      ? "w-10 h-10 min-w-10 rounded-xl"
      : size === "md"
      ? "w-11 h-11 min-w-11 rounded-xl"
      : "w-12 h-12 min-w-12 rounded-xl";

  return (
    <div ref={containerRef} className="relative select-none">
      {/* 3D Arc Fan-out Container */}
      <div
        className={cn(
          "absolute bottom-full left-1/2 -translate-x-1/2 mb-4 pointer-events-none z-50",
          isOpen ? "pointer-events-auto" : "invisible"
        )}
        style={{ perspective: "1000px" }}
      >
        {/* SVG Connecting Arc Trajectories */}
        {isOpen && (
          <svg
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-96 overflow-visible pointer-events-none -z-10"
            style={{ filter: "drop-shadow(0 0 8px rgba(99, 102, 241, 0.4))" }}
          >
            {stackItems.map((_, i) => {
              const progress = (i + 1) / totalItems;
              const endY = -(65 + i * 58);
              const endX = -Math.sin(progress * Math.PI * 0.45) * 36;
              const ctrlX = endX * 0.4;
              const ctrlY = endY * 0.6;

              return (
                <path
                  key={i}
                  d={`M 128 384 Q ${128 + ctrlX} ${384 + ctrlY}, ${128 + endX} ${384 + endY}`}
                  fill="none"
                  stroke={hoveredIdx === i ? "rgba(99, 102, 241, 0.75)" : "rgba(255, 255, 255, 0.18)"}
                  strokeWidth={hoveredIdx === i ? "2" : "1.2"}
                  strokeDasharray={hoveredIdx === i ? "none" : "3 3"}
                  className="transition-all duration-300"
                />
              );
            })}
          </svg>
        )}

        {/* Fanned Out Items */}
        <div className="relative flex flex-col items-center">
          {stackItems.map((item, i) => {
            const isHovered = hoveredIdx === i;
            const progress = (i + 1) / totalItems;
            
            // Physics calculations for macOS curved 3D Arc Stack:
            const translateY = isOpen ? -(70 + i * 56) : 0;
            const translateX = isOpen ? -Math.sin(progress * Math.PI * 0.45) * 34 : 0;
            const rotateZ = isOpen ? -Math.sin(progress * Math.PI * 0.45) * 6 : 0;
            const rotateX = isOpen ? 10 - i * 2 : 0;
            const rotateY = isOpen ? -6 + i * 1.5 : 0;
            const scale = isOpen ? (isHovered ? 1.15 : 1 - i * 0.02) : 0.4;
            const opacity = isOpen ? 1 : 0;
            const zIndex = isHovered ? 60 : 50 - i;
            const delay = isOpen ? `${i * 35}ms` : `${(totalItems - i) * 20}ms`;

            return (
              <div
                key={item.id}
                className="absolute bottom-0 transition-all cursor-pointer"
                style={{
                  transform: `translate3d(${translateX}px, ${translateY}px, ${isHovered ? 35 : 0}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) scale(${scale})`,
                  transformOrigin: "bottom center",
                  transitionDuration: isOpen ? "400ms" : "250ms",
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
                    "flex items-center gap-3 p-1.5 pr-4 pl-2 rounded-2xl backdrop-blur-xl border transition-all duration-200 shadow-2xl group",
                    "bg-[#0f172a]/90 hover:bg-[#1e293b]/95 text-white",
                    isHovered
                      ? "border-indigo-400/80 shadow-[0_0_25px_rgba(99,102,241,0.5)] ring-2 ring-indigo-400/30"
                      : "border-white/15 hover:border-white/30"
                  )}
                  style={{ minWidth: "190px" }}
                >
                  {/* Icon with Glowing Gradient Frame */}
                  <div
                    className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br shadow-inner border border-white/10 transition-transform duration-200",
                      item.bgGradient,
                      isHovered && "scale-110"
                    )}
                  >
                    {item.icon}
                  </div>

                  {/* Text Details */}
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-gray-100 group-hover:text-indigo-200 transition-colors">
                      {t(item.labelKey, item.defaultLabel)}
                    </span>
                    {item.badge ? (
                      <span className="text-[10px] font-semibold text-emerald-400 animate-pulse">
                        {item.badge}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 group-hover:text-gray-300">
                        {item.id === "whiteboard"
                          ? "تخته مشارکتی"
                          : item.id === "miniapps"
                          ? "بازی و ابزارک"
                          : item.id === "quiz"
                          ? "سنجش دانش‌آموزان"
                          : item.id === "timer"
                          ? "مدیریت زمان کلاس"
                          : "امکانات تکمیلی"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trigger Button in the Dock */}
      <Tooltip content={isOpen ? t("tools.closeStack", "بستن منوی ابزارها") : t("tools.stackTooltip", "ابزارها و فعالیت‌های کلاس (نمای دسته‌ای مک)")}>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "relative flex flex-col items-center justify-center gap-1 group",
            "border-none cursor-pointer transition-all duration-200 ease-out",
            "hover:-translate-y-1 hover:scale-105 hover:rotate-[-1.5deg] active:scale-95",
            "py-1"
          )}
        >
          {/* macOS Dock Stack Icon representation */}
          <span
            className={cn(
              "relative flex items-center justify-center transition-all duration-200 shadow-xs border border-[var(--b)]",
              buttonSizeClass,
              isOpen
                ? "bg-[var(--brand-soft)] text-[var(--brand-text)] ring-2 ring-[var(--brand)] shadow-[0_0_15px_var(--brand)]"
                : "bg-[var(--s2)] text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)]"
            )}
          >
            {/* Layered Stack Visual */}
            <span className="relative flex items-center justify-center">
              <span
                className={cn(
                  "absolute -top-1.5 w-6 h-3.5 rounded-sm bg-white/20 border border-white/10 transition-transform duration-200",
                  isOpen ? "-translate-y-1.5 scale-90 rotate-[-6deg]" : "group-hover:-translate-y-0.5 group-hover:rotate-[-3deg]"
                )}
              />
              <span
                className={cn(
                  "absolute -top-0.5 w-7 h-4 rounded-sm bg-white/30 border border-white/15 transition-transform duration-200",
                  isOpen ? "-translate-y-0.5 scale-95 rotate-[-3deg]" : "group-hover:-translate-y-0.5"
                )}
              />
              <span className="text-lg relative z-10">✦</span>
            </span>
          </span>

          <span className="text-[11px] font-medium leading-none text-[var(--t2)] whitespace-nowrap group-hover:text-[var(--t1)]">
            {t("controls.tools", "ابزارها")}
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

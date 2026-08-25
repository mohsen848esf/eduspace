import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  useRoomLayoutStore,
  type LayoutMode,
  MAX_TILES_OPTIONS,
} from "../../store/roomLayoutStore";
import { cn } from "../../../../lib/utils";
import { Switch } from "../../../../components/ui";

interface AdjustViewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdjustViewModal({
  isOpen,
  onClose,
}: AdjustViewModalProps) {
  const { t } = useTranslation("room");
  const modalRef = useRef<HTMLDivElement | null>(null);

  const {
    layoutMode,
    setLayoutMode,
    maxTiles,
    setMaxTiles,
    hideNoVideo,
    setHideNoVideo,
  } = useRoomLayoutStore();

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const layoutOptions: {
    id: LayoutMode;
    label: string;
    desc: string;
    hasSparkle?: boolean;
    previewIcon: React.ReactNode;
  }[] = [
    {
      id: "auto",
      label: t("adjustView.auto") || "Auto (dynamic)",
      desc: t("adjustView.autoDesc") || "Automatically adapts layout based on activity",
      hasSparkle: true,
      previewIcon: (
        <div className="w-14 h-9 rounded-lg border border-[var(--b)] bg-[var(--s1)] p-1 flex gap-1 items-stretch">
          <div className="flex-1 bg-[var(--brand)]/20 border border-[var(--brand)]/40 rounded-sm" />
          <div className="flex-1 bg-white/10 rounded-sm" />
          <div className="flex-1 bg-white/10 rounded-sm" />
        </div>
      ),
    },
    {
      id: "tiled",
      label: t("adjustView.tiled") || "Tiled (legacy)",
      desc: t("adjustView.tiledDesc") || "Equal sized grid tiles for all participants",
      previewIcon: (
        <div className="w-14 h-9 rounded-lg border border-[var(--b)] bg-[var(--s1)] p-1 grid grid-cols-3 grid-rows-2 gap-1">
          <div className="bg-white/15 rounded-sm" />
          <div className="bg-white/15 rounded-sm" />
          <div className="bg-white/15 rounded-sm" />
          <div className="bg-white/15 rounded-sm" />
          <div className="bg-white/15 rounded-sm" />
          <div className="bg-white/15 rounded-sm" />
        </div>
      ),
    },
    {
      id: "spotlight",
      label: t("adjustView.spotlight") || "Spotlight",
      desc: t("adjustView.spotlightDesc") || "Focus on active speaker or pinned participant",
      previewIcon: (
        <div className="w-14 h-9 rounded-lg border border-[var(--b)] bg-[var(--s1)] p-1 flex items-center justify-center">
          <div className="w-full h-full bg-[var(--brand)]/25 border border-[var(--brand)]/40 rounded-sm" />
        </div>
      ),
    },
    {
      id: "sidebar",
      label: t("adjustView.sidebar") || "Sidebar",
      desc: t("adjustView.sidebarDesc") || "Main speaker on stage, others in a side strip",
      previewIcon: (
        <div className="w-14 h-9 rounded-lg border border-[var(--b)] bg-[var(--s1)] p-1 flex gap-1">
          <div className="flex-[3] bg-[var(--brand)]/20 border border-[var(--brand)]/40 rounded-sm" />
          <div className="flex-1 flex flex-col gap-0.5">
            <div className="flex-1 bg-white/15 rounded-sm" />
            <div className="flex-1 bg-white/15 rounded-sm" />
            <div className="flex-1 bg-white/15 rounded-sm" />
          </div>
        </div>
      ),
    },
  ];

  // Map slider step index to MAX_TILES_OPTIONS
  const currentStepIndex = MAX_TILES_OPTIONS.indexOf(
    maxTiles as (typeof MAX_TILES_OPTIONS)[number]
  );
  const sliderValue = currentStepIndex >= 0 ? currentStepIndex : 0;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value, 10);
    if (MAX_TILES_OPTIONS[idx] !== undefined) {
      setMaxTiles(MAX_TILES_OPTIONS[idx]);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjust-view-title"
        className="w-full max-w-[480px] bg-[var(--s1)] border border-[var(--b)] rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/5">
          <div>
            <h2
              id="adjust-view-title"
              className="text-base md:text-lg font-bold text-[var(--t1)]"
            >
              {t("adjustView.title") || "Adjust view"}
            </h2>
            <p className="text-xs text-[var(--t3)] mt-0.5 font-medium">
              {t("adjustView.savedNotice") || "Selection is saved for future meetings"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common:actions.close") || "Close"}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[var(--t2)] hover:text-white flex items-center justify-center border-none cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Layout Mode Options (Radio List) */}
          <div className="space-y-2">
            {layoutOptions.map((opt) => {
              const isSelected = layoutMode === opt.id;
              return (
                <label
                  key={opt.id}
                  onClick={() => setLayoutMode(opt.id)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-150 border",
                    isSelected
                      ? "bg-[var(--brand)]/10 border-[var(--brand)]/50 shadow-sm"
                      : "bg-white/[0.02] border-transparent hover:bg-white/[0.05]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Custom Radio Circle */}
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        isSelected
                          ? "border-[var(--brand)] bg-[var(--brand)]"
                          : "border-[var(--t3)] bg-transparent"
                      )}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-sm text-[var(--t1)]">
                        <span>{opt.label}</span>
                        {opt.hasSparkle && <span className="text-xs">✦</span>}
                      </div>
                      <p className="text-xs text-[var(--t3)] mt-0.5">
                        {opt.desc}
                      </p>
                    </div>
                  </div>

                  {/* Thumbnail Visual */}
                  <div className="ms-3 shrink-0">{opt.previewIcon}</div>
                </label>
              );
            })}
          </div>

          <hr className="border-t border-white/5" />

          {/* Tiles Limit Slider */}
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-sm font-bold text-[var(--t1)]">
                  {t("adjustView.tiles") || "Tiles"}
                </span>
                <p className="text-xs text-[var(--t3)] mt-0.5">
                  {t("adjustView.tilesDesc", { count: maxTiles }) ||
                    `Max ${maxTiles} tiles to display, depending on window size.`}
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/30 font-bold text-xs">
                {maxTiles}
              </span>
            </div>

            {/* Slider Controls with icons */}
            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs text-[var(--t3)] font-semibold">
                ⊞ {MAX_TILES_OPTIONS[0]}
              </span>
              <input
                type="range"
                min={0}
                max={MAX_TILES_OPTIONS.length - 1}
                step={1}
                value={sliderValue}
                onChange={handleSliderChange}
                aria-label={t("adjustView.tiles") || "Tiles limit"}
                className="flex-1 accent-[var(--brand)] h-1.5 bg-[var(--s3)] rounded-lg cursor-pointer transition-all"
              />
              <span className="text-xs text-[var(--t3)] font-semibold">
                ▦ {MAX_TILES_OPTIONS[MAX_TILES_OPTIONS.length - 1]}
              </span>
            </div>

            <div className="flex justify-between px-7 text-[10px] text-[var(--t3)] font-medium">
              {MAX_TILES_OPTIONS.map((val) => (
                <span
                  key={val}
                  className={cn(
                    "cursor-pointer hover:text-[var(--t1)] transition-colors",
                    maxTiles === val && "text-[var(--brand)] font-extrabold"
                  )}
                  onClick={() => setMaxTiles(val)}
                >
                  {val}
                </span>
              ))}
            </div>
          </div>

          <hr className="border-t border-white/5" />

          {/* Hide No-Video Toggle */}
          <label className="flex items-center justify-between cursor-pointer py-1 group">
            <span className="text-sm font-medium text-[var(--t1)] group-hover:text-white transition-colors">
              {t("adjustView.hideNoVideo") || "Hide tiles without video"}
            </span>

            <Switch
              checked={hideNoVideo}
              onChange={setHideNoVideo}
              variant="brand"
            />
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-black/10 border-t border-white/5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[var(--brand)] hover:brightness-110 text-white font-bold text-xs cursor-pointer border-none transition-all active:scale-95"
          >
            {t("common:actions.done") || "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}

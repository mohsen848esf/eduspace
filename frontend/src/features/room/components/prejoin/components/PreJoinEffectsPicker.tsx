import React from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Ban, Droplets, Check, X } from "lucide-react";
import { type BackgroundType, BG_IMAGES } from "../../../hooks/useBackgroundBlur";
import Spinner from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

export interface PreJoinEffectsPickerProps {
  selectedBg: BackgroundType;
  onChangeBackground: (bg: BackgroundType) => void;
  isLoading: boolean;
  isSupported: boolean;
  isFloating?: boolean;
  onClose?: () => void;
}

export const BG_PRESETS: {
  id: BackgroundType;
  labelKey: string;
  previewUrl?: string;
  isBlur?: boolean;
  isNone?: boolean;
}[] = [
  {
    id: "none",
    labelKey: "preJoin.effectsPresets.none",
    isNone: true,
  },
  {
    id: "blur",
    labelKey: "preJoin.effectsPresets.blur",
    isBlur: true,
  },
  {
    id: "office",
    labelKey: "preJoin.effectsPresets.office",
    previewUrl: BG_IMAGES.office || "/backgrounds/office.jpg",
  },
  {
    id: "studio",
    labelKey: "preJoin.effectsPresets.studio",
    previewUrl: BG_IMAGES.studio || "/backgrounds/studio.jpg",
  },
  {
    id: "nature",
    labelKey: "preJoin.effectsPresets.nature",
    previewUrl: BG_IMAGES.nature || "/backgrounds/nature.jpg",
  },
  {
    id: "minimal",
    labelKey: "preJoin.effectsPresets.minimal",
    previewUrl: BG_IMAGES.minimal || "/backgrounds/minimal.jpg",
  },
];

export const PreJoinEffectsPicker: React.FC<PreJoinEffectsPickerProps> = ({
  selectedBg,
  onChangeBackground,
  isLoading,
  isSupported,
  isFloating = false,
  onClose,
}) => {
  const { t } = useTranslation("room");

  return (
    <div
      className={cn(
        "space-y-3",
        isFloating && "p-3 bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--brand)]" />
          <span className={cn("text-xs font-bold", isFloating ? "text-white" : "text-[var(--t1)]")}>
            {t("preJoin.visualEffects")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--brand)] font-semibold animate-pulse">
              <Spinner size="sm" />
              <span>{t("preJoin.bgApplying")}</span>
            </div>
          )}

          {isFloating && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {!isSupported && (
        <div className="p-2.5 rounded-xl bg-[var(--amber)]/15 border border-[var(--amber)]/30 text-xs text-[var(--amber)]">
          {t("preJoin.bgNotSupported")}
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {BG_PRESETS.map((preset) => {
          const isSelected = selectedBg === preset.id;
          const label = t(preset.labelKey);

          return (
            <button
              key={preset.id}
              type="button"
              disabled={isLoading || !isSupported}
              onClick={() => onChangeBackground(preset.id)}
              className={cn(
                "group relative h-16 sm:h-18 rounded-xl overflow-hidden border-2 transition-all flex flex-col items-center justify-center p-1 cursor-pointer",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                isSelected
                  ? "border-[var(--brand)] shadow-lg shadow-[var(--brand)]/30 scale-[1.03]"
                  : "border-white/20 hover:border-white/50 bg-black/40"
              )}
            >
              {preset.isNone && (
                <div className="flex flex-col items-center gap-1 text-white/80 group-hover:text-white">
                  <Ban className="w-4 h-4" />
                  <span className="text-[10px] font-semibold">{label}</span>
                </div>
              )}

              {preset.isBlur && (
                <div className="flex flex-col items-center gap-1 text-sky-300 group-hover:text-white">
                  <Droplets className="w-4 h-4" />
                  <span className="text-[10px] font-semibold">{label}</span>
                </div>
              )}

              {preset.previewUrl && (
                <>
                  <img
                    src={preset.previewUrl}
                    alt={label}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1 text-center">
                    <span className="text-[9px] font-bold text-white drop-shadow-xs truncate block">
                      {label}
                    </span>
                  </div>
                </>
              )}

              {/* Selection Check Badge */}
              {isSelected && (
                <div className="absolute inset-0 bg-[var(--brand)]/30 flex items-center justify-center backdrop-blur-[1px]">
                  <div className="w-5 h-5 rounded-full bg-[var(--brand)] text-white flex items-center justify-center shadow-md">
                    <Check className="w-3 h-3" />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PreJoinEffectsPicker;

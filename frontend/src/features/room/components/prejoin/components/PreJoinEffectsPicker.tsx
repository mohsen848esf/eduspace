import React from "react";
import { Sparkles, Ban, Droplets, Check } from "lucide-react";
import { type BackgroundType } from "../../../hooks/useBackgroundBlur";
import Spinner from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

export interface PreJoinEffectsPickerProps {
  selectedBg: BackgroundType;
  onChangeBackground: (bg: BackgroundType) => void;
  isLoading: boolean;
  isSupported: boolean;
}

export const BG_PRESETS: {
  id: BackgroundType;
  titleFa: string;
  titleEn: string;
  previewUrl?: string;
  gradientClass?: string;
  isBlur?: boolean;
  isNone?: boolean;
}[] = [
  {
    id: "none",
    titleFa: "بدون پس‌زمینه",
    titleEn: "None",
    isNone: true,
  },
  {
    id: "blur",
    titleFa: "تار کردن محیط (Blur)",
    titleEn: "Blur",
    isBlur: true,
  },
  {
    id: "office",
    titleFa: "دفتر کار مدرن",
    titleEn: "Modern Office",
    previewUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=320&q=70",
  },
  {
    id: "studio",
    titleFa: "استودیو گرم",
    titleEn: "Cozy Studio",
    previewUrl: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=320&q=70",
  },
  {
    id: "nature",
    titleFa: "طبیعت آرامش‌بخش",
    titleEn: "Nature Vista",
    previewUrl: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=320&q=70",
  },
  {
    id: "minimal",
    titleFa: "گرادیان مینیمال",
    titleEn: "Minimal Aesthetic",
    previewUrl: "https://images.unsplash.com/photo-1557683316-973673baf926?w=320&q=70",
  },
];

export const PreJoinEffectsPicker: React.FC<PreJoinEffectsPickerProps> = ({
  selectedBg,
  onChangeBackground,
  isLoading,
  isSupported,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--brand)]" />
          <span className="text-xs font-bold text-[var(--t1)]">جلوه‌های بصری و پس‌زمینه مجازی</span>
        </div>
        {isLoading && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--brand-text)] font-semibold animate-pulse">
            <Spinner size="sm" />
            <span>در حال اعمال افکت...</span>
          </div>
        )}
      </div>

      {!isSupported && (
        <div className="p-3 rounded-xl bg-[var(--amber)]/10 border border-[var(--amber)]/20 text-xs text-[var(--amber)]">
          ⚠️ پردازنده گرافیکی مرورگر شما از افکت‌های بلور و پس‌زمینه مجازی پشتیبانی نمی‌کند.
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {BG_PRESETS.map((preset) => {
          const isSelected = selectedBg === preset.id;

          return (
            <button
              key={preset.id}
              type="button"
              disabled={isLoading || !isSupported}
              onClick={() => onChangeBackground(preset.id)}
              className={cn(
                "group relative h-20 rounded-xl overflow-hidden border-2 transition-all flex flex-col items-center justify-center p-1 cursor-pointer",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                isSelected
                  ? "border-[var(--brand)] shadow-md shadow-[var(--brand)]/20 scale-[1.03]"
                  : "border-[var(--b)] hover:border-[var(--brand)]/50 bg-[var(--s2)]"
              )}
            >
              {preset.isNone && (
                <div className="flex flex-col items-center gap-1 text-[var(--t3)] group-hover:text-[var(--t1)]">
                  <Ban className="w-5 h-5" />
                  <span className="text-[10px] font-semibold">واقعی</span>
                </div>
              )}

              {preset.isBlur && (
                <div className="flex flex-col items-center gap-1 text-[var(--brand-text)]">
                  <Droplets className="w-5 h-5" />
                  <span className="text-[10px] font-semibold">تاریک/بلور</span>
                </div>
              )}

              {preset.previewUrl && (
                <img
                  src={preset.previewUrl}
                  alt={preset.titleFa}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              )}

              {/* Selection Overlay */}
              {isSelected && (
                <div className="absolute inset-0 bg-[var(--brand)]/25 flex items-center justify-center backdrop-blur-[1px]">
                  <div className="w-6 h-6 rounded-full bg-[var(--brand)] text-white flex items-center justify-center shadow-md">
                    <Check className="w-3.5 h-3.5" />
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

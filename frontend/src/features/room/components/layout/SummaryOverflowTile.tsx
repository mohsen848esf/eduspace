import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../../lib/utils";
import type { CallTile } from "../../hooks/useCallTiles";

interface SummaryOverflowTileProps {
  overflowTiles: CallTile[];
  totalOverflowCount: number;
  className?: string;
  style?: React.CSSProperties;
}

function getInitials(name: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-[#0284c7]", // Sky blue
  "bg-[#9333ea]", // Purple
  "bg-[#059669]", // Emerald
  "bg-[#d97706]", // Amber
  "bg-[#e11d48]", // Rose
  "bg-[#4f46e5]", // Indigo
];

export default function SummaryOverflowTile({
  overflowTiles,
  totalOverflowCount,
  className,
  style,
}: SummaryOverflowTileProps) {
  const { t } = useTranslation("room");

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent("eduspace:open-people-tab"));
  };

  // Preview up to 2-3 overlapping circles
  const previewParticipants = overflowTiles.slice(0, 3);

  return (
    <button
      type="button"
      onClick={handleClick}
      style={style}
      aria-label={t("tile.overflowMore", { count: totalOverflowCount }) || `${totalOverflowCount} others`}
      className={cn(
        "relative group bg-[var(--s2)] hover:bg-[var(--s3)] border border-white/5 rounded-2xl md:rounded-3xl overflow-hidden cursor-pointer transition-all duration-200 flex flex-col items-center justify-center p-4 shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand)]",
        className
      )}
    >
      {/* Overlapping Avatar Circles (Google Meet Style) */}
      <div className="flex items-center justify-center -space-x-3 rtl:space-x-reverse mb-3">
        {previewParticipants.map((tile, idx) => {
          const name = tile.participant.name || tile.participant.identity;
          const initials = getInitials(name);
          const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length];

          return (
            <div
              key={tile.key}
              className={cn(
                "w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-white font-bold text-base md:text-lg border-2 border-[var(--s2)] shadow-md transition-transform group-hover:scale-105",
                colorClass
              )}
            >
              {initials}
            </div>
          );
        })}
      </div>

      {/* Label "+N others" */}
      <span className="text-white/90 font-bold text-sm md:text-base tracking-wide group-hover:text-white">
        {t("tile.overflowMore", { count: totalOverflowCount }) || `${totalOverflowCount} others`}
      </span>

      {/* Subtle Hint */}
      <span className="text-[11px] text-[var(--t3)] mt-1 font-medium group-hover:text-[var(--t2)] transition-colors">
        {t("tile.clickToViewAll") || "Click to view all"}
      </span>
    </button>
  );
}

import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { EyeOff, Users } from "lucide-react";
import { useCallTiles } from "../../hooks/useCallTiles";
import { cn } from "../../../../lib/utils";
import TileView from "./TileView";
import SummaryOverflowTile from "./SummaryOverflowTile";

/** Layout-only: reuse published tracks, never acquire/stop a camera here. */
export default function PresentationStageLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation("room");
  const { tiles, tracks, localIdentity } = useCallTiles();
  const [showParticipants, setShowParticipants] = useState(true);
  const stripId = useId();
  const cameras = tiles.filter((tile) => tile.kind === "camera");
  const hasOverflow = cameras.length > 6;
  const visible = hasOverflow ? cameras.slice(0, 5) : cameras;
  const overflow = hasOverflow ? cameras.slice(5) : [];

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 w-full h-full gap-2 p-2 md:p-3 bg-[var(--s0)]">
      {cameras.length > 0 && (
        <div className="flex justify-end shrink-0">
          <button
            type="button"
            aria-expanded={showParticipants}
            aria-controls={stripId}
            onClick={() => setShowParticipants((shown) => !shown)}
            className="min-h-11 min-w-11 px-3 inline-flex items-center gap-2 rounded-xl border border-[var(--b)] bg-[var(--s2)] text-[var(--t1)] text-sm hover:bg-[var(--s3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] cursor-pointer transition-colors motion-reduce:transition-none"
          >
            {showParticipants ? <EyeOff size={18} aria-hidden /> : <Users size={18} aria-hidden />}
            {t(showParticipants ? "presentationLayout.hideParticipants" : "presentationLayout.showParticipants")}
            <span className="text-[var(--t2)]">({cameras.length})</span>
          </button>
        </div>
      )}
      <div className="flex flex-col lg:flex-row flex-1 min-w-0 min-h-0 gap-2 md:gap-3">
        <div className="flex flex-1 min-w-0 min-h-0 rounded-2xl overflow-hidden border border-[var(--b)]">
          {children}
        </div>
        <aside
          id={stripId}
          aria-label={t("presentationLayout.participants")}
          hidden={!showParticipants || cameras.length === 0}
          className={cn(
            "shrink-0 gap-2 min-w-0 min-h-0 h-28 sm:h-32 lg:h-auto lg:w-48 xl:w-56 overflow-x-auto overflow-y-hidden lg:overflow-x-hidden lg:overflow-y-auto",
            showParticipants && cameras.length > 0 ? "flex flex-row lg:flex-col" : "hidden",
          )}
        >
          {visible.map((tile) => (
            <div key={tile.key} className="shrink-0 w-40 sm:w-48 lg:w-full h-full lg:h-auto lg:aspect-video rounded-xl overflow-hidden">
              <TileView
                tile={tile} tracks={tracks} localIdentity={localIdentity}
                pinnedKey={null} onTogglePin={() => undefined} showActions={false} compact
              />
            </div>
          ))}
          {hasOverflow && (
            <div className="shrink-0 w-40 sm:w-48 lg:w-full h-full lg:h-auto lg:aspect-video rounded-xl overflow-hidden">
              <SummaryOverflowTile overflowTiles={overflow} totalOverflowCount={overflow.length} className="w-full h-full" />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

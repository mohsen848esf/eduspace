import { useState } from "react";
import TileView from "./TileView";
import SummaryOverflowTile from "./SummaryOverflowTile";
import { useOrientation } from "../../../../hooks/useOrientation";
import type { CallTile, UseCallTilesResult } from "../../hooks/useCallTiles";
import type { RemoteParticipant } from "livekit-client";
import { cn } from "../../../../lib/utils";

export interface SidebarLayoutProps {
  tiles: CallTile[];
  tracks: UseCallTilesResult["tracks"];
  localIdentity: string;
  isHost?: boolean;
  onMute?: (p: RemoteParticipant) => void;
  onKick?: (p: RemoteParticipant) => void;
  mutedByHost?: Set<string>;
  onLowerHand?: (p: RemoteParticipant) => void;
  pinnedKey: string | null;
  onTogglePin: (key: string) => void;
  onToggleSelfView?: () => void;
  selfViewFloating?: boolean;
}

export default function SidebarLayout(props: SidebarLayoutProps) {
  const { tiles, pinnedKey, onTogglePin } = props;
  const orientation = useOrientation();
  const [activeSpeakerOverride, setActiveSpeakerOverride] = useState<string | null>(null);
  const screenTile = tiles.find((t) => t.kind === "screen");

  const focusKey =
    pinnedKey && tiles.some((t) => t.key === pinnedKey)
      ? pinnedKey
      : screenTile
      ? screenTile.key
      : activeSpeakerOverride && tiles.some((t) => t.key === activeSpeakerOverride)
      ? activeSpeakerOverride
      : tiles[0]?.key;

  const focusTile = tiles.find((t) => t.key === focusKey) || tiles[0];
  const restTiles = tiles.filter((t) => t.key !== focusTile?.key);

  if (!focusTile) return null;

  const isLandscape = orientation === "landscape";
  const STRIP_CAP = 6;
  const hasOverflow = restTiles.length > STRIP_CAP;
  const visibleStripTiles = hasOverflow ? restTiles.slice(0, STRIP_CAP - 1) : restTiles;
  const overflowStripTiles = hasOverflow ? restTiles.slice(STRIP_CAP - 1) : [];

  return (
    <div
      className={cn(
        "flex-1 w-full h-full p-2 md:p-3 bg-[var(--s0)] gap-2 md:gap-3 overflow-hidden flex",
        isLandscape ? "flex-row" : "flex-col"
      )}
    >
      {/* Main Stage (75% on desktop, top half on mobile) */}
      <div className={cn("relative flex items-center justify-center min-w-0 min-h-0", isLandscape ? "flex-[3]" : "flex-[2]")}>
        <TileView
          tile={focusTile}
          tracks={props.tracks}
          localIdentity={props.localIdentity}
          isHost={props.isHost}
          onMute={props.onMute}
          onKick={props.onKick}
          mutedByHost={props.mutedByHost}
          onLowerHand={props.onLowerHand}
          pinnedKey={pinnedKey}
          onTogglePin={onTogglePin}
          onToggleSelfView={props.onToggleSelfView}
          selfViewFloating={props.selfViewFloating}
          className="w-full h-full"
        />
      </div>

      {/* Side / Bottom Thumbnail Strip */}
      {restTiles.length > 0 && (
        <div
          className={cn(
            "flex gap-2 min-w-0 min-h-0",
            isLandscape
              ? "flex-1 flex-col overflow-y-auto max-w-[280px]"
              : "flex-row overflow-x-auto h-32 md:h-40"
          )}
        >
          {visibleStripTiles.map((tile) => (
            <div
              key={tile.key}
              onClick={() => setActiveSpeakerOverride(tile.key)}
              className={cn(
                "rounded-xl overflow-hidden cursor-pointer shrink-0 transition-transform hover:scale-[1.02]",
                isLandscape ? "h-36 w-full" : "w-44 h-full"
              )}
            >
              <TileView
                tile={tile}
                tracks={props.tracks}
                localIdentity={props.localIdentity}
                mutedByHost={props.mutedByHost}
                onLowerHand={props.onLowerHand}
                pinnedKey={pinnedKey}
                onTogglePin={onTogglePin}
                onToggleSelfView={props.onToggleSelfView}
                selfViewFloating={props.selfViewFloating}
                compact
              />
            </div>
          ))}

          {hasOverflow && (
            <div className={cn("rounded-xl overflow-hidden shrink-0", isLandscape ? "h-36 w-full" : "w-44 h-full")}>
              <SummaryOverflowTile
                overflowTiles={overflowStripTiles}
                totalOverflowCount={overflowStripTiles.length}
                className="w-full h-full"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

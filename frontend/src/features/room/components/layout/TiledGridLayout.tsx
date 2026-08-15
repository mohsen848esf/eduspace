import React from "react";
import TileView from "./TileView";
import SummaryOverflowTile from "./SummaryOverflowTile";
import { useGridLayoutCalculator } from "./useGridLayoutCalculator";
import { useRoomLayoutStore } from "../../store/roomLayoutStore";
import type { CallTile } from "../../hooks/useCallTiles";
import type { RemoteParticipant } from "livekit-client";
import { cn } from "../../../../lib/utils";

export interface TiledGridLayoutProps {
  tiles: CallTile[];
  tracks: any[];
  localIdentity: string;
  isHost?: boolean;
  onMute?: (p: RemoteParticipant) => void;
  onKick?: (p: RemoteParticipant) => void;
  mutedByHost?: Set<string>;
  onLowerHand?: (p: RemoteParticipant) => void;
  pinnedKey: string | null;
  onTogglePin: (key: string) => void;
}

export default function TiledGridLayout({
  tiles,
  tracks,
  localIdentity,
  isHost,
  onMute,
  onKick,
  mutedByHost,
  onLowerHand,
  pinnedKey,
  onTogglePin,
}: TiledGridLayoutProps) {
  const { maxTiles, hideNoVideo } = useRoomLayoutStore();

  // Filter tiles if hideNoVideo is on
  const filteredTiles = React.useMemo(() => {
    if (!hideNoVideo) return tiles;
    return tiles.filter((t) => {
      if (t.kind === "screen") return true;
      const cam = tracks.find(
        (tr) =>
          tr.participant.identity === t.participant.identity &&
          tr.source === "camera" &&
          !tr.publication?.isMuted
      );
      return Boolean(cam);
    });
  }, [tiles, tracks, hideNoVideo]);

  const effectiveTiles = filteredTiles.length > 0 ? filteredTiles : tiles;
  const totalCount = effectiveTiles.length;

  // Calculate overflow
  const hasOverflow = totalCount > maxTiles;
  const visibleCount = hasOverflow ? maxTiles - 1 : totalCount;
  const visibleTiles = effectiveTiles.slice(0, visibleCount);
  const overflowTiles = hasOverflow ? effectiveTiles.slice(visibleCount) : [];
  const overflowCount = overflowTiles.length;

  const totalRenderItemsCount = visibleTiles.length + (hasOverflow ? 1 : 0);

  const { containerRef, tileWidth, tileHeight, rowDistribution } =
    useGridLayoutCalculator(totalRenderItemsCount, 12, 16 / 9);

  // Group render items by row distribution
  const allRenderItems: Array<
    | { type: "tile"; tile: CallTile }
    | { type: "overflow"; overflowTiles: CallTile[]; count: number }
  > = [
    ...visibleTiles.map((tile) => ({ type: "tile" as const, tile })),
    ...(hasOverflow
      ? [
          {
            type: "overflow" as const,
            overflowTiles,
            count: overflowCount,
          },
        ]
      : []),
  ];

  let currentIndex = 0;
  const rows: Array<typeof allRenderItems> = [];
  for (const countInRow of rowDistribution) {
    rows.push(allRenderItems.slice(currentIndex, currentIndex + countInRow));
    currentIndex += countInRow;
  }

  // Fallback if empty
  if (rows.length === 0 && allRenderItems.length > 0) {
    rows.push(allRenderItems);
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full h-full p-2 md:p-4 bg-[var(--s0)] flex flex-col justify-center items-center gap-2 md:gap-3 overflow-hidden select-none"
    >
      {rows.map((rowItems, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className="flex items-center justify-center gap-2 md:gap-3 w-full"
          style={{
            height: tileHeight > 0 ? `${tileHeight}px` : "auto",
            maxHeight: "100%",
          }}
        >
          {rowItems.map((item) => {
            const isSingleInRow = rowItems.length === 1 && totalCount > 1;
            const itemStyle: React.CSSProperties = {
              width: tileWidth > 0 ? `${tileWidth}px` : "100%",
              height: tileHeight > 0 ? `${tileHeight}px` : "100%",
              maxWidth: isSingleInRow ? `${tileWidth * 1.2}px` : undefined,
            };

            if (item.type === "overflow") {
              return (
                <div
                  key="overflow-tile"
                  style={itemStyle}
                  className="flex items-center justify-center transition-all duration-300"
                >
                  <SummaryOverflowTile
                    overflowTiles={item.overflowTiles}
                    totalOverflowCount={item.count}
                    className="w-full h-full"
                  />
                </div>
              );
            }

            return (
              <div
                key={item.tile.key}
                style={itemStyle}
                className={cn(
                  "flex items-center justify-center transition-all duration-300",
                  totalRenderItemsCount <= 2 ? "flex-1 max-w-[900px]" : ""
                )}
              >
                <TileView
                  tile={item.tile}
                  tracks={tracks}
                  localIdentity={localIdentity}
                  isHost={isHost}
                  onMute={onMute}
                  onKick={onKick}
                  mutedByHost={mutedByHost}
                  onLowerHand={onLowerHand}
                  pinnedKey={pinnedKey}
                  onTogglePin={onTogglePin}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

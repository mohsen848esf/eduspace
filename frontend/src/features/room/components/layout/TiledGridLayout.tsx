import React from "react";
import TileView from "./TileView";
import SummaryOverflowTile from "./SummaryOverflowTile";
import { useRoomLayoutStore } from "../../store/roomLayoutStore";
import { useOrientation } from "../../../../hooks/useOrientation";
import type { CallTile, UseCallTilesResult } from "../../hooks/useCallTiles";
import type { RemoteParticipant } from "livekit-client";

export interface TiledGridLayoutProps {
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
  onToggleSelfView,
  selfViewFloating,
}: TiledGridLayoutProps) {
  const { maxTiles, hideNoVideo } = useRoomLayoutStore();
  const orientation = useOrientation();
  const isLandscape = orientation === "landscape";

  // 1. Filter tiles if hideNoVideo is true
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

  // 2. Overflow calculation (Google Meet style)
  const hasOverflow = totalCount > maxTiles;
  const visibleCount = hasOverflow ? maxTiles - 1 : totalCount;
  const visibleTiles = effectiveTiles.slice(0, visibleCount);
  const overflowTiles = hasOverflow ? effectiveTiles.slice(visibleCount) : [];
  const overflowCount = overflowTiles.length;

  // 3. Assemble render items
  const allItems: Array<
    | { type: "tile"; tile: CallTile; key: string }
    | { type: "overflow"; overflowTiles: CallTile[]; count: number; key: string }
  > = [
    ...visibleTiles.map((t) => ({ type: "tile" as const, tile: t, key: t.key })),
    ...(hasOverflow
      ? [
          {
            type: "overflow" as const,
            overflowTiles,
            count: overflowCount,
            key: "overflow-tile",
          },
        ]
      : []),
  ];

  const renderCount = allItems.length;

  // ── 1 PARTICIPANT: Full screen prominent view (90% viewport fill, Google Meet style) ──
  if (renderCount <= 1) {
    const single = allItems[0];
    return (
      <div className="flex-1 w-full h-full min-w-0 min-h-0 p-3 md:p-6 bg-[var(--s0)] flex items-center justify-center overflow-hidden select-none">
        <div className="w-full h-full max-w-6xl max-h-[88vh] aspect-video flex items-center justify-center">
          {single && single.type === "tile" ? (
            <TileView
              tile={single.tile}
              tracks={tracks}
              localIdentity={localIdentity}
              isHost={isHost}
              onMute={onMute}
              onKick={onKick}
              mutedByHost={mutedByHost}
              onLowerHand={onLowerHand}
              pinnedKey={pinnedKey}
              onTogglePin={onTogglePin}
              onToggleSelfView={onToggleSelfView}
              selfViewFloating={selfViewFloating}
              className="w-full h-full shadow-2xl"
            />
          ) : (
            <div className="w-full h-full bg-[var(--s1)] rounded-3xl" />
          )}
        </div>
      </div>
    );
  }

  // ── PARTITION ITEMS INTO ROWS ACCORDING TO PARTICIPANT COUNT ──
  let rowDistribution: number[];

  if (renderCount === 2) {
    rowDistribution = isLandscape ? [2] : [1, 1];
  } else if (renderCount === 3) {
    rowDistribution = isLandscape ? [3] : [1, 2];
  } else if (renderCount === 4) {
    rowDistribution = [2, 2];
  } else if (renderCount === 5) {
    rowDistribution = isLandscape ? [2, 3] : [2, 2, 1];
  } else if (renderCount === 6) {
    rowDistribution = isLandscape ? [3, 3] : [2, 2, 2];
  } else if (renderCount <= 8) {
    rowDistribution = isLandscape
      ? [Math.ceil(renderCount / 2), Math.floor(renderCount / 2)]
      : [2, 2, 2, renderCount - 6].filter((r) => r > 0);
  } else {
    // 9+ items:
    if (isLandscape) {
      const perRow = Math.ceil(renderCount / 3);
      const row1 = perRow;
      const remaining = renderCount - row1;
      const row2 = Math.ceil(remaining / 2);
      const row3 = remaining - row2;
      rowDistribution = [row1, row2, row3].filter((r) => r > 0);
    } else {
      // Mobile portrait: 2 columns per row
      rowDistribution = [];
      let rem = renderCount;
      while (rem > 0) {
        const take = Math.min(rem, 2);
        rowDistribution.push(take);
        rem -= take;
      }
    }
  }

  let currIndex = 0;
  const rows: Array<typeof allItems> = [];
  for (const countInRow of rowDistribution) {
    rows.push(allItems.slice(currIndex, currIndex + countInRow));
    currIndex += countInRow;
  }

  if (rows.length === 0 && allItems.length > 0) {
    rows.push(allItems);
  }

  return (
    <div className="flex-1 w-full h-full min-w-0 min-h-0 p-2 md:p-3 bg-[var(--s0)] flex flex-col items-center justify-center gap-2 md:gap-3 overflow-hidden select-none">
      {rows.map((rowItems, rowIndex) => (
        <div
          key={`grid-row-${rowIndex}`}
          className="flex-1 w-full min-w-0 min-h-0 flex items-center justify-center gap-2 md:gap-3 overflow-hidden"
        >
          {rowItems.map((item) => {
            const maxColsInRow = rowItems.length;
            return (
              <div
                key={item.key}
                className="h-full min-w-0 max-w-full aspect-video flex items-center justify-center flex-1"
                style={{
                  maxWidth: `calc((100% - ${(maxColsInRow - 1) * 12}px) / ${maxColsInRow})`,
                }}
              >
                {item.type === "overflow" ? (
                  <SummaryOverflowTile
                    overflowTiles={item.overflowTiles}
                    totalOverflowCount={item.count}
                    className="w-full h-full"
                  />
                ) : (
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
                    onToggleSelfView={onToggleSelfView}
                    selfViewFloating={selfViewFloating}
                    className="w-full h-full"
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

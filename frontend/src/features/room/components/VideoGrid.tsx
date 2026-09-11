import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useHostControls } from "../hooks/useHostControls";
import { useRoomStore } from "../store/roomStore";
import { useCallTiles } from "../hooks/useCallTiles";
import {
  useRoomLayoutStore,
  type LayoutMode,
  type PipCorner,
} from "../store/roomLayoutStore";
import AutoDynamicLayout from "./layout/AutoDynamicLayout";
import TiledGridLayout from "./layout/TiledGridLayout";
import SpotlightLayout from "./layout/SpotlightLayout";
import SidebarLayout from "./layout/SidebarLayout";
import AdjustViewModal from "./layout/AdjustViewModal";
import TileView from "./layout/TileView";
import { cn } from "../../../lib/utils";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import { useOrientation } from "../../../hooks/useOrientation";

interface VideoGridProps {
  layout?: LayoutMode;
  onLayoutChange?: (l: LayoutMode) => void;
}

const cornerClasses: Record<PipCorner, string> = {
  "top-start": "top-3 left-3 md:top-5 md:left-5",
  "top-end": "top-3 right-3 md:top-5 md:right-5",
  "bottom-start": "bottom-3 left-3 md:bottom-5 md:left-5",
  "bottom-end": "bottom-3 right-3 md:bottom-5 md:right-5",
};

function FloatingSelfView({
  tile,
  tracks,
  localIdentity,
  pinnedKey,
  onTogglePin,
  onShowInTile,
  corner,
  onCornerChange,
}: {
  tile: ReturnType<typeof useCallTiles>["tiles"][number];
  tracks: ReturnType<typeof useCallTiles>["tracks"];
  localIdentity: string;
  pinnedKey: string | null;
  onTogglePin: (key: string) => void;
  onShowInTile: () => void;
  corner: PipCorner;
  onCornerChange: (corner: PipCorner) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const originRef = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const breakpoint = useBreakpoint();
  const orientation = useOrientation();
  const forcePortraitCard = breakpoint === "mobile" && orientation === "portrait";
  const [videoAspectRatio, setVideoAspectRatio] = useState(() => {
    const cameraTrack = tracks.find(
      (track) =>
        track.participant.identity === tile.participant.identity &&
        track.source === "camera",
    );
    const dimensions = cameraTrack?.publication?.dimensions;
    if (dimensions?.width && dimensions.height) {
      return dimensions.width / dimensions.height;
    }
    const isPortraitMobile =
      typeof window !== "undefined" &&
      window.innerWidth < 768 &&
      window.matchMedia?.("(orientation: portrait)").matches;
    return isPortraitMobile ? 9 / 16 : 16 / 9;
  });
  const displayedAspectRatio = forcePortraitCard ? 9 / 16 : videoAspectRatio;
  const isPortraitVideo = displayedAspectRatio < 1;

  const handleVideoAspectRatioChange = useCallback((nextAspectRatio: number) => {
    const safeAspectRatio = Math.min(16 / 9, Math.max(9 / 16, nextAspectRatio));
    setVideoAspectRatio((currentAspectRatio) =>
      Math.abs(currentAspectRatio - safeAspectRatio) < 0.01
        ? currentAspectRatio
        : safeAspectRatio,
    );
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    originRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setOffset({
      x: event.clientX - originRef.current.x,
      y: event.clientY - originRef.current.y,
    });
  };
  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const bounds = rootRef.current?.parentElement?.getBoundingClientRect();
    if (bounds) {
      const horizontal = event.clientX < bounds.left + bounds.width / 2 ? "start" : "end";
      const vertical = event.clientY < bounds.top + bounds.height / 2 ? "top" : "bottom";
      const tileBounds = event.currentTarget.getBoundingClientRect();
      const inset = window.innerWidth >= 768 ? 20 : 12;
      const targetX = horizontal === "start"
        ? inset
        : bounds.width - tileBounds.width - inset;
      const targetY = vertical === "top"
        ? inset
        : bounds.height - tileBounds.height - inset;
      onCornerChange(`${vertical}-${horizontal}` as PipCorner);
      setOffset({
        x: tileBounds.left - bounds.left - targetX,
        y: tileBounds.top - bounds.top - targetY,
      });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOffset({ x: 0, y: 0 }));
      });
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
    if (!bounds) setOffset({ x: 0, y: 0 });
  };

  return (
    <div
      ref={rootRef}
      data-testid="floating-self-view"
      className={cn(
        "absolute z-30 touch-none overflow-hidden rounded-2xl shadow-2xl",
        isPortraitVideo
          ? "w-[28vw] min-w-24 max-w-36 md:w-52 md:max-w-52 lg:w-60 lg:max-w-60"
          : "w-[42vw] min-w-32 max-w-52 md:w-52 lg:w-60",
        dragging ? "cursor-grabbing scale-[1.03]" : "cursor-grab transition-[top,right,bottom,left,transform] duration-300 ease-out",
        cornerClasses[corner],
      )}
      style={{
        aspectRatio: displayedAspectRatio,
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <TileView
        tile={tile}
        tracks={tracks}
        localIdentity={localIdentity}
        pinnedKey={pinnedKey}
        onTogglePin={onTogglePin}
        onToggleSelfView={onShowInTile}
        selfViewFloating
        compact
        onVideoAspectRatioChange={handleVideoAspectRatioChange}
        className="h-full w-full ring-1 ring-inset ring-white/25"
      />
    </div>
  );
}

export default function VideoGrid({ layout }: VideoGridProps) {
  const { isHost, muteParticipant, kickParticipant, lowerParticipantHand } =
    useHostControls();
  const { mutedByHost } = useRoomStore();
  const { tiles, tracks, localIdentity, pinnedKey, setPinnedKey } =
    useCallTiles();

  const storeLayoutMode = useRoomLayoutStore((s) => s.layoutMode);
  const setLayoutMode = useRoomLayoutStore((s) => s.setLayoutMode);
  const isAdjustViewOpen = useRoomLayoutStore((s) => s.isAdjustViewOpen);
  const setAdjustViewOpen = useRoomLayoutStore((s) => s.setAdjustViewOpen);
  const selfViewMode = useRoomLayoutStore((s) => s.selfViewMode);
  const setSelfViewMode = useRoomLayoutStore((s) => s.setSelfViewMode);
  const pipCorner = useRoomLayoutStore((s) => s.pipCorner);
  const setPipCorner = useRoomLayoutStore((s) => s.setPipCorner);

  const activeMode = layout || storeLayoutMode || "auto";
  const localCameraTile = tiles.find(
    (tile) => tile.kind === "camera" && tile.participant.identity === localIdentity,
  );
  const hasOtherTile = tiles.some((tile) => tile.key !== localCameraTile?.key);
  const localIsPinned = Boolean(localCameraTile && pinnedKey === localCameraTile.key);
  const showFloatingSelf = Boolean(
    localCameraTile && hasOtherTile && selfViewMode === "floating" && !localIsPinned,
  );
  const layoutTiles = showFloatingSelf
    ? tiles.filter((tile) => tile.key !== localCameraTile?.key)
    : tiles;

  const onTogglePin = (key: string) => {
    const unpin = pinnedKey === key;
    setPinnedKey(unpin ? null : key);
    if (activeMode === "tiled" && !unpin) setLayoutMode("sidebar");
    else if (activeMode === "sidebar" && unpin) setLayoutMode("tiled");
  };

  const commonProps = {
    tiles: layoutTiles,
    tracks,
    localIdentity,
    isHost,
    onMute: muteParticipant,
    onKick: kickParticipant,
    mutedByHost,
    onLowerHand: lowerParticipantHand,
    pinnedKey,
    onTogglePin,
    onToggleSelfView: () => setSelfViewMode("floating"),
    selfViewFloating: false,
  };

  return (
    <div className="flex-1 relative flex w-full h-full overflow-hidden bg-[var(--s0)]">
      {activeMode === "auto" && <AutoDynamicLayout {...commonProps} />}
      {activeMode === "tiled" && <TiledGridLayout {...commonProps} />}
      {activeMode === "spotlight" && <SpotlightLayout {...commonProps} />}
      {activeMode === "sidebar" && <SidebarLayout {...commonProps} />}

      {showFloatingSelf && localCameraTile && (
        <FloatingSelfView
          tile={localCameraTile}
          tracks={tracks}
          localIdentity={localIdentity}
          pinnedKey={pinnedKey}
          onTogglePin={onTogglePin}
          onShowInTile={() => setSelfViewMode("tile")}
          corner={pipCorner}
          onCornerChange={setPipCorner}
        />
      )}

      {/* Adjust View Modal */}
      <AdjustViewModal
        isOpen={isAdjustViewOpen}
        onClose={() => setAdjustViewOpen(false)}
      />
    </div>
  );
}

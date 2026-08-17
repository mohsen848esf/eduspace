import { useHostControls } from "../hooks/useHostControls";
import { useRoomStore } from "../store/roomStore";
import { useCallTiles } from "../hooks/useCallTiles";
import { useRoomLayoutStore, type LayoutMode } from "../store/roomLayoutStore";
import AutoDynamicLayout from "./layout/AutoDynamicLayout";
import TiledGridLayout from "./layout/TiledGridLayout";
import SpotlightLayout from "./layout/SpotlightLayout";
import SidebarLayout from "./layout/SidebarLayout";
import AdjustViewModal from "./layout/AdjustViewModal";

interface VideoGridProps {
  layout?: LayoutMode;
  onLayoutChange?: (l: LayoutMode) => void;
}

export default function VideoGrid({ layout }: VideoGridProps) {
  const { isHost, muteParticipant, kickParticipant, lowerParticipantHand } =
    useHostControls();
  const { mutedByHost } = useRoomStore();
  const { tiles, tracks, localIdentity, pinnedKey, setPinnedKey } =
    useCallTiles();

  const storeLayoutMode = useRoomLayoutStore((s) => s.layoutMode);
  const isAdjustViewOpen = useRoomLayoutStore((s) => s.isAdjustViewOpen);
  const setAdjustViewOpen = useRoomLayoutStore((s) => s.setAdjustViewOpen);

  const activeMode = layout || storeLayoutMode || "auto";

  const onTogglePin = (key: string) => {
    setPinnedKey(pinnedKey === key ? null : key);
  };

  const commonProps = {
    tiles,
    tracks,
    localIdentity,
    isHost,
    onMute: muteParticipant,
    onKick: kickParticipant,
    mutedByHost,
    onLowerHand: lowerParticipantHand,
    pinnedKey,
    onTogglePin,
  };

  // If ANY participant (including local user) is sharing screen, force SidebarLayout
  // so the shared screen is on the main stage and all participant cameras are in the filmstrip.
  const screenShareTile = tiles.find((t) => t.kind === "screen");

  return (
    <div className="flex-1 relative flex w-full h-full overflow-hidden bg-[var(--s0)]">
      {screenShareTile ? (
        <SidebarLayout {...commonProps} pinnedKey={pinnedKey || screenShareTile.key} />
      ) : (
        <>
          {activeMode === "auto" && <AutoDynamicLayout {...commonProps} />}
          {activeMode === "tiled" && <TiledGridLayout {...commonProps} />}
          {activeMode === "spotlight" && <SpotlightLayout {...commonProps} />}
          {activeMode === "sidebar" && <SidebarLayout {...commonProps} />}
        </>
      )}

      {/* Adjust View Modal */}
      <AdjustViewModal
        isOpen={isAdjustViewOpen}
        onClose={() => setAdjustViewOpen(false)}
      />
    </div>
  );
}

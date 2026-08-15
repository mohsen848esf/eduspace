import { useState } from "react";
import TileView from "./TileView";
import type { CallTile } from "../../hooks/useCallTiles";
import type { RemoteParticipant } from "livekit-client";
import { cn } from "../../../../lib/utils";

export interface SpotlightLayoutProps {
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

export default function SpotlightLayout(props: SpotlightLayoutProps) {
  const { tiles, pinnedKey, onTogglePin } = props;
  const [activeSpeakerOverride, setActiveSpeakerOverride] = useState<string | null>(null);

  // Focus priority: active manual override > pinned tile > first tile (e.g. active speaker / screen)
  const focusKey =
    activeSpeakerOverride && tiles.some((t) => t.key === activeSpeakerOverride)
      ? activeSpeakerOverride
      : pinnedKey && tiles.some((t) => t.key === pinnedKey)
      ? pinnedKey
      : tiles[0]?.key;

  const focusTile = tiles.find((t) => t.key === focusKey) || tiles[0];
  const otherTiles = tiles.filter((t) => t.key !== focusTile?.key);

  if (!focusTile) return null;

  return (
    <div className="flex-1 w-full h-full p-2 md:p-4 bg-[var(--s0)] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Full Stage Hero */}
      <div className="w-full h-full max-w-6xl max-h-[85vh] flex items-center justify-center">
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
          className="w-full h-full"
        />
      </div>

      {/* Floating Bottom Ribbon for other participants */}
      {otherTiles.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-2 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 max-w-[90vw] overflow-x-auto shadow-2xl">
          {otherTiles.slice(0, 8).map((tile) => (
            <button
              key={tile.key}
              type="button"
              onClick={() => setActiveSpeakerOverride(tile.key)}
              className={cn(
                "w-24 h-16 md:w-28 md:h-20 rounded-xl overflow-hidden cursor-pointer border-2 transition-all hover:scale-105 shrink-0 bg-[var(--s2)]",
                tile.key === focusKey ? "border-[var(--brand)] shadow-lg" : "border-transparent opacity-80 hover:opacity-100"
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
                compact
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

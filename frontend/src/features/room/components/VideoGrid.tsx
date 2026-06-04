import {
  VideoTrack,
  isTrackReference,
  useIsSpeaking,
} from "@livekit/components-react";
import { RemoteParticipant, Track, type Participant } from "livekit-client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icons } from "../../../lib/constants/icons";
import { Tooltip } from "../../../components/ui/Tooltip";
import { cn } from "../../../lib/utils";
import { useHostControls } from "../hooks/useHostControls";
import { useRoomStore } from "../store/roomStore";
import { useCallTiles, type CallTile } from "../hooks/useCallTiles";
import { useOrientation } from "../../../hooks/useOrientation";

type LayoutMode = "grid" | "spotlight" | "sidebar";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarGradient(identity: string): string {
  const gradients = [
    "from-[#6366f1] to-[#38bdf8]",
    "from-[#22c55e] to-[#38bdf8]",
    "from-[#f59e0b] to-[#f87171]",
    "from-[#e879f9] to-[#6366f1]",
    "from-[#f59e0b] to-[#22c55e]",
    "from-[#38bdf8] to-[#6366f1]",
  ];
  return gradients[identity.charCodeAt(0) % gradients.length];
}

function getGridClass(count: number): string {
  if (count === 1) return "grid-cols-1 grid-rows-1";
  // 2 tiles:
  //   - mobile / tablet (<lg): 1 column, 2 rows so each tile is full-width
  //     and roughly half-height. Avoids the "tall narrow strip showing
  //     half a face" look that 2 columns produces on phones.
  //   - desktop (lg+): 2 columns side-by-side as before.
  if (count === 2) return "grid-cols-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1";
  // 3 tiles: a 2x2 grid where the 3rd tile spans both columns.
  if (count === 3) return "grid-cols-2 grid-rows-2";
  if (count <= 4) return "grid-cols-2 grid-rows-2";
  if (count <= 6) return "grid-cols-3 grid-rows-2";
  if (count <= 9) return "grid-cols-3 grid-rows-3";
  return "grid-cols-4 grid-rows-3";
}

/**
 * Per-tile class overrides. Returns a class for the Nth (0-based) tile
 * given the total count, used to make a single tile span when the row
 * would otherwise leave it lonely.
 */
function getTileClass(index: number, count: number): string {
  if (count === 3 && index === 2) return "col-span-2";
  return "";
}

function getCamRef(participant: Participant, tracks: any[]) {
  return tracks.find(
    (t) =>
      t.participant.identity === participant.identity &&
      t.source === Track.Source.Camera,
  );
}

function getScreenRef(participant: Participant, tracks: any[]) {
  return tracks.find(
    (t) =>
      t.participant.identity === participant.identity &&
      t.source === Track.Source.ScreenShare,
  );
}

interface TileViewProps {
  tile: CallTile;
  tracks: any[];
  localIdentity: string;
  isHost?: boolean;
  onMute?: (p: RemoteParticipant) => void;
  onKick?: (p: RemoteParticipant) => void;
  mutedByHost?: Set<string>;
  /** Currently pinned tile key, used to render the pin badge. */
  pinnedKey: string | null;
  /** Pin / unpin handler. */
  onTogglePin: (key: string) => void;
  /**
   * Visual density flag. Compact tiles use smaller avatar circles,
   * smaller name labels, and skip the secondary badges (sharing, pin
   * indicator). They DO keep their hover/tap controls — the user must
   * always be able to pin or moderate from any tile, regardless of
   * size.
   */
  compact?: boolean;
  /** Extra Tailwind classes for grid spans. */
  className?: string;
}

/**
 * One cell in the call grid. Renders either a participant's camera or
 * their screen-share track depending on `tile.kind`. The local user's
 * camera is mirrored; remote ones are not. The screen-share variant
 * always shows the share at object-contain so we don't crop content.
 */
function TileView({
  tile,
  tracks,
  localIdentity,
  isHost,
  onMute,
  onKick,
  mutedByHost,
  pinnedKey,
  onTogglePin,
  compact = false,
  className,
}: TileViewProps) {
  const { t } = useTranslation("room");
  const { participant, kind, key } = tile;
  const isSpeaking = useIsSpeaking(participant);
  const [hovered, setHovered] = useState(false);
  const pinned = pinnedKey === key;
  const isLocal = participant.identity === localIdentity;
  const name = participant.name || participant.identity;
  const gradient = getAvatarGradient(participant.identity);

  const camRef = getCamRef(participant, tracks);
  const screenRef = getScreenRef(participant, tracks);
  const hasCam =
    camRef && isTrackReference(camRef) && !camRef.publication.isMuted;
  const hasScreen =
    screenRef &&
    isTrackReference(screenRef) &&
    !screenRef.publication.isMuted;

  // Decide which track plays in the main video element.
  const primaryTrack =
    kind === "screen" ? (hasScreen ? screenRef : null) : hasCam ? camRef : null;

  // Aspect / fitting:
  //   - screen tiles use object-contain (don't crop slides / code)
  //   - camera tiles use object-cover (face-fill)
  const fitClass = kind === "screen" ? "object-contain bg-black" : "object-cover";

  // Local sharer gets a corner PiP of their own camera so they see
  // themselves and their share at once. Remote viewers don't need it
  // because the remote sharer's camera shows up as its own tile.
  const showLocalSharerPiP =
    kind === "screen" && isLocal && hasCam;

  return (
    <div
      className={cn(
        "relative bg-[var(--s2)] rounded-xl overflow-hidden transition-all duration-200 w-full h-full tile-enter",
        isSpeaking &&
        kind === "camera" &&
        "ring-2 ring-[var(--green)] ring-offset-2 ring-offset-[var(--s0)]",
        pinned &&
        "ring-2 ring-[var(--brand)] ring-offset-2 ring-offset-[var(--s0)]",
        className,
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {primaryTrack ? (
        <VideoTrack
          trackRef={primaryTrack}
          className={cn("absolute inset-0 w-full h-full", fitClass)}
          style={
            { transform: "scaleX(-1)" }

          }
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br",
              compact ? "w-8 h-8 text-xs" : "w-14 h-14 text-xl",
              gradient,
            )}
          >
            {getInitials(name)}
          </div>
        </div>
      )}

      {showLocalSharerPiP && (
        <div className="absolute bottom-10 end-2 w-20 h-14 rounded-lg overflow-hidden border-2 border-[var(--s0)] shadow-lg">
          <VideoTrack
            trackRef={camRef}
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        </div>
      )}

      {/* Sharing badge only on the screen tile, not the camera tile of
          the same participant — otherwise it'd duplicate. */}
      {kind === "screen" && !compact && (
        <div className="absolute top-2 start-2 bg-[var(--brand)]/80 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
          {Icons.screenShare}
          <span>{t("tile.sharing")}</span>
        </div>
      )}

      {pinned && !compact && (
        <div className="absolute top-2 end-2 bg-[var(--brand)]/80 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
          📌
        </div>
      )}

      {isSpeaking && kind === "camera" && (
        <div className="absolute top-2 end-2 flex gap-0.5 items-end h-4">
          {[1, 2, 3, 2, 1].map((h, i) => (
            <div
              key={i}
              className="w-0.5 bg-[var(--green)] rounded-full"
              style={{
                height: `${h * 25}%`,
                animation: `pulse ${0.3 + i * 0.1}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
      )}

      {hovered && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center gap-2 fade-in">
          <Tooltip content={t("tile.zoomIn")}>
            <button
              className={cn(
                "rounded-full bg-white/15 hover:bg-white/25 border-none cursor-pointer text-white flex items-center justify-center transition-all active:scale-95",
                compact ? "w-7 h-7 text-xs" : "w-9 h-9 text-base",
              )}
            >
              🔍
            </button>
          </Tooltip>
          <Tooltip content={pinned ? t("tile.unpin") : t("tile.pin")}>
            <button
              className={cn(
                "rounded-full border-none cursor-pointer text-white flex items-center justify-center transition-all active:scale-95",
                compact ? "w-7 h-7 text-xs" : "w-9 h-9 text-base",
                pinned
                  ? "bg-[var(--brand)]/60 hover:bg-[var(--brand)]/80"
                  : "bg-white/15 hover:bg-white/25",
              )}
              onClick={() => onTogglePin(key)}
            >
              📌
            </button>
          </Tooltip>
          {/* Host moderation only makes sense on camera tiles. The
              screen tile is the same participant; muting from there
              would be redundant. */}
          {isHost && kind === "camera" && !isLocal && (
            <>
              <Tooltip
                content={
                  mutedByHost?.has(participant.identity)
                    ? t("tile.unmute")
                    : t("tile.mute")
                }
              >
                <button
                  className={cn(
                    "rounded-full border-none cursor-pointer text-white flex items-center justify-center transition-all active:scale-95",
                    compact ? "w-7 h-7 text-xs" : "w-9 h-9 text-base",
                    mutedByHost?.has(participant.identity)
                      ? "bg-[var(--amber)]/60 hover:bg-[var(--amber)]/80"
                      : "bg-white/15 hover:bg-[var(--amber)]/50",
                  )}
                  onClick={() => onMute?.(participant as RemoteParticipant)}
                >
                  {mutedByHost?.has(participant.identity) ? "🎙" : "🔇"}
                </button>
              </Tooltip>
              <Tooltip content={t("tile.remove")}>
                <button
                  className={cn(
                    "rounded-full bg-white/15 hover:bg-[var(--red)]/50 border-none cursor-pointer text-white flex items-center justify-center transition-all active:scale-95",
                    compact ? "w-7 h-7 text-xs" : "w-9 h-9 text-base",
                  )}
                  onClick={() => onKick?.(participant as RemoteParticipant)}
                >
                  ✕
                </button>
              </Tooltip>
            </>
          )}
        </div>
      )}
      <div className="absolute bottom-0 start-0 end-0 p-1.5 flex items-center gap-1 bg-gradient-to-t from-black/60 to-transparent">
        <span
          className={cn(
            "font-semibold text-white bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-md truncate flex-1",
            compact ? "text-[9px]" : "text-[11px]",
          )}
        >
          {kind === "screen"
            ? `${name}${isLocal ? ` ${t("tile.you")}` : ""} · ${t("tile.sharing")}`
            : isLocal
              ? `${name} ${t("tile.you")}`
              : name}
        </span>
      </div>
    </div>
  );
}

interface LayoutCommonProps {
  tiles: CallTile[];
  tracks: any[];
  localIdentity: string;
  isHost?: boolean;
  onMute?: (p: RemoteParticipant) => void;
  onKick?: (p: RemoteParticipant) => void;
  mutedByHost?: Set<string>;
  pinnedKey: string | null;
  onTogglePin: (key: string) => void;
}

function GridLayout(props: LayoutCommonProps) {
  const { tiles, pinnedKey } = props;

  // When something is pinned (typically the auto-pinned screen share),
  // switch to PinnedShareLayout so the share gets prominent real estate
  // and the rest reflow into a strip below it. This is the layout the
  // user described for portrait mobile, but it works at any width.
  if (pinnedKey && tiles.some((t) => t.key === pinnedKey)) {
    return <PinnedShareLayout {...props} />;
  }

  return (
    <div
      className={cn(
        "flex-1 grid gap-2 md:gap-3 p-2 md:p-3 bg-[var(--s0)]",
        getGridClass(tiles.length),
      )}
    >
      {tiles.map((tile, idx) => (
        <TileView
          key={tile.key}
          tile={tile}
          tracks={props.tracks}
          localIdentity={props.localIdentity}
          isHost={props.isHost}
          onMute={props.onMute}
          onKick={props.onKick}
          mutedByHost={props.mutedByHost}
          pinnedKey={props.pinnedKey}
          onTogglePin={props.onTogglePin}
          className={getTileClass(idx, tiles.length)}
        />
      ))}
    </div>
  );
}

/**
 * Layout used when there's a pinned tile (auto-pinned screen share or
 * a manual user pin). The pinned tile takes the top third of the
 * viewport at full width; the remaining tiles flow into a responsive
 * strip below it. See `planStrip` for the row/col math.
 */

/**
 * Strip layout for tiles below the pinned share. Returns:
 *   - `cols` (Tailwind grid-cols-*)
 *   - `visibleCount`: number of "real" tiles shown
 *   - `showOverflow`: whether to render the +N pill (one of the cells)
 *
 * The math follows the user's spec, which is:
 *   * 1 other  → 1 col (full width)
 *   * 2 others → 2 cols × 1 row
 *   * 3 others → 2 cols × 2 rows, last tile spans both
 *   * 4 others → 2 cols × 2 rows
 *   * 5 others → 3 cols × 2 rows, with the 5 + an empty cell padding
 *                — actually we treat 5 as `3 cols, fills naturally`
 *   * 6 others → 3 cols × 2 rows
 *   * >6       → 5 visible + 1 +N pill in the 6th slot (3 cols × 2 rows)
 */
const PINNED_STRIP_VISIBLE_CAP = 6;

interface StripPlan {
  cols: string;
  /** Tiles to actually render (subset of rest). */
  visible: CallTile[];
  /** Count omitted because of the cap. 0 means no pill. */
  overflow: number;
  /** If overflow > 0, we drop one visible tile and show the pill, so
   *  the strip stays at cap_total cells. */
  showOverflow: boolean;
  /** Class applied to the very last visible tile when count === 3 so
   *  it spans both columns. */
  lastSpanClass: string;
}

function planStrip(rest: CallTile[]): StripPlan {
  const total = rest.length;

  if (total === 0) {
    return {
      cols: "grid-cols-1",
      visible: [],
      overflow: 0,
      showOverflow: false,
      lastSpanClass: "",
    };
  }
  if (total === 1) {
    return {
      cols: "grid-cols-1",
      visible: rest,
      overflow: 0,
      showOverflow: false,
      lastSpanClass: "",
    };
  }
  if (total === 2) {
    return {
      cols: "grid-cols-2",
      visible: rest,
      overflow: 0,
      showOverflow: false,
      lastSpanClass: "",
    };
  }
  if (total === 3) {
    // 2 cols × 2 rows, last tile spans both columns so the row doesn't
    // leave a lonely cell.
    return {
      cols: "grid-cols-2",
      visible: rest,
      overflow: 0,
      showOverflow: false,
      lastSpanClass: "col-span-2",
    };
  }
  if (total === 4) {
    return {
      cols: "grid-cols-2",
      visible: rest,
      overflow: 0,
      showOverflow: false,
      lastSpanClass: "",
    };
  }
  if (total <= PINNED_STRIP_VISIBLE_CAP) {
    return {
      cols: "grid-cols-3",
      visible: rest,
      overflow: 0,
      showOverflow: false,
      lastSpanClass: "",
    };
  }
  // > cap: keep 5 real tiles + 1 +N pill so the grid stays at 6 cells.
  const visibleCap = PINNED_STRIP_VISIBLE_CAP - 1;
  return {
    cols: "grid-cols-3",
    visible: rest.slice(0, visibleCap),
    overflow: total - visibleCap,
    showOverflow: true,
    lastSpanClass: "",
  };
}

function PinnedShareLayout(props: LayoutCommonProps) {
  const { tiles, pinnedKey } = props;
  const { t } = useTranslation("room");
  const orientation = useOrientation();

  const focus = tiles.find((tt) => tt.key === pinnedKey)!;
  const rest = tiles.filter((tt) => tt.key !== focus.key);

  // Edge case: only the pinned tile exists (e.g. user is alone in the
  // call and shares their screen). Don't waste 2/3 of the screen on an
  // empty strip — render the share full-bleed.
  if (rest.length === 0) {
    return (
      <div className="flex-1 flex p-2 md:p-3 bg-[var(--s0)]">
        <TileView
          tile={focus}
          tracks={props.tracks}
          localIdentity={props.localIdentity}
          isHost={props.isHost}
          onMute={props.onMute}
          onKick={props.onKick}
          mutedByHost={props.mutedByHost}
          pinnedKey={pinnedKey}
          onTogglePin={props.onTogglePin}
        />
      </div>
    );
  }

  const plan = planStrip(rest);

  const handleOverflowClick = () => {
    // The shells listen for this event and open the People tab.
    window.dispatchEvent(new CustomEvent("eduspace:open-people-tab"));
  };

  // Layout direction: portrait stacks share-on-top + strip-below;
  // landscape splits share-on-left + strip-on-right so neither half
  // collapses to nothing on a phone in rotation.
  const containerCls =
    orientation === "landscape"
      ? "flex-1 flex flex-row gap-2 md:gap-3 p-2 md:p-3 bg-[var(--s0)]"
      : "flex-1 flex flex-col gap-2 md:gap-3 p-2 md:p-3 bg-[var(--s0)]";
  const focusCls =
    orientation === "landscape"
      ? "basis-2/3 grow-0 shrink-0 min-w-[200px] relative"
      : "basis-1/3 grow-0 shrink-0 min-h-[180px] relative";
  // The strip uses the count-driven cols from planStrip, plus auto-rows
  // so the rows stretch to fill the remaining space.
  const stripCls =
    orientation === "landscape"
      ? cn("flex-1 grid gap-2 md:gap-3 auto-rows-fr min-w-0", plan.cols)
      : cn("flex-1 grid gap-2 md:gap-3 auto-rows-fr min-h-0", plan.cols);

  return (
    <div className={containerCls}>
      {/* Pinned tile — see focusCls comment above. */}
      <div className={focusCls}>
        <TileView
          tile={focus}
          tracks={props.tracks}
          localIdentity={props.localIdentity}
          isHost={props.isHost}
          onMute={props.onMute}
          onKick={props.onKick}
          mutedByHost={props.mutedByHost}
          pinnedKey={pinnedKey}
          onTogglePin={props.onTogglePin}
        />
      </div>

      <div className={stripCls}>
        {plan.visible.map((tile, idx) => (
          <TileView
            key={tile.key}
            tile={tile}
            tracks={props.tracks}
            localIdentity={props.localIdentity}
            isHost={props.isHost}
            onMute={props.onMute}
            onKick={props.onKick}
            mutedByHost={props.mutedByHost}
            pinnedKey={pinnedKey}
            onTogglePin={props.onTogglePin}
            compact
            className={
              idx === plan.visible.length - 1 ? plan.lastSpanClass : ""
            }
          />
        ))}
        {plan.showOverflow && plan.overflow > 0 && (
          <button
            type="button"
            onClick={handleOverflowClick}
            className={cn(
              "rounded-xl border-none cursor-pointer transition-colors",
              "bg-[var(--s2)] hover:bg-[var(--s3)]",
              "text-[var(--t1)] text-sm font-bold flex flex-col items-center justify-center gap-0.5",
            )}
            aria-label={t("tile.overflowMore", { count: plan.overflow })}
          >
            <span className="text-xl leading-none">+{plan.overflow}</span>
            <span className="text-[10px] font-medium text-[var(--t3)] uppercase tracking-wider">
              {t("tile.overflowLabel")}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Spotlight: one tile big, others as a vertical strip. When a tile is
 * pinned (auto or manual), the pinned tile becomes the spotlight; the
 * user can still click thumbnails to override.
 */
function SpotlightLayout(props: LayoutCommonProps) {
  const { tiles, pinnedKey, onTogglePin } = props;
  const [overrideId, setOverrideId] = useState<string | null>(null);
  // Priority: explicit user override on this layout > global pin > first tile.
  const focusKey =
    overrideId && tiles.some((t) => t.key === overrideId)
      ? overrideId
      : pinnedKey && tiles.some((t) => t.key === pinnedKey)
        ? pinnedKey
        : tiles[0]?.key;
  const focus = tiles.find((t) => t.key === focusKey) ?? tiles[0];
  const rest = tiles.filter((t) => t.key !== focus?.key);

  if (!focus) return null;

  return (
    <div className="flex-1 flex gap-2 md:gap-3 p-2 md:p-3 bg-[var(--s0)]">
      <div className="flex-1 relative">
        <TileView
          tile={focus}
          tracks={props.tracks}
          localIdentity={props.localIdentity}
          isHost={props.isHost}
          onMute={props.onMute}
          onKick={props.onKick}
          mutedByHost={props.mutedByHost}
          pinnedKey={pinnedKey}
          onTogglePin={onTogglePin}
        />
      </div>
      {rest.length > 0 && (
        <div className="flex flex-col gap-2 md:gap-3 w-32">
          {rest.map((tile) => (
            <div
              key={tile.key}
              className="h-24 cursor-pointer rounded-xl overflow-hidden"
              onClick={() => setOverrideId(tile.key)}
            >
              <TileView
                tile={tile}
                tracks={props.tracks}
                localIdentity={props.localIdentity}
                mutedByHost={props.mutedByHost}
                pinnedKey={pinnedKey}
                onTogglePin={onTogglePin}
                compact
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarLayout(props: LayoutCommonProps) {
  const { tiles, pinnedKey, onTogglePin } = props;
  // Same focus logic as Spotlight, but no per-layout override.
  const focusKey =
    pinnedKey && tiles.some((t) => t.key === pinnedKey)
      ? pinnedKey
      : tiles[0]?.key;
  const focus = tiles.find((t) => t.key === focusKey) ?? tiles[0];
  const rest = tiles.filter((t) => t.key !== focus?.key);

  if (!focus) return null;

  return (
    <div className="flex-1 flex gap-2 md:gap-3 p-2 md:p-3 bg-[var(--s0)]">
      <div className="flex-1 relative">
        <TileView
          tile={focus}
          tracks={props.tracks}
          localIdentity={props.localIdentity}
          isHost={props.isHost}
          onMute={props.onMute}
          onKick={props.onKick}
          mutedByHost={props.mutedByHost}
          pinnedKey={pinnedKey}
          onTogglePin={onTogglePin}
        />
      </div>
      <div className="flex flex-col gap-2 md:gap-3 w-28">
        {rest.map((tile) => (
          <div key={tile.key} className="h-20 rounded-xl overflow-hidden">
            <TileView
              tile={tile}
              tracks={props.tracks}
              localIdentity={props.localIdentity}
              mutedByHost={props.mutedByHost}
              pinnedKey={pinnedKey}
              onTogglePin={onTogglePin}
              compact
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface VideoGridProps {
  layout: LayoutMode;
  onLayoutChange: (l: LayoutMode) => void;
}

export default function VideoGrid({ layout }: VideoGridProps) {
  const { isHost, muteParticipant, kickParticipant } = useHostControls();
  const { mutedByHost } = useRoomStore();
  const { tiles, tracks, localIdentity, pinnedKey, setPinnedKey } =
    useCallTiles();

  const onTogglePin = (key: string) => {
    setPinnedKey(pinnedKey === key ? null : key);
  };

  const common: LayoutCommonProps = {
    tiles,
    tracks,
    localIdentity,
    isHost,
    onMute: muteParticipant,
    onKick: kickParticipant,
    mutedByHost,
    pinnedKey,
    onTogglePin,
  };

  return (
    <div className="flex-1 relative flex overflow-hidden">
      {layout === "grid" && <GridLayout {...common} />}
      {layout === "spotlight" && <SpotlightLayout {...common} />}
      {layout === "sidebar" && <SidebarLayout {...common} />}
    </div>
  );
}

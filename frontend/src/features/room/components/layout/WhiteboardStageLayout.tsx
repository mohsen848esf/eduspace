import { useState } from "react";
import Whiteboard from "../Whiteboard";
import TileView from "./TileView";
import SummaryOverflowTile from "./SummaryOverflowTile";
import { useOrientation } from "../../../../hooks/useOrientation";
import { useHostControls } from "../../hooks/useHostControls";
import { useCallTiles } from "../../hooks/useCallTiles";
import { useRoomStore } from "../../store/roomStore";
import { useWhiteboard } from "../../hooks/useWhiteboard";
import { cn } from "../../../../lib/utils";
import { Tooltip } from "../../../../components/ui/Tooltip";
import { Users, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface WhiteboardStageLayoutProps {
  whiteboard: ReturnType<typeof useWhiteboard>;
}

export default function WhiteboardStageLayout({
  whiteboard,
}: WhiteboardStageLayoutProps) {
  const { t } = useTranslation("room");
  const orientation = useOrientation();
  const isLandscape = orientation === "landscape";

  const { isHost, muteParticipant, kickParticipant, lowerParticipantHand } =
    useHostControls();
  const { mutedByHost } = useRoomStore();
  const { tiles, tracks, localIdentity, pinnedKey, setPinnedKey } =
    useCallTiles();

  const [showFilmstrip, setShowFilmstrip] = useState(true);

  const onTogglePin = (key: string) => {
    setPinnedKey(pinnedKey === key ? null : key);
  };

  const STRIP_CAP = 6;
  const hasOverflow = tiles.length > STRIP_CAP;
  const visibleStripTiles = hasOverflow ? tiles.slice(0, STRIP_CAP - 1) : tiles;
  const overflowStripTiles = hasOverflow ? tiles.slice(STRIP_CAP - 1) : [];

  return (
    <div
      className={cn(
        "flex-1 w-full h-full p-2 md:p-3 bg-[var(--s0)] gap-2 md:gap-3 overflow-hidden flex",
        isLandscape ? "flex-row" : "flex-col"
      )}
    >
      {/* 1. Main Stage: Whiteboard Canvas */}
      <div
        className={cn(
          "relative flex flex-col min-w-0 min-h-0 rounded-2xl overflow-hidden shadow-2xl border border-[#334155]",
          showFilmstrip && tiles.length > 0
            ? isLandscape
              ? "flex-[3.5]"
              : "flex-[2.5]"
            : "flex-1"
        )}
      >
        <Whiteboard
          whiteboard={whiteboard.whiteboard}
          onEnd={whiteboard.endWhiteboard}
          onMinimize={whiteboard.minimizeWhiteboard}
          toggleDrawingPermission={whiteboard.toggleDrawingPermission}
          broadcastWhiteboardEvent={whiteboard.broadcastWhiteboardEvent}
          subscribeWhiteboardEvents={whiteboard.subscribeWhiteboardEvents}
          requestSyncState={whiteboard.requestSyncState}
        />

        {/* Filmstrip Floating Toggle Button inside Whiteboard stage */}
        {tiles.length > 0 && (
          <div className="absolute top-14 end-3 z-30">
            <Tooltip
              content={
                showFilmstrip
                  ? t("whiteboard.hideWebcams", "مخفی کردن نوار دوربین‌ها")
                  : t("whiteboard.showWebcams", "نمایش نوار دوربین‌ها")
              }
            >
              <button
                type="button"
                onClick={() => setShowFilmstrip((p) => !p)}
                className="h-8 px-2.5 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/20 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
              >
                {showFilmstrip ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-white/80" />
                    <span className="hidden sm:inline text-[11px]">
                      {t("whiteboard.hideStrip", "مخفی کردن وب‌کم‌ها")}
                    </span>
                  </>
                ) : (
                  <>
                    <Users className="w-3.5 h-3.5 text-[var(--cyan)]" />
                    <span className="hidden sm:inline text-[11px]">
                      {t("whiteboard.showStrip", "نمایش وب‌کم‌ها")} ({tiles.length})
                    </span>
                  </>
                )}
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {/* 2. Side / Bottom Webcam Filmstrip */}
      {showFilmstrip && tiles.length > 0 && (
        <div
          className={cn(
            "flex gap-2 min-w-0 min-h-0 animate-in fade-in duration-200",
            isLandscape
              ? "flex-1 flex-col overflow-y-auto overflow-x-hidden max-w-[280px] scrollbar-none"
              : "flex-row overflow-x-auto overflow-y-hidden h-28 sm:h-32 shrink-0 scrollbar-none touch-pan-x"
          )}
        >
          {visibleStripTiles.map((tile) => (
            <div
              key={tile.key}
              className={cn(
                "rounded-xl overflow-hidden shrink-0 transition-transform hover:scale-[1.02]",
                isLandscape ? "h-36 w-full" : "w-40 sm:w-44 h-full"
              )}
            >
              <TileView
                tile={tile}
                tracks={tracks}
                localIdentity={localIdentity}
                isHost={isHost}
                onMute={muteParticipant}
                onKick={kickParticipant}
                mutedByHost={mutedByHost}
                onLowerHand={lowerParticipantHand}
                pinnedKey={pinnedKey}
                onTogglePin={onTogglePin}
                compact
              />
            </div>
          ))}

          {hasOverflow && (
            <div
              className={cn(
                "rounded-xl overflow-hidden shrink-0",
                isLandscape ? "h-36 w-full" : "w-40 sm:w-44 h-full"
              )}
            >
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

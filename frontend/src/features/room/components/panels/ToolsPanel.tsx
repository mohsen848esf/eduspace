import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../../lib/utils";
import { useRoomGame } from "../../hooks/useRoomGameContext";
import { useRoomStore } from "../../store/roomStore";
import MiniAppSelectorModal from "../MiniAppSelectorModal";

/**
 * In-call tools panel — game launcher, whiteboard, quick exam, etc.
 *
 * Only the game tool changes shape based on host + active state. The
 * other tools surface their "soon" badge until the corresponding feature
 * ships.
 *
 * Reused by:
 *   - RoomSidebar (docked panel)
 *   - MobileSwipeShell page 4
 *   - MobileSheetShell BottomSheet
 */
export default function ToolsPanel() {
  const { t } = useTranslation(["room", "common", "games"]);
  const { gameBoard, launchGame, endGame } = useRoomGame();
  const { isHost } = useRoomStore();
  const [showSelector, setShowSelector] = useState(false);

  const isGameActive = gameBoard.isActive;

  const gameTool = isGameActive
    ? {
        icon: "🛑",
        name: t("games:tools.endGameLabel"),
        desc: t("games:tools.endGameDesc"),
        status: "ready" as const,
        onClick: () => endGame(),
        bg: "bg-[rgba(248,113,113,0.12)]",
        disabled: !isHost,
      }
    : {
        icon: "🎮",
        name: t("games:tools.launchLabel"),
        desc: t("games:tools.launchDesc"),
        status: "ready" as const,
        onClick: () => setShowSelector(true),
        bg: "bg-[rgba(99,102,241,0.15)]",
        disabled: !isHost,
      };

  const tools = [
    gameTool,
    {
      icon: "🤖",
      name: t("tools.aiSummary"),
      desc: t("tools.aiSummaryDesc"),
      status: "soon" as const,
      onClick: () => undefined,
      bg: "bg-[rgba(245,158,11,0.12)]",
      disabled: true,
    },
    {
      icon: "📁",
      name: t("tools.fileShare"),
      desc: t("tools.fileShareDesc"),
      status: "soon" as const,
      onClick: () => undefined,
      bg: "bg-[rgba(248,113,113,0.12)]",
      disabled: true,
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-1">
        {tools.map((tool) => (
          <button
            key={tool.name}
            onClick={tool.onClick}
            disabled={tool.disabled || tool.status === "soon"}
            className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[var(--s3)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors text-start border-none bg-transparent w-full"
          >
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0",
                tool.bg,
              )}
            >
              {tool.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[var(--t1)]">
                {tool.name}
              </div>
              <div className="text-[10px] text-[var(--t3)] mt-0.5">
                {tool.desc}
              </div>
            </div>
            {tool.status === "soon" ? (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[rgba(245,158,11,0.1)] text-[var(--amber)] flex-shrink-0">
                {t("common:actions.soon")}
              </span>
            ) : (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[rgba(34,197,94,0.1)] text-[var(--green)] flex-shrink-0">
                {t("tools.ready")}
              </span>
            )}
          </button>
        ))}
      </div>

      <MiniAppSelectorModal
        open={showSelector}
        onClose={() => setShowSelector(false)}
        onLaunch={(args) =>
          launchGame(args.gameId, args.gameTitle, args.gameUrl)
        }
        activeGame={isGameActive ? {
          gameId: gameBoard.gameId || "",
          gameTitle: gameBoard.gameTitle || "",
          gameUrl: gameBoard.gameUrl || "",
          hostIdentity: gameBoard.hostIdentity || "",
        } : null}
      />
    </>
  );
}

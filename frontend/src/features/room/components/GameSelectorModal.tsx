import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import Spinner from "../../../components/ui/Spinner";
import { cn } from "../../../lib/utils";
import gamesApi, {
  type GameSummary,
  gameAssetUrl,
} from "../../games/api/games.api";

interface GameSelectorModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * Called when the host launches a game. Receives the platform-side
   * payload that should be broadcast to all participants.
   */
  onLaunch: (args: {
    gameId: string;
    gameTitle: string;
    gameUrl: string;
  }) => Promise<unknown> | unknown;
}

const GAME_TYPE_ICON: Record<string, string> = {
  word_guess: "🔤",
  grammar: "📝",
  vocab: "📚",
};

export default function GameSelectorModal({
  open,
  onClose,
  onLaunch,
}: GameSelectorModalProps) {
  const { t } = useTranslation(["games", "common"]);
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  // Load on first open; refetch each time so newly added games show up
  // without a hard refresh.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setGames(null);
    setSelectedId(null);
    gamesApi
      .list()
      .then((data) => {
        if (!cancelled) setGames(data);
      })
      .catch(() => {
        if (!cancelled) setGames([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleLaunch = async () => {
    if (!games || selectedId == null) return;
    const game = games.find((g) => g.id === selectedId);
    if (!game) return;
    const url = gameAssetUrl(game);
    if (!url) return;
    setIsLaunching(true);
    try {
      await onLaunch({
        gameId: String(game.id),
        gameTitle: game.title,
        gameUrl: url,
      });
      onClose();
    } finally {
      setIsLaunching(false);
    }
  };

  const launchable =
    games?.find((g) => g.id === selectedId)?.game_type !== undefined &&
    selectedId != null &&
    !!gameAssetUrl(games!.find((g) => g.id === selectedId)!);

  return (
    <Modal
      open={open}
      onOpenChange={(v) => (v ? null : onClose())}
      panelClassName="max-w-xl"
    >
      <ModalHeader>
        <div>
          <ModalTitle>{t("games:selector.title")}</ModalTitle>
          <ModalDescription>{t("games:selector.subtitle")}</ModalDescription>
        </div>
      </ModalHeader>

      <ModalBody>
        {games === null ? (
          <div className="flex items-center justify-center py-10">
            <Spinner size="md" />
          </div>
        ) : games.length === 0 ? (
          <p className="text-xs text-[var(--t3)] text-center py-6">
            {t("games:selector.empty")}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
            {games.map((g) => {
              const url = gameAssetUrl(g);
              const playable = !!url;
              const selected = selectedId === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => playable && setSelectedId(g.id)}
                  disabled={!playable}
                  className={cn(
                    "text-start p-3 rounded-xl border cursor-pointer transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    selected
                      ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                      : "border-[var(--b)] bg-[var(--s3)] hover:border-[var(--bh)]",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0",
                        selected
                          ? "bg-[var(--brand)]/20"
                          : "bg-[var(--s2)]",
                      )}
                    >
                      {GAME_TYPE_ICON[g.game_type] || "🎮"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-[var(--t1)] truncate">
                          {g.title}
                        </span>
                        {!playable && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[var(--amber)]/15 text-[var(--amber)] uppercase tracking-wider">
                            {t("games:selector.comingSoon")}
                          </span>
                        )}
                        {playable && !g.is_free && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[var(--brand-soft)] text-[var(--brand-text)] uppercase tracking-wider">
                            {t("games:selector.premium")}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--t3)] mt-0.5 line-clamp-2">
                        {g.description || ""}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t("common:actions.cancel")}
        </Button>
        <Button
          size="sm"
          onClick={handleLaunch}
          loading={isLaunching}
          disabled={!launchable}
        >
          {t("games:selector.launch")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

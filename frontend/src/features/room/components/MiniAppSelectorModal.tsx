import { useEffect, useMemo, useState } from "react";
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

/**
 * In-call equivalent of the Mini Apps gallery on /miniapps. Mirrors
 * the same category set so users see a consistent surface across the
 * app. Only games are launchable today; the rest (whiteboard, exams,
 * polls) are static "Soon" cards.
 *
 * Once the host picks a game and confirms, we hand the existing launch
 * payload to ToolsPanel via `onLaunch` — same shape as the previous
 * GameSelectorModal so the call-side wiring doesn't change.
 */
type CategoryId = "all" | "games" | "whiteboard" | "exams" | "polls";

interface MiniAppEntry {
  id: string;
  title: string;
  description?: string;
  icon: string;
  accent: string;
  category: Exclude<CategoryId, "all">;
  /** Set when the entry can be launched right now. */
  game?: GameSummary;
  /** When false, the card is rendered with a "Soon" badge. */
  ready: boolean;
  /** Optional Premium badge. */
  premium?: boolean;
}

const STATIC_ENTRIES: MiniAppEntry[] = [
  {
    id: "static:whiteboard",
    title: "Whiteboard",
    description: "Collaborative drawing for live sessions",
    icon: "🎨",
    accent: "from-[#38bdf8] to-[#6366f1]",
    category: "whiteboard",
    ready: false,
  },
  {
    id: "static:quick-exam",
    title: "Quick Exam",
    description: "Spin up a short quiz inside a call",
    icon: "📝",
    accent: "from-[#f59e0b] to-[#f87171]",
    category: "exams",
    ready: false,
  },
  {
    id: "static:poll",
    title: "Live Poll",
    description: "Ask the room a question, see live results",
    icon: "📊",
    accent: "from-[#22c55e] to-[#38bdf8]",
    category: "polls",
    ready: false,
  },
];

const CATEGORIES: CategoryId[] = ["all", "games", "whiteboard", "exams", "polls"];

const GAME_TYPE_ICON: Record<string, string> = {
  word_guess: "🔤",
  grammar: "📚",
  vocab: "🧠",
};

interface MiniAppSelectorModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * Called when the host launches a real mini app (currently only
   * games). Same payload shape the call-side useGameBoard hook expects.
   */
  onLaunch: (args: {
    gameId: string;
    gameTitle: string;
    gameUrl: string;
  }) => Promise<unknown> | unknown;
}

function gameToEntry(g: GameSummary): MiniAppEntry {
  const url = gameAssetUrl(g);
  return {
    id: `game:${g.id}`,
    title: g.title,
    description: g.description,
    icon: GAME_TYPE_ICON[g.game_type] || "🎮",
    accent: "from-[#e879f9] to-[#6366f1]",
    category: "games",
    game: g,
    ready: !!url,
    premium: !g.is_free,
  };
}

export default function MiniAppSelectorModal({
  open,
  onClose,
  onLaunch,
}: MiniAppSelectorModalProps) {
  const { t } = useTranslation(["miniapps", "games", "common"]);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  // Fetch games whenever the modal opens. Reset selection so a previous
  // pick doesn't carry over into the next launch attempt.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setGames(null);
    setSelectedId(null);
    setActiveCategory("all");
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

  const entries: MiniAppEntry[] = useMemo(() => {
    const out: MiniAppEntry[] = [];
    if (games) out.push(...games.map(gameToEntry));
    out.push(...STATIC_ENTRIES);
    return out;
  }, [games]);

  const filtered = useMemo(() => {
    if (activeCategory === "all") return entries;
    return entries.filter((e) => e.category === activeCategory);
  }, [entries, activeCategory]);

  const selected = entries.find((e) => e.id === selectedId);
  const launchable = !!selected && selected.ready && !!selected.game;

  const handleLaunch = async () => {
    if (!selected || !selected.game) return;
    const url = gameAssetUrl(selected.game);
    if (!url) return;
    setIsLaunching(true);
    try {
      await onLaunch({
        gameId: String(selected.game.id),
        gameTitle: selected.game.title,
        gameUrl: url,
      });
      onClose();
    } finally {
      setIsLaunching(false);
    }
  };

  const isLoading = games === null;

  return (
    <Modal
      open={open}
      onOpenChange={(v) => (v ? null : onClose())}
      panelClassName="max-w-xl"
    >
      <ModalHeader>
        <div>
          <ModalTitle>{t("miniapps:page.title")}</ModalTitle>
          <ModalDescription>{t("miniapps:page.subtitle")}</ModalDescription>
        </div>
      </ModalHeader>

      <ModalBody>
        {/* Category chips. */}
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-2 mb-2 border-b border-[var(--b)]">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "flex-shrink-0 px-2.5 py-1 rounded-full border-none cursor-pointer transition-colors",
                  "text-[11px] font-semibold whitespace-nowrap",
                  isActive
                    ? "bg-[var(--brand)] text-white"
                    : "bg-[var(--s3)] text-[var(--t2)] hover:bg-[var(--s4)] hover:text-[var(--t1)]",
                )}
              >
                {t(`miniapps:categories.${cat}`)}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner size="md" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-[var(--t3)] text-center py-6">
            {t("miniapps:empty.title")}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
            {filtered.map((e) => (
              <EntryCard
                key={e.id}
                entry={e}
                selected={selectedId === e.id}
                onSelect={() => e.ready && setSelectedId(e.id)}
                t={t}
              />
            ))}
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

interface EntryCardProps {
  entry: MiniAppEntry;
  selected: boolean;
  onSelect: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function EntryCard({ entry, selected, onSelect, t }: EntryCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!entry.ready}
      className={cn(
        "text-start p-3 rounded-xl border cursor-pointer transition-all",
        "disabled:cursor-not-allowed",
        selected
          ? "border-[var(--brand)] bg-[var(--brand-soft)]"
          : "border-[var(--b)] bg-[var(--s3)] hover:border-[var(--bh)]",
        !entry.ready && "opacity-70",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0",
            "bg-gradient-to-br shadow-inner",
            entry.accent,
          )}
          aria-hidden
        >
          {entry.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-[var(--t1)] truncate">
              {entry.title}
            </span>
            <span
              className={cn(
                "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md",
                entry.ready
                  ? "bg-[var(--green)]/15 text-[var(--green)]"
                  : "bg-[var(--amber)]/15 text-[var(--amber)]",
              )}
            >
              {entry.ready ? t("miniapps:card.ready") : t("miniapps:card.soon")}
            </span>
            {entry.premium && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[var(--brand-soft)] text-[var(--brand-text)]">
                {t("miniapps:card.premium")}
              </span>
            )}
          </div>
          {entry.description && (
            <p className="text-[11px] text-[var(--t3)] mt-0.5 line-clamp-2">
              {entry.description}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

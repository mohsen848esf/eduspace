import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AppShell from "../../../components/layout/AppShell";
import Spinner from "../../../components/ui/Spinner";
import { cn } from "../../../lib/utils";
import gamesApi, {
  type GameSummary,
  gameAssetUrl,
} from "../../games/api/games.api";

/**
 * Categories shown as filter chips on top of the gallery. The `id` is
 * also the bucket key returned by `bucketize` below.
 */
type CategoryId = "all" | "games" | "whiteboard" | "exams" | "polls";

interface MiniAppCard {
  /** Stable React key. */
  id: string;
  /** Tile label. */
  title: string;
  /** Short one-liner. */
  description?: string;
  /** Emoji or icon. */
  icon: string;
  /** Cosmetic gradient applied to the tile. */
  accent: string;
  category: Exclude<CategoryId, "all">;
  /**
   * If set, the card is "Ready" and clicking it navigates here. If not,
   * it shows a "Soon" badge and clicking is a no-op.
   */
  href?: string;
  /** When true the card shows a "Premium" badge alongside Ready/Soon. */
  premium?: boolean;
}

/**
 * Static placeholder entries for whiteboard / exams / polls. The backend
 * doesn't expose a catalog yet — we surface them as "Soon" so the
 * gallery feels populated and the user gets a preview of what's coming.
 *
 * Once those features ship, replace the static list with their real
 * APIs and drop the `soon` flag.
 */
const STATIC_APPS: MiniAppCard[] = [
  {
    id: "static:whiteboard",
    title: "Whiteboard",
    description: "Collaborative drawing for live sessions",
    icon: "🎨",
    accent: "from-[#38bdf8] to-[#6366f1]",
    category: "whiteboard",
  },
  {
    id: "static:quick-exam",
    title: "Quick Exam",
    description: "Spin up a short quiz inside a call",
    icon: "📝",
    accent: "from-[#f59e0b] to-[#f87171]",
    category: "exams",
  },
  {
    id: "static:poll",
    title: "Live Poll",
    description: "Ask the room a question, see live results",
    icon: "📊",
    accent: "from-[#22c55e] to-[#38bdf8]",
    category: "polls",
  },
];

/** Map game model -> card. Games without a static asset are "Soon". */
function gameToCard(g: GameSummary): MiniAppCard {
  const url = gameAssetUrl(g);
  return {
    id: `game:${g.id}`,
    title: g.title,
    description: g.description,
    // Pick an emoji per game type so the tile looks distinct without
    // depending on real artwork (game.thumbnail is optional).
    icon:
      g.game_type === "word_guess"
        ? "🔤"
        : g.game_type === "grammar"
          ? "📚"
          : g.game_type === "vocab"
            ? "🧠"
            : "🎮",
    accent: "from-[#e879f9] to-[#6366f1]",
    category: "games",
    href: url ?? undefined,
    premium: !g.is_free,
  };
}

const CATEGORIES: CategoryId[] = ["all", "games", "whiteboard", "exams", "polls"];

export default function MiniAppsPage() {
  const { t } = useTranslation(["miniapps", "common"]);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // One-shot fetch on mount. We don't need refetch-on-focus here since
  // the backend catalog rarely changes during a session.
  useEffect(() => {
    let cancelled = false;
    setGames(null);
    setError(null);
    gamesApi
      .list()
      .then((data) => {
        if (!cancelled) setGames(data);
      })
      .catch(() => {
        if (!cancelled) {
          setGames([]);
          setError(t("errorLoading"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  // Build the full card list once games arrive; STATIC_APPS first so
  // the gallery never looks empty even if the backend is down.
  // Filter out is_in_call_only games — they're meaningful only inside
  // a call, where the in-call selector handles them.
  const cards: MiniAppCard[] = useMemo(() => {
    const result: MiniAppCard[] = [];
    if (games) {
      result.push(
        ...games
          .filter((g) => !g.is_in_call_only)
          .map(gameToCard),
      );
    }
    result.push(...STATIC_APPS);
    return result;
  }, [games]);

  const filtered = useMemo(() => {
    if (activeCategory === "all") return cards;
    return cards.filter((c) => c.category === activeCategory);
  }, [cards, activeCategory]);

  const isLoading = games === null && !error;

  return (
    <AppShell
      title={t("page.title")}
      subtitle={t("page.subtitle")}
      activeNav="miniapps"
    >
      <div className="flex flex-col gap-4 fade-in">
        {/* Category chips. Sticky on mobile so the user keeps the
            filter row visible while scrolling tall lists. */}
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 sticky top-0 z-10 bg-[var(--s0)]/90 backdrop-blur-sm py-2">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "flex-shrink-0 px-3 py-1.5 rounded-full border-none cursor-pointer transition-colors",
                  "text-xs font-semibold whitespace-nowrap",
                  isActive
                    ? "bg-[var(--brand)] text-white"
                    : "bg-[var(--s2)] text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)]",
                )}
              >
                {t(`categories.${cat}`)}
              </button>
            );
          })}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Spinner size="md" />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <span className="text-3xl" aria-hidden>
              🎯
            </span>
            <p className="text-sm font-semibold text-[var(--t1)]">
              {t("empty.title")}
            </p>
            <p className="text-xs text-[var(--t3)] max-w-sm">
              {t("empty.hint")}
            </p>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div
            className={cn(
              "grid gap-3",
              // Mobile 2 cols, tablet 3, desktop 4 — matches the user's
              // spec for Mini Apps.
              "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
            )}
          >
            {filtered.map((card) => (
              <MiniAppTile key={card.id} card={card} t={t} />
            ))}
          </div>
        )}

        {error && !isLoading && (
          <p className="text-xs text-[var(--red)] text-center">{error}</p>
        )}
      </div>
    </AppShell>
  );
}

interface MiniAppTileProps {
  card: MiniAppCard;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

/**
 * One card in the gallery. "Ready" cards are clickable links that open
 * the underlying asset (currently the game iframe URL); "Soon" cards
 * render as static tiles with a muted call-to-action.
 */
function MiniAppTile({ card, t }: MiniAppTileProps) {
  const isReady = !!card.href;

  const inner = (
    <>
      <div
        className={cn(
          "h-20 md:h-24 w-full rounded-xl flex items-center justify-center text-3xl md:text-4xl",
          "bg-gradient-to-br shadow-inner",
          card.accent,
        )}
        aria-hidden
      >
        {card.icon}
      </div>
      <div className="flex flex-col gap-0.5 mt-2 text-start">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-[var(--t1)] truncate">
            {card.title}
          </span>
          <span
            className={cn(
              "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md",
              isReady
                ? "bg-[var(--green)]/15 text-[var(--green)]"
                : "bg-[var(--amber)]/15 text-[var(--amber)]",
            )}
          >
            {isReady ? t("card.ready") : t("card.soon")}
          </span>
          {card.premium && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[var(--brand-soft)] text-[var(--brand-text)]">
              {t("card.premium")}
            </span>
          )}
        </div>
        {card.description && (
          <p className="text-[11px] text-[var(--t3)] line-clamp-2">
            {card.description}
          </p>
        )}
      </div>
    </>
  );

  // Render as <a> when ready (so cmd-click opens in new tab), otherwise
  // a non-interactive div with reduced opacity. We deliberately don't
  // disable clicks with `pointer-events-none` because it kills focus
  // ring outlines for keyboard users — the visual cue + lack of href
  // is enough to communicate the "soon" state.
  return isReady ? (
    <a
      href={card.href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex flex-col bg-[var(--s2)] rounded-xl p-2 md:p-3 border border-[var(--b)]",
        "hover:border-[var(--bh)] transition-colors no-underline",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]",
      )}
    >
      {inner}
    </a>
  ) : (
    <div
      className={cn(
        "flex flex-col bg-[var(--s2)] rounded-xl p-2 md:p-3 border border-[var(--b)]",
        "opacity-70",
      )}
      aria-disabled
    >
      {inner}
    </div>
  );
}

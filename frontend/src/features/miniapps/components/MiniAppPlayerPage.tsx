import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AppShell from "../../../components/layout/AppShell";
import Spinner from "../../../components/ui/Spinner";
import { Tooltip } from "../../../components/ui/Tooltip";
import { cn } from "../../../lib/utils";
import gamesApi, {
  type GameSummary,
  gameAssetUrl,
} from "../../games/api/games.api";
import GameContainer from "../../games/components/GameContainer";

/**
 * Standalone player surface for a mini app.
 *
 * Reached from the Mini Apps gallery cards. Wraps the existing
 * GameContainer (which already owns the fullscreen toggle, splash
 * screen, and host controls) inside an AppShell so the user keeps the
 * standard sidebar/topbar chrome and a Back button to return to the
 * gallery.
 *
 * The route is `/miniapps/play/:slug` where `slug` matches the same
 * mapping used by `gameAssetUrl` (currently `word-quest`). Slugs are
 * resolved by reverse-looking-up the games catalog the first time the
 * page loads.
 */
export default function MiniAppPlayerPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(["miniapps", "common"]);
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch the catalog once so we can resolve the slug to a real game.
  // We could pre-load this in a global store, but the gallery already
  // hits the same endpoint and the result is small + cacheable.
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

  const game = useMemo(() => {
    if (!games || !slug) return null;
    return games.find((g) => {
      const url = gameAssetUrl(g);
      return url === `/games/${slug}/index.html`;
    });
  }, [games, slug]);

  const isLoading = games === null && !error;
  const handleBack = () => {
    // Prefer a real history pop so other entries (e.g. /dashboard ->
    // /miniapps -> here) work. Fall back to /miniapps if the user
    // landed directly with no history.
    if (window.history.length > 1) navigate(-1);
    else navigate("/miniapps");
  };

  return (
    <AppShell
      title={game?.title || t("page.title")}
      subtitle={game?.description || undefined}
      activeNav="miniapps"
    >
      <div className="flex flex-col gap-3 fade-in h-full">
        {/* Back button row. The AppShell topbar doesn't host a back
            control today, so we render one here. Sticky so it stays
            visible when the iframe scrolls (rare, but possible on
            small heights). */}
        <div className="flex items-center gap-2">
          <Tooltip content={t("common:actions.back")}>
            <button
              type="button"
              onClick={handleBack}
              className={cn(
                "flex items-center gap-1.5 px-2.5 h-8 rounded-lg border-none cursor-pointer",
                "bg-[var(--s2)] hover:bg-[var(--s3)] text-[var(--t1)] text-xs font-semibold",
                "transition-colors",
              )}
              aria-label={t("common:actions.back")}
            >
              <span aria-hidden>←</span>
              {t("common:actions.back")}
            </button>
          </Tooltip>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Spinner size="md" />
          </div>
        )}

        {!isLoading && !game && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <span className="text-3xl" aria-hidden>
              🎯
            </span>
            <p className="text-sm font-semibold text-[var(--t1)]">
              {t("empty.title")}
            </p>
            <p className="text-[11px] text-[var(--t3)] max-w-sm">
              {error || t("empty.hint")}
            </p>
          </div>
        )}

        {!isLoading && game && (
          // Fixed aspect ratio is fragile across phone, tablet, desktop;
          // give the container all remaining vertical space and let
          // the iframe stretch to fill. The min-h keeps it usable on
          // tall phones in landscape where the page would otherwise
          // collapse to nothing.
          <div className="flex-1 min-h-[400px] md:min-h-[500px]">
            <GameContainer
              gameUrl={gameAssetUrl(game)!}
              gameName={game.title}
              gameId={String(game.id)}
              mode="solo"
              isHost
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}

// Keep a tiny exported helper so the gallery can build the player URL
// without re-implementing the slug logic.
export function miniAppPlayerHref(game: Pick<GameSummary, "game_type">): string | null {
  const url = gameAssetUrl(game);
  if (!url) return null;
  // url looks like /games/<slug>/index.html — extract the slug.
  const match = url.match(/^\/games\/([^/]+)\//);
  return match ? `/miniapps/play/${match[1]}` : null;
}

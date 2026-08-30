import type { GameSummary } from "../../games/api/games.api";
import { gameAssetUrl } from "../../games/api/games.api";

/**
 * Build the SPA route for a game card from its static asset URL.
 *
 * Keeping this helper outside a component module allows React Fast Refresh
 * to treat MiniAppPlayerPage.tsx as a component-only module.
 */
export function miniAppPlayerHref(
  game: Pick<GameSummary, "game_type">,
): string | null {
  const url = gameAssetUrl(game);
  if (!url) return null;

  // url looks like /games/<slug>/index.html — extract the slug.
  const match = url.match(/^\/games\/([^/]+)\//);
  return match ? `/miniapps/play/${match[1]}` : null;
}

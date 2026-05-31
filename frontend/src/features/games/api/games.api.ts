import client from "../../../lib/api/client";

export interface GameSummary {
  id: number;
  title: string;
  game_type: "word_guess" | "grammar" | "vocab" | string;
  description: string;
  thumbnail: string | null;
  is_free: boolean;
}

/**
 * Catalog of games we ship as iframe-embeddable apps.
 *
 * The backend exposes the catalog at /api/games/ and the actual game
 * assets live under /games/<slug>/index.html. The slug is currently
 * inferred from `game_type` since we don't track it explicitly in the
 * Game model — see GAME_TYPE_TO_SLUG below.
 */
const GAME_TYPE_TO_SLUG: Record<string, string> = {
  word_guess: "word-quest",
  // Future games map their game_type -> slug here. The selector falls
  // back to a generic placeholder if a game doesn't have a static asset
  // yet, so the modal renders something sensible.
};

export function gameAssetUrl(game: Pick<GameSummary, "game_type">): string | null {
  const slug = GAME_TYPE_TO_SLUG[game.game_type];
  return slug ? `/games/${slug}/index.html` : null;
}

export const gamesApi = {
  list: async (): Promise<GameSummary[]> => {
    const res = await client.get("/games/");
    return res.data;
  },
};

export default gamesApi;

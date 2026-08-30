import client from "../../../lib/api/client";

export interface GameSummary {
  id: number;
  title: string;
  game_type: "word_guess" | "word_guess_classroom" | "grammar" | "vocab" | string;
  description: string;
  thumbnail: string | null;
  is_free: boolean;
  /**
   * When true, the game is hidden from the standalone /miniapps
   * gallery and only surfaces inside an active call. Used for the
   * classroom variants whose host-vs-player flow only makes sense
   * with a real group on the line.
   */
  is_in_call_only?: boolean;
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
  word_guess_classroom: "word-quest-classroom",
  // Future games map their game_type -> slug here.
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

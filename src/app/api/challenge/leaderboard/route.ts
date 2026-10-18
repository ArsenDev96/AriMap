import { readLeaderboard } from "@/server/leaderboardStore";
import { json, withPlayer } from "@/server/playerRoute";

/**
 * GET /api/challenge/leaderboard: the all-time top 50 named players' best confirmed results, and the asking player's
 * own row when it is not among them. The player is the request's verified session; viewing spends nothing.
 * 200 { entries, own, privateBest }.
 */
export async function GET(request: Request) {
  return withPlayer(request, async ({ db, playerId, clock }) => json(await readLeaderboard(db, playerId, clock)));
}

import { ensurePlayer } from "@/server/playerStore";
import { json, withPlayer } from "@/server/playerRoute";

/** GET /api/player: the signed-in player, created on first use, with today's free attempt and any saved attempts. */
export async function GET(request: Request) {
  return withPlayer(request, async ({ db, playerId, clock }) => json(await ensurePlayer(db, playerId, clock)));
}

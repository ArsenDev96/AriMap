import { finishRound } from "@/server/challengeStore";
import { isUuid } from "@/server/challengeRequest";
import { errorResponse, json, withPlayer } from "@/server/playerRoute";

/**
 * POST /api/challenge/rounds/:id/finish: the round, ended first if its time, the network allowance and the settle
 * window have all run out.
 * The device asks for it to confirm its result; it never ends a round early. Safe to repeat.
 * 200 { ok, round, serverTime }; 404 not this player's round.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPlayer(request, async ({ db, playerId, clock }) => {
    const { id } = await params;
    if (!isUuid(id)) return errorResponse("badRequest", 400);
    const result = await finishRound(db, playerId, id, clock);
    return json(result, result.ok ? 200 : 404);
  });
}

import { startRound } from "@/server/challengeStore";
import { isUuid } from "@/server/challengeRequest";
import { errorResponse, json, readJson, withPlayer } from "@/server/playerRoute";

/**
 * POST /api/challenge/rounds, body { requestId }: starts a Quick Challenge round, spending one attempt, or returns
 * the round under way (the same requestId retried, a double press, another tab), spending nothing. A new round starts
 * when this request's token has been verified.
 * 200 { ok, round, reused, state, serverTime }; 409 { ok: false, problem: "noAttempts", state }; 400 no request id.
 */
export async function POST(request: Request) {
  return withPlayer(request, async ({ db, playerId, clock }) => {
    const body = await readJson(request);
    const requestId = typeof body === "object" && body !== null ? (body as { requestId?: unknown }).requestId : undefined;
    if (!isUuid(requestId)) return errorResponse("badRequest", 400);
    const result = await startRound(db, playerId, requestId, clock);
    return json(result, result.ok ? 200 : 409);
  });
}

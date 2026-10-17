import { submitAnswers } from "@/server/challengeStore";
import { isUuid, parseAnswers } from "@/server/challengeRequest";
import { errorResponse, json, readJson, withPlayer } from "@/server/playerRoute";

/**
 * POST /api/challenge/rounds/:id/answers, body { answers: [{ index, country, atMs }] }: every answer the device has
 * not yet had decided, in order. All count as received when the request reached this server (before its token was
 * checked), and each is scored against the round's own question.
 * 200 { ok, receipts, round, serverTime }; 404 not this player's round; 400 not such a body.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPlayer(request, async ({ db, playerId, clock }) => {
    const { id } = await params;
    const body = await readJson(request);
    const answers = parseAnswers(typeof body === "object" && body !== null ? (body as { answers?: unknown }).answers : undefined);
    if (!isUuid(id) || !answers) return errorResponse("badRequest", 400);
    const result = await submitAnswers(db, playerId, id, answers, clock);
    return json(result, result.ok ? 200 : 404);
  });
}

import type { ClaimEuropeStarsResult } from "@/core/player/api";
import { hasAllEuropeStars, parseEuropeStarsSnapshot } from "@/core/progress/europeStars";
import { claimAllEuropeStars } from "@/server/playerStore";
import { errorResponse, json, readJson, withPlayer } from "@/server/playerRoute";

/**
 * POST /api/player/europe-stars, body { snapshot }: the one-time +2 attempts for all 36 stars across the
 * fixed 12 Europe lessons. The snapshot is the device's own report of its saved lesson progress: its shape
 * and total are checked, but whether the stars were earned cannot be (docs/PLAYER-BACKEND.md, "Trust").
 * 200 with `granted` (false when already granted: never twice); 422 not all 36 stars; 400 not a snapshot.
 */
export async function POST(request: Request) {
  return withPlayer(request, async ({ db, playerId, clock }) => {
    const body = await readJson(request);
    const snapshot = parseEuropeStarsSnapshot(typeof body === "object" && body !== null ? (body as { snapshot?: unknown }).snapshot : undefined);
    if (!snapshot) return errorResponse("badRequest", 400);
    if (!hasAllEuropeStars(snapshot)) return json({ ok: false, problem: "notQualified" } satisfies ClaimEuropeStarsResult, 422);
    const { granted, state } = await claimAllEuropeStars(db, playerId, snapshot, clock);
    return json({ ok: true, granted, state } satisfies ClaimEuropeStarsResult);
  });
}

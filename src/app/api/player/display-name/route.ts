import { checkDisplayName } from "@/core/player/displayName";
import type { SetDisplayNameResult } from "@/core/player/api";
import { setDisplayName } from "@/server/playerStore";
import { errorResponse, json, readJson, withPlayer } from "@/server/playerRoute";

/**
 * PUT /api/player/display-name, body { displayName: string | null }: saves the player's display name
 * (checked by the same rules as on the device), or clears it with null.
 * 200 saved; 422 refused (`problem`); 429 too many changes (`retryAt`); 400 not such a body.
 */
export async function PUT(request: Request) {
  return withPlayer(request, async ({ db, playerId, clock }) => {
    const body = await readJson(request);
    const value = typeof body === "object" && body !== null ? (body as { displayName?: unknown }).displayName : undefined;
    if (!(value === null || typeof value === "string")) return errorResponse("badRequest", 400);
    let name: string | null = null;
    if (value !== null) {
      const check = checkDisplayName(value);
      if (!check.ok) return json({ ok: false, problem: check.problem } satisfies SetDisplayNameResult, 422);
      name = check.name;
    }
    const saved = await setDisplayName(db, playerId, name, clock);
    if (!saved.ok) return json({ ok: false, problem: "rateLimited", retryAt: saved.retryAt } satisfies SetDisplayNameResult, 429);
    return json({ ok: true, state: saved.state } satisfies SetDisplayNameResult);
  });
}

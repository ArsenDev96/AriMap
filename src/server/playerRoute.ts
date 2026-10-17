import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerServiceErrorCode } from "@/core/player/api";
import { RequestClock } from "./requestClock";
import { adminClient } from "./supabaseAdmin";

/** What a player route knows of its request, besides the request itself. */
export interface PlayerRequest {
  db: SupabaseClient;
  /** From the verified token, never from the request's body or query. */
  playerId: string;
  /** Its arrival (before its token was checked) and the token's verification, on this server's monotonic clock. */
  clock: RequestClock;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Runs a player route for the player of the request's verified session. Every request needs
 * `Authorization: Bearer <access token>` from the player's Supabase session.
 *
 * The time of arrival is noted first, before anything else is done, on this server's monotonic clock: answers are
 * timed by it, on the database's clock (requestClock.ts, challengeStore.ts).
 * Then the token is verified, as Supabase supports, with the project's asymmetric signing key (ES256, from its
 * published JWKS, cached for 10 minutes): signature and expiry by supabase-js (auth.getClaims), and here the claims a
 * player's session has (the role and audience "authenticated", this project's issuer, a user id). A token signed with
 * a key the JWKS does not hold (rotation) or a shared secret is checked by Supabase Auth instead, as before. A
 * signed-out or deleted session's token stays valid until it expires (an hour by default); a deleted player's rows
 * are gone with it, so such a request finds nothing to act on.
 *
 * - No backend configured: 503 "notConfigured" (nothing stands in for the database).
 * - No token, or one that fails verification: 401 "unauthorized".
 * - Any other failure (Supabase unreachable included): 500 "server", logged without the token.
 *
 * Each reply has a Server-Timing header: auth (verifying the token), work (the route, its database call included)
 * and total, so a device's round trip less the total is the time on the network; and for the database call, db (its
 * round trip from here) and dbproc (its time in the database), so db less dbproc is the time between here and there.
 */
export async function withPlayer(request: Request, handle: (req: PlayerRequest) => Promise<Response>): Promise<Response> {
  const clock = new RequestClock();
  const db = adminClient();
  if (!db) return errorResponse("notConfigured", 503);
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return errorResponse("unauthorized", 401);
  try {
    const { data, error } = await db.auth.getClaims(token);
    // Refused by verification (4xx) is the session's fault; anything else (Supabase unreachable, 5xx) is the
    // server's, so a device never takes an outage for a lost session.
    if (error) return error.status && error.status >= 400 && error.status < 500 ? errorResponse("unauthorized", 401) : errorResponse("server", 500);
    const playerId = sessionPlayer(data?.claims);
    if (!playerId) return errorResponse("unauthorized", 401);
    clock.verified();
    const res = await handle({ db, playerId, clock });
    res.headers.set("Server-Timing", serverTiming(clock));
    return res;
  } catch (e) {
    console.error("Player route failed:", e instanceof Error ? e.message : e);
    return errorResponse("server", 500);
  }
}

function serverTiming(clock: RequestClock): string {
  const { total, auth, db } = clock.timings();
  const ms = (name: string, dur: number) => `${name};dur=${dur.toFixed(1)}`;
  const parts = [ms("auth", auth ?? 0), ms("work", total - (auth ?? 0)), ms("total", total)];
  if (db) parts.push(ms("db", db.roundTrip), ms("dbproc", db.inDb));
  return parts.join(", ");
}

/** The player of a verified token's claims: a signed-in (or anonymous) user's session of this project, or null. */
function sessionPlayer(claims: Record<string, unknown> | undefined): string | null {
  if (!claims) return null;
  const issuer = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")}/auth/v1`;
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.role !== "authenticated" || !audience.includes("authenticated") || claims.iss !== issuer) return null;
  return typeof claims.sub === "string" && UUID.test(claims.sub) ? claims.sub : null;
}

/** A JSON answer, never cached. */
export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function errorResponse(code: PlayerServiceErrorCode, status: number): Response {
  return json({ error: code }, status);
}

/** The request's JSON body, or undefined when it has none or it is not JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

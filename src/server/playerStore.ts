import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attemptsLeft, type AttemptGrant, type AttemptGrantKind } from "@/core/player/attempts";
import type { PlayerState } from "@/core/player/api";
import type { EuropeStarsSnapshot } from "@/core/progress/europeStars";
import type { DbClockRow, RequestClock } from "./requestClock";
import { toRound, type RoundRow } from "./roundRows";

/**
 * The player functions of the database (supabase/migrations), each one transaction, for a player id the
 * caller has taken from a verified session (playerRoute.ts). Throws on any database failure.
 */

const KINDS: Readonly<Record<string, AttemptGrantKind>> = {
  initial: "initial",
  all_europe_stars: "allEuropeStars",
  rewarded_ad: "rewardedAd",
};

export interface StateRow {
  player_id: string;
  display_name: string | null;
  grants: { kind: string; attempts: number; granted_at: string }[];
  europe_stars_claimed_at: string | null;
  name_change_blocked_until: string | null;
  // From the rounds migration (20261018120000_challenge_rounds.sql); absent before it is applied.
  rounds_started?: number;
  active_round?: RoundRow | null;
  best?: { score: number; elapsed_ms: number } | null;
  // From 20261020120000_database_clock.sql.
  clock: DbClockRow;
}

const iso = (t: string) => new Date(t).toISOString();
const isoOrNull = (t: string | null) => (t === null ? null : iso(t));

/** The player as the database reports it, with the request's times on the database's clock (its reply leaving now). */
export function toState(row: StateRow, clock: RequestClock): PlayerState {
  const grants: AttemptGrant[] = row.grants.map((g) => {
    const kind = KINDS[g.kind];
    if (!kind) throw new Error(`Unknown attempt grant kind: ${g.kind}`);
    return { kind, attempts: g.attempts, grantedAt: iso(g.granted_at) };
  });
  // Each round started spent one attempt.
  const roundsStarted = Number(row.rounds_started ?? 0);
  const blockedUntil = isoOrNull(row.name_change_blocked_until);
  return {
    playerId: row.player_id,
    displayName: row.display_name,
    grants,
    roundsStarted,
    attemptsLeft: attemptsLeft(grants, roundsStarted),
    activeRound: row.active_round ? toRound(row.active_round) : null,
    best: row.best ? { score: row.best.score, elapsedMs: row.best.elapsed_ms } : null,
    serverTime: clock.serverTime(),
    europeStarsClaimedAt: isoOrNull(row.europe_stars_claimed_at),
    nameChangeBlockedUntil: blockedUntil && Date.parse(blockedUntil) > clock.dbNow() ? blockedUntil : null,
  };
}

/**
 * Calls a database function, timed on `clock`: its reply reports the database's clock, at the top (`clock`) or in
 * the player's state (`state.clock`).
 */
export async function call<T>(db: SupabaseClient, fn: string, args: Record<string, unknown>, clock: RequestClock): Promise<T> {
  return clock.timeCall(
    async () => {
      const { data, error } = await db.rpc(fn, args);
      if (error) throw new Error(`${fn} failed: ${error.message}`);
      return data as T;
    },
    (row) => {
      const r = row as { clock?: DbClockRow; state?: { clock?: DbClockRow } } | null;
      return r?.clock ?? r?.state?.clock;
    },
  );
}

/** The player, created on first use with the one initial attempt. */
export async function ensurePlayer(db: SupabaseClient, playerId: string, clock: RequestClock): Promise<PlayerState> {
  return toState(await call<StateRow>(db, "ensure_player", { p_player: playerId }, clock), clock);
}

/** The one-time +2 attempts, for a snapshot already checked to hold all 36 stars. */
export async function claimAllEuropeStars(db: SupabaseClient, playerId: string, snapshot: EuropeStarsSnapshot, clock: RequestClock): Promise<{ granted: boolean; state: PlayerState }> {
  const row = await call<{ granted: boolean; state: StateRow }>(db, "claim_all_europe_stars", { p_player: playerId, p_snapshot: snapshot }, clock);
  return { granted: row.granted, state: toState(row.state, clock) };
}

/** Saves an already validated name (or clears it with null), within the rate limit. */
export async function setDisplayName(
  db: SupabaseClient,
  playerId: string,
  name: string | null,
  clock: RequestClock,
): Promise<{ ok: true; state: PlayerState } | { ok: false; retryAt: string }> {
  const row = await call<{ ok: true; state: StateRow } | { ok: false; retry_at: string }>(db, "set_display_name", { p_player: playerId, p_name: name }, clock);
  return row.ok ? { ok: true, state: toState(row.state, clock) } : { ok: false, retryAt: iso(row.retry_at) };
}

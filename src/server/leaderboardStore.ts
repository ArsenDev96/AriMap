import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LEADERBOARD_SIZE, type Leaderboard, type LeaderboardEntry } from "@/core/challenge/leaderboard";
import { call } from "./playerStore";
import type { RequestClock } from "./requestClock";

/**
 * The leaderboard function of the database (supabase/migrations/20261021120000_challenge_leaderboard.sql), for a
 * player id taken from a verified session (playerRoute.ts): it marks that player's own row, and nothing else of
 * theirs or anyone's is read out. Only reads: no attempt is spent, no player created.
 */

interface EntryRow {
  rank: number;
  display_name: string;
  score: number;
  total: number;
  elapsed_ms: number;
  is_you: boolean;
}

const toEntry = (r: EntryRow): LeaderboardEntry => ({
  rank: Number(r.rank),
  displayName: r.display_name,
  score: r.score,
  total: r.total,
  elapsedMs: r.elapsed_ms,
  isYou: r.is_you,
});

export async function readLeaderboard(db: SupabaseClient, playerId: string, clock: RequestClock): Promise<Leaderboard> {
  const row = await call<{ entries: EntryRow[]; own: EntryRow | null; private_best: boolean }>(
    db,
    "challenge_leaderboard",
    { p_player: playerId, p_limit: LEADERBOARD_SIZE },
    clock,
  );
  return { entries: row.entries.map(toEntry), own: row.own ? toEntry(row.own) : null, privateBest: row.private_best };
}

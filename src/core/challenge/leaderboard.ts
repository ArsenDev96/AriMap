/**
 * The Quick Challenge's all-time leaderboard, as the server reports it (supabase/migrations/
 * 20261021120000_challenge_leaderboard.sql): each named player's best confirmed round, ranked by the rule that keeps
 * it (most correct answers, then the shortest time). Equal scores and times share a rank; the order of rows with the
 * same rank is the server's and stays the same between reads. Players without a display name never appear.
 *
 * Public fields only: no player ids. Which row is the asking player's comes from their verified session (`isYou`),
 * never from their name, which need not be unique.
 *
 * Framework-independent: no React, DOM, storage or network.
 */

/** How many rows the board shows. */
export const LEADERBOARD_SIZE = 50;

export interface LeaderboardEntry {
  /** 1 for the best; equal results share one. */
  rank: number;
  displayName: string;
  /** Correct answers, out of `total`. */
  score: number;
  total: number;
  /** The round's time: to its last answer when completed, its whole length when the time ran out. */
  elapsedMs: number;
  /** The asking player's own row. */
  isYou: boolean;
}

export interface Leaderboard {
  /** The top LEADERBOARD_SIZE, best first. */
  entries: readonly LeaderboardEntry[];
  /** The asking player's own row when it is not among `entries`; null when it is, or they have none. */
  own: LeaderboardEntry | null;
  /** The asking player has a best result that stays private because they have no display name. */
  privateBest: boolean;
}

/**
 * A board time in seconds with exactly three decimals ("24.357"), from the stored milliseconds by whole numbers (no
 * rounding: every millisecond the ranking compares is shown).
 */
export function leaderboardSeconds(elapsedMs: number): string {
  const ms = Math.max(0, Math.trunc(elapsedMs));
  return `${Math.floor(ms / 1000)}.${String(ms % 1000).padStart(3, "0")}`;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function parseEntry(v: unknown): LeaderboardEntry | null {
  if (!isObj(v) || !isCount(v.rank) || v.rank < 1 || typeof v.displayName !== "string" || v.displayName === "") return null;
  if (!isCount(v.score) || !isCount(v.total) || v.score > v.total || !isCount(v.elapsedMs) || typeof v.isYou !== "boolean") return null;
  return { rank: v.rank, displayName: v.displayName, score: v.score, total: v.total, elapsedMs: v.elapsedMs, isYou: v.isYou };
}

/** A leaderboard as the app's server sends it, or null when it is not one. */
export function parseLeaderboard(v: unknown): Leaderboard | null {
  if (!isObj(v) || !Array.isArray(v.entries) || typeof v.privateBest !== "boolean") return null;
  const entries: LeaderboardEntry[] = [];
  for (const e of v.entries) {
    const entry = parseEntry(e);
    if (!entry || (entries.length > 0 && entry.rank < entries[entries.length - 1].rank)) return null;
    entries.push(entry);
  }
  const own = v.own === null ? null : parseEntry(v.own);
  if (v.own !== null && (!own || !own.isYou)) return null;
  return { entries, own, privateBest: v.privateBest };
}

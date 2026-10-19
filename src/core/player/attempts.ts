/**
 * Quick Challenge attempts: one free attempt each UTC day, and saved (bonus) attempts from a ledger of grants.
 *
 * - Today's free attempt: one per UTC calendar day, from 00:00 UTC on the database's clock. An unused one is not
 *   kept: it never adds up. Start spends it first.
 * - Saved attempts: the grants, less the rounds that spent one (a round spends a saved attempt only once the day's
 *   free one is used). They never expire. Grants:
 *   - "allEuropeStars": +2 attempts, once per player, for all 36 stars across the fixed 12 Europe lessons
 *     (../progress/europeStars.ts), existing players included.
 *   - "rewardedAd": +1 attempt per completed rewarded ad, as many times as earned, each one only once per
 *     ad provider's transaction id (ads come later; nothing grants one yet).
 *   - "initial": 1 attempt, once per player, granted only before the daily attempt (October 2026). Kept, so an unspent
 *     one stays a saved attempt; new players get none.
 *
 * The database enforces the same rules (supabase/migrations): one free attempt per player per UTC day, the one-time
 * grants unique per player, an ad grant unique per provider and transaction id, and each kind's amount fixed.
 *
 * Framework-independent: no React, DOM, storage or network.
 */

export type AttemptGrantKind = "initial" | "allEuropeStars" | "rewardedAd";

export const GRANT_ATTEMPTS: Readonly<Record<AttemptGrantKind, number>> = {
  initial: 1,
  allEuropeStars: 2,
  rewardedAd: 1,
};

/** Grants a player can receive only once. */
export const ONE_TIME_GRANTS: readonly AttemptGrantKind[] = ["initial", "allEuropeStars"];

export interface AttemptGrant {
  kind: AttemptGrantKind;
  attempts: number;
  /** When the server recorded the grant (ISO 8601). */
  grantedAt: string;
}

/** Today's free attempt, as the server reports it: the day and the reset are the database's (UTC). */
export interface DailyAttempt {
  /** Unused today. */
  available: boolean;
  /** The next 00:00 UTC, when the next free attempt comes (ISO 8601). */
  resetsAt: string;
}

/** What a player can start a round with. */
export interface AttemptBalance {
  daily: DailyAttempt;
  /** Saved attempts left. */
  bonusAttemptsLeft: number;
}

/** Which attempt a round spends. */
export type AttemptSource = "daily" | "bonus";

export function isAttemptGrantKind(v: unknown): v is AttemptGrantKind {
  return v === "initial" || v === "allEuropeStars" || v === "rewardedAd";
}

export function attemptsGranted(grants: readonly AttemptGrant[]): number {
  return grants.reduce((sum, g) => sum + g.attempts, 0);
}

/** Saved attempts left: everything granted, less the rounds that spent one (never below 0). */
export function bonusAttemptsLeft(grants: readonly AttemptGrant[], bonusRoundsStarted: number): number {
  return Math.max(0, attemptsGranted(grants) - bonusRoundsStarted);
}

/** The attempt the next round spends: today's free one first, then a saved one; null when there is neither. */
export function nextAttemptSource(balance: AttemptBalance): AttemptSource | null {
  if (balance.daily.available) return "daily";
  return balance.bonusAttemptsLeft > 0 ? "bonus" : null;
}

/** Start is offered whenever today's free attempt or a saved one is left. */
export function canStartRound(balance: AttemptBalance): boolean {
  return nextAttemptSource(balance) !== null;
}

export function hasGrant(grants: readonly AttemptGrant[], kind: AttemptGrantKind): boolean {
  return grants.some((g) => g.kind === kind);
}

/**
 * Quick Challenge attempts: a ledger of grants, each adding attempts, less the rounds started.
 * - "initial": 1 attempt, once per player, never reset.
 * - "allEuropeStars": +2 attempts, once per player, for all 36 stars across the fixed 12 Europe lessons
 *   (../progress/europeStars.ts), existing players included.
 * - "rewardedAd": +1 attempt per completed rewarded ad, as many times as earned, each one only once per
 *   ad provider's transaction id (ads come later; nothing grants one yet).
 *
 * The database enforces the same rules (supabase/migrations): the one-time grants are unique per player,
 * an ad grant is unique per provider and transaction id, and each kind's amount is fixed.
 *
 * Spending comes with the server-managed rounds: until then no round spends an attempt, and nothing in the
 * game checks the balance.
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

export function isAttemptGrantKind(v: unknown): v is AttemptGrantKind {
  return v === "initial" || v === "allEuropeStars" || v === "rewardedAd";
}

export function attemptsGranted(grants: readonly AttemptGrant[]): number {
  return grants.reduce((sum, g) => sum + g.attempts, 0);
}

/** Attempts left: everything granted, less the rounds started (never below 0). */
export function attemptsLeft(grants: readonly AttemptGrant[], roundsStarted: number): number {
  return Math.max(0, attemptsGranted(grants) - roundsStarted);
}

export function hasGrant(grants: readonly AttemptGrant[], kind: AttemptGrantKind): boolean {
  return grants.some((g) => g.kind === kind);
}

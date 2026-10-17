import "server-only";
import { CHALLENGE_POOL, CHALLENGE_RULES } from "@/core/challenge/quickChallenge";
import type { QueuedAnswer } from "@/core/challenge/serverRound";

/** Checks of what a device sends to the round routes, before the database sees it. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

/**
 * The answers of a request: 1 to as many as a round has questions, each a question's index, a country of the
 * challenge's pool or null (Skip), and the device's whole milliseconds from its start of the round. Null when any
 * one is not. Whether they keep the rhythm and arrive in time is the database's to decide.
 */
export function parseAnswers(v: unknown): QueuedAnswer[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > CHALLENGE_RULES.questions) return null;
  const answers: QueuedAnswer[] = [];
  for (const a of v) {
    if (typeof a !== "object" || a === null) return null;
    const { index, country, atMs } = a as Record<string, unknown>;
    if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= CHALLENGE_RULES.questions) return null;
    if (!(country === null || (typeof country === "string" && CHALLENGE_POOL.includes(country)))) return null;
    if (!Number.isInteger(atMs) || (atMs as number) < 0 || (atMs as number) > 10 * CHALLENGE_RULES.durationMs) return null;
    answers.push({ index: index as number, country: country as string | null, atMs: atMs as number });
  }
  return answers;
}

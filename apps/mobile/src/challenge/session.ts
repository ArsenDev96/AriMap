import { CHALLENGE_POOL } from "@/core/challenge/europe";
import { createChallenge, startChallenge, type ChallengeRound } from "@/core/challenge/quickChallenge";
import type { RandomSource } from "@/core/game/random";
import type { KeyValueStorage } from "@/core/progress/storage";
import { isClockAnchor, type ClockAnchor, type RoundClock } from "./clock";

/**
 * A practice round of the Quick Challenge, played on the phone alone (docs/MOBILE.md, "Quick Challenge"): the shared
 * round (src/core/challenge/quickChallenge.ts, its rules and pool as they are) and its clock's anchor (clock.ts), saved
 * as it changes so that leaving the screen, Android recreating the app or closing it never stops or resets the timer:
 * the round carries on, against the same deadline, when it opens again. Nothing is sent anywhere, and it is never
 * ranked. Pure, apart from the storage passed in.
 */
export interface PracticeSession {
  /** A new id for every round (its clock is kept by it while the app runs). */
  id: string;
  round: ChallengeRound;
  /** The round's clock, from Start (null before). */
  clock: ClockAnchor | null;
}

/** Where the round under way is saved, apart from the lessons' progress ("arimap:state"). */
export const PRACTICE_KEY = "arimap:practice";

/** A new round, drawn and waiting for Start: 15 different countries of the shared pool, in random order. */
export function newSession(random: RandomSource, id: string): PracticeSession {
  return { id, round: createChallenge(random), clock: null };
}

/** Starts the round's timer on `clock` (its time 0, the round's start). Only from "ready". */
export function startSession(session: PracticeSession, clock: RoundClock): PracticeSession {
  if (session.round.status !== "ready") return session;
  return { ...session, round: startChallenge(session.round, clock.now()), clock: clock.anchor() };
}

export function saveSession(storage: KeyValueStorage, session: PracticeSession | null): void {
  try {
    storage.setItem(PRACTICE_KEY, session ? JSON.stringify(session) : "");
  } catch {
    // A store that can't be written: the round plays on in memory, as the lessons' game does.
  }
}

/** The saved round, or null: none, unreadable, or not a round these rules can carry on. */
export function loadSession(storage: KeyValueStorage): PracticeSession | null {
  try {
    const raw = storage.getItem(PRACTICE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as PracticeSession;
    return isSession(value) ? value : null;
  } catch {
    return null;
  }
}

function isSession(s: PracticeSession | null): s is PracticeSession {
  if (!s || typeof s.id !== "string" || !s.round || (s.clock !== null && !isClockAnchor(s.clock))) return false;
  const r = s.round;
  const inPool = (id: unknown) => typeof id === "string" && CHALLENGE_POOL.includes(id);
  return (
    !!r.rules &&
    Number.isInteger(r.rules.questions) &&
    r.rules.durationMs > 0 &&
    !!r.rules.feedbackMs &&
    Array.isArray(r.pool) &&
    r.pool.every(inPool) &&
    Array.isArray(r.questions) &&
    r.questions.length === r.rules.questions &&
    r.questions.every((q) => r.pool.includes(q)) &&
    ["ready", "playing", "finished"].includes(r.status) &&
    Number.isInteger(r.index) &&
    Array.isArray(r.answers) &&
    // A round under way or ended has its clock and its start; one waiting for Start has neither.
    (r.status === "ready" ? s.clock === null && r.startedAt === null : s.clock !== null && r.startedAt !== null && r.deadline !== null)
  );
}

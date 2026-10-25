import { CHALLENGE_POOL } from "@/core/challenge/europe";
import { createNeighboursRound, NEIGHBOUR_OPTIONS, type Neighbours } from "@/core/challenge/neighbours";
import { createChallenge, remainingMs, startChallenge, type ChallengeRound } from "@/core/challenge/quickChallenge";
import type { CountryId } from "@/core/content/types";
import type { RandomSource } from "@/core/game/random";
import type { KeyValueStorage } from "@/core/progress/storage";
import { isClockAnchor, type ClockAnchor, type RoundClock } from "./clock";

/**
 * A practice round of the Quick Challenge, played on the phone alone (docs/MOBILE.md, "Quick Challenge"): the shared
 * round (src/core/challenge/quickChallenge.ts, its rules and pool as they are) and its clock's anchor (clock.ts), saved
 * as it changes so that leaving the screen, Android recreating the app or closing it never stops or resets the timer:
 * the round carries on, against the same deadline, when it opens again. Nothing is sent anywhere, and it is never
 * ranked. Pure, apart from the storage passed in.
 *
 * A round is the map round, or the neighbours round (src/core/challenge/neighbours.ts: the same countries without the
 * map, for screen readers), saved with each question's options.
 */
export interface PracticeSession {
  /** A new id for every round (its clock is kept by it while the app runs). */
  id: string;
  round: ChallengeRound;
  /** The round's clock, from Start (null before). */
  clock: ClockAnchor | null;
  /** "neighbours" for the neighbours round; absent for the map round (and in every round saved before it existed). */
  mode?: "neighbours";
  /** The neighbours round's options, question by question, in the order shown. */
  options?: CountryId[][];
}

/** Where the round under way is saved, apart from the lessons' progress ("arimap:state"). */
export const PRACTICE_KEY = "arimap:practice";

/** A new round, drawn and waiting for Start: 15 different countries of the shared pool, in random order. */
export function newSession(random: RandomSource, id: string): PracticeSession {
  return { id, round: createChallenge(random), clock: null };
}

/** A new neighbours round, drawn and waiting for Start: its 15 countries and each one's four options. */
export function newNeighboursSession(neighbours: Neighbours, random: RandomSource, id: string): PracticeSession {
  const { round, options } = createNeighboursRound(neighbours, random);
  return { id, round, clock: null, mode: "neighbours", options };
}

/**
 * The countdown's whole seconds left at `now`, to the round's own deadline: 60 at its start (the clock's first reading,
 * which may be a fraction past 0), 0 once it has ended.
 */
export function secondsLeft(round: ChallengeRound, now: number): number {
  return Math.ceil(remainingMs(round, now) / 1000);
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
    (r.status === "ready" ? s.clock === null && r.startedAt === null : s.clock !== null && r.startedAt !== null && r.deadline !== null) &&
    // A neighbours round has four options of its pool for each question; a map round, none.
    (s.mode === "neighbours"
      ? Array.isArray(s.options) &&
        s.options.length === r.questions.length &&
        s.options.every((o) => Array.isArray(o) && o.length === NEIGHBOUR_OPTIONS && o.every((id) => r.pool.includes(id)))
      : s.mode === undefined && s.options === undefined)
  );
}

import { useEffect, useState } from "react";
import { AppState } from "react-native";
import type { Neighbours } from "@/core/challenge/neighbours";
import { answer, challengeResult, currentQuestion, feedbackOf, remainingMs, tick } from "@/core/challenge/quickChallenge";
import type { CountryId } from "@/core/content/types";
import type { RandomSource } from "@/core/game/random";
import type { KeyValueStorage } from "@/core/progress/storage";
import { roundClock, systemClock, type ClockSources, type RoundClock } from "./clock";
import { loadSession, newNeighboursSession, newSession, saveSession, secondsLeft, startSession, type PracticeSession } from "./session";

/** How often a round under way is brought up to date (its countdown, the end of an answer's feedback, its deadline). */
export const TICK_MS = 100;

/**
 * The running round's clock, kept by the round's id while the app runs: Android recreating the screen (a font size
 * change) mounts it again, and it carries on from the same monotonic start. A round opened after the app was closed
 * gets a clock from its saved anchor instead (clock.ts).
 */
let live: { id: string; clock: RoundClock } | null = null;

function clockFor(session: PracticeSession, sources: ClockSources): RoundClock | null {
  if (!session.clock) return null;
  if (live?.id !== session.id) live = { id: session.id, clock: roundClock(sources, session.clock) };
  return live.clock;
}

export interface ChallengeDeps {
  storage: KeyValueStorage;
  random: RandomSource;
  newId: () => string;
  sources?: ClockSources;
}

/**
 * The Quick Challenge screen's round (session.ts): the round under way carried on (or its result, if its time ran out
 * meanwhile), or a new one drawn and waiting for Start. Every rule is the shared round's (quickChallenge.ts): one
 * answer per question, a second tap while an answer's feedback shows is no answer, nothing counts after the
 * deadline, and the round ends once (the 15th answer, or the deadline), whatever ticks or app switches come first.
 */
export function useChallenge({ storage, random, newId, sources = systemClock }: ChallengeDeps) {
  const [session, setSession] = useState<PracticeSession>(() => loadSession(storage) ?? newSession(random, newId()));
  const clock = clockFor(session, sources);
  // A round opened under way shows its time left from its first frame.
  const [now, setNow] = useState(() => clock?.now() ?? 0);
  const status = session.round.status;
  const deadline = session.round.deadline;

  // Saved as it changes: its answers, its end, and its clock's anchor (below).
  useEffect(() => saveSession(storage, session), [storage, session]);

  // While it plays: brought up to date every tick, and at once when the app comes back to the foreground; its
  // clock's anchor is saved when the app goes to the background (where Android may close it). The screen draws
  // again only when the round changes or the second shown does (counted down to its deadline), not every tick.
  useEffect(() => {
    if (status !== "playing" || !clock || deadline === null) return;
    const id = session.id;
    const shownSecond = (at: number) => Math.ceil((deadline - at) / 1000);
    const step = (keepAnchor = false) => {
      const t = clock.now();
      setNow((shown) => (shownSecond(shown) === shownSecond(t) ? shown : t));
      setSession((s) => {
        if (s.id !== id) return s;
        const next = tick(s.round, t);
        return next === s.round && !keepAnchor ? s : { ...s, round: next, clock: clock.anchor() };
      });
    };
    step();
    const timer = setInterval(step, TICK_MS);
    const subscription = AppState.addEventListener("change", (state) => step(state !== "active"));
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [status, clock, deadline, session.id]);

  const round = session.round;
  const at = clock ? Math.max(now, 0) : 0;

  /** Starts `s` (waiting for Start) on a new clock. */
  const begin = (s: PracticeSession) => {
    const c = roundClock(sources);
    live = { id: s.id, clock: c };
    const started = startSession(s, c);
    setNow(started.round.startedAt ?? 0);
    setSession(started);
  };

  return {
    round,
    /** "neighbours" for the neighbours round (no map), else the map round. */
    mode: session.mode ?? ("map" as const),
    /** The neighbours round's options, by question (null for the map round). */
    options: session.options ?? null,
    /** The question waiting for an answer, or null (before Start, during feedback, after the end). */
    question: currentQuestion(round),
    feedback: feedbackOf(round),
    /** Time left, at the last tick (the whole round before Start). */
    remainingMs: remainingMs(round, at),
    /** The countdown: whole seconds left at the last tick. */
    secondsLeft: secondsLeft(round, at),
    result: challengeResult(round),
    /** Starts the timer: only from "ready", once the map is drawn (the caller's `ready`). */
    start(ready: boolean) {
      if (!ready || round.status !== "ready") return;
      begin(session);
    },
    /** Draws a neighbours round in place of the map round waiting for Start, and starts it. */
    startNeighbours(neighbours: Neighbours) {
      if (round.status !== "ready") return;
      begin(newNeighboursSession(neighbours, random, newId()));
    },
    /**
     * Answers the question asked with `country`, or skips it (null), now. Ignored when no question is asked, or when
     * `forIndex` is given and another question is asked by then.
     */
    choose(country: CountryId | null, forIndex?: number) {
      if (!clock) return;
      const t = clock.now();
      const q = currentQuestion(tick(round, t));
      if (!q || (forIndex !== undefined && q.index !== forIndex)) return;
      setNow(t);
      setSession((s) => {
        if (s.id !== session.id) return s;
        const { round: next } = answer(s.round, q.index, country, t);
        return next === s.round ? s : { ...s, round: next, clock: clock.anchor() };
      });
    },
    /** Try again: a new round of the same kind, started at once (the map is already drawn). */
    retry(neighbours: Neighbours | null) {
      begin(session.mode === "neighbours" && neighbours ? newNeighboursSession(neighbours, random, newId()) : newSession(random, newId()));
    },
    /** Leaving a round that has ended: the next opening draws a new one. */
    discard() {
      saveSession(storage, null);
    },
  };
}

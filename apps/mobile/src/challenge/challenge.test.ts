import { describe, expect, it } from "vitest";
import { CHALLENGE_POOL, EUROPE, NOT_ASKED } from "@/core/challenge/europe";
import { answer, CHALLENGE_RULES, challengeResult, currentQuestion, remainingMs, tick, type ChallengeRound } from "@/core/challenge/quickChallenge";
import type { CountryId } from "@/core/content/types";
import { seededRandom } from "@/core/game/random";
import type { KeyValueStorage } from "@/core/progress/storage";
import { roundClock, type ClockSources } from "./clock";
import { loadSession, newSession, PRACTICE_KEY, saveSession, startSession, type PracticeSession } from "./session";

/*
 * The app's practice rounds on the shared Quick Challenge rules, timed by the app's clock (clock.ts) and saved as the
 * screen saves them (session.ts), with clocks the tests move: no real time passes.
 */

/** A monotonic clock and a wall clock the test moves, together or apart. */
function testClock(start = 1_700_000_000_000) {
  let mono = 5_000;
  let wall = start;
  const sources: ClockSources = { mono: () => mono, wall: () => wall };
  return {
    sources,
    /** Time passing as usual: both clocks move. */
    pass(ms: number) {
      mono += ms;
      wall += ms;
    },
    /** The phone asleep: the wall clock moves, the monotonic one may not. */
    sleep(ms: number) {
      wall += ms;
    },
    /** The player moves the phone's clock. */
    setWall(ms: number) {
      wall += ms;
    },
    /** The app closed and opened again: a new process, its monotonic clock from another origin. */
    restartProcess() {
      mono = 0;
    },
  };
}

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const DURATION = CHALLENGE_RULES.durationMs;
const FEEDBACK = CHALLENGE_RULES.feedbackMs.correct;

/** A started round on a test clock. */
function started(seed = 1) {
  const c = testClock();
  const clock = roundClock(c.sources);
  const session = startSession(newSession(seededRandom(seed), `round-${seed}`), clock);
  return { c, clock, session };
}

/** Answers the question asked now with `country` (null: skip), as the screen does; the round, and whether it was taken. */
function choose(round: ChallengeRound, country: CountryId | null, now: number) {
  const q = currentQuestion(tick(round, now));
  if (!q) return { round: tick(round, now), taken: false };
  const { round: next, result } = answer(round, q.index, country, now);
  return { round: next, taken: result !== "rejected" };
}

/** A pool country that isn't `target`. */
const otherThan = (target: CountryId) => CHALLENGE_POOL.find((id) => id !== target)!;

describe("a practice round", () => {
  it("asks 15 different countries of the shared pool of 40, never one it doesn't ask", () => {
    expect(CHALLENGE_POOL).toHaveLength(40);
    expect(CHALLENGE_POOL.every((id) => EUROPE.includes(id) && !NOT_ASKED.includes(id))).toBe(true);
    for (let seed = 1; seed <= 50; seed++) {
      const { round } = newSession(seededRandom(seed), "r");
      expect(round.questions).toHaveLength(15);
      expect(new Set(round.questions).size).toBe(15);
      expect(round.questions.every((id) => CHALLENGE_POOL.includes(id))).toBe(true);
    }
    // Different rounds, different questions or orders.
    const orders = new Set([1, 2, 3, 4, 5].map((seed) => newSession(seededRandom(seed), "r").round.questions.join()));
    expect(orders.size).toBe(5);
  });

  it("waits for Start: no time runs before it, and the timer is the shared 60 seconds", () => {
    const c = testClock();
    const ready = newSession(seededRandom(1), "r");
    c.pass(30_000);
    expect(ready.round.status).toBe("ready");
    expect(remainingMs(ready.round, 30_000)).toBe(DURATION);
    expect(DURATION).toBe(60_000);
    const s = startSession(ready, roundClock(c.sources));
    expect(s.round).toMatchObject({ status: "playing", startedAt: 0, deadline: DURATION });
    // Start again changes nothing.
    expect(startSession(s, roundClock(c.sources))).toBe(s);
  });

  it("a correct answer counts once; a wrong one counts as wrong with the country chosen; a second tap during feedback is no answer", () => {
    const { c, clock, session } = started();
    let round = session.round;
    const [first, second] = round.questions;
    c.pass(1_000);
    let r = choose(round, first, clock.now());
    expect(r.taken).toBe(true);
    round = r.round;
    // The same tap again (a double tap): feedback shows, no question is asked.
    r = choose(round, first, clock.now());
    expect(r.taken).toBe(false);
    expect(r.round.answers).toHaveLength(1);
    c.pass(FEEDBACK);
    round = tick(r.round, clock.now());
    expect(currentQuestion(round)).toEqual({ index: 1, target: second });
    r = choose(round, otherThan(second), clock.now());
    expect(r.round.answers[1]).toMatchObject({ target: second, outcome: "wrong", chosen: otherThan(second) });
    // A country outside the pool (Malta, never asked) is no answer.
    c.pass(FEEDBACK);
    round = tick(r.round, clock.now());
    expect(choose(round, "MLT", clock.now()).taken).toBe(false);
  });

  it("ends exactly once at the deadline; answers after it are refused; the display stops at 0", () => {
    const { c, clock, session } = started();
    let round = session.round;
    c.pass(DURATION - 1);
    round = tick(round, clock.now());
    expect(round.status).toBe("playing");
    expect(remainingMs(round, clock.now())).toBe(1);
    c.pass(1);
    round = tick(round, clock.now());
    expect(round).toMatchObject({ status: "finished", endReason: "timeUp", endedAt: DURATION });
    // Ticking again, or a late answer, changes nothing.
    c.pass(5_000);
    expect(tick(round, clock.now())).toBe(round);
    expect(choose(round, round.questions[0], clock.now()).taken).toBe(false);
    expect(remainingMs(round, clock.now())).toBe(0);
    expect(challengeResult(round)).toMatchObject({ score: 0, unanswered: 15, elapsedMs: DURATION });
  });

  it("gains no time in the background or while the phone sleeps, nor by setting the clock back", () => {
    const { c, clock } = started();
    c.pass(10_000);
    expect(clock.now()).toBe(10_000);
    // In the background, the app's timers stopped: both clocks still move on.
    c.pass(20_000);
    expect(clock.now()).toBe(30_000);
    // The phone asleep: the monotonic clock stood still, the wall clock didn't.
    c.sleep(15_000);
    expect(clock.now()).toBe(45_000);
    // The phone's clock set back an hour: no time comes back.
    c.setWall(-3_600_000);
    expect(clock.now()).toBe(45_000);
    c.pass(1_000);
    expect(clock.now()).toBe(46_000);
    // Set forward: the round's time runs out (the player's loss, never a gain).
    c.setWall(3_600_000);
    expect(clock.now()).toBeGreaterThanOrEqual(DURATION);
  });

  it("carries on after Android recreates the screen, and after the app is closed, against the same deadline", () => {
    const storage = memoryStorage();
    const { c, clock, session } = started();
    let s: PracticeSession = session;
    c.pass(2_000);
    const r = choose(s.round, s.round.questions[0], clock.now());
    s = { ...s, round: r.round, clock: clock.anchor() };
    saveSession(storage, s);

    // The app closed 10 seconds later and opened again: a new process, its monotonic clock from 0.
    c.pass(10_000);
    c.restartProcess();
    const loaded = loadSession(storage)!;
    expect(loaded.round.answers).toHaveLength(1);
    const again = roundClock(c.sources, loaded.clock!);
    expect(again.now()).toBe(12_000);
    let round = tick(loaded.round, again.now());
    expect(currentQuestion(round)?.index).toBe(1);
    expect(remainingMs(round, again.now())).toBe(DURATION - 12_000);
    // Its time runs out at the deadline the round started with.
    c.pass(DURATION - 12_000);
    round = tick(round, again.now());
    expect(round).toMatchObject({ status: "finished", endReason: "timeUp", endedAt: DURATION });
  });

  it("closed with the phone's clock set back meanwhile: never earlier than the time last saved", () => {
    const storage = memoryStorage();
    const { c, clock, session } = started();
    c.pass(20_000);
    saveSession(storage, { ...session, clock: clock.anchor() });
    c.restartProcess();
    c.setWall(-600_000);
    const loaded = loadSession(storage)!;
    expect(roundClock(c.sources, loaded.clock!).now()).toBe(20_000);
  });

  it("leaving during a round leaves it running: back after its deadline, its result is there, time up", () => {
    const storage = memoryStorage();
    const { c, clock, session } = started();
    let s = session;
    c.pass(3_000);
    s = { ...s, round: choose(s.round, s.round.questions[0], clock.now()).round, clock: clock.anchor() };
    saveSession(storage, s);
    // Home, then back two minutes later.
    c.pass(120_000);
    const loaded = loadSession(storage)!;
    const round = tick(loaded.round, roundClock(c.sources, loaded.clock!).now());
    expect(challengeResult(round)).toMatchObject({ endReason: "timeUp", score: 1, correct: 1, unanswered: 14, elapsedMs: DURATION });
  });

  it("an example result: 12 of 15, with the missed countries and what was chosen", () => {
    const { c, clock, session } = started(7);
    let round = session.round;
    const qs = round.questions;
    for (let i = 0; i < 15; i++) {
      c.pass(1_000);
      round = tick(round, clock.now());
      // Questions 3 and 9 answered wrong, 12 skipped; the rest right.
      const country = i === 3 || i === 9 ? otherThan(qs[i]) : i === 12 ? null : qs[i];
      round = choose(round, country, clock.now()).round;
      c.pass(FEEDBACK);
    }
    round = tick(round, clock.now());
    const result = challengeResult(round)!;
    expect(result).toMatchObject({ endReason: "completed", score: 12, total: 15, correct: 12, incorrect: 2, skipped: 1, unanswered: 0 });
    expect(result.missed.map((m) => [m.target, m.outcome, m.chosen ?? null])).toEqual([
      [qs[3], "wrong", otherThan(qs[3])],
      [qs[9], "wrong", otherThan(qs[9])],
      [qs[12], "skipped", null],
    ]);
    expect(result.elapsedMs).toBe(15 * 1_000 + 14 * FEEDBACK);
  });

  it("Try again draws a new round of 15 and starts it; the result shown before stays the old round's", () => {
    const { c, clock, session } = started(3);
    c.pass(DURATION);
    const ended = tick(session.round, clock.now());
    const next = startSession(newSession(seededRandom(4), "round-4"), roundClock(c.sources));
    expect(next.id).not.toBe(session.id);
    expect(next.round).toMatchObject({ status: "playing", startedAt: 0, answers: [] });
    expect(next.round.questions).not.toEqual(ended.questions);
    expect(challengeResult(ended)?.endReason).toBe("timeUp");
  });

  it("a saved round that isn't one is read as none (a new round is drawn), and an ended round is cleared on leaving", () => {
    const storage = memoryStorage();
    storage.setItem(PRACTICE_KEY, "{not json");
    expect(loadSession(storage)).toBeNull();
    storage.setItem(PRACTICE_KEY, JSON.stringify({ id: "x", round: { status: "playing" }, clock: null }));
    expect(loadSession(storage)).toBeNull();
    const s = newSession(seededRandom(1), "r");
    saveSession(storage, { ...s, round: { ...s.round, questions: ["XXX", ...s.round.questions.slice(1)] } });
    expect(loadSession(storage)).toBeNull();
    saveSession(storage, s);
    expect(loadSession(storage)?.id).toBe("r");
    saveSession(storage, null);
    expect(loadSession(storage)).toBeNull();
    // A store that can't be written or read: no round is lost to an exception.
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error("no store");
      },
      setItem: () => {
        throw new Error("no store");
      },
    };
    expect(() => saveSession(broken, s)).not.toThrow();
    expect(loadSession(broken)).toBeNull();
  });
});

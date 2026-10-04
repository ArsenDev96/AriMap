import { describe, expect, it } from "vitest";
import type { FindAnswer } from "../game/find";
import { LESSONS } from "../lessons";
import type { LessonAction } from "../lesson/progress";
import { attemptRating, nextStar, rateAttempt, type StarRating } from "../lesson/rating";
import { appReducer, continentProgress, createInitialState, levelStatus, type AppAction, type AppState } from "./appState";
import { getLevel } from "../lessons";
import { parseSavedState, saveAppState, STORAGE_KEY } from "./storage";

const [L1, L2] = ["western-europe-1", "around-the-alps"];
const ROUTE: Record<string, string[]> = { [L1]: ["FRA", "BEL", "NLD"], [L2]: ["FRA", "CHE", "AUT"] };

const open = (levelId: string): AppAction => ({ type: "openLevel", levelId });
const restart = (levelId: string): AppAction => ({ type: "restartLevel", levelId });
const play = (action: LessonAction): AppAction => ({ type: "lesson", action });
const run = (s: AppState, ...actions: AppAction[]) => actions.reduce(appReducer, s);
const refresh = (s: AppState) => parseSavedState(JSON.stringify(s));
const at = (s: AppState, id = s.levelId) => s.levels[id];

interface Attempt {
  /** Find answers found on the first try without hints (the first ones asked). */
  firstTry: number;
  /** How the others are missed: a hint first, or a wrong tap first. */
  miss?: "hint" | "wrong";
  /** Help on the journey: a hint, an undo, or none. */
  travelHelp?: "hint" | "undo" | null;
}

/** Plays the open level's full attempt from Discover (as Play again or a first play), as described. */
function attempt(s: AppState, { firstTry, miss = "hint", travelHelp = null }: Attempt): AppState {
  const lesson = LESSONS[s.levelId];
  s = run(s, play({ type: "startFinding", order: [...lesson.countries] }));
  lesson.countries.forEach((target, i) => {
    if (i >= firstTry) s = run(s, miss === "hint" ? play({ type: "findHint" }) : play({ type: "findGuess", country: lesson.countries.find((c) => c !== target)! }));
    s = run(s, play({ type: "findGuess", country: target }), play({ type: "findNext" }));
  });
  s = run(s, play({ type: "findToTravel" }));
  const route = ROUTE[s.levelId];
  if (travelHelp === "hint") s = run(s, play({ type: "travelHint" }));
  if (travelHelp === "undo") s = run(s, play({ type: "travelMove", country: route[1] }), play({ type: "travelUndo" }));
  for (const country of route.slice(1)) s = run(s, play({ type: "travelMove", country }));
  return s;
}

const answers = (firstTry: number): FindAnswer[] =>
  ["FRA", "BEL", "NLD", "LUX", "DEU"].map((target, i) => ({ target, wrongGuesses: i < firstTry ? 0 : 1, hintLevel: 0, independent: i < firstTry }));

describe("star ratings: one rule for every level", () => {
  it("1 star for completing; 2 for at least 4 of 5 first-try Find answers; 3 for all 5 and the journey without help", () => {
    const cases: [number, boolean, StarRating][] = [
      [0, true, 1],
      [3, false, 1],
      [3, true, 1],
      [4, false, 2],
      [4, true, 2],
      [5, false, 2],
      [5, true, 3],
    ];
    for (const [firstTry, independent, stars] of cases) expect(rateAttempt(answers(firstTry), { independent }), `${firstTry}/5, journey ${independent ? "without" : "with"} help`).toBe(stars);
    // What the next star needs, for 1 and 2 stars.
    expect(nextStar(answers(3), { independent: true })).toBe("findMost");
    expect(nextStar(answers(4), { independent: true })).toBe("findAll");
    expect(nextStar(answers(4), { independent: false })).toBe("findAllAndTravel");
    expect(nextStar(answers(5), { independent: false })).toBe("travel");
    expect(nextStar(answers(5), { independent: true })).toBeNull();
  });

  it("a full attempt is rated as it completes, the same with hints or wrong first taps, and help on the journey by hint or undo", () => {
    for (const miss of ["hint", "wrong"] as const)
      for (const firstTry of [3, 4, 5])
        for (const travelHelp of [null, "hint", "undo"] as const) {
          const s = attempt(run(createInitialState(), open(L1)), { firstTry, miss, travelHelp });
          const expected = firstTry === 5 && !travelHelp ? 3 : firstTry >= 4 ? 2 : 1;
          const where = `${firstTry}/5 (others by ${miss}), journey help: ${travelHelp}`;
          expect(at(s).stage, where).toBe("results");
          expect(attemptRating(at(s)), where).toBe(expected);
          expect(at(s).records.bestRating, where).toBe(expected);
          // A first rating is not a "New best".
          expect(s.newBest, where).toBeUndefined();
        }
  });

  it("an attempt not completed has no rating: Discover, Find and a journey under way", () => {
    let s = run(createInitialState(), open(L1));
    expect(at(s).records.bestRating).toBeNull();
    s = run(s, play({ type: "startFinding", order: [...LESSONS[L1].countries] }));
    for (const target of LESSONS[L1].countries) s = run(s, play({ type: "findGuess", country: target }), play({ type: "findNext" }));
    s = run(s, play({ type: "findToTravel" }), play({ type: "travelMove", country: "BEL" }));
    expect(at(s).stage).toBe("travel");
    expect(attemptRating(at(s))).toBeNull();
    expect(at(s).records.bestRating).toBeNull();
    expect(levelStatus(s, getLevel(L1)!).kind).toBe("inProgress");
  });

  it("the best is never lowered: improved, equal and worse attempts; New best only when an earlier best is beaten, until the next action", () => {
    let s = attempt(run(createInitialState(), open(L1)), { firstTry: 3 });
    expect(at(s).records.bestRating).toBe(1);
    // Better: New best.
    s = attempt(run(s, restart(L1)), { firstTry: 4 });
    expect(attemptRating(at(s))).toBe(2);
    expect(at(s).records.bestRating).toBe(2);
    expect(s.newBest).toBe(L1);
    // Gone with the next action: a language change, View results (opening the level), anything.
    expect(run(s, { type: "setLocale", locale: "hy" }).newBest).toBeUndefined();
    expect(run(s, open(L1)).newBest).toBeUndefined();
    expect(run(s, { type: "goHome" }).newBest).toBeUndefined();
    // Equal: no New best.
    s = attempt(run(s, restart(L1)), { firstTry: 4, travelHelp: "hint" });
    expect(s.newBest).toBeUndefined();
    expect(at(s).records.bestRating).toBe(2);
    // Better again: 3 stars.
    s = attempt(run(s, restart(L1)), { firstTry: 5 });
    expect([attemptRating(at(s)), at(s).records.bestRating, s.newBest]).toEqual([3, 3, L1]);
    // Worse: this attempt's 1 star, the best kept at 3.
    s = attempt(run(s, restart(L1)), { firstTry: 2, miss: "wrong" });
    expect([attemptRating(at(s)), at(s).records.bestRating, s.newBest]).toEqual([1, 3, undefined]);
    // Starting over (and playing again) keeps the best; so does leaving a new attempt unfinished.
    s = run(s, restart(L1));
    expect(at(s)).toMatchObject({ stage: "discover", records: { bestRating: 3, travelDone: true } });
    expect(attemptRating(at(s))).toBeNull();
    expect(refresh(s).levels[L1].records.bestRating).toBe(3);
  });

  it("Replay journey never changes the rating: an earlier Find never combines with a new journey", () => {
    // 5/5 in Find, the journey with a hint: 2 stars.
    let s = attempt(run(createInitialState(), open(L1)), { firstTry: 5, travelHelp: "hint" });
    expect(at(s).records.bestRating).toBe(2);
    // The journey alone, now without help: still 2 stars, and no rating for these Results.
    s = run(s, play({ type: "replayTravel" }));
    expect(at(s).journeyReplay).toBe(true);
    // Refreshed mid-journey, it is still a replay.
    s = refresh(s);
    expect(at(s).journeyReplay).toBe(true);
    for (const country of ROUTE[L1].slice(1)) s = run(s, play({ type: "travelMove", country }));
    expect(at(s).stage).toBe("results");
    expect(at(s).lastTravelResult?.independent).toBe(true);
    expect(attemptRating(at(s))).toBeNull();
    expect(at(s).records).toMatchObject({ bestRating: 2, travelWithoutHelp: true });
    expect(s.newBest).toBeUndefined();
    expect(refresh(s).levels[L1].records.bestRating).toBe(2);
    expect(attemptRating(refresh(s).levels[L1])).toBeNull();
    // A full attempt (Play again) earns the third star.
    s = attempt(run(s, restart(L1)), { firstTry: 5 });
    expect(at(s).journeyReplay).toBe(false);
    expect([attemptRating(at(s)), at(s).records.bestRating, s.newBest]).toEqual([3, 3, L1]);
  });

  it("a refresh keeps the ratings with their Results; New best is never saved", () => {
    let s = attempt(run(createInitialState(), open(L1)), { firstTry: 3 });
    s = attempt(run(s, restart(L1)), { firstTry: 5 });
    expect(s.newBest).toBe(L1);
    const data: Record<string, string> = {};
    saveAppState({ getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) }, s);
    expect(JSON.parse(data[STORAGE_KEY])).not.toHaveProperty("newBest");
    const back = parseSavedState(data[STORAGE_KEY]);
    expect(back.newBest).toBeUndefined();
    expect(back.levels[L1]).toEqual(at(s));
    expect(attemptRating(back.levels[L1])).toBe(3);
  });

  it("each level keeps its own rating; completion counts and unlocks are unchanged", () => {
    let s = attempt(run(createInitialState(), open(L1)), { firstTry: 5 });
    s = attempt(run(s, open(L2)), { firstTry: 3 });
    expect([at(s, L1).records.bestRating, at(s, L2).records.bestRating]).toEqual([3, 1]);
    s = attempt(run(s, restart(L2)), { firstTry: 4 });
    expect([at(s, L1).records.bestRating, at(s, L2).records.bestRating, s.newBest]).toEqual([3, 2, L2]);
    expect(continentProgress(s, "europe")).toEqual({ total: 7, completed: 2 });
    expect(levelStatus(s, getLevel("central-europe")!).kind).toBe("ready");
  });
});

describe("star ratings in saves", () => {
  /** A save as written before ratings existed: no bestRating, no journeyReplay. */
  const older = (s: AppState) => {
    const data = JSON.parse(JSON.stringify(s));
    for (const level of Object.values(data.levels) as { records: Record<string, unknown>; journeyReplay?: boolean }[]) {
      delete level.records.bestRating;
      delete level.journeyReplay;
    }
    return parseSavedState(JSON.stringify(data));
  };

  it("an older save gets the stars its own complete Find and journey support; a completion record alone gets none", () => {
    expect(older(attempt(run(createInitialState(), open(L1)), { firstTry: 5 })).levels[L1].records.bestRating).toBe(3);
    expect(older(attempt(run(createInitialState(), open(L1)), { firstTry: 4, travelHelp: "undo" })).levels[L1].records.bestRating).toBe(2);
    const old = older(attempt(run(createInitialState(), open(L1)), { firstTry: 5 }));
    expect(attemptRating(old.levels[L1])).toBe(3);
    // Completed, with only the record kept (no Find or journey to rate).
    const recordOnly = parseSavedState(
      JSON.stringify({ version: 2, locale: "en", screen: "levels", levelId: L1, recent: [], levels: { [L1]: { started: false, stage: "discover", records: { discoverDone: true, findDone: true, travelDone: true } } } }),
    );
    expect(levelStatus(recordOnly, getLevel(L1)!).kind).toBe("completed");
    expect(recordOnly.levels[L1].records.bestRating).toBeNull();
    // Results without their Find: not rated.
    const noFind = JSON.parse(JSON.stringify(attempt(run(createInitialState(), open(L1)), { firstTry: 5 })));
    noFind.levels[L1].find = null;
    delete noFind.levels[L1].records.bestRating;
    const parsed = parseSavedState(JSON.stringify(noFind));
    expect(parsed.levels[L1].stage).toBe("results");
    expect(parsed.levels[L1].records.bestRating).toBeNull();
  });

  it("an older save's journey under way in a completed level may be a replay: finishing it rates nothing; a first attempt's is rated", () => {
    // Completed (without a rating kept), then a journey under way: taken as a replay.
    const done = JSON.parse(JSON.stringify(attempt(run(createInitialState(), open(L1)), { firstTry: 5 })));
    done.levels[L1].stage = "travel";
    done.levels[L1].travel = { missionId: "fra-to-nld", path: ["FRA"], hintUsed: false, undoUsed: false };
    delete done.levels[L1].journeyReplay;
    delete done.levels[L1].records.bestRating;
    let s = parseSavedState(JSON.stringify(done));
    expect(at(s, L1).journeyReplay).toBe(true);
    for (const country of ROUTE[L1].slice(1)) s = run(s, play({ type: "travelMove", country }));
    expect(at(s, L1).records.bestRating).toBeNull();
    expect(levelStatus(s, getLevel(L1)!).kind).toBe("completed");
    // Never completed: the journey under way ends the first full attempt, which is rated.
    let first = run(createInitialState(), open(L1), play({ type: "startFinding", order: [...LESSONS[L1].countries] }));
    for (const target of LESSONS[L1].countries) first = run(first, play({ type: "findGuess", country: target }), play({ type: "findNext" }));
    first = older(run(first, play({ type: "findToTravel" })));
    expect(at(first, L1).journeyReplay).toBe(false);
    for (const country of ROUTE[L1].slice(1)) first = run(first, play({ type: "travelMove", country }));
    expect(at(first, L1).records.bestRating).toBe(3);
  });

  it("ignores invalid stored ratings safely, keeping everything else", () => {
    const save = (bestRating: unknown, extra: object = {}) =>
      parseSavedState(JSON.stringify({ version: 2, locale: "en", screen: "levels", levelId: L1, recent: [], levels: { [L1]: { started: false, stage: "discover", records: { discoverDone: true, findDone: true, travelDone: true, bestRating }, ...extra } } }));
    for (const bad of [0, 4, -1, 2.5, "3", null, true, {}, [3]]) {
      const s = save(bad);
      expect(s.levels[L1].records.bestRating, JSON.stringify(bad)).toBeNull();
      expect(levelStatus(s, getLevel(L1)!).kind).toBe("completed");
    }
    expect(save(2).levels[L1].records.bestRating).toBe(2);
    // A rating without completion is not one.
    const notDone = parseSavedState(
      JSON.stringify({ version: 2, locale: "en", screen: "levels", levelId: L1, recent: [], levels: { [L1]: { started: true, stage: "discover", records: { discoverDone: true, bestRating: 3 } } } }),
    );
    expect(notDone.levels[L1].records.bestRating).toBeNull();
    // A stored best below what the kept Results earn is raised to it; one above them is kept.
    const three = JSON.parse(JSON.stringify(attempt(run(createInitialState(), open(L1)), { firstTry: 5 })));
    three.levels[L1].records.bestRating = 1;
    expect(parseSavedState(JSON.stringify(three)).levels[L1].records.bestRating).toBe(3);
    const one = JSON.parse(JSON.stringify(attempt(run(createInitialState(), open(L1)), { firstTry: 2 })));
    one.levels[L1].records.bestRating = 3;
    expect(parseSavedState(JSON.stringify(one)).levels[L1].records.bestRating).toBe(3);
    // An invalid replay flag falls back to the older saves' reading: Results here are a full attempt's.
    three.levels[L1].journeyReplay = "yes";
    expect(attemptRating(parseSavedState(JSON.stringify(three)).levels[L1])).toBe(3);
  });
});

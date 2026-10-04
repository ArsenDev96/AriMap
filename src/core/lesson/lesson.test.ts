import { describe, expect, it } from "vitest";
import { westernEuropeLesson as lesson } from "../lessons/western-europe";
import { appReducer, createInitialState, type AppAction, type AppState } from "../progress/appState";
import { parseSavedState } from "../progress/storage";
import { buildMapView } from "./mapView";
import type { LessonAction } from "./progress";

const ORDER = ["FRA", "BEL", "NLD", "LUX", "DEU"];
const NO_UI = { travelHintVisible: false };

function run(state: AppState, ...actions: (AppAction | LessonAction)[]): AppState {
  return actions.reduce<AppState>(
    (s, a) => appReducer(s, "action" in a || a.type === "setLocale" || a.type === "openLevel" || a.type === "goHome" || a.type === "restartLevel" ? (a as AppAction) : { type: "lesson", action: a as LessonAction }),
    state,
  );
}

const OPEN: AppAction = { type: "openLevel", levelId: lesson.id };
const progressOf = (s: AppState) => s.levels[lesson.id];

/** Answers all five Find questions (the last stays answered, ready to continue to Travel). */
function findAll(s: AppState): AppState {
  for (const target of ORDER) s = run(s, { type: "findGuess", country: target }, { type: "findNext" });
  return s;
}

function toTravel(): AppState {
  return run(findAll(run(createInitialState(), OPEN, { type: "startFinding", order: ORDER })), { type: "findToTravel" });
}

/** Round-trips through JSON the way localStorage does on refresh. */
const refresh = (s: AppState) => parseSavedState(JSON.stringify(s));

describe("lesson flow", () => {
  it("goes Discover → Find (five questions) → Travel → Results", () => {
    let s = run(createInitialState(), OPEN);
    expect(progressOf(s).stage).toBe("discover");
    s = run(s, { type: "startFinding", order: ORDER });
    expect(progressOf(s).stage).toBe("find");
    // Not before the last answer.
    expect(run(s, { type: "findToTravel" })).toBe(s);
    s = findAll(s);
    // After the fifth answer the player stays on it until choosing to continue.
    expect(progressOf(s).stage).toBe("find");
    expect(progressOf(s).find).toMatchObject({ index: 4, status: "asking", question: { target: "DEU", solved: true } });
    expect(progressOf(s).find?.results).toHaveLength(5);
    s = run(s, { type: "findToTravel" });
    expect(progressOf(s).stage).toBe("travel");
    expect(progressOf(s).find?.status).toBe("complete");
    expect(progressOf(s).records).toMatchObject({ findDone: true, lastFindScore: { independent: 5, total: 5 }, bestFindScore: { independent: 5, total: 5 } });

    s = run(s, { type: "travelMove", country: "DEU" }, { type: "travelMove", country: "NLD" });
    expect(progressOf(s).stage).toBe("results");
    expect(progressOf(s).lastTravelResult).toMatchObject({ route: ["FRA", "DEU", "NLD"], independent: true });
    expect(progressOf(s).records.travelWithoutHelp).toBe(true);
  });

  it("does not grant the badge after hint or undo", () => {
    let s = run(toTravel(), { type: "travelHint" }, { type: "travelMove", country: "BEL" }, { type: "travelMove", country: "NLD" });
    expect(progressOf(s).lastTravelResult?.independent).toBe(false);
    expect(progressOf(s).records.travelWithoutHelp).toBe(false);

    s = run(s, { type: "replayTravel" }, { type: "travelMove", country: "LUX" }, { type: "travelUndo" });
    s = run(s, { type: "travelMove", country: "BEL" }, { type: "travelMove", country: "NLD" });
    expect(progressOf(s).lastTravelResult).toMatchObject({ undoUsed: true, independent: false });
    expect(progressOf(s).records.travelWithoutHelp).toBe(false);
  });

  it("changing language preserves the current activity", () => {
    const s = run(toTravel(), { type: "travelMove", country: "LUX" });
    const hy = run(s, { type: "setLocale", locale: "hy" });
    expect(hy.locale).toBe("hy");
    expect(hy.levels).toBe(s.levels);
    expect(hy.screen).toBe("lesson");
  });

  it("scores help: hints and wrong taps count against the first-try score", () => {
    let s = run(createInitialState(), OPEN, { type: "startFinding", order: ORDER });
    s = run(s, { type: "findHint" }, { type: "findGuess", country: "FRA" }, { type: "findNext" });
    s = run(s, { type: "findGuess", country: "DEU" }, { type: "findGuess", country: "BEL" }, { type: "findNext" });
    for (const target of ORDER.slice(2)) s = run(s, { type: "findGuess", country: target }, { type: "findNext" });
    s = run(s, { type: "findToTravel" });
    expect(progressOf(s).records.lastFindScore).toEqual({ independent: 3, total: 5 });
    expect(progressOf(s).find?.results.map((a) => a.independent)).toEqual([false, false, true, true, true]);
  });

  it("Home keeps the lesson exactly as it was, and Continue resumes it", () => {
    const states = [
      run(createInitialState(), OPEN, { type: "discoverSelect", country: "BEL" }),
      run(createInitialState(), OPEN, { type: "startFinding", order: ORDER }, { type: "findGuess", country: "DEU" }, { type: "findHint" }),
      findAll(run(createInitialState(), OPEN, { type: "startFinding", order: ORDER })),
      run(toTravel(), { type: "travelHint" }, { type: "travelMove", country: "BEL" }),
      run(toTravel(), { type: "travelMove", country: "BEL" }, { type: "travelMove", country: "NLD" }),
      // A completed lesson being replayed.
      run(toTravel(), { type: "travelMove", country: "BEL" }, { type: "travelMove", country: "NLD" }, { type: "replayTravel" }, { type: "travelMove", country: "DEU" }),
    ];
    for (const s of states) {
      const home = run(s, { type: "goHome" });
      expect(home.screen).toBe("continents");
      expect(home.levels).toBe(s.levels);
      // Also across a refresh while on the home screen.
      const back = run(refresh(home), OPEN);
      expect(back.screen).toBe("lesson");
      expect(progressOf(back)).toEqual(progressOf(s));
    }
  });

  it("start over keeps achievements and language", () => {
    let s = run(toTravel(), { type: "setLocale", locale: "hy" }, { type: "restartLevel", levelId: lesson.id });
    expect(s.locale).toBe("hy");
    expect(progressOf(s).stage).toBe("discover");
    expect(progressOf(s).records.findDone).toBe(true);
    s = run(s, { type: "goHome" });
    expect(s.screen).toBe("continents");
  });
});

describe("map view", () => {
  it("hides names, capitals and the target in Find", () => {
    const s = run(createInitialState(), OPEN, { type: "startFinding", order: ORDER });
    const view = buildMapView(lesson, progressOf(s), NO_UI);
    expect(view).toMatchObject({ labels: [], markers: [], tones: {}, areaHint: null, interactive: true, namesPublic: false });
  });

  it("identifies a wrong tap, reveals the target when solved, and clears both on the next question", () => {
    let s = run(createInitialState(), OPEN, { type: "startFinding", order: ORDER }, { type: "findGuess", country: "DEU" });
    let view = buildMapView(lesson, progressOf(s), NO_UI);
    expect(view.tones).toEqual({ DEU: "wrong" });
    expect(view.labels).toEqual(["DEU"]);

    s = run(s, { type: "findGuess", country: "FRA" });
    view = buildMapView(lesson, progressOf(s), NO_UI);
    expect(view.tones.FRA).toBe("correct");
    expect(view.labels).toContain("FRA");
    expect(view.interactive).toBe(false);

    s = run(s, { type: "findNext" });
    view = buildMapView(lesson, progressOf(s), NO_UI);
    expect(view.labels).toEqual([]);
    expect(view.tones).toEqual({});
  });

  it("shows hint area then reveal", () => {
    let s = run(createInitialState(), OPEN, { type: "startFinding", order: ORDER }, { type: "findHint" });
    expect(buildMapView(lesson, progressOf(s), NO_UI).areaHint).toBeNull();
    s = run(s, { type: "findHint" });
    expect(buildMapView(lesson, progressOf(s), NO_UI).areaHint).toBe("FRA");
    s = run(s, { type: "findHint" });
    expect(buildMapView(lesson, progressOf(s), NO_UI).tones.FRA).toBe("reveal");
  });

  it("labels only visited countries and the destination in Travel, plus neighbours during a hint", () => {
    const s = run(toTravel(), { type: "travelMove", country: "BEL" });
    const view = buildMapView(lesson, progressOf(s), NO_UI);
    expect([...view.labels].sort()).toEqual(["BEL", "FRA", "NLD"]);
    expect(view.tones).toEqual({ FRA: "visited", BEL: "current", NLD: "destination" });
    expect(view.route).toEqual(["FRA", "BEL"]);
    const hinted = buildMapView(lesson, progressOf(s), { travelHintVisible: true });
    expect([...hinted.labels].sort()).toEqual(["BEL", "DEU", "FRA", "LUX", "NLD"]);
  });

  it("marks explored countries in Discover only", () => {
    let s = run(createInitialState(), OPEN, { type: "discoverSelect", country: "BEL" }, { type: "discoverSelect", country: "LUX" });
    expect(buildMapView(lesson, progressOf(s), NO_UI).explored.sort()).toEqual(["BEL", "LUX"]);
    s = run(s, { type: "startFinding", order: ORDER });
    expect(buildMapView(lesson, progressOf(s), NO_UI).explored).toEqual([]);
  });

  it("gives each Find answer its own feedback key, and none before an answer", () => {
    let s = run(createInitialState(), OPEN, { type: "startFinding", order: ORDER });
    expect(buildMapView(lesson, progressOf(s), NO_UI).feedback).toBeNull();
    s = run(s, { type: "findGuess", country: "DEU" });
    const wrong = buildMapView(lesson, progressOf(s), NO_UI).feedback;
    expect(wrong).toMatchObject({ country: "DEU", kind: "wrong" });
    s = run(s, { type: "findGuess", country: "BEL" });
    const again = buildMapView(lesson, progressOf(s), NO_UI).feedback;
    expect(again).toMatchObject({ country: "BEL", kind: "wrong" });
    expect(again?.key).not.toBe(wrong?.key);
    s = run(s, { type: "findGuess", country: "FRA" });
    const correct = buildMapView(lesson, progressOf(s), NO_UI).feedback;
    expect(correct).toMatchObject({ country: "FRA", kind: "correct" });
    expect(correct?.key).not.toBe(again?.key);
    s = run(s, { type: "findNext" });
    expect(buildMapView(lesson, progressOf(s), NO_UI).feedback).toBeNull();
  });

  it("marks a Travel journey as arrived only at the destination", () => {
    let s = run(toTravel(), { type: "travelMove", country: "BEL" });
    expect(buildMapView(lesson, progressOf(s), NO_UI).arrived).toBe(false);
    s = run(s, { type: "travelMove", country: "NLD" });
    expect(buildMapView(lesson, progressOf(s), NO_UI).arrived).toBe(true);
  });

  it("undo restores the previous map display", () => {
    const before = run(toTravel(), { type: "travelMove", country: "LUX" });
    const after = run(before, { type: "travelMove", country: "DEU" }, { type: "travelUndo" });
    const a = buildMapView(lesson, progressOf(before), NO_UI);
    const b = buildMapView(lesson, progressOf(after), NO_UI);
    expect(b).toEqual(a);
    expect(progressOf(after).travel?.undoUsed).toBe(true);
  });
});

describe("saved state", () => {
  it("resumes Find mid-question including assistance", () => {
    const s = run(createInitialState(), { type: "setLocale", locale: "hy" }, OPEN, { type: "startFinding", order: ORDER }, { type: "findHint" });
    const restored = refresh(s);
    expect(restored.locale).toBe("hy");
    expect(restored.screen).toBe("lesson");
    expect(progressOf(restored)).toEqual(progressOf(s));
    const solved = run(restored, { type: "findGuess", country: "FRA" });
    expect(progressOf(solved).find?.results[0].independent).toBe(false);
  });

  it("resumes an in-progress journey", () => {
    const s = run(toTravel(), { type: "travelHint" }, { type: "travelMove", country: "BEL" });
    expect(progressOf(refresh(s))).toEqual(progressOf(s));
  });

  it("falls back safely on missing, malformed or future data", () => {
    expect(parseSavedState(null)).toEqual(createInitialState());
    expect(parseSavedState("{not json")).toEqual(createInitialState());
    expect(parseSavedState("[]")).toEqual(createInitialState());
    expect(parseSavedState(JSON.stringify({ version: 99, locale: "hy" }))).toEqual(createInitialState("hy"));
    expect(parseSavedState(JSON.stringify({ version: 1, locale: "fr" })).locale).toBe("en");
    expect(parseSavedState(JSON.stringify({ version: 2, locale: "fr" })).locale).toBe("en");
  });

  it("rejects tampered journeys and recomputes derived values", () => {
    const s = toTravel();
    const raw = JSON.parse(JSON.stringify(s));
    const p = raw.levels[lesson.id];
    p.travel.path = ["FRA", "NLD"]; // not neighbours
    p.travel.budget = 5;
    const restored = progressOf(parseSavedState(JSON.stringify(raw)));
    expect(restored.travel).toBeNull();
    expect(restored.stage).toBe("discover");

    p.travel.path = ["FRA", "BEL"];
    delete p.travel.hintUsed; // missing flag is treated as assisted
    const again = progressOf(parseSavedState(JSON.stringify(raw)));
    expect(again.travel).toMatchObject({ budget: 2, hintUsed: true, status: "playing" });
  });

  it("recomputes independent Find answers instead of trusting saved flags", () => {
    let s = run(createInitialState(), OPEN, { type: "startFinding", order: ORDER }, { type: "findGuess", country: "DEU" }, { type: "findGuess", country: "FRA" });
    const raw = JSON.parse(JSON.stringify(s));
    raw.levels[lesson.id].find.results[0].independent = true;
    s = parseSavedState(JSON.stringify(raw));
    expect(progressOf(s).find?.results[0].independent).toBe(false);
  });
});

/*
 * Saves from the old two-round Find (see migrateLegacyFind in storage.ts): only
 * the first round is kept, and it is the five-question Find.
 */
describe("saves from the two-round Find", () => {
  const ORDERS = [ORDER, ["LUX", "FRA", "DEU", "NLD", "BEL"]];
  /** Old-format answers to the first `n` questions of `order`; `assisted` ones had a wrong tap. */
  const answers = (order: string[], n: number, assisted: number[] = []) =>
    order.slice(0, n).map((target, i) => ({ target, wrongGuesses: assisted.includes(i) ? 1 : 0, hintLevel: 0, independent: !assisted.includes(i) }));
  const question = (target: string, extra: object = {}) => ({ target, wrongGuesses: [], hintLevel: 0, solved: false, feedback: null, ...extra });
  const load = (lessonSave: object) =>
    parseSavedState(JSON.stringify({ version: 1, locale: "en", screen: "lesson", lessons: { [lesson.id]: { started: true, discover: { selected: null, explored: [] }, ...lessonSave } } }));

  it("in the first round: the same question, hints and answers", () => {
    const s = load({
      stage: "find",
      find: { orders: ORDERS, round: 0, index: 2, question: question("NLD", { wrongGuesses: ["DEU"], hintLevel: 1, feedback: { kind: "wrong", country: "DEU" } }), results: [answers(ORDER, 2, [1]), []], status: "asking" },
    });
    expect(s.screen).toBe("lesson");
    const p = progressOf(s);
    expect(p.stage).toBe("find");
    expect(p.find).toMatchObject({ order: ORDER, index: 2, status: "asking", question: { target: "NLD", wrongGuesses: ["DEU"], hintLevel: 1, solved: false } });
    expect(p.find?.results.map((a) => a.independent)).toEqual([true, false]);
    // Play goes on to the fifth question, then Travel.
    let next = run(s, { type: "findGuess", country: "NLD" }, { type: "findNext" });
    for (const target of ["LUX", "DEU"]) next = run(next, { type: "findGuess", country: target }, { type: "findNext" });
    next = run(next, { type: "findToTravel" });
    expect(progressOf(next).stage).toBe("travel");
    expect(progressOf(next).records.lastFindScore).toEqual({ independent: 3, total: 5 });
  });

  it("at the first round's summary: the fifth answer, ready to continue to Travel", () => {
    const s = load({
      stage: "findSummary",
      find: { orders: ORDERS, round: 0, index: 4, question: question("DEU", { solved: true, feedback: { kind: "correct", country: "DEU" } }), results: [answers(ORDER, 5, [0]), []], status: "roundComplete" },
    });
    const p = progressOf(s);
    expect(p.stage).toBe("find");
    expect(p.find).toMatchObject({ index: 4, status: "asking", question: { target: "DEU", solved: true } });
    const next = run(s, { type: "findToTravel" });
    expect(progressOf(next).stage).toBe("travel");
    expect(progressOf(next).records.lastFindScore).toEqual({ independent: 4, total: 5 });
  });

  for (const [where, status, stage, index, secondRound] of [
    ["in the second round", "asking", "find", 2, 2],
    ["at the second round's summary", "roundComplete", "findSummary", 4, 5],
  ] as const) {
    it(`${where}: the completed first round is the Find, on its last answer; second-round answers are dropped`, () => {
      const s = load({
        stage,
        find: {
          orders: ORDERS,
          round: 1,
          index,
          question: question(ORDERS[1][index], status === "roundComplete" ? { solved: true } : {}),
          results: [answers(ORDER, 5, [1, 3]), answers(ORDERS[1], secondRound)],
          status,
        },
      });
      const p = progressOf(s);
      expect(p.stage).toBe("find");
      expect(p.find).toMatchObject({ order: ORDER, index: 4, status: "asking", question: { target: "DEU", solved: true, feedback: { kind: "correct", country: "DEU" } } });
      expect(p.find?.results.map((a) => a.target)).toEqual(ORDER);
      // Nothing is left to answer; Next does nothing, and the player moves on to Travel.
      expect(run(s, { type: "findNext" })).toBe(s);
      expect(run(s, { type: "findGuess", country: "FRA" })).toBe(s);
      const next = run(s, { type: "findToTravel" });
      expect(progressOf(next).stage).toBe("travel");
      expect(progressOf(next).records.lastFindScore).toEqual({ independent: 3, total: 5 });
    });
  }

  for (const stage of ["travel", "results"] as const) {
    it(`in ${stage === "travel" ? "Travel" : "Results"} after both rounds: stays there, scored out of five from the first round`, () => {
      const s = load({
        stage,
        find: { orders: ORDERS, round: 1, index: 4, question: question("BEL", { solved: true }), results: [answers(ORDER, 5, [0]), answers(ORDERS[1], 5)], status: "complete" },
        travel: { missionId: "fra-to-nld", path: stage === "travel" ? ["FRA", "BEL"] : ["FRA", "BEL", "NLD"], hintUsed: false, undoUsed: false },
        lastTravelResult: stage === "results" ? { missionId: "fra-to-nld", route: ["FRA", "BEL", "NLD"], hintUsed: false, undoUsed: false } : null,
        records: { discoverDone: true, findDone: true, travelDone: stage === "results", lastFindScore: { independent: 9, total: 10 }, bestFindScore: { independent: 10, total: 10 }, travelWithoutHelp: false },
      });
      const p = progressOf(s);
      expect(p.stage).toBe(stage);
      expect(p.find).toMatchObject({ order: ORDER, status: "complete" });
      expect(p.records).toMatchObject({ findDone: true, lastFindScore: { independent: 4, total: 5 }, bestFindScore: { independent: 4, total: 5 } });
    });
  }

  it("drops old scores it cannot rescore, keeping the completed steps", () => {
    const s = load({ stage: "discover", records: { discoverDone: true, findDone: true, travelDone: true, lastFindScore: { independent: 9, total: 10 }, bestFindScore: { independent: 10, total: 10 }, travelWithoutHelp: true } });
    expect(progressOf(s).records).toEqual({ discoverDone: true, findDone: true, travelDone: true, lastFindScore: null, bestFindScore: null, travelWithoutHelp: true });
  });

  it("drops an inconsistent old session and resumes at Discover", () => {
    const s = load({
      stage: "find",
      find: { orders: ORDERS, round: 1, index: 0, question: question("LUX"), results: [answers(ORDER, 3), []], status: "asking" },
    });
    expect(progressOf(s).find).toBeNull();
    expect(progressOf(s).stage).toBe("discover");
  });
});

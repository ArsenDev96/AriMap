import { describe, expect, it } from "vitest";
import { westernEuropeLesson as lesson } from "../lessons/western-europe";
import { appReducer, createInitialState, type AppAction, type AppState } from "../progress/appState";
import { parseSavedState } from "../progress/storage";
import { buildMapView } from "./mapView";
import type { LessonAction } from "./progress";

const ORDERS = [
  ["FRA", "BEL", "NLD", "LUX", "DEU"],
  ["LUX", "FRA", "DEU", "NLD", "BEL"],
];
const NO_UI = { travelHintVisible: false };

function run(state: AppState, ...actions: (AppAction | LessonAction)[]): AppState {
  return actions.reduce<AppState>(
    (s, a) => appReducer(s, "action" in a || a.type === "setLocale" || a.type === "openLesson" || a.type === "goHome" || a.type === "startOver" ? (a as AppAction) : { type: "lesson", action: a as LessonAction }),
    state,
  );
}

const progressOf = (s: AppState) => s.lessons[lesson.id];

function toTravel(): AppState {
  let s = run(createInitialState(), { type: "openLesson" }, { type: "startFinding", orders: ORDERS });
  for (const order of ORDERS) {
    for (const target of order) s = run(s, { type: "findGuess", country: target }, { type: "findNext" });
    s = run(s, { type: "findContinue" });
  }
  return s;
}

/** Round-trips through JSON the way localStorage does on refresh. */
const refresh = (s: AppState) => parseSavedState(JSON.stringify(s));

describe("lesson flow", () => {
  it("goes Discover → Find → summary → Find → summary → Travel → Results", () => {
    let s = run(createInitialState(), { type: "openLesson" });
    expect(progressOf(s).stage).toBe("discover");
    s = run(s, { type: "startFinding", orders: ORDERS });
    expect(progressOf(s).stage).toBe("find");
    for (const target of ORDERS[0]) s = run(s, { type: "findGuess", country: target }, { type: "findNext" });
    expect(progressOf(s).stage).toBe("findSummary");
    s = run(s, { type: "findContinue" });
    expect(progressOf(s).stage).toBe("find");
    expect(progressOf(s).find?.question.target).toBe("LUX");
    for (const target of ORDERS[1]) s = run(s, { type: "findGuess", country: target }, { type: "findNext" });
    s = run(s, { type: "findContinue" });
    expect(progressOf(s).stage).toBe("travel");
    expect(progressOf(s).records.lastFindScore).toEqual({ independent: 10, total: 10 });

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
    expect(hy.lessons).toBe(s.lessons);
    expect(hy.screen).toBe("lesson");
  });

  it("start over keeps achievements and language", () => {
    let s = run(toTravel(), { type: "setLocale", locale: "hy" }, { type: "startOver" });
    expect(s.locale).toBe("hy");
    expect(progressOf(s).stage).toBe("discover");
    expect(progressOf(s).records.findDone).toBe(true);
    s = run(s, { type: "goHome" });
    expect(s.screen).toBe("welcome");
  });
});

describe("map view", () => {
  it("hides names, capitals and the target in Find", () => {
    const s = run(createInitialState(), { type: "openLesson" }, { type: "startFinding", orders: ORDERS });
    const view = buildMapView(lesson, progressOf(s), NO_UI);
    expect(view).toMatchObject({ labels: [], markers: [], tones: {}, areaHint: null, interactive: true, namesPublic: false });
  });

  it("identifies a wrong tap, reveals the target when solved, and clears both on the next question", () => {
    let s = run(createInitialState(), { type: "openLesson" }, { type: "startFinding", orders: ORDERS }, { type: "findGuess", country: "DEU" });
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
    let s = run(createInitialState(), { type: "openLesson" }, { type: "startFinding", orders: ORDERS }, { type: "findHint" });
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
    let s = run(createInitialState(), { type: "openLesson" }, { type: "discoverSelect", country: "BEL" }, { type: "discoverSelect", country: "LUX" });
    expect(buildMapView(lesson, progressOf(s), NO_UI).explored.sort()).toEqual(["BEL", "LUX"]);
    s = run(s, { type: "startFinding", orders: ORDERS });
    expect(buildMapView(lesson, progressOf(s), NO_UI).explored).toEqual([]);
  });

  it("gives each Find answer its own feedback key, and none before an answer", () => {
    let s = run(createInitialState(), { type: "openLesson" }, { type: "startFinding", orders: ORDERS });
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
    const s = run(createInitialState(), { type: "setLocale", locale: "hy" }, { type: "openLesson" }, { type: "startFinding", orders: ORDERS }, { type: "findHint" });
    const restored = refresh(s);
    expect(restored.locale).toBe("hy");
    expect(restored.screen).toBe("lesson");
    expect(progressOf(restored)).toEqual(progressOf(s));
    const solved = run(restored, { type: "findGuess", country: "FRA" });
    expect(progressOf(solved).find?.results[0][0].independent).toBe(false);
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
  });

  it("rejects tampered journeys and recomputes derived values", () => {
    const s = toTravel();
    const raw = JSON.parse(JSON.stringify(s));
    const p = raw.lessons[lesson.id];
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
    let s = run(createInitialState(), { type: "openLesson" }, { type: "startFinding", orders: ORDERS }, { type: "findGuess", country: "DEU" }, { type: "findGuess", country: "FRA" });
    const raw = JSON.parse(JSON.stringify(s));
    raw.lessons[lesson.id].find.results[0][0].independent = true;
    s = parseSavedState(JSON.stringify(raw));
    expect(progressOf(s).find?.results[0][0].independent).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { createFindOrder } from "../game/find";
import { shortestDistance } from "../game/graph";
import { seededRandom } from "../game/random";
import { LESSONS, LEVELS } from "../lessons";
import { alpsLesson as alps } from "../lessons/alps";
import { adriaticLesson as adriatic } from "../lessons/adriatic";
import { centralEuropeLesson as central } from "../lessons/central-europe";
import { westernEuropeLesson as france } from "../lessons/western-europe";
import { buildMapView } from "../lesson/mapView";
import type { LessonAction } from "../lesson/progress";
import { appReducer, canPlay, createInitialState, levelStatus, mainAction, startFindingAction, type AppAction, type AppState } from "./appState";
import { BACKUP_KEY, loadAppState, parseSavedState, saveAppState, STORAGE_KEY, type KeyValueStorage } from "./storage";

const L1 = france.id;
const L2 = alps.id;
const L3 = central.id;
const L4 = adriatic.id;
const NO_UI = { travelHintVisible: false };

const open = (levelId: string): AppAction => ({ type: "openLevel", levelId });
const restart = (levelId: string): AppAction => ({ type: "restartLevel", levelId });
const play = (action: LessonAction): AppAction => ({ type: "lesson", action });
const run = (s: AppState, ...actions: AppAction[]) => actions.reduce(appReducer, s);
/** Round-trips through JSON the way localStorage does on refresh. */
const refresh = (s: AppState) => parseSavedState(JSON.stringify(s));

/** Plays the open level from Discover to Results along `route`, answering Find at once. */
function complete(s: AppState, route: string[]): AppState {
  const lesson = LESSONS[s.levelId];
  s = run(s, play({ type: "startFinding", order: [...lesson.countries] }));
  for (const target of lesson.countries) s = run(s, play({ type: "findGuess", country: target }), play({ type: "findNext" }));
  s = run(s, play({ type: "findToTravel" }));
  for (const country of route.slice(1)) s = run(s, play({ type: "travelMove", country }));
  return s;
}

const level1Done = () => complete(run(createInitialState(), open(L1)), ["FRA", "BEL", "NLD"]);
const level2Done = () => complete(run(level1Done(), open(L2)), ["FRA", "CHE", "AUT"]);
const level3Done = () => complete(run(level2Done(), open(L3)), ["POL", "CZE", "AUT"]);

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe("levels", () => {
  it("lists five levels with stable, unique ids; Levels 1–4 are playable, Level 5 is coming soon", () => {
    expect(LEVELS.map((l) => l.number)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(5);
    expect(LEVELS.map((l) => Boolean(l.lesson))).toEqual([true, true, true, true, false]);
    expect(LEVELS.map((l) => l.id)).toEqual(["western-europe-1", "around-the-alps", "central-europe", "along-the-adriatic", "towards-greece"]);
    for (const level of LEVELS) expect(level.countries).toHaveLength(5);
    expect(LEVELS[1].countries).toEqual(["FRA", "CHE", "DEU", "AUT", "ITA"]);
    expect(LEVELS[2].countries).toEqual(["DEU", "POL", "CZE", "SVK", "AUT"]);
    expect(LEVELS[2].unlockedBy).toBe(L2);
    // Level 4 keeps the id its card had while it was coming soon.
    expect(LEVELS[3].countries).toEqual(["ITA", "SVN", "HRV", "BIH", "MNE"]);
    expect(LEVELS[3].unlockedBy).toBe(L3);
    expect(LEVELS[4].unlockedBy).toBe(L4);
  });

  it("a new player can start Level 1 only; Levels 2–4 are locked and Level 5 is coming soon", () => {
    const s = createInitialState();
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["ready", "locked", "locked", "locked", "comingSoon"]);
    expect(levelStatus(s, LEVELS[3])).toMatchObject({ kind: "locked", after: { id: L3 } });
    expect(levelStatus(s, LEVELS[2])).toMatchObject({ kind: "locked", after: { id: L2 } });
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L1 } });
  });

  it("never starts a locked or coming-soon level", () => {
    const s = createInitialState();
    for (const id of [L2, L3, "along-the-adriatic", "towards-greece", "no-such-level"]) {
      expect(canPlay(s, id)).toBe(false);
      expect(run(s, open(id))).toBe(s);
      expect(run(s, restart(id))).toBe(s);
    }
    // Level 3 stays locked until Level 2 is completed, not Level 1 alone.
    const one = level1Done();
    expect(canPlay(one, L3)).toBe(false);
    expect(run(one, open(L3))).toBe(one);
    // Level 4 stays locked until Level 3 is completed.
    const two = level2Done();
    expect(canPlay(two, L4)).toBe(false);
    expect(run(two, open(L4))).toBe(two);
    // Level 5 never starts, even once everything playable is done.
    const done = complete(run(level3Done(), open(L4)), ["ITA", "SVN", "HRV", "MNE"]);
    expect(levelStatus(done, LEVELS[4]).kind).toBe("comingSoon");
    expect(run(done, open("towards-greece"))).toBe(done);
    expect(run(done, restart("towards-greece"))).toBe(done);
    expect(mainAction(done)).toBeNull();
  });

  it("completing Level 1 unlocks Level 2, and replays or starting over never lock it again", () => {
    let s = level1Done();
    expect(levelStatus(s, LEVELS[0]).kind).toBe("completed");
    expect(levelStatus(s, LEVELS[1]).kind).toBe("ready");
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L2 } });
    s = run(s, play({ type: "replayTravel" }), play({ type: "travelMove", country: "LUX" }));
    expect(levelStatus(s, LEVELS[0])).toMatchObject({ kind: "completed", stage: "travel" });
    expect(canPlay(s, L2)).toBe(true);
    s = run(s, restart(L1));
    expect(s.levels[L1]).toMatchObject({ stage: "discover", records: { travelDone: true } });
    expect(canPlay(refresh(s), L2)).toBe(true);
  });

  it("keeps each level's progress apart; starting one over leaves the other alone", () => {
    let s = level1Done();
    s = run(s, play({ type: "replayTravel" }), play({ type: "travelMove", country: "BEL" }));
    s = run(s, open(L2), play({ type: "discoverSelect", country: "ITA" }), play({ type: "discoverSelect", country: "CHE" }));
    const l1 = s.levels[L1];
    s = run(s, play(startFindingAction(alps, seededRandom(3))), play({ type: "findHint" }));
    expect(s.levels[L1]).toBe(l1);
    expect(s.levels[L2]).toMatchObject({ stage: "find", discover: { explored: ["ITA", "CHE"] }, find: { question: { hintLevel: 1 } } });

    const again = run(s, restart(L2));
    expect(again.levels[L1]).toBe(l1);
    expect(again.levels[L2]).toMatchObject({ stage: "discover", find: null, discover: { explored: [] }, records: { discoverDone: true } });
    const other = run(s, restart(L1));
    expect(other.levels[L2]).toBe(s.levels[L2]);
    expect(other.levels[L1]).toMatchObject({ stage: "discover", travel: null, records: { travelDone: true } });
  });

  it("Replay journey changes only that level's Travel", () => {
    let s = level1Done();
    s = run(s, open(L2), play({ type: "discoverSelect", country: "AUT" }));
    s = complete(s, ["FRA", "DEU", "AUT"]);
    const l1 = s.levels[L1];
    const before = s.levels[L2];
    s = run(s, play({ type: "replayTravel" }));
    expect(s.levels[L1]).toBe(l1);
    expect(s.levels[L2]).toMatchObject({ stage: "travel", travel: { path: ["FRA"] }, find: before.find, records: before.records, lastTravelResult: before.lastTravelResult });
  });

  it("Home keeps the current level; Continue resumes the most recently active unfinished level, also after a refresh", () => {
    let s = level1Done();
    s = run(s, open(L2), play({ type: "discoverSelect", country: "CHE" }), play(startFindingAction(alps, seededRandom(1))));
    const inFind = s.levels[L2];
    s = run(s, { type: "goHome" });
    expect(s).toMatchObject({ screen: "welcome", levelId: L2 });
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L2 } });
    s = refresh(s);
    expect(s).toMatchObject({ screen: "welcome", levelId: L2 });
    s = run(s, open(L2));
    expect(s.screen).toBe("lesson");
    expect(s.levels[L2]).toEqual(inFind);

    // Visiting the completed Level 1 (at its Results) doesn't change which level Continue opens.
    s = run(s, { type: "goHome" }, open(L1));
    expect(s.levels[L1].stage).toBe("results");
    s = refresh(run(s, { type: "goHome" }));
    expect(s.levelId).toBe(L1);
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L2 } });
  });

  it("a refresh inside a level reopens that level at the same stage; the language is kept", () => {
    let s = run(level1Done(), { type: "setLocale", locale: "hy" }, open(L2), play({ type: "discoverSelect", country: "ITA" }));
    s = run(s, play(startFindingAction(alps, seededRandom(2))));
    for (let i = 0; i < 5; i++) s = run(s, play({ type: "findGuess", country: s.levels[L2].find!.question.target }), play({ type: "findNext" }));
    s = run(s, play({ type: "findToTravel" }), play({ type: "travelMove", country: "ITA" }));
    const back = refresh(s);
    expect(back).toMatchObject({ locale: "hy", screen: "lesson", levelId: L2 });
    expect(back.levels).toEqual(s.levels);
  });

  it("does not open a level from a save that claims it without its unlock", () => {
    const s = run(level1Done(), open(L2));
    const raw = JSON.parse(JSON.stringify(s));
    delete raw.levels[L1];
    const loaded = parseSavedState(JSON.stringify(raw));
    expect(loaded.screen).toBe("welcome");
    expect(canPlay(loaded, L2)).toBe(false);
    // Its progress is still kept, for when Level 1 is completed again.
    expect(loaded.levels[L2]?.started).toBe(true);
  });
});

describe("saves from before there were levels (version 1)", () => {
  const v1 = (lesson: object, extra: object = {}) =>
    JSON.stringify({ version: 1, locale: "hy", screen: "lesson", lessonId: "western-europe-1", lessons: { "western-europe-1": { lessonId: "western-europe-1", started: true, discover: { selected: "BEL", explored: ["BEL", "LUX"] }, ...lesson } }, ...extra });
  const records = (travelDone: boolean) => ({ discoverDone: true, findDone: travelDone, travelDone, lastFindScore: null, bestFindScore: null, travelWithoutHelp: false });

  it("become Level 1's progress, resuming at the same place in the same language", () => {
    const s = parseSavedState(v1({ stage: "discover", records: records(false) }));
    expect(s).toMatchObject({ version: 2, locale: "hy", screen: "lesson", levelId: L1, recent: [L1] });
    expect(s.levels[L1]).toMatchObject({ stage: "discover", discover: { selected: "BEL", explored: ["BEL", "LUX"] }, records: { discoverDone: true } });
    expect(Object.keys(s.levels)).toEqual([L1]);
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L1 } });
  });

  it("a completed Level 1 unlocks Level 2", () => {
    const s = parseSavedState(
      v1({
        stage: "results",
        find: { order: ["FRA", "BEL", "NLD", "LUX", "DEU"], index: 4, question: { target: "DEU", wrongGuesses: [], hintLevel: 0, solved: true, feedback: null }, results: ["FRA", "BEL", "NLD", "LUX", "DEU"].map((target) => ({ target, wrongGuesses: 0, hintLevel: 0 })), status: "complete" },
        travel: { missionId: "fra-to-nld", path: ["FRA", "BEL", "NLD"], hintUsed: false, undoUsed: false },
        lastTravelResult: { missionId: "fra-to-nld", route: ["FRA", "BEL", "NLD"], hintUsed: false, undoUsed: false },
        records: records(true),
      }),
    );
    expect(s.levels[L1].stage).toBe("results");
    expect(levelStatus(s, LEVELS[0]).kind).toBe("completed");
    expect(levelStatus(s, LEVELS[1]).kind).toBe("ready");
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L2 } });
  });

  it("are kept aside before the first save in the new format, never silently replaced", () => {
    const old = v1({ stage: "discover", records: records(false) });
    const storage = memoryStorage({ [STORAGE_KEY]: old });
    const s = loadAppState(storage);
    saveAppState(storage, s);
    expect(storage.data[BACKUP_KEY]).toBe(old);
    expect(JSON.parse(storage.data[STORAGE_KEY]).version).toBe(2);
    // The next load finds the new format: the backup is left as it was.
    saveAppState(storage, run(loadAppState(storage), open(L1)));
    expect(storage.data[BACKUP_KEY]).toBe(old);
  });

  it("a save from a newer version keeps the language, and is kept aside too", () => {
    const newer = JSON.stringify({ version: 3, locale: "hy", screen: "lesson", levels: {} });
    const storage = memoryStorage({ [STORAGE_KEY]: newer });
    expect(loadAppState(storage)).toEqual(createInitialState("hy"));
    expect(storage.data[BACKUP_KEY]).toBe(newer);
  });
});

describe("Level 2: Around the Alps", () => {
  it("asks five different questions, each country once, in a random order", () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const order = createFindOrder(alps.countries, seededRandom(seed));
      expect([...order].sort()).toEqual([...alps.countries].sort());
      orders.add(order.join(","));
    }
    expect(orders.size).toBeGreaterThan(20);
    let s = run(level1Done(), open(L2), play(startFindingAction(alps, seededRandom(9))));
    const asked: string[] = [];
    for (let i = 0; i < 5; i++) {
      asked.push(s.levels[L2].find!.question.target);
      s = run(s, play({ type: "findGuess", country: asked[i] }), play({ type: "findNext" }));
    }
    expect(new Set(asked).size).toBe(5);
    s = run(s, play({ type: "findToTravel" }));
    expect(s.levels[L2].records).toMatchObject({ findDone: true, lastFindScore: { independent: 5, total: 5 } });
  });

  it("gives nothing away in Find: no names, markers, colours or badges before an answer, whatever is asked", () => {
    let s = run(level1Done(), open(L2), play({ type: "discoverSelect", country: "ITA" }));
    for (let seed = 1; seed <= 5; seed++) {
      const t = run(s, play(startFindingAction(alps, seededRandom(seed))));
      const view = buildMapView(alps, t.levels[L2], NO_UI);
      expect(view).toMatchObject({ labels: [], markers: [], tones: {}, explored: [], areaHint: null, namesPublic: false, feedback: null });
    }
    s = run(s, play(startFindingAction(alps, seededRandom(1))), play({ type: "findHint" }));
    expect(buildMapView(alps, s.levels[L2], NO_UI)).toMatchObject({ labels: [], tones: {}, areaHint: null });
  });

  it("travels France → Austria in two crossings, by any of the three shortest routes", () => {
    expect(shortestDistance(alps.borders, "FRA", "AUT")).toBe(2);
    for (const via of ["CHE", "DEU", "ITA"]) {
      const s = complete(run(level1Done(), open(L2)), ["FRA", via, "AUT"]);
      expect(s.levels[L2].stage).toBe("results");
      expect(s.levels[L2].lastTravelResult).toMatchObject({ route: ["FRA", via, "AUT"], budget: 2, independent: true });
      expect(levelStatus(s, LEVELS[1]).kind).toBe("completed");
    }
  });

  it("offers every real neighbour within the level, and only those", () => {
    let s = complete(run(level1Done(), open(L2)), ["FRA"]);
    const moves = (st: AppState) => [...alps.borders[st.levels[L2].travel!.path.at(-1)!]].sort();
    expect(moves(s)).toEqual(["CHE", "DEU", "ITA"]);
    // No France–Austria or Germany–Italy border.
    expect(run(s, play({ type: "travelMove", country: "AUT" }))).toBe(s);
    s = run(s, play({ type: "travelMove", country: "DEU" }));
    expect(moves(s)).toEqual(["AUT", "CHE", "FRA"]);
    expect(run(s, play({ type: "travelMove", country: "ITA" }))).toBe(s);
    // A longer route runs out of crossings; Undo and Restart work as in Level 1, and count as help.
    s = run(s, play({ type: "travelMove", country: "CHE" }));
    expect(s.levels[L2].travel).toMatchObject({ status: "outOfCrossings" });
    s = run(s, play({ type: "travelUndo" }), play({ type: "travelRestart" }), play({ type: "travelMove", country: "CHE" }), play({ type: "travelMove", country: "AUT" }));
    expect(s.levels[L2].lastTravelResult).toMatchObject({ route: ["FRA", "CHE", "AUT"], undoUsed: true, independent: false });
  });
});

describe("Level 3: Central Europe", () => {
  /** A save written before Level 3 was playable: Levels 1 and 2 completed, nothing for Level 3. */
  const oldSave = () => {
    const raw = JSON.parse(JSON.stringify(run(level2Done(), { type: "goHome" })));
    expect(Object.keys(raw.levels).sort()).toEqual([L1, L2].sort());
    return JSON.stringify(raw);
  };

  it("an existing save with Level 2 completed unlocks it; the main action starts it", () => {
    const s = parseSavedState(oldSave());
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["completed", "completed", "ready", "locked", "comingSoon"]);
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L3 } });
    const opened = run(s, open(L3));
    expect(opened).toMatchObject({ screen: "lesson", levelId: L3, recent: [L3, L2, L1] });
    expect(opened.levels[L3]).toMatchObject({ started: true, stage: "discover", records: { travelDone: false } });
    // Nothing else in the save changed.
    expect(opened.levels[L1]).toEqual(s.levels[L1]);
    expect(opened.levels[L2]).toEqual(s.levels[L2]);
  });

  it("keeps its unlock when Levels 1 or 2 are started over, also after a refresh", () => {
    let s = run(parseSavedState(oldSave()), open(L3), play({ type: "discoverSelect", country: "POL" }));
    const l3 = s.levels[L3];
    s = run(s, restart(L2), restart(L1), play({ type: "discoverSelect", country: "BEL" }));
    s = refresh(s);
    expect(canPlay(s, L3)).toBe(true);
    expect(levelStatus(s, LEVELS[1])).toMatchObject({ kind: "completed", stage: "discover" });
    expect(levelStatus(s, LEVELS[2])).toMatchObject({ kind: "inProgress", stage: "discover" });
    expect(s.levels[L3]).toEqual(l3);
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L3 } });
  });

  it("keeps its progress apart: Home, Continue, a refresh, and starting it over", () => {
    let s = run(level2Done(), open(L3), play({ type: "discoverSelect", country: "SVK" }), play(startFindingAction(central, seededRandom(4))), play({ type: "findHint" }));
    const [l1, l2, inFind] = [s.levels[L1], s.levels[L2], s.levels[L3]];
    expect(inFind).toMatchObject({ stage: "find", discover: { explored: ["SVK"] }, find: { question: { hintLevel: 1 } }, records: { discoverDone: true } });
    s = refresh(run(s, { type: "goHome" }));
    expect(s).toMatchObject({ screen: "welcome", levelId: L3 });
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L3 } });
    expect(levelStatus(s, LEVELS[2])).toMatchObject({ kind: "inProgress", stage: "find" });
    // Visiting a completed level doesn't change which one Continue opens.
    s = refresh(run(s, open(L2), { type: "goHome" }));
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L3 } });
    s = run(s, open(L3));
    expect(s.levels[L3]).toEqual(inFind);
    expect(s.levels[L1]).toEqual(l1);
    expect(s.levels[L2]).toEqual(l2);
    // Starting Level 3 over clears only its place; its records and the other levels stay.
    const again = run(s, restart(L3));
    expect(again.levels[L3]).toMatchObject({ stage: "discover", find: null, discover: { explored: [] }, records: { discoverDone: true } });
    expect(again.levels[L1]).toBe(s.levels[L1]);
    expect(again.levels[L2]).toBe(s.levels[L2]);
  });

  it("asks five different questions, each country once, in a random order, scored out of five", () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const order = createFindOrder(central.countries, seededRandom(seed));
      expect([...order].sort()).toEqual([...central.countries].sort());
      orders.add(order.join(","));
    }
    expect(orders.size).toBeGreaterThan(20);
    let s = run(level2Done(), open(L3), play(startFindingAction(central, seededRandom(9))));
    const asked: string[] = [];
    for (let i = 0; i < 5; i++) {
      const target = s.levels[L3].find!.question.target;
      asked.push(target);
      // First question: a wrong tap, then a hint; both count as help.
      if (i === 0) s = run(s, play({ type: "findGuess", country: central.countries.find((c) => c !== target)! }), play({ type: "findHint" }));
      s = run(s, play({ type: "findGuess", country: target }), play({ type: "findNext" }));
    }
    expect(new Set(asked).size).toBe(5);
    s = run(s, play({ type: "findToTravel" }));
    expect(s.levels[L3].find!.results.map((r) => r.independent)).toEqual([false, true, true, true, true]);
    expect(s.levels[L3].records).toMatchObject({ findDone: true, lastFindScore: { independent: 4, total: 5 } });
  });

  it("gives nothing away in Find: no names, markers, colours or badges before an answer, whatever is asked", () => {
    let s = run(level2Done(), open(L3));
    for (const id of central.countries) s = run(s, play({ type: "discoverSelect", country: id }));
    for (let seed = 1; seed <= 5; seed++) {
      const t = run(s, play(startFindingAction(central, seededRandom(seed))));
      expect(buildMapView(central, t.levels[L3], NO_UI)).toMatchObject({ labels: [], markers: [], tones: {}, explored: [], areaHint: null, namesPublic: false, feedback: null });
    }
    s = run(s, play(startFindingAction(central, seededRandom(1))), play({ type: "findHint" }));
    expect(buildMapView(central, s.levels[L3], NO_UI)).toMatchObject({ labels: [], tones: {}, areaHint: null });
  });

  it("travels Poland → Austria in two crossings, by any of the three shortest routes", () => {
    expect(shortestDistance(central.borders, "POL", "AUT")).toBe(2);
    for (const via of ["CZE", "SVK", "DEU"]) {
      const s = complete(run(level2Done(), open(L3)), ["POL", via, "AUT"]);
      expect(s.levels[L3].stage).toBe("results");
      expect(s.levels[L3].lastTravelResult).toMatchObject({ route: ["POL", via, "AUT"], budget: 2, independent: true });
      expect(levelStatus(s, LEVELS[2]).kind).toBe("completed");
      expect(s.levels[L3].records).toMatchObject({ travelDone: true, travelWithoutHelp: true, bestFindScore: { independent: 5, total: 5 } });
    }
  });

  it("offers every real neighbour within the level, and only those; Hint, Undo and Restart count as help", () => {
    let s = complete(run(level2Done(), open(L3)), ["POL"]);
    const moves = (st: AppState) => [...central.borders[st.levels[L3].travel!.path.at(-1)!]].sort();
    expect(moves(s)).toEqual(["CZE", "DEU", "SVK"]);
    // No Poland–Austria or Germany–Slovakia border.
    expect(run(s, play({ type: "travelMove", country: "AUT" }))).toBe(s);
    s = run(s, play({ type: "travelMove", country: "DEU" }));
    expect(moves(s)).toEqual(["AUT", "CZE", "POL"]);
    expect(run(s, play({ type: "travelMove", country: "SVK" }))).toBe(s);
    // A longer route runs out of crossings.
    s = run(s, play({ type: "travelMove", country: "CZE" }));
    expect(s.levels[L3].travel).toMatchObject({ status: "outOfCrossings", path: ["POL", "DEU", "CZE"] });
    s = run(s, play({ type: "travelUndo" }));
    expect(s.levels[L3].travel).toMatchObject({ status: "playing", path: ["POL", "DEU"], undoUsed: true });
    s = run(s, play({ type: "travelRestart" }));
    expect(s.levels[L3].travel).toMatchObject({ path: ["POL"], undoUsed: true });
    s = run(s, play({ type: "travelMove", country: "SVK" }), play({ type: "travelMove", country: "AUT" }));
    expect(s.levels[L3].lastTravelResult).toMatchObject({ route: ["POL", "SVK", "AUT"], undoUsed: true, hintUsed: false, independent: false });
    expect(s.levels[L3].records.travelWithoutHelp).toBe(false);
    // A hint alone also counts as help; Replay journey starts Travel again and keeps the completion.
    s = run(s, play({ type: "replayTravel" }), play({ type: "travelHint" }), play({ type: "travelMove", country: "CZE" }), play({ type: "travelMove", country: "AUT" }));
    expect(s.levels[L3].lastTravelResult).toMatchObject({ route: ["POL", "CZE", "AUT"], hintUsed: true, independent: false });
    expect(levelStatus(refresh(s), LEVELS[2])).toMatchObject({ kind: "completed", stage: "results" });
  });
});

describe("Level 4: Along the Adriatic", () => {
  /** A save written before Level 4 was playable: Levels 1–3 completed, nothing for Level 4. */
  const oldSave = () => {
    const raw = JSON.parse(JSON.stringify(run(level3Done(), { type: "goHome" })));
    expect(Object.keys(raw.levels).sort()).toEqual([L1, L2, L3].sort());
    return JSON.stringify(raw);
  };

  it("an existing save with Level 3 completed unlocks it; the main action starts it", () => {
    const s = parseSavedState(oldSave());
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["completed", "completed", "completed", "ready", "comingSoon"]);
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L4 } });
    const opened = run(s, open(L4));
    expect(opened).toMatchObject({ screen: "lesson", levelId: L4, recent: [L4, L3, L2, L1] });
    expect(opened.levels[L4]).toMatchObject({ started: true, stage: "discover", records: { travelDone: false } });
    // Nothing else in the save changed.
    for (const id of [L1, L2, L3]) expect(opened.levels[id]).toEqual(s.levels[id]);
  });

  it("keeps its unlock when Level 3 is replayed or started over, also after a refresh", () => {
    let s = run(parseSavedState(oldSave()), open(L4), play({ type: "discoverSelect", country: "HRV" }));
    const l4 = s.levels[L4];
    s = run(s, open(L3), play({ type: "replayTravel" }), restart(L3), restart(L1), play({ type: "discoverSelect", country: "BEL" }));
    s = refresh(s);
    expect(canPlay(s, L4)).toBe(true);
    expect(levelStatus(s, LEVELS[2])).toMatchObject({ kind: "completed", stage: "discover" });
    expect(levelStatus(s, LEVELS[3])).toMatchObject({ kind: "inProgress", stage: "discover" });
    expect(s.levels[L4]).toEqual(l4);
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L4 } });
  });

  it("keeps its progress apart: Home, Continue, a refresh, and starting it over", () => {
    let s = run(level3Done(), open(L4), play({ type: "discoverSelect", country: "BIH" }), play(startFindingAction(adriatic, seededRandom(4))), play({ type: "findHint" }));
    const [l1, l2, l3, inFind] = [s.levels[L1], s.levels[L2], s.levels[L3], s.levels[L4]];
    expect(inFind).toMatchObject({ stage: "find", discover: { explored: ["BIH"] }, find: { question: { hintLevel: 1 } }, records: { discoverDone: true } });
    s = refresh(run(s, { type: "goHome" }));
    expect(s).toMatchObject({ screen: "welcome", levelId: L4 });
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L4 } });
    // Visiting a completed level doesn't change which one Continue opens.
    s = refresh(run(s, open(L3), { type: "goHome" }));
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L4 } });
    s = run(s, open(L4));
    expect(s.levels[L4]).toEqual(inFind);
    for (const [id, before] of [[L1, l1], [L2, l2], [L3, l3]] as const) expect(s.levels[id]).toEqual(before);
    // Starting Level 4 over clears only its place; its records and the other levels stay.
    const again = run(s, restart(L4));
    expect(again.levels[L4]).toMatchObject({ stage: "discover", find: null, discover: { explored: [] }, records: { discoverDone: true } });
    for (const id of [L1, L2, L3]) expect(again.levels[id]).toBe(s.levels[id]);
  });

  it("asks five different questions, each country once, in a random order, scored out of five", () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const order = createFindOrder(adriatic.countries, seededRandom(seed));
      expect([...order].sort()).toEqual([...adriatic.countries].sort());
      orders.add(order.join(","));
    }
    expect(orders.size).toBeGreaterThan(20);
    let s = run(level3Done(), open(L4), play(startFindingAction(adriatic, seededRandom(9))));
    const asked: string[] = [];
    for (let i = 0; i < 5; i++) {
      const target = s.levels[L4].find!.question.target;
      asked.push(target);
      // First question: a wrong tap, then a hint; both count as help.
      if (i === 0) s = run(s, play({ type: "findGuess", country: adriatic.countries.find((c) => c !== target)! }), play({ type: "findHint" }));
      s = run(s, play({ type: "findGuess", country: target }), play({ type: "findNext" }));
    }
    expect(new Set(asked).size).toBe(5);
    s = run(s, play({ type: "findToTravel" }));
    expect(s.levels[L4].find!.results.map((r) => r.independent)).toEqual([false, true, true, true, true]);
    expect(s.levels[L4].records).toMatchObject({ findDone: true, lastFindScore: { independent: 4, total: 5 } });
  });

  it("gives nothing away in Find: no names, markers, colours or badges before an answer, whatever is asked", () => {
    let s = run(level3Done(), open(L4));
    for (const id of adriatic.countries) s = run(s, play({ type: "discoverSelect", country: id }));
    for (let seed = 1; seed <= 5; seed++) {
      const t = run(s, play(startFindingAction(adriatic, seededRandom(seed))));
      expect(buildMapView(adriatic, t.levels[L4], NO_UI)).toMatchObject({ labels: [], markers: [], tones: {}, explored: [], areaHint: null, namesPublic: false, feedback: null });
    }
    s = run(s, play(startFindingAction(adriatic, seededRandom(1))), play({ type: "findHint" }));
    expect(buildMapView(adriatic, s.levels[L4], NO_UI)).toMatchObject({ labels: [], tones: {}, areaHint: null });
  });

  it("travels Italy → Montenegro in three crossings, by the one shortest route", () => {
    expect(shortestDistance(adriatic.borders, "ITA", "MNE")).toBe(3);
    const s = complete(run(level3Done(), open(L4)), ["ITA", "SVN", "HRV", "MNE"]);
    expect(s.levels[L4].stage).toBe("results");
    expect(s.levels[L4].lastTravelResult).toMatchObject({ route: ["ITA", "SVN", "HRV", "MNE"], budget: 3, independent: true });
    expect(levelStatus(s, LEVELS[3]).kind).toBe("completed");
    expect(s.levels[L4].records).toMatchObject({ travelDone: true, travelWithoutHelp: true, bestFindScore: { independent: 5, total: 5 } });
  });

  it("offers every real neighbour within the level, and only those; Hint, Undo and Restart count as help", () => {
    let s = complete(run(level3Done(), open(L4)), ["ITA"]);
    const moves = (st: AppState) => [...adriatic.borders[st.levels[L4].travel!.path.at(-1)!]].sort();
    // Italy's only neighbour here is Slovenia: no sea crossings to Croatia or Montenegro.
    expect(moves(s)).toEqual(["SVN"]);
    for (const country of ["HRV", "BIH", "MNE"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    s = run(s, play({ type: "travelMove", country: "SVN" }));
    expect(moves(s)).toEqual(["HRV", "ITA"]);
    expect(run(s, play({ type: "travelMove", country: "BIH" }))).toBe(s);
    s = run(s, play({ type: "travelMove", country: "HRV" }));
    expect(moves(s)).toEqual(["BIH", "MNE", "SVN"]);
    // Through Bosnia and Herzegovina takes four crossings: out of crossings there.
    s = run(s, play({ type: "travelMove", country: "BIH" }));
    expect(s.levels[L4].travel).toMatchObject({ status: "outOfCrossings", path: ["ITA", "SVN", "HRV", "BIH"] });
    s = run(s, play({ type: "travelUndo" }));
    expect(s.levels[L4].travel).toMatchObject({ status: "playing", path: ["ITA", "SVN", "HRV"], undoUsed: true });
    s = run(s, play({ type: "travelRestart" }));
    expect(s.levels[L4].travel).toMatchObject({ path: ["ITA"], undoUsed: true });
    s = run(s, play({ type: "travelMove", country: "SVN" }), play({ type: "travelMove", country: "HRV" }), play({ type: "travelMove", country: "MNE" }));
    expect(s.levels[L4].lastTravelResult).toMatchObject({ route: ["ITA", "SVN", "HRV", "MNE"], undoUsed: true, hintUsed: false, independent: false });
    expect(s.levels[L4].records.travelWithoutHelp).toBe(false);
    // A hint alone also counts as help; Replay journey starts Travel again and keeps the completion.
    s = run(s, play({ type: "replayTravel" }), play({ type: "travelHint" }), play({ type: "travelMove", country: "SVN" }), play({ type: "travelMove", country: "HRV" }), play({ type: "travelMove", country: "MNE" }));
    expect(s.levels[L4].lastTravelResult).toMatchObject({ hintUsed: true, independent: false });
    expect(levelStatus(refresh(s), LEVELS[3])).toMatchObject({ kind: "completed", stage: "results" });
  });
});

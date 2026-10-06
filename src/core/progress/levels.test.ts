import { describe, expect, it } from "vitest";
import { createFindOrder } from "../game/find";
import { shortestDistance } from "../game/graph";
import { availableMoves, createAttempt, isDeadEnd, move, undo } from "../game/travel";
import { seededRandom } from "../game/random";
import { CONTINENTS, getLevel, hasPlayableLevels, LESSON_VERSIONS, LESSONS, LEVELS, levelsOf } from "../lessons";
import { alpsLesson as alps } from "../lessons/alps";
import { balticJourneyLesson as baltic, balticJourneyOriginalLesson as balticOriginal } from "../lessons/baltic-journey";
import { adriaticLesson as adriatic } from "../lessons/adriatic";
import { centralEuropeLesson as central } from "../lessons/central-europe";
import { easternEuropeLesson as eastern } from "../lessons/eastern-europe";
import { iberianJourneyLesson as iberian } from "../lessons/iberian-journey";
import { towardsGreeceLesson as greece } from "../lessons/towards-greece";
import { westernEuropeLesson as france } from "../lessons/western-europe";
import { buildMapView } from "../lesson/mapView";
import type { LessonAction } from "../lesson/progress";
import {
  activeLesson,
  allLevelsComplete,
  appReducer,
  canPlay,
  continentProgress,
  createInitialState,
  levelStatus,
  levelToContinue,
  hasSavedResults,
  hasUnfinishedAttempt,
  isLevelComplete,
  nextLevel,
  mainAction,
  startFindingAction,
  versionOf,
  type AppAction,
  type AppState,
} from "./appState";
import { BACKUP_KEY, loadAppState, parseSavedState, saveAppState, STORAGE_KEY, type KeyValueStorage } from "./storage";

const L1 = france.id;
const L2 = alps.id;
const L3 = central.id;
const L4 = adriatic.id;
const L5 = greece.id;
const L6 = baltic.id;
const L7 = iberian.id;
const L8 = eastern.id;
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
const level4Done = () => complete(run(level3Done(), open(L4)), ["MNE", "HRV", "SVN", "ITA"]);
const level5Done = () => complete(run(level4Done(), open(L5)), ["HUN", "ROU", "BGR", "GRC"]);
const level6Done = () => complete(run(level5Done(), open(L6)), ["POL", "LTU", "LVA", "EST"]);
const level7Done = () => complete(run(level6Done(), open(L7)), ["PRT", "ESP", "FRA", "ITA"]);
const level8Done = () => complete(run(level7Done(), open(L8)), ["POL", "UKR", "MDA"]);

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe("levels", () => {
  it("lists eight levels with stable, unique ids, all playable", () => {
    expect(LEVELS.map((l) => l.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(8);
    expect(LEVELS.map((l) => Boolean(l.lesson))).toEqual([true, true, true, true, true, true, true, true]);
    expect(LEVELS.map((l) => l.id)).toEqual(["western-europe-1", "around-the-alps", "central-europe", "along-the-adriatic", "towards-greece", "baltic-journey", "iberian-journey", "eastern-europe"]);
    for (const level of LEVELS) expect(level.countries).toHaveLength(5);
    expect(LEVELS[1].countries).toEqual(["FRA", "CHE", "DEU", "AUT", "ITA"]);
    expect(LEVELS[2].countries).toEqual(["DEU", "POL", "CZE", "SVK", "AUT"]);
    expect(LEVELS[2].unlockedBy).toBe(L2);
    // Level 4 keeps the id its card had while it was coming soon.
    expect(LEVELS[3].countries).toEqual(["ITA", "SVN", "HRV", "BIH", "MNE"]);
    expect(LEVELS[3].unlockedBy).toBe(L3);
    // Level 5 keeps the id and the countries its card had while it was coming soon.
    expect(LEVELS[4].id).toBe("towards-greece");
    expect(LEVELS[4].countries).toEqual(["HUN", "ROU", "SRB", "BGR", "GRC"]);
    expect(LEVELS[4].unlockedBy).toBe(L4);
    // Level 6 opens after Level 5.
    expect(LEVELS[5].id).toBe("baltic-journey");
    expect(LEVELS[5].countries).toEqual(["DEU", "POL", "LTU", "LVA", "EST"]);
    expect(LEVELS[5].unlockedBy).toBe(L5);
    // Level 7 opens after Level 6.
    expect(LEVELS[6].id).toBe("iberian-journey");
    expect(LEVELS[6].countries).toEqual(["PRT", "ESP", "AND", "FRA", "ITA"]);
    expect(LEVELS[6].unlockedBy).toBe(L6);
    expect(LEVELS[6].title).toEqual({ en: "Iberian Journey", hy: "Պիրենեյան ճամփորդություն" });
    // Level 8 opens after Level 7.
    expect(LEVELS[7].id).toBe("eastern-europe");
    expect(LEVELS[7].continent).toBe("europe");
    expect(LEVELS[7].countries).toEqual(["POL", "BLR", "UKR", "MDA", "ROU"]);
    expect(LEVELS[7].unlockedBy).toBe(L7);
    expect(LEVELS[7].title).toEqual({ en: "Eastern Europe", hy: "Արևելյան Եվրոպա" });
  });

  it("a new player can start Level 1 only; Levels 2–8 are locked", () => {
    const s = createInitialState();
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["ready", "locked", "locked", "locked", "locked", "locked", "locked", "locked"]);
    expect(levelStatus(s, LEVELS[7])).toMatchObject({ kind: "locked", after: { id: L7 } });
    expect(levelStatus(s, LEVELS[6])).toMatchObject({ kind: "locked", after: { id: L6 } });
    expect(levelStatus(s, LEVELS[5])).toMatchObject({ kind: "locked", after: { id: L5 } });
    expect(levelStatus(s, LEVELS[4])).toMatchObject({ kind: "locked", after: { id: L4 } });
    expect(levelStatus(s, LEVELS[3])).toMatchObject({ kind: "locked", after: { id: L3 } });
    expect(levelStatus(s, LEVELS[2])).toMatchObject({ kind: "locked", after: { id: L2 } });
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L1 } });
  });

  it("never starts a locked level", () => {
    const s = createInitialState();
    for (const id of [L2, L3, "along-the-adriatic", "towards-greece", "baltic-journey", "iberian-journey", "eastern-europe", "no-such-level"]) {
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
    // Level 5 stays locked until Level 4 is completed.
    const three = level3Done();
    expect(canPlay(three, L5)).toBe(false);
    expect(run(three, open(L5))).toBe(three);
    expect(run(three, restart(L5))).toBe(three);
    expect(canPlay(level4Done(), L5)).toBe(true);
    // Level 6 stays locked until Level 5 is completed.
    const four = level4Done();
    expect(canPlay(four, L6)).toBe(false);
    expect(run(four, open(L6))).toBe(four);
    expect(run(four, restart(L6))).toBe(four);
    expect(canPlay(level5Done(), L6)).toBe(true);
    // Level 7 stays locked until Level 6 is completed.
    const five = level5Done();
    expect(canPlay(five, L7)).toBe(false);
    expect(run(five, open(L7))).toBe(five);
    expect(run(five, restart(L7))).toBe(five);
    expect(canPlay(level6Done(), L7)).toBe(true);
    // Level 8 stays locked until Level 7 is completed.
    const six = level6Done();
    expect(canPlay(six, L8)).toBe(false);
    expect(run(six, open(L8))).toBe(six);
    expect(run(six, restart(L8))).toBe(six);
    expect(canPlay(level7Done(), L8)).toBe(true);
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
    expect(s).toMatchObject({ screen: "continents", levelId: L2 });
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L2 } });
    s = refresh(s);
    expect(s).toMatchObject({ screen: "continents", levelId: L2 });
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
    expect(loaded.screen).toBe("continents");
    expect(canPlay(loaded, L2)).toBe(false);
    // Its progress is still kept, for when Level 1 is completed again.
    expect(loaded.levels[L2]?.started).toBe(true);
  });
});

describe("continents", () => {
  const openContinent = (continent: AppState["continent"]): AppAction => ({ type: "openContinent", continent });

  it("lists five continents in order; Europe holds the eight levels in their order, the other four are coming soon", () => {
    expect(CONTINENTS.map((c) => c.id)).toEqual(["europe", "asia", "africa", "north-america", "south-america"]);
    expect(CONTINENTS.map((c) => c.name.en)).toEqual(["Europe", "Asia", "Africa", "North America", "South America"]);
    expect(CONTINENTS.map((c) => c.name.hy)).toEqual(["Եվրոպա", "Ասիա", "Աֆրիկա", "Հյուսիսային Ամերիկա", "Հարավային Ամերիկա"]);
    expect(levelsOf("europe").map((l) => l.id)).toEqual([L1, L2, L3, L4, L5, L6, L7, L8]);
    expect(levelsOf("europe").map((l) => l.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const id of ["asia", "africa", "north-america", "south-america"] as const) {
      expect(levelsOf(id), id).toEqual([]);
      expect(hasPlayableLevels(id), id).toBe(false);
    }
    // Every level belongs to exactly one listed continent (grouped by that, not by a separate list).
    expect(LEVELS.every((l) => CONTINENTS.some((c) => c.id === l.continent))).toBe(true);
    expect(CONTINENTS.flatMap((c) => levelsOf(c.id)).length).toBe(LEVELS.length);
  });

  it("unlocks within a continent: each continent's first level is open, and no level waits for another continent's", () => {
    for (const continent of CONTINENTS) {
      const levels = levelsOf(continent.id);
      levels.forEach((level, i) => {
        expect(level.number, level.id).toBe(i + 1);
        if (i === 0) expect(level.unlockedBy, level.id).toBeUndefined();
        else expect(levels.slice(0, i).map((l) => l.id), level.id).toContain(level.unlockedBy);
      });
    }
    // The chain of the first seven levels is unchanged; Level 8 follows Level 7.
    expect(levelsOf("europe").map((l) => l.unlockedBy ?? null)).toEqual([null, L1, L2, L3, L4, L5, L6, L7]);
  });

  it("navigates continents → a continent's levels → a level, and Home and Back return to the continents", () => {
    let s = createInitialState();
    expect(s).toMatchObject({ screen: "continents", continent: "europe" });
    // Coming soon: nothing to open.
    for (const id of ["asia", "africa", "north-america", "south-america"] as const) expect(run(s, openContinent(id))).toBe(s);
    s = run(s, openContinent("europe"));
    expect(s).toMatchObject({ screen: "levels", continent: "europe" });
    expect(refresh(s)).toMatchObject({ screen: "levels", continent: "europe" });
    expect(run(s, { type: "goHome" }).screen).toBe("continents");
    s = run(s, open(L1));
    expect(s).toMatchObject({ screen: "lesson", continent: "europe", levelId: L1 });
    s = run(s, { type: "goHome" });
    expect(s.screen).toBe("continents");
    expect(refresh(s).screen).toBe("continents");
  });

  it("reopens a save's screen: a level, a continent's levels, or the continents; a save from before continents opens Europe's levels", () => {
    const base = run(createInitialState(), open(L1));
    const saved = (screen: string, extra: object = {}) => parseSavedState(JSON.stringify({ ...base, screen, ...extra }));
    expect(saved("lesson")).toMatchObject({ screen: "lesson", continent: "europe" });
    expect(saved("levels")).toMatchObject({ screen: "levels", continent: "europe" });
    expect(saved("continents").screen).toBe("continents");
    // Before continents: "welcome" was the level selection, Europe's levels only; no continent field.
    const { continent: _ignored, ...old } = { ...base, screen: "welcome" };
    void _ignored;
    expect(parseSavedState(JSON.stringify(old))).toMatchObject({ screen: "levels", continent: "europe" });
    // A continent with nothing to play, or an unknown one, opens the continents instead.
    expect(saved("levels", { continent: "asia" }).screen).toBe("continents");
    expect(saved("levels", { continent: "atlantis" })).toMatchObject({ screen: "continents", continent: "europe" });
    expect(saved("somewhere").screen).toBe("continents");
  });

  it("counts a continent's completed levels from the permanent records: replays and starting over never lower it", () => {
    expect(continentProgress(createInitialState(), "europe")).toEqual({ total: 8, completed: 0 });
    let s = level3Done();
    expect(continentProgress(s, "europe")).toEqual({ total: 8, completed: 3 });
    for (const id of [L1, L2, L3]) {
      s = run(s, restart(id));
      expect(continentProgress(s, "europe"), id).toEqual({ total: 8, completed: 3 });
    }
    expect(continentProgress(refresh(s), "europe")).toEqual({ total: 8, completed: 3 });
    expect(continentProgress(level7Done(), "europe")).toEqual({ total: 8, completed: 7 });
    expect(continentProgress(level8Done(), "europe")).toEqual({ total: 8, completed: 8 });
    for (const id of ["asia", "africa", "north-america", "south-america"] as const) expect(continentProgress(s, id)).toEqual({ total: 0, completed: 0 });
  });

  it("Continue on the continents resumes the most recently active unfinished level at exactly its place", () => {
    expect(levelToContinue(createInitialState())).toBeNull();
    let s = run(level2Done(), open(L3), play({ type: "discoverSelect", country: "POL" }), play(startFindingAction(central, seededRandom(4))));
    s = run(s, play({ type: "findGuess", country: s.levels[L3].find!.question.target }));
    const inFind = s.levels[L3];
    s = refresh(run(s, { type: "goHome" }));
    expect(s.screen).toBe("continents");
    expect(levelToContinue(s)?.id).toBe(L3);
    s = run(s, open(levelToContinue(s)!.id));
    expect(s).toMatchObject({ screen: "lesson", levelId: L3 });
    expect(s.levels[L3]).toEqual(inFind);
    // Once all are completed, every finished attempt is at Results: nothing to continue. Playing one again
    // (Play again, or Replay journey) starts an attempt that Continue then resumes, at exactly its place.
    expect(levelToContinue(level8Done())).toBeNull();
    const again = run(level8Done(), restart(L2), play({ type: "discoverSelect", country: "CHE" }), { type: "goHome" });
    expect(levelToContinue(again)?.id).toBe(L2);
    expect(run(again, open(L2)).levels[L2]).toEqual(again.levels[L2]);
    const travel = run(level8Done(), open(L5), play({ type: "replayTravel" }), { type: "goHome" });
    expect(travel.levels[L5]).toMatchObject({ stage: "travel", records: { travelDone: true } });
    expect(levelToContinue(travel)?.id).toBe(L5);
  });

  it("offers Continue only for an attempt under way: never for a finished one at Results", () => {
    let s = level2Done();
    expect(s.levels[L2]).toMatchObject({ stage: "results", started: true });
    expect(hasUnfinishedAttempt(s, L2)).toBe(false);
    expect(hasUnfinishedAttempt(s, L3)).toBe(false);
    s = run(s, open(L3));
    expect(hasUnfinishedAttempt(s, L3)).toBe(true);
    // Replay journey on a finished level: an attempt under way again, until its journey ends.
    s = run(s, open(L2), play({ type: "replayTravel" }));
    expect(hasUnfinishedAttempt(s, L2)).toBe(true);
    expect(levelToContinue(s)?.id).toBe(L2);
  });

  it("View results: a finished attempt with saved Results reopens them unchanged; a completion record alone has none", () => {
    const s = level2Done();
    expect(hasSavedResults(s, L2)).toBe(true);
    const viewed = run(s, open(L2));
    expect(viewed).toMatchObject({ screen: "lesson", levelId: L2 });
    expect(viewed.levels[L2]).toEqual(s.levels[L2]);
    expect(viewed.levels[L1]).toEqual(s.levels[L1]);
    // A replay under way: Continue, not View results.
    expect(hasSavedResults(run(s, open(L2), play({ type: "replayTravel" })), L2)).toBe(false);
    // Never started, or in progress: none.
    expect(hasSavedResults(s, L3)).toBe(false);
    expect(hasSavedResults(run(s, open(L3)), L3)).toBe(false);
    // An older save with only the completion record (or Results without their route) keeps no Results: none are made up.
    const records = { discoverDone: true, findDone: true, travelDone: true, lastFindScore: null, bestFindScore: null, travelWithoutHelp: false };
    for (const level of [{ started: false, stage: "discover", records }, { started: true, stage: "results", records }]) {
      const old = parseSavedState(JSON.stringify({ version: 2, locale: "en", screen: "levels", continent: "europe", levelId: L1, recent: [L1], levels: { [L1]: level } }));
      expect(levelStatus(old, getLevel(L1)!).kind).toBe("completed");
      expect(hasSavedResults(old, L1)).toBe(false);
    }
  });

  it("Next level from Results: the next playable level of the continent, never a coming-soon one", () => {
    expect(nextLevel(level2Done(), L2)?.id).toBe(L3);
    expect(nextLevel(level2Done(), L1)?.id).toBe(L2);
    // Level 7's is Level 8; the last playable level has none.
    expect(nextLevel(level7Done(), L7)?.id).toBe(L8);
    expect(nextLevel(level8Done(), L8)).toBeNull();
    // A level still locked is never offered.
    expect(nextLevel(createInitialState(), L1)).toBeNull();
    // Opening it: Discover if never started, its saved place otherwise (opening never resets it).
    const fresh = run(level2Done(), open(L3));
    expect(fresh.levels[L3]).toMatchObject({ started: true, stage: "discover" });
    const placed = run(fresh, play({ type: "discoverSelect", country: "POL" }), open(L2), open(L3));
    expect(placed.levels[L3]).toEqual(run(fresh, play({ type: "discoverSelect", country: "POL" })).levels[L3]);
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
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["completed", "completed", "ready", "locked", "locked", "locked", "locked", "locked"]);
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
    // Level 1, started over last, is the most recent attempt under way: Continue resumes it, and
    // Level 3 keeps its place for when it is opened again.
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L1 } });
    expect(run(s, open(L3)).levels[L3]).toEqual(l3);
  });

  it("keeps its progress apart: Home, Continue, a refresh, and starting it over", () => {
    let s = run(level2Done(), open(L3), play({ type: "discoverSelect", country: "SVK" }), play(startFindingAction(central, seededRandom(4))), play({ type: "findHint" }));
    const [l1, l2, inFind] = [s.levels[L1], s.levels[L2], s.levels[L3]];
    expect(inFind).toMatchObject({ stage: "find", discover: { explored: ["SVK"] }, find: { question: { hintLevel: 1 } }, records: { discoverDone: true } });
    s = refresh(run(s, { type: "goHome" }));
    expect(s).toMatchObject({ screen: "continents", levelId: L3 });
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
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["completed", "completed", "completed", "ready", "locked", "locked", "locked", "locked"]);
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
    // Level 1, started over last, is the most recent attempt under way (see Level 3's test above).
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L1 } });
    expect(run(s, open(L4)).levels[L4]).toEqual(l4);
  });

  it("keeps its progress apart: Home, Continue, a refresh, and starting it over", () => {
    let s = run(level3Done(), open(L4), play({ type: "discoverSelect", country: "BIH" }), play(startFindingAction(adriatic, seededRandom(4))), play({ type: "findHint" }));
    const [l1, l2, l3, inFind] = [s.levels[L1], s.levels[L2], s.levels[L3], s.levels[L4]];
    expect(inFind).toMatchObject({ stage: "find", discover: { explored: ["BIH"] }, find: { question: { hintLevel: 1 } }, records: { discoverDone: true } });
    s = refresh(run(s, { type: "goHome" }));
    expect(s).toMatchObject({ screen: "continents", levelId: L4 });
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

  it("travels Montenegro → Italy in three crossings, by the one shortest route", () => {
    expect(adriatic.travel.mission).toMatchObject({ id: "mne-to-ita", from: "MNE", to: "ITA" });
    expect(shortestDistance(adriatic.borders, "MNE", "ITA")).toBe(3);
    const s = complete(run(level3Done(), open(L4)), ["MNE", "HRV", "SVN", "ITA"]);
    expect(s.levels[L4].stage).toBe("results");
    expect(s.levels[L4].lastTravelResult).toMatchObject({ missionId: "mne-to-ita", route: ["MNE", "HRV", "SVN", "ITA"], budget: 3, independent: true });
    expect(levelStatus(s, LEVELS[3]).kind).toBe("completed");
    expect(s.levels[L4].records).toMatchObject({ travelDone: true, travelWithoutHelp: true, bestFindScore: { independent: 5, total: 5 } });
  });

  it("offers every real neighbour within the level not yet on the route; the longer way and the dead end both stay possible; Hint, Undo and Restart count as help", () => {
    let s = complete(run(level3Done(), open(L4)), ["MNE"]);
    const neighbours = (st: AppState) => [...adriatic.borders[st.levels[L4].travel!.path.at(-1)!]].sort();
    const offered = (st: AppState) => [...availableMoves(st.levels[L4].travel!, adriatic.borders)].sort();
    // Montenegro meets Croatia and Bosnia and Herzegovina; no sea crossing to Italy.
    expect(neighbours(s)).toEqual(["BIH", "HRV"]);
    expect(offered(s)).toEqual(["BIH", "HRV"]);
    for (const country of ["ITA", "SVN"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    // Through Bosnia and Herzegovina first: real borders, but out of crossings in Slovenia.
    s = run(s, play({ type: "travelMove", country: "BIH" }));
    expect(offered(s)).toEqual(["HRV"]);
    s = run(s, play({ type: "travelMove", country: "HRV" }));
    expect(offered(s)).toEqual(["SVN"]);
    s = run(s, play({ type: "travelMove", country: "SVN" }));
    expect(s.levels[L4].travel).toMatchObject({ status: "outOfCrossings", path: ["MNE", "BIH", "HRV", "SVN"] });
    s = run(s, play({ type: "travelUndo" }));
    expect(s.levels[L4].travel).toMatchObject({ status: "playing", path: ["MNE", "BIH", "HRV"], undoUsed: true });
    s = run(s, play({ type: "travelRestart" }));
    expect(s.levels[L4].travel).toMatchObject({ path: ["MNE"], undoUsed: true });
    // Into Bosnia and Herzegovina from Croatia: a dead end with a crossing left.
    s = run(s, play({ type: "travelMove", country: "HRV" }));
    expect(neighbours(s)).toEqual(["BIH", "MNE", "SVN"]);
    expect(offered(s)).toEqual(["BIH", "SVN"]);
    s = run(s, play({ type: "travelMove", country: "BIH" }));
    expect(s.levels[L4].travel).toMatchObject({ status: "playing", path: ["MNE", "HRV", "BIH"] });
    expect(isDeadEnd(s.levels[L4].travel!, adriatic.borders)).toBe(true);
    expect(refresh(s).levels[L4].travel).toMatchObject({ status: "playing", path: ["MNE", "HRV", "BIH"] });
    s = run(s, play({ type: "travelUndo" }), play({ type: "travelMove", country: "SVN" }), play({ type: "travelMove", country: "ITA" }));
    expect(s.levels[L4].lastTravelResult).toMatchObject({ missionId: "mne-to-ita", route: ["MNE", "HRV", "SVN", "ITA"], undoUsed: true, hintUsed: false, independent: false });
    expect(s.levels[L4].records.travelWithoutHelp).toBe(false);
    // A hint alone also counts as help; Replay journey starts Travel again and keeps the completion.
    s = run(s, play({ type: "replayTravel" }), play({ type: "travelHint" }), play({ type: "travelMove", country: "HRV" }), play({ type: "travelMove", country: "SVN" }), play({ type: "travelMove", country: "ITA" }));
    expect(s.levels[L4].lastTravelResult).toMatchObject({ hintUsed: true, independent: false });
    expect(levelStatus(refresh(s), LEVELS[3])).toMatchObject({ kind: "completed", stage: "results" });
  });

  describe("saves from when the journey ran Italy → Montenegro", () => {
    const OLD = "ita-to-mne";
    /** Level 4 saved on the earlier journey: `path` under way, or finished along `path` at its Results. */
    const oldSave = (path: string[], { results = false, undoUsed = false } = {}) => {
      const raw = JSON.parse(JSON.stringify(level3Done()));
      const order = [...adriatic.countries];
      raw.levelId = L4;
      raw.levels[L4] = {
        started: true,
        stage: results ? "results" : "travel",
        discover: { selected: null, explored: order },
        find: { order, index: 4, question: { target: order[4], wrongGuesses: [], hintLevel: 0, solved: true, feedback: null }, results: order.map((target) => ({ target, wrongGuesses: 0, hintLevel: 0 })), status: "complete" },
        travel: { missionId: OLD, path, hintUsed: false, undoUsed },
        lastTravelResult: results ? { missionId: OLD, route: path, hintUsed: false, undoUsed } : null,
        records: { discoverDone: true, findDone: true, travelDone: results, lastFindScore: { independent: 5, total: 5 }, bestFindScore: { independent: 5, total: 5 }, travelWithoutHelp: results && !undoUsed, ...(results ? { bestRating: 3 } : {}) },
      };
      return parseSavedState(JSON.stringify(raw))!;
    };

    it("keeps a journey under way on its own endpoints; Undo and Restart stay on it, and it finishes in Montenegro", () => {
      let s = oldSave(["ITA", "SVN"]);
      expect(s.levels[L4].stage).toBe("travel");
      expect(s.levels[L4].travel).toMatchObject({ missionId: OLD, from: "ITA", to: "MNE", budget: 3, path: ["ITA", "SVN"], status: "playing" });
      expect(availableMoves(s.levels[L4].travel!, adriatic.borders)).toEqual(["HRV"]);
      s = run(s, play({ type: "travelMove", country: "HRV" }), play({ type: "travelUndo" }), play({ type: "travelRestart" }));
      expect(s.levels[L4].travel).toMatchObject({ missionId: OLD, from: "ITA", to: "MNE", path: ["ITA"], undoUsed: true });
      s = run(s, ...["SVN", "HRV", "MNE"].map((country) => play({ type: "travelMove", country })));
      expect(s.levels[L4].stage).toBe("results");
      expect(s.levels[L4].lastTravelResult).toMatchObject({ missionId: OLD, route: ["ITA", "SVN", "HRV", "MNE"], budget: 3, undoUsed: true });
      expect(levelStatus(s, LEVELS[3]).kind).toBe("completed");
      // Saved and read again: still the earlier journey.
      expect(refresh(s).levels[L4].lastTravelResult).toMatchObject({ missionId: OLD, route: ["ITA", "SVN", "HRV", "MNE"] });
    });

    it("keeps finished Results, score, stars and unlock; Replay journey and Play again take Montenegro → Italy", () => {
      let s = oldSave(["ITA", "SVN", "HRV", "MNE"], { results: true });
      expect(s.levels[L4].stage).toBe("results");
      expect(s.levels[L4].travel).toMatchObject({ missionId: OLD, status: "arrived", path: ["ITA", "SVN", "HRV", "MNE"] });
      expect(s.levels[L4].lastTravelResult).toMatchObject({ missionId: OLD, route: ["ITA", "SVN", "HRV", "MNE"], budget: 3, independent: true });
      expect(s.levels[L4].records).toMatchObject({ travelDone: true, travelWithoutHelp: true, bestRating: 3 });
      expect(levelStatus(s, LEVELS[3]).kind).toBe("completed");
      expect(levelStatus(s, LEVELS[4]).kind).toBe("ready");
      // Replay journey: the current journey; the earlier Results stay until it arrives.
      const replay = run(s, play({ type: "replayTravel" }));
      expect(replay.levels[L4].travel).toMatchObject({ missionId: "mne-to-ita", from: "MNE", to: "ITA", path: ["MNE"] });
      expect(replay.levels[L4].lastTravelResult).toMatchObject({ missionId: OLD });
      // Play again: from Discover, its next journey the current one; completion and stars kept.
      s = run(s, restart(L4));
      expect(s.levels[L4].travel).toBeNull();
      expect(s.levels[L4].records).toMatchObject({ travelDone: true, bestRating: 3 });
      s = complete(s, ["MNE"]);
      expect(s.levels[L4].travel).toMatchObject({ missionId: "mne-to-ita", path: ["MNE"] });
    });

    it("drops a journey id the level never offered, as before, without touching the rest", () => {
      const raw = JSON.parse(JSON.stringify(oldSave(["ITA", "SVN"])));
      raw.levels[L4].travel.missionId = "ita-to-bih";
      const s = parseSavedState(JSON.stringify(raw))!;
      expect(s.levels[L4].travel).toBeNull();
      expect(s.levels[L4].stage).toBe("discover");
      expect(levelStatus(s, LEVELS[2]).kind).toBe("completed");
    });
  });
});

describe("Level 5: Towards Greece", () => {
  /** A save written before Level 5 was playable: Levels 1–4 completed, nothing for Level 5. */
  const oldSave = () => {
    const raw = JSON.parse(JSON.stringify(run(level4Done(), { type: "goHome" })));
    expect(Object.keys(raw.levels).sort()).toEqual([L1, L2, L3, L4].sort());
    return JSON.stringify(raw);
  };
  it("an existing save with Level 4 completed unlocks it; the main action starts it", () => {
    const s = parseSavedState(oldSave());
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["completed", "completed", "completed", "completed", "ready", "locked", "locked", "locked"]);
    expect(allLevelsComplete(s)).toBe(false);
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L5 } });
    const opened = run(s, open(L5));
    expect(opened).toMatchObject({ screen: "lesson", levelId: L5, recent: [L5, L4, L3, L2, L1] });
    expect(opened.levels[L5]).toMatchObject({ started: true, stage: "discover", records: { travelDone: false } });
    for (const id of [L1, L2, L3, L4]) expect(opened.levels[id]).toEqual(s.levels[id]);
  });

  it("keeps its unlock and its progress when Level 4 is replayed or started over, also after a refresh", () => {
    let s = run(parseSavedState(oldSave()), open(L5), play({ type: "discoverSelect", country: "GRC" }));
    const l5 = s.levels[L5];
    s = refresh(run(s, open(L4), play({ type: "replayTravel" }), restart(L4), { type: "goHome" }));
    expect(canPlay(s, L5)).toBe(true);
    expect(s.levels[L5]).toEqual(l5);
    // Level 4, started over last, is the most recent attempt under way; Level 5 keeps its place.
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L4 } });
    expect(run(s, open(L5)).levels[L5]).toEqual(l5);
  });

  it("travels Hungary → Greece in three crossings, by either shortest route", () => {
    expect(shortestDistance(greece.borders, "HUN", "GRC")).toBe(3);
    for (const route of [["HUN", "ROU", "BGR", "GRC"], ["HUN", "SRB", "BGR", "GRC"]]) {
      const s = complete(run(level4Done(), open(L5)), route);
      expect(s.levels[L5].lastTravelResult).toMatchObject({ route, budget: 3, independent: true });
      expect(levelStatus(s, LEVELS[4]).kind).toBe("completed");
    }
  });

  it("offers every real neighbour within the level, and only those; Undo and Restart count as help", () => {
    let s = complete(run(level4Done(), open(L5)), ["HUN"]);
    const moves = (st: AppState) => [...greece.borders[st.levels[L5].travel!.path.at(-1)!]].sort();
    expect(moves(s)).toEqual(["ROU", "SRB"]);
    // Hungary meets neither Bulgaria nor Greece.
    for (const country of ["BGR", "GRC"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    s = run(s, play({ type: "travelMove", country: "SRB" }));
    expect(moves(s)).toEqual(["BGR", "HUN", "ROU"]);
    // Serbia doesn't meet Greece (North Macedonia lies between, outside the level).
    expect(run(s, play({ type: "travelMove", country: "GRC" }))).toBe(s);
    // Sideways into Romania: then Bulgaria is two crossings on, with one left.
    s = run(s, play({ type: "travelMove", country: "ROU" }));
    expect(moves(s)).toEqual(["BGR", "HUN", "SRB"]);
    s = run(s, play({ type: "travelMove", country: "BGR" }));
    expect(s.levels[L5].travel).toMatchObject({ status: "outOfCrossings", path: ["HUN", "SRB", "ROU", "BGR"] });
    s = run(s, play({ type: "travelUndo" }), play({ type: "travelUndo" }));
    expect(s.levels[L5].travel).toMatchObject({ status: "playing", path: ["HUN", "SRB"], undoUsed: true });
    s = refresh(s);
    expect(s.levels[L5].travel).toMatchObject({ path: ["HUN", "SRB"], undoUsed: true });
    s = run(s, play({ type: "travelRestart" }));
    expect(s.levels[L5].travel).toMatchObject({ path: ["HUN"], undoUsed: true });
    s = run(s, play({ type: "travelMove", country: "ROU" }), play({ type: "travelMove", country: "BGR" }));
    // Greece's only neighbour here is Bulgaria.
    expect(moves(s)).toEqual(["GRC", "ROU", "SRB"]);
    s = run(s, play({ type: "travelMove", country: "GRC" }));
    expect(moves(s)).toEqual(["BGR"]);
    expect(s.levels[L5].lastTravelResult).toMatchObject({ route: ["HUN", "ROU", "BGR", "GRC"], undoUsed: true, independent: false });
  });

  it("asks five different questions, each country once, and gives nothing away before an answer", () => {
    let s = run(level4Done(), open(L5));
    for (const id of greece.countries) s = run(s, play({ type: "discoverSelect", country: id }));
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) orders.add(createFindOrder(greece.countries, seededRandom(seed)).join(","));
    expect(orders.size).toBeGreaterThan(20);
    for (let seed = 1; seed <= 5; seed++) {
      const t = run(s, play(startFindingAction(greece, seededRandom(seed))));
      expect(buildMapView(greece, t.levels[L5], NO_UI)).toMatchObject({ labels: [], markers: [], tones: {}, explored: [], areaHint: null, namesPublic: false, feedback: null });
    }
    s = run(s, play(startFindingAction(greece, seededRandom(2))), play({ type: "findHint" }));
    expect(buildMapView(greece, s.levels[L5], NO_UI)).toMatchObject({ labels: [], tones: {}, areaHint: null });
    const asked: string[] = [];
    for (let i = 0; i < 5; i++) {
      const target = s.levels[L5].find!.question.target;
      asked.push(target);
      s = run(s, play({ type: "findGuess", country: target }), play({ type: "findNext" }));
    }
    expect([...asked].sort()).toEqual([...greece.countries].sort());
    s = run(s, play({ type: "findToTravel" }));
    expect(s.levels[L5].records).toMatchObject({ findDone: true, lastFindScore: { independent: 4, total: 5 } });
  });

  it("completing it unlocks Level 6, which the main action starts", () => {
    const s = refresh(run(level5Done(), { type: "goHome" }));
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["completed", "completed", "completed", "completed", "completed", "ready", "locked", "locked"]);
    expect(allLevelsComplete(s)).toBe(false);
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L6 } });
  });
});

describe("Level 6: Baltic Journey", () => {
  /** A save written before Level 6 existed: Levels 1–5 completed, nothing for Level 6. */
  const oldSave = () => {
    const raw = JSON.parse(JSON.stringify(run(level5Done(), { type: "goHome" })));
    expect(Object.keys(raw.levels).sort()).toEqual([L1, L2, L3, L4, L5].sort());
    return JSON.stringify(raw);
  };

  it("an existing save with Level 5 completed unlocks it, with every earlier level's progress intact; the main action starts it", () => {
    const before = JSON.parse(oldSave());
    const s = parseSavedState(oldSave());
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["completed", "completed", "completed", "completed", "completed", "ready", "locked", "locked"]);
    expect(allLevelsComplete(s)).toBe(false);
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L6 } });
    for (const id of [L1, L2, L3, L4, L5]) expect(JSON.parse(JSON.stringify(s.levels[id]))).toEqual(before.levels[id]);
    const opened = run(s, open(L6));
    expect(opened).toMatchObject({ screen: "lesson", levelId: L6, recent: [L6, L5, L4, L3, L2, L1] });
    expect(opened.levels[L6]).toMatchObject({ started: true, stage: "discover", records: { travelDone: false } });
    for (const id of [L1, L2, L3, L4, L5]) expect(opened.levels[id]).toEqual(s.levels[id]);
  });

  it("keeps its unlock and its progress apart: Home, Continue, a refresh, starting it or Level 5 over", () => {
    let s = run(parseSavedState(oldSave()), open(L6), play({ type: "discoverSelect", country: "EST" }));
    const l6 = s.levels[L6];
    s = refresh(run(s, { type: "goHome" }));
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L6 } });
    expect(levelStatus(s, LEVELS[5])).toMatchObject({ kind: "inProgress", stage: "discover" });
    expect(s.levels[L6]).toEqual(l6);
    // Level 5 replayed and started over: Level 6 stays open, its place kept.
    s = refresh(run(s, open(L5), play({ type: "replayTravel" }), restart(L5), { type: "goHome" }));
    expect(canPlay(s, L6)).toBe(true);
    expect(s.levels[L6]).toEqual(l6);
    // Continue resumes Level 6 where it was; a refresh inside it reopens it there.
    s = refresh(run(s, open(L6)));
    expect(s).toMatchObject({ screen: "lesson", levelId: L6 });
    expect(s.levels[L6].discover.selected).toBe("EST");
    // Starting Level 6 over clears only its place.
    const over = run(s, restart(L6));
    expect(over.levels[L6]).toMatchObject({ stage: "discover", discover: { selected: null, explored: [] } });
    for (const id of [L1, L2, L3, L4, L5]) expect(over.levels[id]).toBe(s.levels[id]);
  });

  it("travels Poland → Estonia in three crossings, by either shortest route: Lithuania or Belarus, then Latvia", () => {
    expect(baltic.revision).toBe(2);
    expect(baltic.countries).toEqual(["POL", "BLR", "LTU", "LVA", "EST"]);
    expect(baltic.travel.mission).toEqual({ id: "pol-to-est", from: "POL", to: "EST" });
    expect(shortestDistance(baltic.borders, "POL", "EST")).toBe(3);
    for (const route of [
      ["POL", "LTU", "LVA", "EST"],
      ["POL", "BLR", "LVA", "EST"],
    ]) {
      const s = complete(run(level5Done(), open(L6)), route);
      expect(s.levels[L6]).toMatchObject({ revision: 2, stage: "results" });
      expect(s.levels[L6].lastTravelResult).toMatchObject({ missionId: "pol-to-est", route, budget: 3, independent: true });
      expect(levelStatus(s, LEVELS[5]).kind).toBe("completed");
    }
  });

  it("offers every real neighbour within the level not yet on the route, wrong turns included; a wrong turn runs out of crossings; Undo and Restart count as help", () => {
    let s = complete(run(level5Done(), open(L6)), ["POL"]);
    const neighbours = (st: AppState) => [...baltic.borders[st.levels[L6].travel!.path.at(-1)!]].sort();
    const offered = (st: AppState) => [...availableMoves(st.levels[L6].travel!, baltic.borders)].sort();
    // Both ways north are offered, and both are right.
    expect(neighbours(s)).toEqual(["BLR", "LTU"]);
    expect(offered(s)).toEqual(["BLR", "LTU"]);
    // Poland meets neither Latvia nor Estonia.
    for (const country of ["LVA", "EST"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    s = run(s, play({ type: "travelMove", country: "LTU" }));
    expect(neighbours(s)).toEqual(["BLR", "LVA", "POL"]);
    // Poland is on the route: not offered, and never entered again. Belarus is: the wrong turn.
    expect(offered(s)).toEqual(["BLR", "LVA"]);
    expect(run(s, play({ type: "travelMove", country: "POL" }))).toBe(s);
    // Lithuania doesn't meet Estonia (Latvia lies between).
    expect(run(s, play({ type: "travelMove", country: "EST" }))).toBe(s);
    s = run(s, play({ type: "travelMove", country: "BLR" }));
    expect(s.levels[L6].travel).toMatchObject({ status: "playing", path: ["POL", "LTU", "BLR"] });
    expect(offered(s)).toEqual(["LVA"]);
    s = run(s, play({ type: "travelMove", country: "LVA" }));
    // In Latvia with no crossing left, one short of Estonia: nothing more is offered.
    expect(s.levels[L6].travel).toMatchObject({ status: "outOfCrossings", path: ["POL", "LTU", "BLR", "LVA"] });
    expect(offered(s)).toEqual([]);
    expect(isDeadEnd(s.levels[L6].travel!, baltic.borders)).toBe(false);
    s = run(s, play({ type: "travelUndo" }), play({ type: "travelUndo" }));
    expect(s.levels[L6].travel).toMatchObject({ status: "playing", path: ["POL", "LTU"], undoUsed: true });
    expect(offered(s)).toEqual(["BLR", "LVA"]);
    s = run(s, play({ type: "travelMove", country: "LVA" }));
    s = refresh(s);
    expect(s.levels[L6].travel).toMatchObject({ path: ["POL", "LTU", "LVA"], undoUsed: true });
    // From Latvia: Estonia, or Belarus, back south.
    expect(neighbours(s)).toEqual(["BLR", "EST", "LTU"]);
    expect(offered(s)).toEqual(["BLR", "EST"]);
    s = run(s, play({ type: "travelRestart" }));
    expect(s.levels[L6].travel).toMatchObject({ path: ["POL"], undoUsed: true });
    // The other way: Belarus, where Lithuania is the wrong turn.
    s = run(s, play({ type: "travelMove", country: "BLR" }));
    expect(neighbours(s)).toEqual(["LTU", "LVA", "POL"]);
    expect(offered(s)).toEqual(["LTU", "LVA"]);
    s = run(s, play({ type: "travelMove", country: "LVA" }));
    expect(offered(s)).toEqual(["EST", "LTU"]);
    s = run(s, play({ type: "travelMove", country: "EST" }));
    // Estonia's only neighbour here is Latvia.
    expect(neighbours(s)).toEqual(["LVA"]);
    expect(s.levels[L6].lastTravelResult).toMatchObject({ route: ["POL", "BLR", "LVA", "EST"], undoUsed: true, independent: false });
  });

  it("never reaches a dead end with crossings left: every wrong turn ends out of crossings", () => {
    const ends: string[] = [];
    const walk = (attempt: ReturnType<typeof createAttempt>) => {
      expect(isDeadEnd(attempt, baltic.borders), attempt.path.join(">")).toBe(false);
      if (attempt.status !== "playing") return ends.push(`${attempt.path.join(">")} ${attempt.status}`);
      for (const next of availableMoves(attempt, baltic.borders)) walk(move(attempt, baltic.borders, next).attempt);
    };
    walk(createAttempt(baltic.borders, baltic.travel.mission));
    expect(ends.filter((e) => e.endsWith("arrived")).sort()).toEqual(["POL>BLR>LVA>EST arrived", "POL>LTU>LVA>EST arrived"]);
    expect(ends.filter((e) => !e.endsWith("arrived")).sort()).toEqual([
      "POL>BLR>LTU>LVA outOfCrossings",
      "POL>BLR>LVA>LTU outOfCrossings",
      "POL>LTU>BLR>LVA outOfCrossings",
      "POL>LTU>LVA>BLR outOfCrossings",
    ]);
  });

  it("asks five different questions, each country once, and gives nothing away before an answer", () => {
    let s = run(level5Done(), open(L6));
    for (const id of baltic.countries) s = run(s, play({ type: "discoverSelect", country: id }));
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) orders.add(createFindOrder(baltic.countries, seededRandom(seed)).join(","));
    expect(orders.size).toBeGreaterThan(20);
    for (let seed = 1; seed <= 5; seed++) {
      const t = run(s, play(startFindingAction(baltic, seededRandom(seed))));
      expect(buildMapView(baltic, t.levels[L6], NO_UI)).toMatchObject({ labels: [], markers: [], tones: {}, explored: [], areaHint: null, namesPublic: false, feedback: null });
    }
    s = run(s, play(startFindingAction(baltic, seededRandom(2))), play({ type: "findHint" }));
    expect(buildMapView(baltic, s.levels[L6], NO_UI)).toMatchObject({ labels: [], tones: {}, areaHint: null });
    const asked: string[] = [];
    for (let i = 0; i < 5; i++) {
      const target = s.levels[L6].find!.question.target;
      asked.push(target);
      s = run(s, play({ type: "findGuess", country: target }), play({ type: "findNext" }));
    }
    expect([...asked].sort()).toEqual([...baltic.countries].sort());
    s = run(s, play({ type: "findToTravel" }));
    expect(s.levels[L6].records).toMatchObject({ findDone: true, lastFindScore: { independent: 4, total: 5 } });
  });

  it("completing it unlocks Level 7, which the main action starts", () => {
    const s = refresh(run(level6Done(), { type: "goHome" }));
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["completed", "completed", "completed", "completed", "completed", "completed", "ready", "locked"]);
    expect(allLevelsComplete(s)).toBe(false);
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L7 } });
  });
});

describe("Level 6: attempts from before Belarus replaced Germany (its first version)", () => {
  const OLD = ["DEU", "POL", "LTU", "LVA", "EST"];
  const ORDER = ["LVA", "DEU", "EST", "POL", "LTU"];
  const answers = (order: string[]) => order.map((target) => ({ target, wrongGuesses: 0, hintLevel: 0 }));
  const findDone = { order: ORDER, index: 4, question: { target: "LTU", wrongGuesses: [], hintLevel: 0, solved: true, feedback: null }, results: answers(ORDER), status: "complete" };
  const score = { independent: 5, total: 5 };
  const findRecords = { discoverDone: true, findDone: true, travelDone: false, lastFindScore: score, bestFindScore: score, travelWithoutHelp: false };
  /** A save from before the change: Levels 1–5 completed (Level 4 on Montenegro → Italy) and Level 6 as given, with no revision. */
  const saved = (level6: object, extra: object = {}) => {
    const raw = JSON.parse(JSON.stringify(run(level5Done(), { type: "goHome" })));
    return JSON.stringify({ ...raw, screen: "lesson", levelId: L6, recent: [L6, ...raw.recent], levels: { ...raw.levels, [L6]: level6, ...extra } });
  };
  const discover = { started: true, stage: "discover", discover: { selected: "DEU", explored: ["DEU", "POL"] }, records: { ...findRecords, findDone: false, lastFindScore: null, bestFindScore: null, discoverDone: false } };
  const midFind = {
    started: true,
    stage: "find",
    discover: { selected: null, explored: OLD },
    find: { order: ORDER, index: 1, question: { target: "DEU", wrongGuesses: ["POL"], hintLevel: 1, solved: false, feedback: { kind: "wrong", country: "POL" } }, results: answers(["LVA"]), status: "asking" },
    records: { ...findRecords, findDone: false, lastFindScore: null, bestFindScore: null },
  };
  const travelling = { started: true, stage: "travel", discover: { selected: null, explored: OLD }, find: findDone, travel: { missionId: "deu-to-est", path: ["DEU", "POL"], hintUsed: true, undoUsed: false }, records: findRecords };
  const results = {
    started: true,
    stage: "results",
    discover: { selected: null, explored: OLD },
    find: findDone,
    travel: { missionId: "deu-to-est", path: OLD, hintUsed: false, undoUsed: false },
    lastTravelResult: { missionId: "deu-to-est", route: OLD, hintUsed: false, undoUsed: false },
    journeyReplay: false,
    records: { ...findRecords, travelDone: true, travelWithoutHelp: true, bestRating: 3 },
  };

  it("keeps the first version for those attempts: Germany, Poland, Lithuania, Latvia and Estonia, Germany → Estonia", () => {
    expect(getLevel(L6)!.earlier!.map((v) => v.lesson)).toEqual([balticOriginal]);
    expect(balticOriginal).toMatchObject({ id: L6, countries: OLD, travel: { mission: { id: "deu-to-est", from: "DEU", to: "EST" } } });
    expect(balticOriginal.revision).toBeUndefined();
    expect(shortestDistance(balticOriginal.borders, "DEU", "EST")).toBe(4);
    expect(LESSON_VERSIONS.filter((l) => l.id === L6)).toEqual([baltic, balticOriginal]);
  });

  it("an older Discover and an older Find go on with Germany, through Home, Continue and a refresh", () => {
    let s = parseSavedState(saved(discover));
    expect(s.levels[L6].revision).toBeUndefined();
    expect(activeLesson(s)).toBe(balticOriginal);
    expect(versionOf(s, getLevel(L6)!)!.lesson.countries).toEqual(OLD);
    expect(s.levels[L6].discover).toEqual({ selected: "DEU", explored: ["DEU", "POL"] });
    s = refresh(run(s, play({ type: "discoverSelect", country: "LTU" }), { type: "goHome" }));
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L6 } });
    s = run(s, open(L6));
    expect(activeLesson(s)).toBe(balticOriginal);
    expect(s.levels[L6].discover).toEqual({ selected: "LTU", explored: ["DEU", "POL", "LTU"] });
    // Find asks the first version's five countries, Germany among them; never Belarus.
    expect(run(s, play({ type: "startFinding", order: ["EST", "BLR", "POL", "LVA", "LTU"] }))).toBe(s);
    s = refresh(run(s, play({ type: "startFinding", order: ORDER })));
    expect(s.levels[L6].find).toMatchObject({ order: ORDER, status: "asking" });

    s = parseSavedState(saved(midFind));
    expect(s.levels[L6]).toMatchObject({ stage: "find", find: { order: ORDER, index: 1, question: { target: "DEU", wrongGuesses: ["POL"], hintLevel: 1 } } });
    s = refresh(run(s, play({ type: "findGuess", country: "DEU" })));
    expect(s.levels[L6].find!.question).toMatchObject({ target: "DEU", solved: true });
    expect(s.levels[L6].revision).toBeUndefined();
  });

  it("an older journey keeps Germany → Estonia, its route, crossings left and help; Undo, Restart, Home and a refresh keep it", () => {
    let s = parseSavedState(saved(travelling));
    expect(s.levels[L6].travel).toMatchObject({ missionId: "deu-to-est", from: "DEU", to: "EST", budget: 4, path: ["DEU", "POL"], status: "playing", hintUsed: true, undoUsed: false });
    expect([...availableMoves(s.levels[L6].travel!, balticOriginal.borders)]).toEqual(["LTU"]);
    s = run(s, play({ type: "travelMove", country: "LTU" }), play({ type: "travelUndo" }));
    expect(s.levels[L6].travel).toMatchObject({ missionId: "deu-to-est", path: ["DEU", "POL"], undoUsed: true });
    s = refresh(run(s, play({ type: "travelRestart" }), { type: "goHome" }));
    expect(levelToContinue(s)?.id).toBe(L6);
    s = run(s, open(L6));
    expect(s.levels[L6].travel).toMatchObject({ missionId: "deu-to-est", path: ["DEU"], budget: 4 });
    for (const country of ["POL", "LTU", "LVA", "EST"]) s = run(s, play({ type: "travelMove", country }));
    // It finishes on its own journey, and counts: the level completes and Level 7 opens.
    expect(s.levels[L6]).toMatchObject({ stage: "results", lastTravelResult: { missionId: "deu-to-est", route: OLD, budget: 4, independent: false } });
    expect(s.levels[L6].revision).toBeUndefined();
    expect(isLevelComplete(s, L6)).toBe(true);
    expect(canPlay(s, L7)).toBe(true);
    // Help used: two stars.
    expect(s.levels[L6].records.bestRating).toBe(2);
  });

  it("an older journey saved with a repeat (before countries could not be visited twice) is a dead end, undone", () => {
    // Back in Germany with two crossings left: its one neighbour here, Poland, is on the route.
    let s = parseSavedState(saved({ ...travelling, travel: { ...travelling.travel, path: ["DEU", "POL", "DEU"] } }));
    expect(s.levels[L6].travel).toMatchObject({ path: ["DEU", "POL", "DEU"], status: "playing", budget: 4 });
    expect(isDeadEnd(s.levels[L6].travel!, balticOriginal.borders)).toBe(true);
    s = run(s, play({ type: "travelUndo" }));
    expect(s.levels[L6].travel).toMatchObject({ path: ["DEU", "POL"], status: "playing", undoUsed: true });
    expect([...availableMoves(s.levels[L6].travel!, balticOriginal.borders)]).toEqual(["LTU"]);
  });

  it("older Results stay as they were; Replay journey starts Poland → Estonia; Play again starts the current version; records, unlocks and other levels are kept", () => {
    const s = parseSavedState(saved(results, { [L7]: { started: false, stage: "discover", records: { discoverDone: true, findDone: true, travelDone: true, bestRating: 2 } } }));
    expect(hasSavedResults(s, L6)).toBe(true);
    expect(s.levels[L6].lastTravelResult).toEqual({ missionId: "deu-to-est", route: OLD, budget: 4, hintUsed: false, undoUsed: false, independent: true });
    expect(s.levels[L6].records).toMatchObject({ travelDone: true, lastFindScore: score, bestRating: 3 });
    expect(versionOf(s, getLevel(L6)!)!.description.en).toMatch(/^From Berlin/);
    // View results reopens them unchanged.
    const viewed = refresh(run(s, { type: "goHome" }, open(L6)));
    expect(viewed.levels[L6]).toEqual(s.levels[L6]);

    const replay = run(s, play({ type: "replayTravel" }));
    expect(replay.levels[L6]).toMatchObject({ revision: 2, stage: "travel", journeyReplay: true, find: null, lastTravelResult: null, travel: { missionId: "pol-to-est", path: ["POL"], budget: 3 } });
    expect(replay.levels[L6].records).toEqual(s.levels[L6].records);
    expect(activeLesson(replay)).toBe(baltic);
    expect(refresh(replay).levels[L6]).toMatchObject({ revision: 2, travel: { missionId: "pol-to-est", path: ["POL"] }, journeyReplay: true });
    let done = replay;
    for (const country of ["BLR", "LVA", "EST"]) done = run(done, play({ type: "travelMove", country }));
    expect(done.levels[L6]).toMatchObject({ stage: "results", lastTravelResult: { missionId: "pol-to-est", route: ["POL", "BLR", "LVA", "EST"] }, records: { bestRating: 3 } });

    const again = run(s, restart(L6));
    expect(again.levels[L6]).toMatchObject({ revision: 2, started: true, stage: "discover", find: null, travel: null, lastTravelResult: null });
    expect(again.levels[L6].records).toEqual(s.levels[L6].records);
    expect(activeLesson(again)).toBe(baltic);
    expect(versionOf(again, getLevel(L6)!)!.lesson.countries).toEqual(["POL", "BLR", "LTU", "LVA", "EST"]);
    for (const state of [replay, again]) {
      expect(isLevelComplete(state, L6)).toBe(true);
      expect(levelStatus(state, getLevel(L7)!).kind).toBe("completed");
      for (const id of [L1, L2, L3, L4, L5, L7]) expect(state.levels[id]).toBe(s.levels[id]);
    }
    // Start over from an older journey under way: the current version too.
    expect(run(parseSavedState(saved(travelling)), restart(L6)).levels[L6]).toMatchObject({ revision: 2, stage: "discover" });
  });

  it("reads a save on the version it names; one without a revision is never read with the current countries; an unknown revision keeps only the records", () => {
    const current = { revision: 2, started: true, stage: "travel", discover: { selected: null, explored: [] }, find: { ...findDone, order: ["BLR", "POL", "EST", "LVA", "LTU"], question: { ...findDone.question, target: "LTU" }, results: answers(["BLR", "POL", "EST", "LVA", "LTU"]) }, travel: { missionId: "pol-to-est", path: ["POL", "BLR"], hintUsed: false, undoUsed: false }, records: findRecords };
    const s = parseSavedState(saved(current));
    expect(s.levels[L6]).toMatchObject({ revision: 2, stage: "travel", travel: { missionId: "pol-to-est", path: ["POL", "BLR"] }, find: { status: "complete" } });
    // The same place without its revision is read on the first version: nothing in it fits, so nothing is kept.
    expect(parseSavedState(saved({ ...current, revision: undefined })).levels[L6]).toMatchObject({ stage: "discover", find: null, travel: null });
    for (const revision of [3, "2", 1.5]) {
      const kept = parseSavedState(saved({ ...results, revision }));
      expect(kept.levels[L6]).toMatchObject({ revision: 2, started: false, stage: "discover", travel: null, lastTravelResult: null, records: { travelDone: true, bestRating: 3 } });
      expect(canPlay(kept, L7)).toBe(true);
    }
    // A first visit, and a saved revision 1, are what they say.
    expect(run(parseSavedState(saved(undefined as unknown as object)), open(L6)).levels[L6].revision).toBe(2);
    expect(parseSavedState(saved({ ...travelling, revision: 1 })).levels[L6].travel).toMatchObject({ missionId: "deu-to-est" });
    // Only Level 6's saves name a revision; the other levels' are unchanged.
    for (const id of [L1, L2, L3, L4, L5]) expect(JSON.parse(JSON.stringify(s.levels[id]))).not.toHaveProperty("revision");
  });
});

describe("Level 7: Iberian Journey", () => {
  /** A save written before Level 7 existed: Levels 1–6 completed, nothing for Level 7. */
  const oldSave = () => {
    const raw = JSON.parse(JSON.stringify(run(level6Done(), { type: "goHome" })));
    expect(Object.keys(raw.levels).sort()).toEqual([L1, L2, L3, L4, L5, L6].sort());
    return JSON.stringify(raw);
  };

  it("an existing save with Level 6 completed unlocks it, with every earlier level's progress intact; the main action starts it", () => {
    const before = JSON.parse(oldSave());
    const s = parseSavedState(oldSave());
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["completed", "completed", "completed", "completed", "completed", "completed", "ready", "locked"]);
    expect(allLevelsComplete(s)).toBe(false);
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L7 } });
    for (const id of [L1, L2, L3, L4, L5, L6]) expect(JSON.parse(JSON.stringify(s.levels[id]))).toEqual(before.levels[id]);
    const opened = run(s, open(L7));
    expect(opened).toMatchObject({ screen: "lesson", levelId: L7, recent: [L7, L6, L5, L4, L3, L2, L1] });
    expect(opened.levels[L7]).toMatchObject({ started: true, stage: "discover", records: { travelDone: false } });
    for (const id of [L1, L2, L3, L4, L5, L6]) expect(opened.levels[id]).toEqual(s.levels[id]);
  });

  it("keeps its unlock and its progress apart: Home, Continue, a refresh, starting it or Level 6 over", () => {
    let s = run(parseSavedState(oldSave()), open(L7), play({ type: "discoverSelect", country: "AND" }));
    const l7 = s.levels[L7];
    s = refresh(run(s, { type: "goHome" }));
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L7 } });
    expect(levelStatus(s, LEVELS[6])).toMatchObject({ kind: "inProgress", stage: "discover" });
    expect(s.levels[L7]).toEqual(l7);
    // Level 6 replayed and started over: Level 7 stays open, its place kept.
    s = refresh(run(s, open(L6), play({ type: "replayTravel" }), restart(L6), { type: "goHome" }));
    expect(canPlay(s, L7)).toBe(true);
    expect(s.levels[L7]).toEqual(l7);
    // Continue resumes Level 7 where it was; a refresh inside it reopens it there.
    s = refresh(run(s, open(L7)));
    expect(s).toMatchObject({ screen: "lesson", levelId: L7 });
    expect(s.levels[L7].discover.selected).toBe("AND");
    // Starting Level 7 over clears only its place.
    const over = run(s, restart(L7));
    expect(over.levels[L7]).toMatchObject({ stage: "discover", discover: { selected: null, explored: [] } });
    for (const id of [L1, L2, L3, L4, L5, L6]) expect(over.levels[id]).toBe(s.levels[id]);
  });

  it("travels Portugal → Italy in three crossings, by the one shortest route", () => {
    expect(shortestDistance(iberian.borders, "PRT", "ITA")).toBe(3);
    const route = ["PRT", "ESP", "FRA", "ITA"];
    const s = complete(run(level6Done(), open(L7)), route);
    expect(s.levels[L7].lastTravelResult).toMatchObject({ route, budget: 3, independent: true });
    expect(levelStatus(s, LEVELS[6]).kind).toBe("completed");
  });

  it("offers every real neighbour within the level, Andorra included, and only those; Undo and Restart count as help", () => {
    let s = complete(run(level6Done(), open(L7)), ["PRT"]);
    const moves = (st: AppState) => [...iberian.borders[st.levels[L7].travel!.path.at(-1)!]].sort();
    // Portugal's only neighbour is Spain.
    expect(moves(s)).toEqual(["ESP"]);
    for (const country of ["AND", "FRA", "ITA"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    s = run(s, play({ type: "travelMove", country: "ESP" }));
    // Spain offers Andorra too, though going through it takes one crossing more.
    expect(moves(s)).toEqual(["AND", "FRA", "PRT"]);
    expect(run(s, play({ type: "travelMove", country: "ITA" }))).toBe(s);
    s = run(s, play({ type: "travelMove", country: "AND" }));
    expect(moves(s)).toEqual(["ESP", "FRA"]);
    expect(run(s, play({ type: "travelMove", country: "ITA" }))).toBe(s);
    // Through Andorra the crossings run out in France, before Italy.
    s = run(s, play({ type: "travelMove", country: "FRA" }));
    expect(s.levels[L7].travel).toMatchObject({ status: "outOfCrossings", path: ["PRT", "ESP", "AND", "FRA"] });
    s = run(s, play({ type: "travelUndo" }), play({ type: "travelUndo" }));
    expect(s.levels[L7].travel).toMatchObject({ status: "playing", path: ["PRT", "ESP"], undoUsed: true });
    s = refresh(s);
    expect(s.levels[L7].travel).toMatchObject({ path: ["PRT", "ESP"], undoUsed: true });
    s = run(s, play({ type: "travelRestart" }));
    expect(s.levels[L7].travel).toMatchObject({ path: ["PRT"], undoUsed: true });
    s = run(s, play({ type: "travelMove", country: "ESP" }), play({ type: "travelMove", country: "FRA" }));
    expect(moves(s)).toEqual(["AND", "ESP", "ITA"]);
    s = run(s, play({ type: "travelMove", country: "ITA" }));
    // Italy's only neighbour here is France.
    expect(moves(s)).toEqual(["FRA"]);
    expect(s.levels[L7].lastTravelResult).toMatchObject({ route: ["PRT", "ESP", "FRA", "ITA"], budget: 3, undoUsed: true, independent: false });
  });

  it("asks five different questions, each country once, and gives nothing away before an answer", () => {
    let s = run(level6Done(), open(L7));
    for (const id of iberian.countries) s = run(s, play({ type: "discoverSelect", country: id }));
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) orders.add(createFindOrder(iberian.countries, seededRandom(seed)).join(","));
    expect(orders.size).toBeGreaterThan(20);
    for (let seed = 1; seed <= 5; seed++) {
      const t = run(s, play(startFindingAction(iberian, seededRandom(seed))));
      expect(buildMapView(iberian, t.levels[L7], NO_UI)).toMatchObject({ labels: [], markers: [], tones: {}, explored: [], areaHint: null, namesPublic: false, feedback: null });
    }
    s = run(s, play(startFindingAction(iberian, seededRandom(2))), play({ type: "findHint" }));
    expect(buildMapView(iberian, s.levels[L7], NO_UI)).toMatchObject({ labels: [], tones: {}, areaHint: null });
    const asked: string[] = [];
    for (let i = 0; i < 5; i++) {
      const target = s.levels[L7].find!.question.target;
      asked.push(target);
      s = run(s, play({ type: "findGuess", country: target }), play({ type: "findNext" }));
    }
    expect([...asked].sort()).toEqual([...iberian.countries].sort());
    s = run(s, play({ type: "findToTravel" }));
    expect(s.levels[L7].records).toMatchObject({ findDone: true, lastFindScore: { independent: 4, total: 5 } });
  });

  it("completing it unlocks Level 8, which the main action starts", () => {
    const s = refresh(run(level7Done(), { type: "goHome" }));
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual([...Array(7).fill("completed"), "ready"]);
    expect(allLevelsComplete(s)).toBe(false);
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L8 } });
  });
});

describe("Level 8: Eastern Europe", () => {
  /** A save written before Level 8 existed: Levels 1–7 completed, nothing for Level 8. */
  const oldSave = () => {
    const raw = JSON.parse(JSON.stringify(run(level7Done(), { type: "goHome" })));
    expect(Object.keys(raw.levels).sort()).toEqual([L1, L2, L3, L4, L5, L6, L7].sort());
    return JSON.stringify(raw);
  };

  it("an existing save with Level 7 completed unlocks it, with every earlier level's progress, completion and best stars intact; the main action starts it", () => {
    const before = JSON.parse(oldSave());
    const s = parseSavedState(oldSave());
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual([...Array(7).fill("completed"), "ready"]);
    expect(allLevelsComplete(s)).toBe(false);
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L8 } });
    for (const id of [L1, L2, L3, L4, L5, L6, L7]) {
      expect(JSON.parse(JSON.stringify(s.levels[id]))).toEqual(before.levels[id]);
      expect(s.levels[id].records).toMatchObject({ travelDone: true, bestRating: before.levels[id].records.bestRating });
    }
    const opened = run(s, open(L8));
    expect(opened).toMatchObject({ screen: "lesson", levelId: L8, recent: [L8, L7, L6, L5, L4, L3, L2, L1] });
    expect(opened.levels[L8]).toMatchObject({ started: true, stage: "discover", records: { travelDone: false } });
    for (const id of [L1, L2, L3, L4, L5, L6, L7]) expect(opened.levels[id]).toEqual(s.levels[id]);
    // Level 7's Results offer Next level: Level 8, at Discover or where it was left.
    expect(nextLevel(s, L7)?.id).toBe(L8);
    const placed = run(opened, play({ type: "discoverSelect", country: "MDA" }), open(L7), open(L8));
    expect(placed.levels[L8].discover.selected).toBe("MDA");
  });

  it("keeps its unlock and its progress apart: Home, Continue, a refresh, starting it or Level 7 over", () => {
    let s = run(parseSavedState(oldSave()), open(L8), play({ type: "discoverSelect", country: "UKR" }));
    const l8 = s.levels[L8];
    s = refresh(run(s, { type: "goHome" }));
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L8 } });
    expect(levelToContinue(s)?.id).toBe(L8);
    expect(levelStatus(s, LEVELS[7])).toMatchObject({ kind: "inProgress", stage: "discover" });
    expect(s.levels[L8]).toEqual(l8);
    // Level 7 replayed and started over: Level 8 stays open, its place kept.
    s = refresh(run(s, open(L7), play({ type: "replayTravel" }), restart(L7), { type: "goHome" }));
    expect(canPlay(s, L8)).toBe(true);
    expect(s.levels[L8]).toEqual(l8);
    // Continue resumes Level 8 where it was; a refresh inside it reopens it there.
    s = refresh(run(s, open(L8)));
    expect(s).toMatchObject({ screen: "lesson", levelId: L8 });
    expect(s.levels[L8].discover.selected).toBe("UKR");
    // Starting Level 8 over clears only its place.
    const over = run(s, restart(L8));
    expect(over.levels[L8]).toMatchObject({ stage: "discover", discover: { selected: null, explored: [] } });
    for (const id of [L1, L2, L3, L4, L5, L6, L7]) expect(over.levels[id]).toBe(s.levels[id]);
  });

  it("travels Poland → Moldova in two crossings, by the one shortest route through Ukraine", () => {
    expect(shortestDistance(eastern.borders, "POL", "MDA")).toBe(2);
    // Every shortest route, found by search over the graph: only Poland → Ukraine → Moldova.
    const shortest: string[][] = [];
    const walk = (path: string[]) => {
      if (path.at(-1) === "MDA") return void shortest.push(path);
      if (path.length - 1 >= 2) return;
      for (const next of eastern.borders[path.at(-1)!]) if (!path.includes(next)) walk([...path, next]);
    };
    walk(["POL"]);
    expect(shortest).toEqual([["POL", "UKR", "MDA"]]);
    // Pairwise distances: neighbours 1, the others 2.
    for (const [a, b] of [["POL", "ROU"], ["BLR", "MDA"], ["BLR", "ROU"]]) expect(shortestDistance(eastern.borders, a, b)).toBe(2);
    const route = ["POL", "UKR", "MDA"];
    const s = complete(run(level7Done(), open(L8)), route);
    expect(s.levels[L8].lastTravelResult).toMatchObject({ route, budget: 2, independent: true });
    expect(levelStatus(s, LEVELS[7]).kind).toBe("completed");
    // The last level: no Next level; its Results lead back to Europe's levels.
    expect(nextLevel(s, L8)).toBeNull();
  });

  it("offers every real neighbour within the level, and only those; out of crossings, Undo and Restart recover; help is counted", () => {
    let s = complete(run(level7Done(), open(L8)), ["POL"]);
    const moves = (st: AppState) => [...eastern.borders[st.levels[L8].travel!.path.at(-1)!]].sort();
    // Poland meets Belarus and Ukraine here; never Moldova or Romania.
    expect(moves(s)).toEqual(["BLR", "UKR"]);
    for (const country of ["MDA", "ROU"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    // Through Belarus the crossings run out in Ukraine, before Moldova.
    s = run(s, play({ type: "travelMove", country: "BLR" }));
    expect(moves(s)).toEqual(["POL", "UKR"]);
    for (const country of ["MDA", "ROU"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    s = run(s, play({ type: "travelMove", country: "UKR" }));
    expect(s.levels[L8].travel).toMatchObject({ status: "outOfCrossings", path: ["POL", "BLR", "UKR"] });
    // No move is accepted with no crossings left.
    for (const country of ["MDA", "ROU", "POL", "BLR"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    s = run(s, play({ type: "travelUndo" }), play({ type: "travelUndo" }));
    expect(s.levels[L8].travel).toMatchObject({ status: "playing", path: ["POL"], undoUsed: true });
    s = refresh(s);
    expect(s.levels[L8].travel).toMatchObject({ path: ["POL"], undoUsed: true });
    // Ukraine offers all four others.
    s = run(s, play({ type: "travelMove", country: "UKR" }));
    expect(moves(s)).toEqual(["BLR", "MDA", "POL", "ROU"]);
    // Through Romania the crossings run out there too.
    s = run(s, play({ type: "travelMove", country: "ROU" }));
    expect(s.levels[L8].travel).toMatchObject({ status: "outOfCrossings", path: ["POL", "UKR", "ROU"] });
    s = run(s, play({ type: "travelRestart" }));
    expect(s.levels[L8].travel).toMatchObject({ status: "playing", path: ["POL"], undoUsed: true });
    s = run(s, play({ type: "travelMove", country: "UKR" }), play({ type: "travelMove", country: "MDA" }));
    expect(s.levels[L8].lastTravelResult).toMatchObject({ route: ["POL", "UKR", "MDA"], budget: 2, undoUsed: true, independent: false });
    // Moldova meets only Ukraine and Romania.
    expect(moves(s)).toEqual(["ROU", "UKR"]);
    // A hint counts as help too.
    let h = complete(run(level7Done(), open(L8)), ["POL"]);
    h = run(h, play({ type: "travelHint" }), play({ type: "travelMove", country: "UKR" }), play({ type: "travelMove", country: "MDA" }));
    expect(h.levels[L8].lastTravelResult).toMatchObject({ hintUsed: true, independent: false });
  });

  it("asks five different questions, each country once, and gives nothing away before an answer", () => {
    let s = run(level7Done(), open(L8));
    for (const id of eastern.countries) s = run(s, play({ type: "discoverSelect", country: id }));
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) orders.add(createFindOrder(eastern.countries, seededRandom(seed)).join(","));
    expect(orders.size).toBeGreaterThan(20);
    for (let seed = 1; seed <= 5; seed++) {
      const t = run(s, play(startFindingAction(eastern, seededRandom(seed))));
      expect(buildMapView(eastern, t.levels[L8], NO_UI)).toMatchObject({ labels: [], markers: [], tones: {}, explored: [], areaHint: null, namesPublic: false, feedback: null });
    }
    s = run(s, play(startFindingAction(eastern, seededRandom(2))), play({ type: "findHint" }));
    expect(buildMapView(eastern, s.levels[L8], NO_UI)).toMatchObject({ labels: [], tones: {}, areaHint: null });
    const asked: string[] = [];
    for (let i = 0; i < 5; i++) {
      const target = s.levels[L8].find!.question.target;
      asked.push(target);
      s = run(s, play({ type: "findGuess", country: target }), play({ type: "findNext" }));
    }
    expect([...asked].sort()).toEqual([...eastern.countries].sort());
    s = run(s, play({ type: "findToTravel" }));
    expect(s.levels[L8].records).toMatchObject({ findDone: true, lastFindScore: { independent: 4, total: 5 } });
  });

  it("once all eight levels are completed: nothing to start, every level still open to replay, nothing reset", () => {
    let s = level8Done();
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(Array(8).fill("completed"));
    expect(allLevelsComplete(s)).toBe(true);
    expect(mainAction(s)).toBeNull();
    s = refresh(run(s, { type: "goHome" }));
    expect(allLevelsComplete(s)).toBe(true);
    for (const level of LEVELS) expect(canPlay(s, level.id)).toBe(true);
    // Nothing was reset by finishing: every level keeps its last result.
    for (const level of LEVELS) expect(s.levels[level.id]).toMatchObject({ stage: "results", records: { travelDone: true } });
    // Playing one again clears only its place; it and every other level stay completed.
    for (const id of [L3, L6, L7, L8]) {
      const again = run(s, restart(id));
      expect(again.levels[id]).toMatchObject({ stage: "discover", records: { travelDone: true } });
      for (const other of [L1, L2, L3, L4, L5, L6, L7, L8].filter((x) => x !== id)) expect(again.levels[other]).toBe(s.levels[other]);
      expect(allLevelsComplete(again)).toBe(true);
      // A replay under way is an attempt to resume: the main action continues it. The level stays completed.
      expect(mainAction(again)).toMatchObject({ kind: "continue", level: { id } });
    }
  });
});

describe("travel choices in every level", () => {
  it("never offer a country already on the route; Undo offers it again where it is a neighbour", () => {
    // Every version, Level 6's first included (attempts started on it go on).
    for (const lesson of LESSON_VERSIONS) {
      const graph = lesson.borders;
      // Every journey the choices allow, to the destination or the end of the crossings: at each step the
      // choices are exactly the current country's neighbours not on the route, so none repeats a country.
      const walk = (attempt: ReturnType<typeof createAttempt>) => {
        const here = attempt.path.at(-1)!;
        const offered = availableMoves(attempt, graph);
        if (attempt.status !== "playing") return expect(offered).toEqual([]);
        expect([...offered].sort(), `${lesson.id}: ${attempt.path.join(">")}`).toEqual(graph[here].filter((c) => !attempt.path.includes(c)).sort());
        for (const next of offered) {
          const moved = move(attempt, graph, next).attempt;
          expect(new Set(moved.path).size, `${lesson.id}: ${moved.path.join(">")}`).toBe(moved.path.length);
          // Undo takes the country off the route and offers it again.
          if (moved.status !== "arrived") expect(availableMoves(undo(moved), graph)).toContain(next);
          walk(moved);
        }
      };
      walk(createAttempt(graph, lesson.travel.mission));
    }
  });
});

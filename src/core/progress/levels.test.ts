import { describe, expect, it } from "vitest";
import { createFindOrder } from "../game/find";
import { isConnectedRoute, shortestDistance } from "../game/graph";
import { availableMoves, createAttempt, isDeadEnd, move, travelChoices, travelStop, undo } from "../game/travel";
import { seededRandom } from "../game/random";
import { CONTINENTS, getLevel, hasPlayableLevels, LESSON_VERSIONS, LESSONS, LEVELS, levelsOf, travelCountries } from "../lessons";
import { alpsLesson as alps } from "../lessons/alps";
import { balticJourneyLesson as baltic, balticJourneyOriginalLesson as balticOriginal } from "../lessons/baltic-journey";
import { adriaticLesson as adriatic } from "../lessons/adriatic";
import { centralEuropeLesson as central } from "../lessons/central-europe";
import { easternEuropeLesson as eastern } from "../lessons/eastern-europe";
import { heartOfTheBalkansLesson as balkans } from "../lessons/heart-of-the-balkans";
import { iberianJourneyLesson as iberian } from "../lessons/iberian-journey";
import { nordicCountriesLesson as nordic } from "../lessons/nordic-countries";
import { acrossTheChannelLesson as channel } from "../lessons/across-the-channel";
import { russiaAndWesternNeighboursLesson as east } from "../lessons/russia-and-western-neighbours";
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
  continentStars,
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
const L9 = balkans.id;
const L10 = nordic.id;
const L11 = channel.id;
const L12 = east.id;
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
const level9Done = () => complete(run(level8Done(), open(L9)), ["MNE", "KOS", "MKD"]);
const level10Done = () => complete(run(level9Done(), open(L10)), ["DNK", "SWE", "FIN"]);
const level11Done = () => complete(run(level10Done(), open(L11)), ["DEU", "FRA", "GBR"]);
const level12Done = () => complete(run(level11Done(), open(L12)), ["EST", "LVA", "BLR"]);

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe("levels", () => {
  it("lists twelve levels with stable, unique ids, all playable", () => {
    expect(LEVELS.map((l) => l.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(12);
    expect(LEVELS.map((l) => Boolean(l.lesson))).toEqual(Array(12).fill(true));
    expect(LEVELS.map((l) => l.id)).toEqual(["western-europe-1", "around-the-alps", "central-europe", "along-the-adriatic", "towards-greece", "baltic-journey", "iberian-journey", "eastern-europe", "heart-of-the-balkans", "nordic-countries", "across-the-channel", "russia-and-western-neighbours"]);
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
    expect(LEVELS[5].countries).toEqual(["POL", "BLR", "LTU", "LVA", "EST"]);
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
    // Level 9 opens after Level 8.
    expect(LEVELS[8].id).toBe("heart-of-the-balkans");
    expect(LEVELS[8].continent).toBe("europe");
    expect(LEVELS[8].countries).toEqual(["MNE", "KOS", "ALB", "MKD", "GRC"]);
    expect(LEVELS[8].unlockedBy).toBe(L8);
    expect(LEVELS[8].title).toEqual({ en: "Heart of the Balkans", hy: "Բալկանների սրտում" });
    expect(LEVELS[8].description).toEqual({
      en: "Explore the southern Balkans, from Montenegro to Greece.",
      hy: "Ուսումնասիրիր Հարավային Բալկանները՝ Չեռնոգորիայից մինչև Հունաստան։",
    });
    // Level 10 opens after Level 9.
    expect(LEVELS[9].id).toBe("nordic-countries");
    expect(LEVELS[9].continent).toBe("europe");
    expect(LEVELS[9].countries).toEqual(["DNK", "SWE", "NOR", "FIN", "ISL"]);
    expect(LEVELS[9].unlockedBy).toBe(L9);
    expect(LEVELS[9].title).toEqual({ en: "Nordic Countries", hy: "Հյուսիսային երկրներ" });
    expect(LEVELS[9].description).toEqual({
      en: "Explore the Nordic countries, from Denmark to Iceland.",
      hy: "Ուսումնասիրիր Հյուսիսային երկրները՝ Դանիայից մինչև Իսլանդիա։",
    });
    // Level 11 opens after Level 10.
    expect(LEVELS[10].id).toBe("across-the-channel");
    expect(LEVELS[10].continent).toBe("europe");
    expect(LEVELS[10].countries).toEqual(["GBR", "IRL", "FRA", "BEL", "DEU"]);
    expect(LEVELS[10].unlockedBy).toBe(L10);
    expect(LEVELS[10].title).toEqual({ en: "Across the Channel", hy: "Լա Մանշի այն կողմ" });
    expect(LEVELS[10].description).toEqual({
      en: "Explore north-western Europe, from Germany to Ireland.",
      hy: "Ուսումնասիրիր Հյուսիսարևմտյան Եվրոպան՝ Գերմանիայից մինչև Իռլանդիա։",
    });
    // Level 12 opens after Level 11.
    expect(LEVELS[11].id).toBe("russia-and-western-neighbours");
    expect(LEVELS[11].continent).toBe("europe");
    expect(LEVELS[11].countries).toEqual(["RUS", "FIN", "EST", "LVA", "BLR"]);
    expect(LEVELS[11].unlockedBy).toBe(L11);
    expect(LEVELS[11].title).toEqual({ en: "Russia and its western neighbours", hy: "Ռուսաստանը և նրա արևմտյան հարևանները" });
    expect(LEVELS[11].description).toEqual({
      en: "Explore European Russia and its neighbours, from Finland to Belarus.",
      hy: "Ուսումնասիրիր Ռուսաստանի եվրոպական մասը և նրա հարևաններին՝ Ֆինլանդիայից մինչև Բելառուս։",
    });
  });

  it("a new player can start Level 1 only; Levels 2–12 are locked", () => {
    const s = createInitialState();
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["ready", ...Array(11).fill("locked")]);
    expect(levelStatus(s, LEVELS[11])).toMatchObject({ kind: "locked", after: { id: L11 } });
    expect(levelStatus(s, LEVELS[10])).toMatchObject({ kind: "locked", after: { id: L10 } });
    expect(levelStatus(s, LEVELS[9])).toMatchObject({ kind: "locked", after: { id: L9 } });
    expect(levelStatus(s, LEVELS[8])).toMatchObject({ kind: "locked", after: { id: L8 } });
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
    for (const id of [L2, L3, "along-the-adriatic", "towards-greece", "baltic-journey", "iberian-journey", "eastern-europe", "heart-of-the-balkans", "nordic-countries", "across-the-channel", "russia-and-western-neighbours", "no-such-level"]) {
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

  it("lists five continents in order; Europe holds the twelve levels in their order, the other four are coming soon", () => {
    expect(CONTINENTS.map((c) => c.id)).toEqual(["europe", "asia", "africa", "north-america", "south-america"]);
    expect(CONTINENTS.map((c) => c.name.en)).toEqual(["Europe", "Asia", "Africa", "North America", "South America"]);
    expect(CONTINENTS.map((c) => c.name.hy)).toEqual(["Եվրոպա", "Ասիա", "Աֆրիկա", "Հյուսիսային Ամերիկա", "Հարավային Ամերիկա"]);
    expect(levelsOf("europe").map((l) => l.id)).toEqual([L1, L2, L3, L4, L5, L6, L7, L8, L9, L10, L11, L12]);
    expect(levelsOf("europe").map((l) => l.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
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
    // Each level follows the one before it: Level 10 follows Level 9.
    expect(levelsOf("europe").map((l) => l.unlockedBy ?? null)).toEqual([null, L1, L2, L3, L4, L5, L6, L7, L8, L9]);
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
    expect(continentProgress(createInitialState(), "europe")).toEqual({ total: 12, completed: 0 });
    let s = level3Done();
    expect(continentProgress(s, "europe")).toEqual({ total: 12, completed: 3 });
    for (const id of [L1, L2, L3]) {
      s = run(s, restart(id));
      expect(continentProgress(s, "europe"), id).toEqual({ total: 12, completed: 3 });
    }
    expect(continentProgress(refresh(s), "europe")).toEqual({ total: 12, completed: 3 });
    expect(continentProgress(level7Done(), "europe")).toEqual({ total: 12, completed: 7 });
    expect(continentProgress(level8Done(), "europe")).toEqual({ total: 12, completed: 8 });
    expect(continentProgress(level9Done(), "europe")).toEqual({ total: 12, completed: 9 });
    expect(continentProgress(level10Done(), "europe")).toEqual({ total: 12, completed: 10 });
    expect(continentProgress(level11Done(), "europe")).toEqual({ total: 12, completed: 11 });
    expect(continentProgress(level12Done(), "europe")).toEqual({ total: 12, completed: 12 });
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
    expect(levelToContinue(level10Done())).toBeNull();
    const again = run(level10Done(), restart(L2), play({ type: "discoverSelect", country: "CHE" }), { type: "goHome" });
    expect(levelToContinue(again)?.id).toBe(L2);
    expect(run(again, open(L2)).levels[L2]).toEqual(again.levels[L2]);
    const travel = run(level10Done(), open(L5), play({ type: "replayTravel" }), { type: "goHome" });
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
    // Level 7's is Level 8, …, Level 11's is Level 12; the last playable level has none.
    expect(nextLevel(level7Done(), L7)?.id).toBe(L8);
    expect(nextLevel(level8Done(), L8)?.id).toBe(L9);
    expect(nextLevel(level9Done(), L9)?.id).toBe(L10);
    expect(nextLevel(level10Done(), L10)?.id).toBe(L11);
    expect(nextLevel(level11Done(), L11)?.id).toBe(L12);
    expect(nextLevel(level12Done(), L12)).toBeNull();
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
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["completed", "completed", "ready", "locked", "locked", "locked", "locked", "locked", "locked", "locked", "locked", "locked"]);
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
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["completed", "completed", "completed", "ready", "locked", "locked", "locked", "locked", "locked", "locked", "locked", "locked"]);
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

  it("offers every real neighbour not yet on the route, Hungary and Serbia (Travel only) included; a wrong turn stops off course, none is a dead end; Hint, Undo and Restart count as help", () => {
    expect(adriatic.travelOnly).toEqual(["HUN", "SRB"]);
    let s = complete(run(level3Done(), open(L4)), ["MNE"]);
    const neighbours = (st: AppState) => [...adriatic.borders[st.levels[L4].travel!.path.at(-1)!]].sort();
    const offered = (st: AppState) => [...availableMoves(st.levels[L4].travel!, adriatic.borders)].sort();
    // Montenegro meets Croatia, Bosnia and Herzegovina and Serbia; no sea crossing to Italy.
    expect(neighbours(s)).toEqual(["BIH", "HRV", "SRB"]);
    expect(offered(s)).toEqual(["BIH", "HRV", "SRB"]);
    for (const country of ["ITA", "SVN", "HUN"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    const stop = (st: AppState) => travelStop(st.levels[L4].travel!, adriatic.borders);
    // Through Bosnia and Herzegovina first: a real border, but Italy is then three crossings away with two left, so the
    // journey stops there, off course, nothing offered (until 2026-10-25 it went on, out of crossings in Slovenia).
    s = run(s, play({ type: "travelMove", country: "BIH" }));
    expect(s.levels[L4].travel).toMatchObject({ status: "playing", path: ["MNE", "BIH"] });
    expect(stop(s)).toBe("offCourse");
    expect(offered(s)).toEqual([]);
    expect(run(s, play({ type: "travelMove", country: "HRV" }))).toBe(s);
    s = run(s, play({ type: "travelUndo" }));
    expect(s.levels[L4].travel).toMatchObject({ status: "playing", path: ["MNE"], undoUsed: true });
    s = run(s, play({ type: "travelMove", country: "BIH" }), play({ type: "travelRestart" }));
    expect(s.levels[L4].travel).toMatchObject({ path: ["MNE"], undoUsed: true });
    // Into Bosnia and Herzegovina from Croatia: Serbia is new there (it was a dead end before Serbia), but Italy is out
    // of reach with the crossing left: off course, saved and read again as it is (the stop is the route's, not saved).
    s = run(s, play({ type: "travelMove", country: "HRV" }));
    expect(neighbours(s)).toEqual(["BIH", "HUN", "MNE", "SRB", "SVN"]);
    expect(offered(s)).toEqual(["BIH", "HUN", "SRB", "SVN"]);
    s = run(s, play({ type: "travelMove", country: "BIH" }));
    expect(s.levels[L4].travel).toMatchObject({ status: "playing", path: ["MNE", "HRV", "BIH"] });
    expect(isDeadEnd(s.levels[L4].travel!, adriatic.borders)).toBe(false);
    expect(stop(s)).toBe("offCourse");
    expect(offered(s)).toEqual([]);
    expect(refresh(s).levels[L4].travel).toMatchObject({ status: "playing", path: ["MNE", "HRV", "BIH"] });
    expect(stop(refresh(s))).toBe("offCourse");
    // A wrong turn into a Travel-only country stops there too.
    s = run(s, play({ type: "travelUndo" }), play({ type: "travelMove", country: "SRB" }));
    expect(s.levels[L4].travel).toMatchObject({ status: "playing", path: ["MNE", "HRV", "SRB"] });
    expect(stop(s)).toBe("offCourse");
    // Slovenia, a crossing left: Italy or Hungary, a choice; Hungary takes the last crossing, and they run out.
    s = run(s, play({ type: "travelUndo" }), play({ type: "travelMove", country: "SVN" }));
    expect(offered(s)).toEqual(["HUN", "ITA"]);
    s = run(s, play({ type: "travelMove", country: "HUN" }));
    expect(s.levels[L4].travel).toMatchObject({ status: "outOfCrossings", path: ["MNE", "HRV", "SVN", "HUN"] });
    expect(refresh(s).levels[L4].travel).toMatchObject({ status: "outOfCrossings", path: ["MNE", "HRV", "SVN", "HUN"] });
    s = run(s, play({ type: "travelUndo" }), play({ type: "travelMove", country: "ITA" }));
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
      // Croatia, or Hungary (Travel only), which runs out of crossings.
      expect(availableMoves(s.levels[L4].travel!, adriatic.borders)).toEqual(["HRV", "HUN"]);
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
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["completed", "completed", "completed", "completed", "ready", "locked", "locked", "locked", "locked", "locked", "locked", "locked"]);
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
    // Sideways into Romania: then Greece is two crossings on, with one left, so the journey stops there, off course;
    // Bulgaria, its one way on, is no longer offered as though it led anywhere (until 2026-10-25 it was).
    s = run(s, play({ type: "travelMove", country: "ROU" }));
    expect(moves(s)).toEqual(["BGR", "HUN", "SRB"]);
    expect(s.levels[L5].travel).toMatchObject({ status: "playing", path: ["HUN", "SRB", "ROU"] });
    expect(travelStop(s.levels[L5].travel!, greece.borders)).toBe("offCourse");
    expect(availableMoves(s.levels[L5].travel!, greece.borders)).toEqual([]);
    expect(run(s, play({ type: "travelMove", country: "BGR" }))).toBe(s);
    s = run(s, play({ type: "travelUndo" }));
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
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["completed", "completed", "completed", "completed", "completed", "ready", "locked", "locked", "locked", "locked", "locked", "locked"]);
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
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["completed", "completed", "completed", "completed", "completed", "ready", "locked", "locked", "locked", "locked", "locked", "locked"]);
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

  it("offers every real neighbour within the level not yet on the route, wrong turns included; a wrong turn stops off course; Undo and Restart count as help", () => {
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
    // In Belarus, Estonia is two crossings on with one left: the journey stops there, off course, and Latvia, its one
    // way on, is no longer offered as though it led anywhere (until 2026-10-25 it was, then ran the crossings out).
    expect(s.levels[L6].travel).toMatchObject({ status: "playing", path: ["POL", "LTU", "BLR"] });
    expect(travelStop(s.levels[L6].travel!, baltic.borders)).toBe("offCourse");
    expect(offered(s)).toEqual([]);
    expect(isDeadEnd(s.levels[L6].travel!, baltic.borders)).toBe(false);
    expect(run(s, play({ type: "travelMove", country: "LVA" }))).toBe(s);
    s = run(s, play({ type: "travelUndo" }));
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

  it("never reaches a dead end with crossings left: every wrong turn stops off course, or takes the last crossing", () => {
    const ends: string[] = [];
    const walk = (attempt: ReturnType<typeof createAttempt>) => {
      expect(isDeadEnd(attempt, baltic.borders), attempt.path.join(">")).toBe(false);
      const stop = travelStop(attempt, baltic.borders);
      if (attempt.status !== "playing" || stop) return ends.push(`${attempt.path.join(">")} ${stop ?? attempt.status}`);
      for (const next of availableMoves(attempt, baltic.borders)) walk(move(attempt, baltic.borders, next).attempt);
    };
    walk(createAttempt(baltic.borders, baltic.travel.mission));
    expect(ends.filter((e) => e.endsWith("arrived")).sort()).toEqual(["POL>BLR>LVA>EST arrived", "POL>LTU>LVA>EST arrived"]);
    // The single-card states of Phase 2B's audit (Belarus after Lithuania, Lithuania after Belarus, each offering only
    // Latvia) now stop off course.
    expect(ends.filter((e) => !e.endsWith("arrived")).sort()).toEqual([
      "POL>BLR>LTU offCourse",
      "POL>BLR>LVA>LTU outOfCrossings",
      "POL>LTU>BLR offCourse",
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
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["completed", "completed", "completed", "completed", "completed", "completed", "ready", "locked", "locked", "locked", "locked", "locked"]);
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
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(["completed", "completed", "completed", "completed", "completed", "completed", "ready", "locked", "locked", "locked", "locked", "locked"]);
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
    // Portugal's only neighbour is Spain; France (no neighbour) is offered beside it as a distractor, never a move.
    expect(moves(s)).toEqual(["ESP"]);
    expect(travelChoices(s.levels[L7].travel!, iberian.borders, iberian.travel.nonNeighbourOptions)).toEqual([
      { country: "ESP", neighbour: true },
      { country: "FRA", neighbour: false },
    ]);
    for (const country of ["AND", "ITA"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    s = run(s, play({ type: "travelMove", country: "ESP" }));
    // Spain offers Andorra too, though going through it takes one crossing more.
    expect(moves(s)).toEqual(["AND", "FRA", "PRT"]);
    expect(run(s, play({ type: "travelMove", country: "ITA" }))).toBe(s);
    s = run(s, play({ type: "travelMove", country: "AND" }));
    expect(moves(s)).toEqual(["ESP", "FRA"]);
    expect(run(s, play({ type: "travelMove", country: "ITA" }))).toBe(s);
    // Through Andorra Italy is two crossings on, with one left: the journey stops there, off course, and France, its
    // one way on, is no longer offered as though it led anywhere (until 2026-10-25 it ran the crossings out there).
    expect(s.levels[L7].travel).toMatchObject({ status: "playing", path: ["PRT", "ESP", "AND"] });
    expect(travelStop(s.levels[L7].travel!, iberian.borders)).toBe("offCourse");
    expect(travelChoices(s.levels[L7].travel!, iberian.borders, iberian.travel.nonNeighbourOptions)).toEqual([]);
    expect(run(s, play({ type: "travelMove", country: "FRA" }))).toBe(s);
    s = run(s, play({ type: "travelUndo" }));
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

  it("offers France at the start as a non-neighbour option: choosing it moves nothing, uses no crossing and costs nothing; Spain goes on", () => {
    expect(iberian.travel.nonNeighbourOptions).toEqual([{ route: ["PRT"], country: "FRA" }]);
    // Shown, never an edge: Portugal and France share no border, in the game graph or the data.
    expect(iberian.borders.PRT).not.toContain("FRA");
    expect(iberian.borders.FRA).not.toContain("PRT");
    expect(shortestDistance(iberian.borders, "PRT", "ITA")).toBe(3);
    let s = complete(run(level6Done(), open(L7)), ["PRT"]);
    const start = s.levels[L7].travel!;
    // Chosen, again and again: the attempt stays the same object (route, crossings, help); Travel says why.
    for (let i = 1; i <= 3; i++) {
      s = run(s, play({ type: "travelMove", country: "FRA" }));
      expect(s.levels[L7].travel).toBe(start);
      expect(s.levels[L7].travelNotice).toEqual({ kind: "notNeighbour", from: "PRT", country: "FRA", seq: i });
      expect(s.levels[L7].stage).toBe("travel");
    }
    expect(s.levels[L7].travel).toMatchObject({ path: ["PRT"], status: "playing", budget: 3, hintUsed: false, undoUsed: false });
    // The map names France in the wrong-answer colour, once per choice; Spain (the move) is not marked.
    const view = buildMapView(iberian, s.levels[L7], NO_UI);
    expect(view.tones).toEqual({ PRT: "current", ITA: "destination", FRA: "wrong" });
    expect(view.labels).toContain("FRA");
    expect(view.labels).not.toContain("ESP");
    expect(view.route).toEqual(["PRT"]);
    expect(view.feedback).toEqual({ country: "FRA", kind: "wrong", key: "travel.3" });
    // A refresh drops the notice; the attempt is as it was.
    expect(refresh(s).levels[L7].travelNotice).toBeUndefined();
    expect(refresh(s).levels[L7].travel).toMatchObject({ path: ["PRT"], hintUsed: false, undoUsed: false });
    // Spain: the move, as before; the notice goes. France is now a real neighbour, a move like any other.
    s = run(s, play({ type: "travelMove", country: "ESP" }));
    expect(s.levels[L7].travel).toMatchObject({ path: ["PRT", "ESP"], status: "playing" });
    expect(s.levels[L7].travelNotice).toBeUndefined();
    expect(travelChoices(s.levels[L7].travel!, iberian.borders, iberian.travel.nonNeighbourOptions).every((c) => c.neighbour)).toBe(true);
    // Undo and Restart back to Portugal: France is offered beside Spain again.
    const back = run(s, play({ type: "travelUndo" }));
    expect(travelChoices(back.levels[L7].travel!, iberian.borders, iberian.travel.nonNeighbourOptions).map((c) => c.country)).toEqual(["ESP", "FRA"]);
    expect(run(back, play({ type: "travelMove", country: "FRA" })).levels[L7].travel).toBe(back.levels[L7].travel);
    // The journey without Hint or Undo: three stars, as without the France choices.
    s = run(s, play({ type: "travelMove", country: "FRA" }), play({ type: "travelMove", country: "ITA" }));
    expect(s.levels[L7].lastTravelResult).toMatchObject({ route: ["PRT", "ESP", "FRA", "ITA"], budget: 3, hintUsed: false, undoUsed: false, independent: true });
    expect(s.levels[L7].records).toMatchObject({ travelWithoutHelp: true, bestRating: 3 });
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
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual([...Array(7).fill("completed"), "ready", "locked", "locked", "locked", "locked"]);
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
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual([...Array(7).fill("completed"), "ready", "locked", "locked", "locked", "locked"]);
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
    // Completing it opens Level 9, its Next level.
    expect(nextLevel(s, L8)?.id).toBe(L9);
    expect(levelStatus(s, LEVELS[8]).kind).toBe("ready");
  });

  it("offers every real neighbour within the level and Latvia (Travel only), and only those; off course, out of crossings, Undo and Restart recover; help is counted", () => {
    expect(eastern.travelOnly).toEqual(["LVA"]);
    let s = complete(run(level7Done(), open(L8)), ["POL"]);
    const moves = (st: AppState) => [...eastern.borders[st.levels[L8].travel!.path.at(-1)!]].sort();
    // Poland meets Belarus and Ukraine here; never Moldova or Romania.
    expect(moves(s)).toEqual(["BLR", "UKR"]);
    for (const country of ["MDA", "ROU", "LVA"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    // Through Belarus Moldova is two crossings on, with one left: the journey stops there, off course, and Ukraine and
    // Latvia, both wrong turns, are no longer offered (until 2026-10-25 either ran the crossings out).
    s = run(s, play({ type: "travelMove", country: "BLR" }));
    expect(moves(s)).toEqual(["LVA", "POL", "UKR"]);
    expect(s.levels[L8].travel).toMatchObject({ status: "playing", path: ["POL", "BLR"] });
    expect(travelStop(s.levels[L8].travel!, eastern.borders)).toBe("offCourse");
    expect(availableMoves(s.levels[L8].travel!, eastern.borders)).toEqual([]);
    for (const country of ["MDA", "ROU", "LVA", "UKR"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    expect(refresh(s).levels[L8].travel).toMatchObject({ status: "playing", path: ["POL", "BLR"] });
    s = run(s, play({ type: "travelUndo" }));
    expect(s.levels[L8].travel).toMatchObject({ status: "playing", path: ["POL"], undoUsed: true });
    s = refresh(s);
    expect(s.levels[L8].travel).toMatchObject({ path: ["POL"], undoUsed: true });
    // Ukraine offers all four others.
    s = run(s, play({ type: "travelMove", country: "UKR" }));
    expect(moves(s)).toEqual(["BLR", "MDA", "POL", "ROU"]);
    // Through Romania, the last crossing: they run out there.
    s = run(s, play({ type: "travelMove", country: "ROU" }));
    expect(s.levels[L8].travel).toMatchObject({ status: "outOfCrossings", path: ["POL", "UKR", "ROU"] });
    // No move is accepted with no crossings left.
    for (const country of ["MDA", "UKR", "POL", "BLR"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
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

});

describe("Level 9: Heart of the Balkans", () => {
  /** A save written before Level 9 existed: Levels 1–8 completed, nothing for Level 9. */
  const oldSave = () => {
    const raw = JSON.parse(JSON.stringify(run(level8Done(), { type: "goHome" })));
    expect(Object.keys(raw.levels).sort()).toEqual([L1, L2, L3, L4, L5, L6, L7, L8].sort());
    return JSON.stringify(raw);
  };

  it("an existing save with all eight earlier levels completed unlocks it, with every level's progress, completion and best stars intact", () => {
    const before = JSON.parse(oldSave());
    const s = parseSavedState(oldSave());
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual([...Array(8).fill("completed"), "ready", "locked", "locked", "locked"]);
    // No longer all complete: Level 9 is there to play. Nothing earned is lost.
    expect(allLevelsComplete(s)).toBe(false);
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L9 } });
    for (const id of [L1, L2, L3, L4, L5, L6, L7, L8]) {
      expect(JSON.parse(JSON.stringify(s.levels[id]))).toEqual(before.levels[id]);
      expect(s.levels[id].records).toMatchObject({ travelDone: true, bestRating: before.levels[id].records.bestRating });
    }
    expect(continentProgress(s, "europe")).toEqual({ total: 12, completed: 8 });
    const opened = run(s, open(L9));
    expect(opened).toMatchObject({ screen: "lesson", levelId: L9, recent: [L9, L8, L7, L6, L5, L4, L3, L2, L1] });
    expect(opened.levels[L9]).toMatchObject({ started: true, stage: "discover", records: { travelDone: false } });
    for (const id of [L1, L2, L3, L4, L5, L6, L7, L8]) expect(opened.levels[id]).toEqual(s.levels[id]);
    const placed = run(opened, play({ type: "discoverSelect", country: "KOS" }), open(L8), open(L9));
    expect(placed.levels[L9].discover.selected).toBe("KOS");
  });

  it("keeps its unlock and its progress apart: Home, Continue, a refresh, starting it or Level 8 over", () => {
    let s = run(parseSavedState(oldSave()), open(L9), play({ type: "discoverSelect", country: "ALB" }));
    const l9 = s.levels[L9];
    s = refresh(run(s, { type: "goHome" }));
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L9 } });
    expect(levelToContinue(s)?.id).toBe(L9);
    expect(levelStatus(s, LEVELS[8])).toMatchObject({ kind: "inProgress", stage: "discover" });
    expect(s.levels[L9]).toEqual(l9);
    // Level 8 replayed and started over: Level 9 stays open, its place kept.
    s = refresh(run(s, open(L8), play({ type: "replayTravel" }), restart(L8), { type: "goHome" }));
    expect(canPlay(s, L9)).toBe(true);
    expect(s.levels[L9]).toEqual(l9);
    s = refresh(run(s, open(L9)));
    expect(s).toMatchObject({ screen: "lesson", levelId: L9 });
    expect(s.levels[L9].discover.selected).toBe("ALB");
    // Starting Level 9 over clears only its place.
    const over = run(s, restart(L9));
    expect(over.levels[L9]).toMatchObject({ stage: "discover", discover: { selected: null, explored: [] } });
    for (const id of [L1, L2, L3, L4, L5, L6, L7, L8]) expect(over.levels[id]).toBe(s.levels[id]);
  });

  it("has exactly the seven real land borders among its countries", () => {
    expect(balkans.borders).toEqual({
      MNE: ["KOS", "ALB"],
      KOS: ["MNE", "ALB", "MKD"],
      ALB: ["MNE", "KOS", "MKD", "GRC"],
      MKD: ["KOS", "ALB", "GRC"],
      GRC: ["ALB", "MKD"],
    });
    // No Montenegro–North Macedonia, Montenegro–Greece or Kosovo–Greece border.
    for (const [a, b] of [["MNE", "MKD"], ["MNE", "GRC"], ["KOS", "GRC"]]) expect(shortestDistance(balkans.borders, a, b)).toBe(2);
  });

  it("travels Montenegro → North Macedonia in two crossings, by either of the two shortest routes", () => {
    expect(shortestDistance(balkans.borders, "MNE", "MKD")).toBe(2);
    // Every shortest route, found by search over the graph: through Kosovo or through Albania.
    const shortest: string[][] = [];
    const walk = (path: string[]) => {
      if (path.at(-1) === "MKD") return void shortest.push(path);
      if (path.length - 1 >= 2) return;
      for (const next of balkans.borders[path.at(-1)!]) if (!path.includes(next)) walk([...path, next]);
    };
    walk(["MNE"]);
    expect(shortest.map((p) => p.join(">")).sort()).toEqual(["MNE>ALB>MKD", "MNE>KOS>MKD"]);
    for (const route of [["MNE", "KOS", "MKD"], ["MNE", "ALB", "MKD"]]) {
      const s = complete(run(level8Done(), open(L9)), route);
      expect(s.levels[L9].lastTravelResult).toMatchObject({ route, budget: 2, independent: true });
      expect(levelStatus(s, LEVELS[8]).kind).toBe("completed");
      // Completing it opens Level 10, its Next level.
      expect(nextLevel(s, L9)?.id).toBe(L10);
      expect(levelStatus(s, LEVELS[9]).kind).toBe("ready");
    }
  });

  it("offers every real neighbour within the level, and only those; each wrong turn runs out of crossings; Undo and Restart recover; help is counted", () => {
    let s = complete(run(level8Done(), open(L9)), ["MNE"]);
    const moves = (st: AppState) => availableMoves(st.levels[L9].travel!, balkans.borders);
    // Montenegro meets Kosovo and Albania here, both on a shortest route; never North Macedonia or Greece.
    expect([...moves(s)].sort()).toEqual(["ALB", "KOS"]);
    for (const country of ["MKD", "GRC"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    // Kosovo → Albania: out of crossings in Albania.
    s = run(s, play({ type: "travelMove", country: "KOS" }));
    expect([...moves(s)].sort()).toEqual(["ALB", "MKD"]);
    s = run(s, play({ type: "travelMove", country: "ALB" }));
    expect(s.levels[L9].travel).toMatchObject({ status: "outOfCrossings", path: ["MNE", "KOS", "ALB"] });
    for (const country of ["MKD", "GRC", "MNE", "KOS"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    s = run(s, play({ type: "travelUndo" }), play({ type: "travelUndo" }));
    expect(s.levels[L9].travel).toMatchObject({ status: "playing", path: ["MNE"], undoUsed: true });
    s = refresh(s);
    expect(s.levels[L9].travel).toMatchObject({ path: ["MNE"], undoUsed: true });
    // Albania offers Kosovo, North Macedonia and Greece (Montenegro is on the route already).
    s = run(s, play({ type: "travelMove", country: "ALB" }));
    expect([...moves(s)].sort()).toEqual(["GRC", "KOS", "MKD"]);
    // Albania → Greece: out of crossings in Greece.
    s = run(s, play({ type: "travelMove", country: "GRC" }));
    expect(s.levels[L9].travel).toMatchObject({ status: "outOfCrossings", path: ["MNE", "ALB", "GRC"] });
    // Albania → Kosovo: out of crossings in Kosovo.
    s = run(s, play({ type: "travelUndo" }), play({ type: "travelMove", country: "KOS" }));
    expect(s.levels[L9].travel).toMatchObject({ status: "outOfCrossings", path: ["MNE", "ALB", "KOS"] });
    s = run(s, play({ type: "travelRestart" }));
    expect(s.levels[L9].travel).toMatchObject({ status: "playing", path: ["MNE"], undoUsed: true });
    s = run(s, play({ type: "travelMove", country: "ALB" }), play({ type: "travelMove", country: "MKD" }));
    expect(s.levels[L9].lastTravelResult).toMatchObject({ route: ["MNE", "ALB", "MKD"], budget: 2, undoUsed: true, independent: false });
    // No dead end: from every country of a route within the crossings, a move is left until they run out.
    for (const route of [["MNE", "KOS"], ["MNE", "ALB"]]) {
      let a = createAttempt(balkans.borders, balkans.travel.mission);
      for (const country of route.slice(1)) a = move(a, balkans.borders, country).attempt;
      expect(isDeadEnd(a, balkans.borders)).toBe(false);
    }
    // A hint counts as help too.
    let h = complete(run(level8Done(), open(L9)), ["MNE"]);
    h = run(h, play({ type: "travelHint" }), play({ type: "travelMove", country: "KOS" }), play({ type: "travelMove", country: "MKD" }));
    expect(h.levels[L9].lastTravelResult).toMatchObject({ hintUsed: true, independent: false });
  });

  it("asks five different questions, each country once, and gives nothing away before an answer", () => {
    let s = run(level8Done(), open(L9));
    for (const id of balkans.countries) s = run(s, play({ type: "discoverSelect", country: id }));
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) orders.add(createFindOrder(balkans.countries, seededRandom(seed)).join(","));
    expect(orders.size).toBeGreaterThan(20);
    for (let seed = 1; seed <= 5; seed++) {
      const t = run(s, play(startFindingAction(balkans, seededRandom(seed))));
      expect(buildMapView(balkans, t.levels[L9], NO_UI)).toMatchObject({ labels: [], markers: [], tones: {}, explored: [], areaHint: null, namesPublic: false, feedback: null });
    }
    s = run(s, play(startFindingAction(balkans, seededRandom(2))), play({ type: "findHint" }));
    expect(buildMapView(balkans, s.levels[L9], NO_UI)).toMatchObject({ labels: [], tones: {}, areaHint: null });
    const asked: string[] = [];
    for (let i = 0; i < 5; i++) {
      const target = s.levels[L9].find!.question.target;
      asked.push(target);
      s = run(s, play({ type: "findGuess", country: target }), play({ type: "findNext" }));
    }
    expect([...asked].sort()).toEqual([...balkans.countries].sort());
    s = run(s, play({ type: "findToTravel" }));
    expect(s.levels[L9].records).toMatchObject({ findDone: true, lastFindScore: { independent: 4, total: 5 } });
  });

});

describe("Level 10: Nordic Countries", () => {
  /** A save written before Level 10 existed: Levels 1–9 completed, nothing for Level 10. */
  const oldSave = () => {
    const raw = JSON.parse(JSON.stringify(run(level9Done(), { type: "goHome" })));
    expect(Object.keys(raw.levels).sort()).toEqual([L1, L2, L3, L4, L5, L6, L7, L8, L9].sort());
    return JSON.stringify(raw);
  };
  const moves = (st: AppState) => availableMoves(st.levels[L10].travel!, nordic.borders);

  it("an existing save with all nine earlier levels completed unlocks it, with every level's progress, completion and best stars intact", () => {
    const before = JSON.parse(oldSave());
    const s = parseSavedState(oldSave());
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual([...Array(9).fill("completed"), "ready", "locked", "locked"]);
    // No longer all complete: Level 10 is there to play. Nothing earned is lost.
    expect(allLevelsComplete(s)).toBe(false);
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L10 } });
    for (const id of [L1, L2, L3, L4, L5, L6, L7, L8, L9]) {
      expect(JSON.parse(JSON.stringify(s.levels[id]))).toEqual(before.levels[id]);
      expect(s.levels[id].records).toMatchObject({ travelDone: true, bestRating: before.levels[id].records.bestRating });
    }
    expect(continentProgress(s, "europe")).toEqual({ total: 12, completed: 9 });
    expect(continentStars(s, "europe")).toEqual({ earned: 27, max: 36 });
    const opened = run(s, open(L10));
    expect(opened).toMatchObject({ screen: "lesson", levelId: L10, recent: [L10, L9, L8, L7, L6, L5, L4, L3, L2, L1] });
    expect(opened.levels[L10]).toMatchObject({ started: true, stage: "discover", records: { travelDone: false } });
    for (const id of [L1, L2, L3, L4, L5, L6, L7, L8, L9]) expect(opened.levels[id]).toEqual(s.levels[id]);
    const placed = run(opened, play({ type: "discoverSelect", country: "ISL" }), open(L9), open(L10));
    expect(placed.levels[L10].discover.selected).toBe("ISL");
  });

  it("keeps its unlock and its progress apart: Home, Continue, a refresh, starting it or Level 9 over", () => {
    let s = run(parseSavedState(oldSave()), open(L10), play({ type: "discoverSelect", country: "NOR" }));
    const l10 = s.levels[L10];
    s = refresh(run(s, { type: "goHome" }));
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L10 } });
    expect(levelToContinue(s)?.id).toBe(L10);
    expect(levelStatus(s, LEVELS[9])).toMatchObject({ kind: "inProgress", stage: "discover" });
    expect(s.levels[L10]).toEqual(l10);
    // Level 9 replayed and started over: Level 10 stays open, its place kept.
    s = refresh(run(s, open(L9), play({ type: "replayTravel" }), restart(L9), { type: "goHome" }));
    expect(canPlay(s, L10)).toBe(true);
    expect(s.levels[L10]).toEqual(l10);
    s = refresh(run(s, open(L10)));
    expect(s).toMatchObject({ screen: "lesson", levelId: L10 });
    expect(s.levels[L10].discover.selected).toBe("NOR");
    // Starting Level 10 over clears only its place.
    const over = run(s, restart(L10));
    expect(over.levels[L10]).toMatchObject({ stage: "discover", discover: { selected: null, explored: [] } });
    for (const id of [L1, L2, L3, L4, L5, L6, L7, L8, L9]) expect(over.levels[id]).toBe(s.levels[id]);
  });

  it("has exactly the three real land borders among its countries, the Øresund's fixed link and Germany's (Travel only) to Denmark, Poland and the Netherlands; Iceland has none", () => {
    expect(nordic.travelOnly).toEqual(["DEU", "POL", "NLD"]);
    expect(nordic.borders).toEqual({
      DNK: ["SWE", "DEU"],
      SWE: ["DNK", "NOR", "FIN"],
      NOR: ["SWE", "FIN"],
      FIN: ["SWE", "NOR"],
      ISL: [],
      DEU: ["DNK", "POL", "NLD"],
      POL: ["DEU"],
      NLD: ["DEU"],
    });
    // Denmark–Sweden is no land border: the Øresund Bridge and Drogden Tunnel join them, a named link.
    expect(nordic.map.borderLinks?.map((link) => [...link.between].sort())).toEqual([["DNK", "SWE"]]);
    // No Denmark–Norway or Denmark–Finland border: both two crossings away, through Sweden.
    for (const to of ["NOR", "FIN"]) expect(shortestDistance(nordic.borders, "DNK", to), to).toBe(2);
    // Iceland: no land border, bridge or tunnel to any of the others, so no journey reaches it or leaves it.
    for (const id of ["DNK", "SWE", "NOR", "FIN", "DEU", "POL", "NLD"]) {
      expect(shortestDistance(nordic.borders, id, "ISL"), id).toBeNull();
      expect(shortestDistance(nordic.borders, "ISL", id), id).toBeNull();
    }
    expect(nordic.travel.note?.en).toContain("Iceland has no land border, bridge or tunnel to the others");
  });

  it("travels Denmark → Finland in two crossings, by its one shortest route; completing it unlocks Level 11, its Next level", () => {
    expect(shortestDistance(nordic.borders, "DNK", "FIN")).toBe(2);
    // Every shortest route, found by search over the graph: through Sweden only.
    const shortest: string[][] = [];
    const walk = (path: string[]) => {
      if (path.at(-1) === "FIN") return void shortest.push(path);
      if (path.length - 1 >= 2) return;
      for (const next of nordic.borders[path.at(-1)!]) if (!path.includes(next)) walk([...path, next]);
    };
    walk(["DNK"]);
    expect(shortest.map((p) => p.join(">"))).toEqual(["DNK>SWE>FIN"]);
    const s = complete(run(level9Done(), open(L10)), ["DNK", "SWE", "FIN"]);
    expect(s.levels[L10].lastTravelResult).toMatchObject({ route: ["DNK", "SWE", "FIN"], budget: 2, independent: true });
    expect(levelStatus(s, LEVELS[9]).kind).toBe("completed");
    // No longer the last level: its Results offer Level 11, now unlocked.
    expect(levelStatus(s, LEVELS[10]).kind).toBe("ready");
    expect(nextLevel(s, L10)?.id).toBe(L11);
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L11 } });
    // Every answer on the first try and the journey without help: three stars, thirty of Europe's thirty-six.
    expect(s.levels[L10].records.bestRating).toBe(3);
    expect(continentStars(s, "europe")).toEqual({ earned: 30, max: 36 });
  });

  it("offers every real neighbour within the level and Germany's (Travel only), and only those; Sweden → Norway runs out of crossings, Denmark → Germany stops off course; Undo and Restart recover; help is counted", () => {
    let s = complete(run(level9Done(), open(L10)), ["DNK"]);
    // Denmark offers Sweden, over the Øresund, or Germany; never Norway, Finland or Iceland, nor Germany's neighbours.
    expect(moves(s)).toEqual(["SWE", "DEU"]);
    for (const country of ["NOR", "FIN", "ISL", "POL", "NLD"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    // Denmark → Germany: a crossing left, and Finland far beyond it: the journey stops there, off course; Poland and the
    // Netherlands are no longer offered (until 2026-10-25 either ran the crossings out).
    s = run(s, play({ type: "travelMove", country: "DEU" }));
    expect(s.levels[L10].travel).toMatchObject({ status: "playing", path: ["DNK", "DEU"] });
    expect(travelStop(s.levels[L10].travel!, nordic.borders)).toBe("offCourse");
    expect(moves(s)).toEqual([]);
    for (const country of ["POL", "NLD"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    expect(refresh(s).levels[L10].travel).toMatchObject({ status: "playing", path: ["DNK", "DEU"] });
    s = run(s, play({ type: "travelUndo" }));
    expect(refresh(s).levels[L10].travel).toMatchObject({ status: "playing", path: ["DNK"], undoUsed: true });
    expect(moves(s)).toEqual(["SWE", "DEU"]);
    s = run(s, play({ type: "travelMove", country: "SWE" }));
    // Sweden offers Finland and Norway; Iceland never.
    expect([...moves(s)].sort()).toEqual(["FIN", "NOR"]);
    expect(run(s, play({ type: "travelMove", country: "ISL" }))).toBe(s);
    // Sweden → Norway: out of crossings in Norway. Norway → Finland, a real border, is never reached.
    s = run(s, play({ type: "travelMove", country: "NOR" }));
    expect(s.levels[L10].travel).toMatchObject({ status: "outOfCrossings", path: ["DNK", "SWE", "NOR"] });
    expect(moves(s)).toEqual([]);
    for (const country of ["FIN", "SWE", "DNK", "ISL"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    s = run(s, play({ type: "travelUndo" }));
    expect(s.levels[L10].travel).toMatchObject({ status: "playing", path: ["DNK", "SWE"], undoUsed: true });
    s = refresh(s);
    expect(s.levels[L10].travel).toMatchObject({ path: ["DNK", "SWE"], undoUsed: true });
    expect([...moves(s)].sort()).toEqual(["FIN", "NOR"]);
    s = run(s, play({ type: "travelRestart" }));
    expect(s.levels[L10].travel).toMatchObject({ status: "playing", path: ["DNK"], undoUsed: true });
    s = run(s, play({ type: "travelMove", country: "SWE" }), play({ type: "travelMove", country: "FIN" }));
    expect(s.levels[L10].lastTravelResult).toMatchObject({ route: ["DNK", "SWE", "FIN"], budget: 2, undoUsed: true, independent: false });
    // Undo is help: the third star is missed.
    expect(s.levels[L10].records.bestRating).toBe(2);
    // No dead end: from every country of a route within the crossings, a neighbour is new until they run out.
    for (const route of [["DNK"], ["DNK", "SWE"], ["DNK", "DEU"]]) {
      let a = createAttempt(nordic.borders, nordic.travel.mission);
      for (const country of route.slice(1)) a = move(a, nordic.borders, country).attempt;
      expect(isDeadEnd(a, nordic.borders)).toBe(false);
    }
    // A hint counts as help too.
    let h = complete(run(level9Done(), open(L10)), ["DNK"]);
    h = run(h, play({ type: "travelHint" }), play({ type: "travelMove", country: "SWE" }), play({ type: "travelMove", country: "FIN" }));
    expect(h.levels[L10].lastTravelResult).toMatchObject({ hintUsed: true, independent: false });
  });

  it("asks five different questions, Iceland among them, each country once, and gives nothing away before an answer", () => {
    let s = run(level9Done(), open(L10));
    for (const id of nordic.countries) s = run(s, play({ type: "discoverSelect", country: id }));
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) orders.add(createFindOrder(nordic.countries, seededRandom(seed)).join(","));
    expect(orders.size).toBeGreaterThan(20);
    for (let seed = 1; seed <= 5; seed++) {
      const t = run(s, play(startFindingAction(nordic, seededRandom(seed))));
      expect(buildMapView(nordic, t.levels[L10], NO_UI)).toMatchObject({ labels: [], markers: [], tones: {}, explored: [], areaHint: null, namesPublic: false, feedback: null });
    }
    s = run(s, play(startFindingAction(nordic, seededRandom(2))), play({ type: "findHint" }));
    expect(buildMapView(nordic, s.levels[L10], NO_UI)).toMatchObject({ labels: [], tones: {}, areaHint: null });
    const asked: string[] = [];
    for (let i = 0; i < 5; i++) {
      const target = s.levels[L10].find!.question.target;
      asked.push(target);
      s = run(s, play({ type: "findGuess", country: target }), play({ type: "findNext" }));
    }
    expect([...asked].sort()).toEqual([...nordic.countries].sort());
    s = run(s, play({ type: "findToTravel" }));
    expect(s.levels[L10].records).toMatchObject({ findDone: true, lastFindScore: { independent: 4, total: 5 } });
    // Travel starts in Denmark: Iceland, learned in Discover and Find, is not on the journey.
    expect(s.levels[L10].travel).toMatchObject({ path: ["DNK"] });
  });

});

describe("Level 11: Across the Channel", () => {
  const EARLIER = [L1, L2, L3, L4, L5, L6, L7, L8, L9, L10];
  /** A save written before Level 11 existed: Levels 1–10 completed, nothing for Level 11. */
  const oldSave = () => {
    const raw = JSON.parse(JSON.stringify(run(level10Done(), { type: "goHome" })));
    expect(Object.keys(raw.levels).sort()).toEqual([...EARLIER].sort());
    return JSON.stringify(raw);
  };
  const moves = (st: AppState) => availableMoves(st.levels[L11].travel!, channel.borders);

  it("an existing save with all ten earlier levels completed unlocks it, with every level's progress, completion and best stars intact", () => {
    const before = JSON.parse(oldSave());
    const s = parseSavedState(oldSave());
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual([...Array(10).fill("completed"), "ready", "locked"]);
    // No longer all complete: Level 11 is there to play. Nothing earned is lost.
    expect(allLevelsComplete(s)).toBe(false);
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L11 } });
    for (const id of EARLIER) {
      expect(JSON.parse(JSON.stringify(s.levels[id]))).toEqual(before.levels[id]);
      expect(s.levels[id].records).toMatchObject({ travelDone: true, bestRating: before.levels[id].records.bestRating });
    }
    // Level 6's attempt keeps the version it was made on.
    expect(s.levels[L6].revision).toBe(before.levels[L6].revision);
    expect(continentProgress(s, "europe")).toEqual({ total: 12, completed: 10 });
    expect(continentStars(s, "europe")).toEqual({ earned: 30, max: 36 });
    const opened = run(s, open(L11));
    expect(opened).toMatchObject({ screen: "lesson", levelId: L11, recent: [L11, ...[...EARLIER].reverse()] });
    expect(opened.levels[L11]).toMatchObject({ started: true, stage: "discover", records: { travelDone: false } });
    for (const id of EARLIER) expect(opened.levels[id]).toEqual(s.levels[id]);
    const placed = run(opened, play({ type: "discoverSelect", country: "IRL" }), open(L10), open(L11));
    expect(placed.levels[L11].discover.selected).toBe("IRL");
  });

  it("keeps its unlock and its progress apart: Home, Continue, a refresh, starting it or Level 10 over", () => {
    let s = run(parseSavedState(oldSave()), open(L11), play({ type: "discoverSelect", country: "GBR" }));
    const l11 = s.levels[L11];
    s = refresh(run(s, { type: "goHome" }));
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L11 } });
    expect(levelToContinue(s)?.id).toBe(L11);
    expect(levelStatus(s, LEVELS[10])).toMatchObject({ kind: "inProgress", stage: "discover" });
    expect(s.levels[L11]).toEqual(l11);
    // Level 10 replayed and started over: Level 11 stays open, its place kept.
    s = refresh(run(s, open(L10), play({ type: "replayTravel" }), restart(L10), { type: "goHome" }));
    expect(canPlay(s, L11)).toBe(true);
    expect(s.levels[L11]).toEqual(l11);
    s = refresh(run(s, open(L11)));
    expect(s).toMatchObject({ screen: "lesson", levelId: L11 });
    expect(s.levels[L11].discover.selected).toBe("GBR");
    // Starting Level 11 over clears only its place.
    const over = run(s, restart(L11));
    expect(over.levels[L11]).toMatchObject({ stage: "discover", discover: { selected: null, explored: [] } });
    for (const id of EARLIER) expect(over.levels[id]).toBe(s.levels[id]);
  });

  it("has exactly the real land borders among its countries and Luxembourg (Travel only), the UK–Ireland border among them, and the Channel Tunnel between France and the United Kingdom", () => {
    expect(channel.travelOnly).toEqual(["LUX"]);
    expect(channel.borders).toEqual({
      GBR: ["FRA", "IRL"],
      IRL: ["GBR"],
      FRA: ["GBR", "BEL", "DEU", "LUX"],
      BEL: ["FRA", "DEU", "LUX"],
      DEU: ["FRA", "BEL", "LUX"],
      LUX: ["FRA", "BEL", "DEU"],
    });
    // France–United Kingdom is no land border: the Channel Tunnel joins them, a named link.
    expect(channel.map.borderLinks?.map((link) => [link.name, ...[...link.between].sort()])).toEqual([["Channel Tunnel", "FRA", "GBR"]]);
    // The United Kingdom and Ireland share a real land border, on the island of Ireland: Ireland is a neighbour in the
    // graph, three crossings from Germany. This journey ends in the United Kingdom, before it.
    expect(shortestDistance(channel.borders, "DEU", "IRL")).toBe(3);
    expect(shortestDistance(channel.borders, "IRL", "GBR")).toBe(1);
    // Belgium and Germany, two crossings from the United Kingdom, through France.
    for (const id of ["BEL", "DEU", "LUX"]) expect(shortestDistance(channel.borders, id, "GBR"), id).toBe(2);
    // The Travel note: the tunnel under the sea, never a land border.
    expect(channel.travel.note).toEqual({
      en: "France and the United Kingdom are connected under the sea by the Channel Tunnel.",
      hy: "Ֆրանսիան և Միացյալ Թագավորությունը ծովի տակով միացված են Լա Մանշի թունելով։",
    });
    expect(channel.travel.note!.en).not.toMatch(/land border/i);
  });

  it("travels Germany → the United Kingdom in two crossings, by its one shortest route through France; its Next level is Level 12", () => {
    expect(shortestDistance(channel.borders, "DEU", "GBR")).toBe(2);
    const shortest: string[][] = [];
    const walk = (path: string[]) => {
      if (path.at(-1) === "GBR") return void shortest.push(path);
      if (path.length - 1 >= 2) return;
      for (const next of channel.borders[path.at(-1)!]) if (!path.includes(next)) walk([...path, next]);
    };
    walk(["DEU"]);
    expect(shortest.map((p) => p.join(">"))).toEqual(["DEU>FRA>GBR"]);
    const s = complete(run(level10Done(), open(L11)), ["DEU", "FRA", "GBR"]);
    expect(s.levels[L11].lastTravelResult).toMatchObject({ route: ["DEU", "FRA", "GBR"], budget: 2, independent: true });
    expect(levelStatus(s, LEVELS[10]).kind).toBe("completed");
    // No longer the last level: its Results offer Level 12, now unlocked.
    expect(levelStatus(s, LEVELS[11]).kind).toBe("ready");
    expect(nextLevel(s, L11)?.id).toBe(L12);
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L12 } });
    // Every answer on the first try and the journey without help: three stars, thirty-three of Europe's thirty-six.
    expect(s.levels[L11].records.bestRating).toBe(3);
    expect(continentStars(s, "europe")).toEqual({ earned: 33, max: 36 });
  });

  it("offers every real neighbour within the level and Luxembourg (Travel only), and only those; the wrong turns stop on the Continent; Undo, Restart and a refresh recover; help is counted", () => {
    let s = complete(run(level10Done(), open(L11)), ["DEU"]);
    // Germany offers France, Belgium or Luxembourg; never the United Kingdom or Ireland (no border).
    expect(moves(s)).toEqual(["FRA", "BEL", "LUX"]);
    for (const country of ["GBR", "IRL", "NLD"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    // Germany → Belgium: a crossing left, and the United Kingdom two on: the journey stops there, off course; France and
    // Luxembourg are no longer offered (until 2026-10-25 either ran the crossings out on the Continent).
    s = run(s, play({ type: "travelMove", country: "BEL" }));
    expect(s.levels[L11].travel).toMatchObject({ status: "playing", path: ["DEU", "BEL"] });
    expect(travelStop(s.levels[L11].travel!, channel.borders)).toBe("offCourse");
    expect(moves(s)).toEqual([]);
    for (const country of ["FRA", "LUX", "GBR"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    expect(refresh(s).levels[L11].travel).toMatchObject({ status: "playing", path: ["DEU", "BEL"] });
    // A journey through Luxembourg (Travel only) stops so too, and is saved and restored as it is.
    s = run(s, play({ type: "travelUndo" }), play({ type: "travelMove", country: "LUX" }));
    s = refresh(s);
    expect(s.levels[L11].travel).toMatchObject({ status: "playing", path: ["DEU", "LUX"], undoUsed: true });
    expect(travelStop(s.levels[L11].travel!, channel.borders)).toBe("offCourse");
    expect(moves(s)).toEqual([]);
    s = run(s, play({ type: "travelRestart" }), play({ type: "travelMove", country: "FRA" }));
    // France offers the United Kingdom, through the tunnel, and its neighbours on the Continent.
    expect(moves(s)).toEqual(["GBR", "BEL", "LUX"]);
    // France → Belgium takes the last crossing: they run out on the Continent.
    s = run(s, play({ type: "travelMove", country: "BEL" }));
    expect(s.levels[L11].travel).toMatchObject({ status: "outOfCrossings", path: ["DEU", "FRA", "BEL"] });
    // In Belgium no crossing is left.
    expect(moves(s)).toEqual([]);
    expect(refresh(s).levels[L11].travel).toMatchObject({ status: "outOfCrossings", path: ["DEU", "FRA", "BEL"] });
    s = run(s, play({ type: "travelUndo" }), play({ type: "travelMove", country: "GBR" }));
    // Arrived: the journey ends in the United Kingdom; Ireland, beyond it, is never entered.
    expect(s.levels[L11].lastTravelResult).toMatchObject({ route: ["DEU", "FRA", "GBR"], budget: 2, undoUsed: true, independent: false });
    expect(s.levels[L11].travel).toMatchObject({ status: "arrived" });
    expect(availableMoves(s.levels[L11].travel!, channel.borders)).toEqual([]);
    // Undo is help: the third star is missed.
    expect(s.levels[L11].records.bestRating).toBe(2);
    // Replayed without help: three stars, the best kept.
    s = run(s, play({ type: "replayTravel" }), play({ type: "travelMove", country: "FRA" }), play({ type: "travelMove", country: "GBR" }));
    expect(s.levels[L11].lastTravelResult).toMatchObject({ route: ["DEU", "FRA", "GBR"], independent: true });
    expect(refresh(s).levels[L11].records.bestRating).toBe(3);
    // No dead end: from every country of a route within the crossings, a move is left until they run out.
    for (const route of [["DEU"], ["DEU", "FRA"], ["DEU", "BEL"], ["DEU", "LUX"]]) {
      let a = createAttempt(channel.borders, channel.travel.mission);
      for (const country of route.slice(1)) a = move(a, channel.borders, country).attempt;
      expect(isDeadEnd(a, channel.borders)).toBe(false);
    }
    // A hint counts as help too.
    let h = complete(run(level10Done(), open(L11)), ["DEU"]);
    h = run(h, play({ type: "travelHint" }), play({ type: "travelMove", country: "FRA" }), play({ type: "travelMove", country: "GBR" }));
    expect(h.levels[L11].lastTravelResult).toMatchObject({ hintUsed: true, independent: false });
  });

  it("asks five different questions, Ireland among them, each country once, and gives nothing away before an answer; Luxembourg is never asked", () => {
    let s = run(level10Done(), open(L11));
    for (const id of channel.countries) s = run(s, play({ type: "discoverSelect", country: id }));
    expect(run(s, play({ type: "discoverSelect", country: "LUX" }))).toBe(s);
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) orders.add(createFindOrder(channel.countries, seededRandom(seed)).join(","));
    expect(orders.size).toBeGreaterThan(20);
    for (let seed = 1; seed <= 5; seed++) {
      const t = run(s, play(startFindingAction(channel, seededRandom(seed))));
      expect(buildMapView(channel, t.levels[L11], NO_UI)).toMatchObject({ labels: [], markers: [], tones: {}, explored: [], areaHint: null, namesPublic: false, feedback: null });
    }
    s = run(s, play(startFindingAction(channel, seededRandom(2))), play({ type: "findHint" }));
    expect(buildMapView(channel, s.levels[L11], NO_UI)).toMatchObject({ labels: [], tones: {}, areaHint: null });
    const asked: string[] = [];
    for (let i = 0; i < 5; i++) {
      const target = s.levels[L11].find!.question.target;
      asked.push(target);
      s = run(s, play({ type: "findGuess", country: target }), play({ type: "findNext" }));
    }
    expect([...asked].sort()).toEqual([...channel.countries].sort());
    s = run(s, play({ type: "findToTravel" }));
    expect(s.levels[L11].records).toMatchObject({ findDone: true, lastFindScore: { independent: 4, total: 5 } });
    // Travel starts in Germany: Ireland, learned in Discover and Find, is beyond the journey's end.
    expect(s.levels[L11].travel).toMatchObject({ path: ["DEU"] });
  });
});

describe("Level 12: Russia and its western neighbours", () => {
  const EARLIER = [L1, L2, L3, L4, L5, L6, L7, L8, L9, L10, L11];
  /** A save written before Level 12 existed: Levels 1–11 completed, nothing for Level 12. */
  const oldSave = () => {
    const raw = JSON.parse(JSON.stringify(run(level11Done(), { type: "goHome" })));
    expect(Object.keys(raw.levels).sort()).toEqual([...EARLIER].sort());
    return JSON.stringify(raw);
  };
  const moves = (st: AppState) => availableMoves(st.levels[L12].travel!, east.borders);
  const choices = (st: AppState) => travelChoices(st.levels[L12].travel!, east.borders, east.travel.nonNeighbourOptions);

  it("an existing save with all eleven earlier levels completed unlocks it, with every level's progress, completion and best stars intact", () => {
    const before = JSON.parse(oldSave());
    const s = parseSavedState(oldSave());
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual([...Array(11).fill("completed"), "ready"]);
    // No longer all complete: Level 12 is there to play. Nothing earned is lost.
    expect(allLevelsComplete(s)).toBe(false);
    expect(mainAction(s)).toMatchObject({ kind: "start", level: { id: L12 } });
    for (const id of EARLIER) {
      expect(JSON.parse(JSON.stringify(s.levels[id]))).toEqual(before.levels[id]);
      expect(s.levels[id].records).toMatchObject({ travelDone: true, bestRating: before.levels[id].records.bestRating });
    }
    // Level 6's attempt keeps the version it was made on.
    expect(s.levels[L6].revision).toBe(before.levels[L6].revision);
    expect(continentProgress(s, "europe")).toEqual({ total: 12, completed: 11 });
    expect(continentStars(s, "europe")).toEqual({ earned: 33, max: 36 });
    const opened = run(s, open(L12));
    expect(opened).toMatchObject({ screen: "lesson", levelId: L12, recent: [L12, ...[...EARLIER].reverse()] });
    expect(opened.levels[L12]).toMatchObject({ started: true, stage: "discover", records: { travelDone: false } });
    for (const id of EARLIER) expect(opened.levels[id]).toEqual(s.levels[id]);
    const placed = run(opened, play({ type: "discoverSelect", country: "RUS" }), open(L11), open(L12));
    expect(placed.levels[L12].discover.selected).toBe("RUS");
  });

  it("keeps its unlock and its progress apart: Home, Continue, a refresh, starting it or Level 11 over", () => {
    let s = run(parseSavedState(oldSave()), open(L12), play({ type: "discoverSelect", country: "FIN" }));
    const l12 = s.levels[L12];
    s = refresh(run(s, { type: "goHome" }));
    expect(mainAction(s)).toMatchObject({ kind: "continue", level: { id: L12 } });
    expect(levelToContinue(s)?.id).toBe(L12);
    expect(levelStatus(s, LEVELS[11])).toMatchObject({ kind: "inProgress", stage: "discover" });
    expect(s.levels[L12]).toEqual(l12);
    // Level 11 replayed and started over: Level 12 stays open, its place kept.
    s = refresh(run(s, open(L11), play({ type: "replayTravel" }), restart(L11), { type: "goHome" }));
    expect(canPlay(s, L12)).toBe(true);
    expect(s.levels[L12]).toEqual(l12);
    s = refresh(run(s, open(L12)));
    expect(s).toMatchObject({ screen: "lesson", levelId: L12 });
    expect(s.levels[L12].discover.selected).toBe("FIN");
    // Starting Level 12 over clears only its place.
    const over = run(s, restart(L12));
    expect(over.levels[L12]).toMatchObject({ stage: "discover", discover: { selected: null, explored: [] } });
    for (const id of EARLIER) expect(over.levels[id]).toBe(s.levels[id]);
  });

  it("has exactly the real land borders among its countries, all on Russia's mainland: none between Estonia and Finland, none into Kaliningrad", () => {
    expect(east.travelOnly).toBeUndefined();
    expect(east.borders).toEqual({
      EST: ["LVA", "RUS"],
      LVA: ["EST", "RUS", "BLR"],
      BLR: ["LVA", "RUS"],
      RUS: ["FIN", "EST", "LVA", "BLR"],
      FIN: ["RUS"],
    });
    // Estonia and Finland share no border, and no fixed link joins them: Finland is two crossings away, through Russia.
    expect(east.map.borderLinks ?? []).toEqual([]);
    expect(shortestDistance(east.borders, "EST", "FIN")).toBe(2);
    // Kaliningrad's neighbours, Lithuania and Poland, are in no journey.
    for (const id of ["LTU", "POL"]) expect(Object.keys(east.borders), id).not.toContain(id);
    // The Travel note: a map exercise along land borders, not advice on crossing them today. Kaliningrad is Discover's
    // (Russia's hint), not the note's.
    expect(east.travel.note).toEqual({
      en: "This journey is a map exercise along land borders, not a guide to crossing them today.",
      hy: "Այս ճանապարհորդությունը քարտեզային վարժություն է՝ ցամաքային սահմաններով, և ոչ թե այսօր դրանք հատելու ուղեցույց։",
    });
    expect(east.travel.note!.en).not.toMatch(/Kaliningrad/);
  });

  it("travels Estonia → Belarus in two crossings, by its two shortest routes, through Latvia or Russia; Level 11's Next level is it, and it is the last", () => {
    expect(shortestDistance(east.borders, "EST", "BLR")).toBe(2);
    const shortest: string[][] = [];
    const walk = (path: string[]) => {
      if (path.at(-1) === "BLR") return void shortest.push(path);
      if (path.length - 1 >= 2) return;
      for (const next of east.borders[path.at(-1)!]) if (!path.includes(next)) walk([...path, next]);
    };
    walk(["EST"]);
    expect(shortest.map((p) => p.join(">")).sort()).toEqual(["EST>LVA>BLR", "EST>RUS>BLR"]);
    for (const route of shortest) {
      const s = complete(run(level11Done(), open(L12)), route);
      expect(s.levels[L12].lastTravelResult, route.join(">")).toMatchObject({ route, budget: 2, independent: true });
      expect(levelStatus(s, LEVELS[11]).kind).toBe("completed");
      // Every answer on the first try and the journey without help: three stars, all thirty-six in Europe.
      expect(s.levels[L12].records.bestRating).toBe(3);
      expect(continentStars(s, "europe")).toEqual({ earned: 36, max: 36 });
      // The last level: no Next level; its Results lead back to Europe's levels.
      expect(nextLevel(s, L12)).toBeNull();
    }
    expect(nextLevel(level11Done(), L11)?.id).toBe(L12);
  });

  it("offers Finland beside Estonia's neighbours, as a non-neighbour: it moves nothing, uses no crossing and costs no star", () => {
    let s = complete(run(level11Done(), open(L12)), ["EST"]);
    expect(moves(s)).toEqual(["LVA", "RUS"]);
    expect(choices(s)).toEqual([
      { country: "LVA", neighbour: true },
      { country: "RUS", neighbour: true },
      { country: "FIN", neighbour: false },
    ]);
    const before = s.levels[L12].travel;
    s = run(s, play({ type: "travelMove", country: "FIN" }));
    // Travel says the two share no border; the journey is as it was.
    expect(s.levels[L12].travel).toEqual(before);
    expect(s.levels[L12].travelNotice).toMatchObject({ kind: "notNeighbour", from: "EST", country: "FIN" });
    // Shown only at the start: after a move, Finland is a real choice (from Russia) or no choice at all.
    const viaLatvia = run(s, play({ type: "travelMove", country: "LVA" }));
    expect(choices(viaLatvia).map((c) => c.country)).toEqual(["RUS", "BLR"]);
    // Then Belarus: arrived, three stars, as if Finland had never been chosen.
    s = run(viaLatvia, play({ type: "travelMove", country: "BLR" }));
    expect(s.levels[L12].lastTravelResult).toMatchObject({ route: ["EST", "LVA", "BLR"], budget: 2, independent: true, hintUsed: false, undoUsed: false });
    expect(s.levels[L12].records.bestRating).toBe(3);
  });

  it("offers every real neighbour within the level, and only those; the wrong turns run out of crossings; Undo, Restart and a refresh recover; help is counted", () => {
    let s = complete(run(level11Done(), open(L12)), ["EST"]);
    for (const country of ["BLR", "LTU", "POL", "UKR"]) expect(run(s, play({ type: "travelMove", country }))).toBe(s);
    // Estonia → Russia: Finland, Latvia or Belarus; Finland and Latvia run out of crossings.
    s = run(s, play({ type: "travelMove", country: "RUS" }));
    expect(s.levels[L12].travel).toMatchObject({ status: "playing", path: ["EST", "RUS"] });
    expect(moves(s)).toEqual(["FIN", "LVA", "BLR"]);
    s = run(s, play({ type: "travelMove", country: "FIN" }));
    expect(s.levels[L12].travel).toMatchObject({ status: "outOfCrossings", path: ["EST", "RUS", "FIN"] });
    expect(moves(s)).toEqual([]);
    expect(refresh(s).levels[L12].travel).toMatchObject({ status: "outOfCrossings", path: ["EST", "RUS", "FIN"] });
    s = run(s, play({ type: "travelUndo" }), play({ type: "travelMove", country: "LVA" }));
    expect(s.levels[L12].travel).toMatchObject({ status: "outOfCrossings", path: ["EST", "RUS", "LVA"], undoUsed: true });
    // Estonia → Latvia → Russia, the other wrong turn, saved and restored as it is.
    s = refresh(run(s, play({ type: "travelRestart" }), play({ type: "travelMove", country: "LVA" })));
    expect(s.levels[L12].travel).toMatchObject({ status: "playing", path: ["EST", "LVA"], undoUsed: true });
    expect(moves(s)).toEqual(["RUS", "BLR"]);
    s = run(s, play({ type: "travelMove", country: "RUS" }));
    expect(s.levels[L12].travel).toMatchObject({ status: "outOfCrossings", path: ["EST", "LVA", "RUS"] });
    s = run(s, play({ type: "travelUndo" }), play({ type: "travelMove", country: "BLR" }));
    expect(s.levels[L12].lastTravelResult).toMatchObject({ route: ["EST", "LVA", "BLR"], budget: 2, undoUsed: true, independent: false });
    expect(s.levels[L12].travel).toMatchObject({ status: "arrived" });
    // Undo is help: the third star is missed.
    expect(s.levels[L12].records.bestRating).toBe(2);
    // Replayed without help, through Russia: three stars, the best kept.
    s = run(s, play({ type: "replayTravel" }), play({ type: "travelMove", country: "RUS" }), play({ type: "travelMove", country: "BLR" }));
    expect(s.levels[L12].lastTravelResult).toMatchObject({ route: ["EST", "RUS", "BLR"], independent: true });
    expect(refresh(s).levels[L12].records.bestRating).toBe(3);
    // No dead end: from every country of a route within the crossings, a move is left until they run out.
    for (const route of [["EST"], ["EST", "LVA"], ["EST", "RUS"]]) {
      let a = createAttempt(east.borders, east.travel.mission);
      for (const country of route.slice(1)) a = move(a, east.borders, country).attempt;
      expect(isDeadEnd(a, east.borders)).toBe(false);
    }
    // A hint counts as help too.
    let h = complete(run(level11Done(), open(L12)), ["EST"]);
    h = run(h, play({ type: "travelHint" }), play({ type: "travelMove", country: "LVA" }), play({ type: "travelMove", country: "BLR" }));
    expect(h.levels[L12].lastTravelResult).toMatchObject({ hintUsed: true, independent: false });
  });

  it("asks five different questions, Russia and Finland among them, each country once, and gives nothing away before an answer", () => {
    let s = run(level11Done(), open(L12));
    for (const id of east.countries) s = run(s, play({ type: "discoverSelect", country: id }));
    for (const id of ["LTU", "POL"]) expect(run(s, play({ type: "discoverSelect", country: id }))).toBe(s);
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) orders.add(createFindOrder(east.countries, seededRandom(seed)).join(","));
    expect(orders.size).toBeGreaterThan(20);
    for (let seed = 1; seed <= 5; seed++) {
      const t = run(s, play(startFindingAction(east, seededRandom(seed))));
      expect(buildMapView(east, t.levels[L12], NO_UI)).toMatchObject({ labels: [], markers: [], tones: {}, explored: [], areaHint: null, namesPublic: false, feedback: null });
    }
    s = run(s, play(startFindingAction(east, seededRandom(2))), play({ type: "findHint" }));
    expect(buildMapView(east, s.levels[L12], NO_UI)).toMatchObject({ labels: [], tones: {}, areaHint: null });
    const asked: string[] = [];
    for (let i = 0; i < 5; i++) {
      const target = s.levels[L12].find!.question.target;
      asked.push(target);
      s = run(s, play({ type: "findGuess", country: target }), play({ type: "findNext" }));
    }
    expect([...asked].sort()).toEqual([...east.countries].sort());
    s = run(s, play({ type: "findToTravel" }));
    expect(s.levels[L12].records).toMatchObject({ findDone: true, lastFindScore: { independent: 4, total: 5 } });
    expect(s.levels[L12].travel).toMatchObject({ path: ["EST"] });
  });

  it("once all twelve levels are completed: nothing to start, every level still open to replay, nothing reset", () => {
    let s = level12Done();
    expect(LEVELS.map((l) => levelStatus(s, l).kind)).toEqual(Array(12).fill("completed"));
    expect(allLevelsComplete(s)).toBe(true);
    expect(mainAction(s)).toBeNull();
    s = refresh(run(s, { type: "goHome" }));
    expect(allLevelsComplete(s)).toBe(true);
    for (const level of LEVELS) expect(canPlay(s, level.id)).toBe(true);
    // Nothing was reset by finishing: every level keeps its last result.
    for (const level of LEVELS) expect(s.levels[level.id]).toMatchObject({ stage: "results", records: { travelDone: true } });
    // Playing one again clears only its place; it and every other level stay completed.
    for (const id of [L3, L6, L9, L11, L12]) {
      const again = run(s, restart(id));
      expect(again.levels[id]).toMatchObject({ stage: "discover", records: { travelDone: true } });
      for (const other of [...EARLIER, L12].filter((x) => x !== id)) expect(again.levels[other]).toBe(s.levels[other]);
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
      // Every journey the choices allow, to the destination, the end of the crossings or a stop off course: at each
      // step the choices are exactly the current country's neighbours not on the route, so none repeats a country.
      const walk = (attempt: ReturnType<typeof createAttempt>) => {
        const here = attempt.path.at(-1)!;
        const offered = availableMoves(attempt, graph);
        if (attempt.status !== "playing" || travelStop(attempt, graph)) return expect(offered).toEqual([]);
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

  /**
   * Every state of a journey that goes on (crossings left, not arrived, not stopped: travelStop) with fewer than two
   * choices, a non-neighbour option shown there (Level 7's France) counting as one: "route:[choices]".
   */
  const forcedStates = (lesson: (typeof LESSON_VERSIONS)[number], mission = lesson.travel.mission) => {
    const found: string[] = [];
    const walk = (attempt: ReturnType<typeof createAttempt>) => {
      const offered = availableMoves(attempt, lesson.borders);
      const shown = travelChoices(attempt, lesson.borders, lesson.travel.nonNeighbourOptions).map((c) => c.country);
      if (attempt.status === "playing" && !travelStop(attempt, lesson.borders) && shown.length < 2) found.push(`${attempt.path.join(">")}:[${shown.join(",")}]`);
      for (const next of offered) walk(move(attempt, lesson.borders, next).attempt);
    };
    walk(createAttempt(lesson.borders, mission));
    return found.sort();
  };

  it("never offer a single move as though it led anywhere: every state that goes on has a choice", () => {
    // Until 2026-10-25 a single card was offered after some wrong turns, the destination already out of reach
    // (docs/MOBILE.md, "Travel states with a single choice"): Level 4's Bosnia and Herzegovina, Level 5's Romania or
    // Serbia, Level 6's Belarus or Lithuania, Level 7's Andorra. The journey now stops there (below).
    const forced = Object.fromEntries(LEVELS.map((level) => [level.id, forcedStates(level.lesson!)]));
    expect(forced).toEqual(Object.fromEntries(LEVELS.map((level) => [level.id, []])));
  });

  it("stops off course where a single card used to be offered, with crossings left, explaining nothing was moved", () => {
    const lessonOf = (id: string) => LEVELS.find((l) => l.id === id)!.lesson!;
    const ROUTES: [string, string[], string][] = [
      [L4, ["MNE", "HRV", "BIH"], "SRB"],
      // Montenegro → Serbia is itself the wrong turn: the journey stops in Serbia, a step before the old single card.
      [L4, ["MNE", "SRB"], "BIH"],
      [L5, ["HUN", "ROU", "SRB"], "BGR"],
      [L5, ["HUN", "SRB", "ROU"], "BGR"],
      [L6, ["POL", "BLR", "LTU"], "LVA"],
      [L6, ["POL", "LTU", "BLR"], "LVA"],
      [L7, ["PRT", "ESP", "AND"], "FRA"],
    ];
    for (const [id, route, card] of ROUTES) {
      const lesson = lessonOf(id);
      let a = createAttempt(lesson.borders, lesson.travel.mission);
      for (const country of route.slice(1)) a = move(a, lesson.borders, country).attempt;
      const where = `${id}: ${route.join(">")}`;
      expect(a.path, where).toEqual(route);
      expect(a.status, where).toBe("playing");
      expect(travelStop(a, lesson.borders), where).toBe("offCourse");
      expect(travelChoices(a, lesson.borders, lesson.travel.nonNeighbourOptions), where).toEqual([]);
      // The old single card is a real neighbour, but no move: nothing is invented, nothing narrowed while it can arrive.
      expect(lesson.borders[route.at(-1)!], where).toContain(card);
      expect(move(a, lesson.borders, card).outcome, where).toBe("invalid");
      // Undo goes back to a state that goes on; Restart to the start.
      expect(travelStop(undo(a), lesson.borders), where).toBeNull();
      expect(availableMoves(undo(a), lesson.borders), where).toContain(route.at(-1));
    }
  });

  it("show a non-neighbour option only where it is none: never an edge, a neighbour there, on the route or the destination", () => {
    const withOptions = LESSON_VERSIONS.filter((lesson) => lesson.travel.nonNeighbourOptions?.length);
    // Level 7's Portugal start, and Level 12's Estonia start (Finland, across the Gulf of Finland).
    expect(withOptions.map((lesson) => lesson.id)).toEqual(["iberian-journey", "russia-and-western-neighbours"]);
    for (const lesson of withOptions) {
      const { from, to } = lesson.travel.mission;
      for (const { route, country } of lesson.travel.nonNeighbourOptions!) {
        expect(route[0], lesson.id).toBe(from);
        expect(isConnectedRoute(lesson.borders, route), lesson.id).toBe(true);
        expect(lesson.borders[route.at(-1)!], `${lesson.id}: ${country}`).not.toContain(country);
        expect(lesson.borders[country] ?? [], `${lesson.id}: ${country}`).not.toContain(route.at(-1)!);
        expect(route).not.toContain(country);
        expect(country).not.toBe(to);
        expect(travelCountries(lesson)).toContain(country);
      }
    }
  });

  it("never put a Travel-only country on a shortest route, in Discover or in Find; journeys keep their crossings", () => {
    const budgets: Record<string, number> = { [L1]: 2, [L2]: 2, [L3]: 2, [L4]: 3, [L5]: 3, [L6]: 3, [L7]: 3, [L8]: 2, [L9]: 2, [L10]: 2, [L11]: 2, [L12]: 2 };
    for (const level of LEVELS) {
      const lesson = level.lesson!;
      const { from, to } = lesson.travel.mission;
      const budget = shortestDistance(lesson.borders, from, to)!;
      expect(budget, level.id).toBe(budgets[level.id]);
      for (const id of lesson.travelOnly ?? []) {
        expect(lesson.countries, id).not.toContain(id);
        // Through it, the journey takes more crossings than its budget.
        expect(shortestDistance(lesson.borders, from, id)! + shortestDistance(lesson.borders, id, to)!, `${level.id}: ${id}`).toBeGreaterThan(budget);
      }
    }
    // Level 4's earlier journey, Italy → Montenegro, keeps its three crossings and its one route too.
    expect(shortestDistance(adriatic.borders, "ITA", "MNE")).toBe(3);
    for (const id of adriatic.travelOnly!) expect(shortestDistance(adriatic.borders, "ITA", id)! + shortestDistance(adriatic.borders, id, "MNE")!).toBeGreaterThan(3);
    // Discover and Find: the level's five only.
    for (const lesson of [adriatic, eastern, nordic, channel]) {
      const id = LEVELS.find((l) => l.lesson === lesson)!.id;
      // Opened at Discover (Levels 4, 8 and 10 played again, Level 11 for the first time).
      let s = run(level10Done(), restart(id));
      expect(s.levels[id].stage).toBe("discover");
      expect(buildMapView(lesson, s.levels[id], NO_UI).labels).toEqual([...lesson.countries]);
      for (const extra of lesson.travelOnly!) expect(run(s, play({ type: "discoverSelect", country: extra }))).toBe(s);
      s = run(s, play(startFindingAction(lesson, seededRandom(1))));
      expect([...s.levels[id].find!.order].sort()).toEqual([...lesson.countries].sort());
    }
  });
});

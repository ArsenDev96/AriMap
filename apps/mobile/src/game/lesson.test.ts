import { describe, expect, it } from "vitest";
import { getCountry } from "@/core/content/countries";
import type { CountryId } from "@/core/content/types";
import { travelChoices, travelStop } from "@/core/game/travel";
import { buildMapView } from "@/core/lesson/mapView";
import type { LessonAction } from "@/core/lesson/progress";
import { attemptRating } from "@/core/lesson/rating";
import { getLevel } from "@/core/lessons";
import { westernEuropeLesson as lesson } from "@/core/lessons/western-europe";
import { activeProgress, appReducer, canPlay, continentStars, createInitialState, levelStatus, levelToContinue, mainAction, nextLevel, type AppState } from "@/core/progress/appState";
import { loadAppState, saveAppState, STORAGE_KEY, type KeyValueStorage } from "@/core/progress/storage";
import { regionMapFor, viewLimits } from "@/geo/regionMap";
import { mapPadding, toScreen } from "../map/camera";
import { countryAt } from "../map/pick";
import { cardActions } from "./levelActions";
import { acceptPress, PRESS_GAP_MS } from "./pressGuard";

/*
 * Level 1 played as the app plays it: the level card's action, then taps on the map resolved to countries as the map
 * resolves them (pick.ts, on the level's real map at a phone's size), the panels' buttons, and the native store
 * (an in-memory one here, behind the same KeyValueStorage) saved and read by the shared storage code. The rules
 * themselves are the website's (src/core), tested there in depth; this checks the app drives them as the website does.
 */

const L1 = lesson.id;
const L2 = "around-the-alps";
const ORDER = ["FRA", "BEL", "NLD", "LUX", "DEU"];

const [W, H] = [380, 320];
const map = regionMapFor(lesson);
const camera = viewLimits(map, W, H, mapPadding(W, H)).base;
/** A tap on the map at a country's label point (or any place), resolved as the map resolves it. */
const tapOn = (lonLat: readonly [number, number]) => countryAt(map.shapes, lesson.countries, camera, toScreen(camera, map.project(lonLat)));
const tapCountry = (id: CountryId) => tapOn(getCountry(id).label.coordinates)!;

const step = (s: AppState, action: LessonAction) => appReducer(s, { type: "lesson", action });
const progress = (s: AppState) => s.levels[L1];

/** A tap on the map in the current stage, as LessonScreen handles it. */
function tap(s: AppState, country: CountryId | null): AppState {
  const p = activeProgress(s);
  if (!country) return s;
  if (p.stage === "discover") return lesson.countries.includes(country) ? step(s, { type: "discoverSelect", country }) : s;
  if (p.stage === "find") return step(s, { type: "findGuess", country });
  return s;
}

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

/** Opens Level 1 from its card, as the level selection does. */
function open(s: AppState): AppState {
  const actions = cardActions(s, getLevel(L1)!);
  expect(actions?.main.kind).toBe("open");
  return appReducer(s, { type: "openLevel", levelId: L1 });
}

/** Discover, then Find in ORDER with every answer on the first try (unless `answer` says otherwise). */
function throughFind(s: AppState, answer: (target: CountryId, s: AppState) => AppState = (t, st) => tap(st, tapCountry(t))): AppState {
  s = open(s);
  for (const id of lesson.countries) s = tap(s, tapCountry(id));
  s = step(s, { type: "startFinding", order: ORDER });
  for (const target of ORDER) {
    s = answer(target, s);
    s = step(s, { type: activeProgress(s).find!.index === ORDER.length - 1 ? "findToTravel" : "findNext" });
  }
  return s;
}

const travel = (s: AppState, ...route: CountryId[]) => route.reduce((acc, c) => step(acc, { type: "travelMove", country: c }), s);

describe("Level 1 in the app", () => {
  it("Discover: tapping each country selects and explores it; a faded neighbour selects nothing", () => {
    let s = open(createInitialState());
    expect(progress(s)).toMatchObject({ started: true, stage: "discover" });
    s = tap(s, tapOn([8.2, 46.8]));
    expect(progress(s).discover).toEqual({ selected: null, explored: [] });
    for (const id of lesson.countries) s = tap(s, tapCountry(id));
    expect(progress(s).discover).toEqual({ selected: "DEU", explored: lesson.countries });
    expect(buildMapView(lesson, progress(s), { travelHintVisible: false }).namesPublic).toBe(true);
  });

  it("Find: a correct tap answers; a wrong one says which country it was and counts; a faded one doesn't count", () => {
    let s = step(open(createInitialState()), { type: "startFinding", order: ORDER });
    // Asked for France: Belgium, then Switzerland, then France.
    s = tap(s, tapCountry("BEL"));
    expect(progress(s).find!.question).toMatchObject({ wrongGuesses: ["BEL"], solved: false, feedback: { kind: "wrong", country: "BEL" } });
    s = tap(s, tapOn([8.2, 46.8]));
    expect(progress(s).find!.question).toMatchObject({ wrongGuesses: ["BEL"], feedback: { kind: "outside" } });
    s = tap(s, tapCountry("FRA"));
    expect(progress(s).find!.question).toMatchObject({ solved: true, feedback: { kind: "correct", country: "FRA" } });
    expect(progress(s).find!.results).toEqual([{ target: "FRA", wrongGuesses: 1, hintLevel: 0, independent: false }]);
    // Once answered, the map takes no answers (the map view says so) and more taps change nothing.
    expect(buildMapView(lesson, progress(s), { travelHintVisible: false }).interactive).toBe(false);
    expect(tap(s, tapCountry("DEU"))).toBe(s);
  });

  it("Find: five questions in order, Next only once answered, Travel only after the last", () => {
    let s = step(open(createInitialState()), { type: "startFinding", order: ORDER });
    expect(step(s, { type: "findNext" })).toBe(s);
    expect(step(s, { type: "findToTravel" })).toBe(s);
    for (const [i, target] of ORDER.entries()) {
      expect(progress(s).find).toMatchObject({ index: i, question: { target } });
      s = tap(s, tapCountry(target));
      if (i < ORDER.length - 1) {
        s = step(s, { type: "findNext" });
        // A second Next (a double tap) moves no further: the new question isn't answered.
        expect(step(s, { type: "findNext" })).toBe(s);
      }
    }
    expect(step(s, { type: "findNext" })).toBe(s);
    s = step(s, { type: "findToTravel" });
    expect(progress(s)).toMatchObject({ stage: "travel", records: { findDone: true, lastFindScore: { independent: 5, total: 5 } } });
    expect(step(s, { type: "findToTravel" })).toBe(s);
  });

  it("Travel: the cards offer only neighbours not yet on the route; anything else changes nothing", () => {
    let s = throughFind(createInitialState());
    const choices = () => travelChoices(activeProgress(s).travel!, lesson.borders, lesson.travel.nonNeighbourOptions).map((c) => c.country);
    expect(choices()).toEqual(["BEL", "LUX", "DEU"]);
    // The Netherlands share no border with France; France is where the traveller is.
    expect(travel(s, "NLD")).toBe(s);
    expect(travel(s, "FRA")).toBe(s);
    s = travel(s, "BEL");
    expect(choices()).toEqual(["NLD", "LUX", "DEU"]);
    // A double tap on Belgium's card: Belgium is already on the route.
    expect(travel(s, "BEL")).toBe(s);
  });

  it("Travel: a wrong turn stops the journey off course; Undo and Retry go on, and count as help", () => {
    let s = throughFind(createInitialState());
    expect(activeProgress(s).travel!.budget).toBe(2);
    // Luxembourg, the wrong turn: the Netherlands is then two crossings away with one left, so the journey stops there.
    s = travel(s, "LUX");
    expect(activeProgress(s).travel).toMatchObject({ status: "playing", path: ["FRA", "LUX"] });
    expect(travelStop(activeProgress(s).travel!, lesson.borders)).toBe("offCourse");
    expect(travelChoices(activeProgress(s).travel!, lesson.borders)).toEqual([]);
    for (const country of ["BEL", "DEU", "NLD"]) expect(travel(s, country)).toBe(s);
    s = step(s, { type: "travelUndo" });
    s = step(s, { type: "travelRestart" });
    expect(activeProgress(s).travel).toMatchObject({ status: "playing", path: ["FRA"], undoUsed: true });
    s = travel(s, "BEL", "NLD");
    expect(progress(s)).toMatchObject({ stage: "results", lastTravelResult: { route: ["FRA", "BEL", "NLD"], independent: false } });
    // Every answer on the first try, but help on the journey: 2 stars.
    expect(attemptRating(progress(s))).toBe(2);
  });

  it("Results: three stars for a perfect attempt, saved with completion; Level 2 opens", () => {
    let s = travel(throughFind(createInitialState()), "DEU", "NLD");
    expect(progress(s)).toMatchObject({ stage: "results", records: { travelDone: true, travelWithoutHelp: true, bestRating: 3 } });
    expect(attemptRating(progress(s))).toBe(3);
    expect(continentStars(s, "europe")).toMatchObject({ earned: 3 });
    expect(canPlay(s, L2)).toBe(true);
    expect(nextLevel(s, L1)?.id).toBe(L2);
    // Saved and read back as the app does at its next launch.
    const store = memoryStorage();
    saveAppState(store, s);
    const again = loadAppState(store);
    expect(again.levels[L1].records).toEqual(progress(s).records);
    expect(levelStatus(again, getLevel(L1)!).kind).toBe("completed");
    expect(levelStatus(again, getLevel(L2)!).kind).toBe("ready");
    expect(mainAction(again, "europe")).toMatchObject({ kind: "start", level: { id: L2 } });
  });

  it("Results: one hint in Find gives 2 stars; two answers with help give 1", () => {
    const withHelp = (helped: number) => (target: CountryId, s: AppState) => {
      if (ORDER.indexOf(target) < helped) s = step(s, { type: "findHint" });
      return tap(s, tapCountry(target));
    };
    expect(progress(travel(throughFind(createInitialState(), withHelp(1)), "DEU", "NLD")).records.bestRating).toBe(2);
    expect(progress(travel(throughFind(createInitialState(), withHelp(2)), "DEU", "NLD")).records.bestRating).toBe(1);
  });

  it("replaying: the card shows View results and Play again; playing again never lowers the best or the completion", () => {
    let s = travel(throughFind(createInitialState()), "DEU", "NLD");
    s = appReducer(s, { type: "openContinent", continent: "europe" });
    expect(cardActions(s, getLevel(L1)!)).toEqual({ main: { kind: "open", label: "welcome.viewResults" }, other: { kind: "restart", mode: "playAgain" } });
    // Play again (after the confirmation): Discover, records kept.
    s = appReducer(s, { type: "restartLevel", levelId: L1 });
    expect(progress(s)).toMatchObject({ stage: "discover", records: { travelDone: true, bestRating: 3 } });
    expect(cardActions(s, getLevel(L1)!)).toEqual({ main: { kind: "open", label: "welcome.continue" }, other: { kind: "restart", mode: "playAgain" } });
    // A worse attempt: 1 star now, 3 kept as the best.
    s = step(s, { type: "startFinding", order: ORDER });
    for (const target of ORDER) {
      if (ORDER.indexOf(target) < 2) s = step(s, { type: "findHint" });
      s = tap(s, tapCountry(target));
      s = step(s, { type: target === "DEU" ? "findToTravel" : "findNext" });
    }
    s = travel(s, "DEU", "NLD");
    expect(attemptRating(progress(s))).toBe(1);
    expect(progress(s).records.bestRating).toBe(3);
    expect(continentStars(s, "europe").earned).toBe(3);
    // Replay journey: Travel alone, rated by no one.
    s = step(s, { type: "replayTravel" });
    s = travel(s, "BEL", "NLD");
    expect(attemptRating(progress(s))).toBeNull();
    expect(progress(s).records.bestRating).toBe(3);
  });

  it("leaving mid-lesson keeps the place: Continue resumes the same question after the app restarts", () => {
    let s = step(open(createInitialState()), { type: "startFinding", order: ORDER });
    s = tap(s, tapCountry("FRA"));
    s = step(s, { type: "findNext" });
    s = tap(s, tapCountry("NLD"));
    // Back to the levels, then Home (as the screens' focus does), and the app closed.
    s = appReducer(appReducer(s, { type: "openContinent", continent: "europe" }), { type: "goHome" });
    const store = memoryStorage();
    saveAppState(store, s);
    expect(store.data.has(STORAGE_KEY)).toBe(true);
    const again = loadAppState(store);
    expect(levelToContinue(again)?.id).toBe(L1);
    expect(cardActions(again, getLevel(L1)!)).toEqual({ main: { kind: "open", label: "welcome.continue" }, other: { kind: "restart", mode: "startOver" } });
    const resumed = appReducer(again, { type: "openLevel", levelId: L1 });
    expect(resumed.levels[L1]).toMatchObject({ stage: "find", find: { index: 1, question: { target: "BEL", wrongGuesses: ["NLD"], solved: false } } });
    // Nothing completed, nothing unlocked.
    expect(resumed.levels[L1].records).toMatchObject({ discoverDone: true, findDone: false, travelDone: false, bestRating: null });
    expect(canPlay(resumed, L2)).toBe(false);
  });

  it("Start over (after the confirmation) clears the place only", () => {
    let s = step(open(createInitialState()), { type: "startFinding", order: ORDER });
    s = appReducer(s, { type: "restartLevel", levelId: L1 });
    expect(progress(s)).toMatchObject({ stage: "discover", find: null, records: { discoverDone: true } });
  });

  it("a press within the guard's gap after another is ignored; one after it goes through", () => {
    expect(acceptPress(null, 1000)).toBe(true);
    expect(acceptPress(1000, 1000 + PRESS_GAP_MS - 1)).toBe(false);
    expect(acceptPress(1000, 1000 + PRESS_GAP_MS)).toBe(true);
    // A clock set back never locks the buttons.
    expect(acceptPress(5000, 1000)).toBe(true);
  });
});

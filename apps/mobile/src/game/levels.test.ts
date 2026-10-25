/// <reference types="node" />
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { getCountry } from "@/core/content/countries";
import type { CountryId } from "@/core/content/types";
import { shortestPath } from "@/core/game/graph";
import { travelChoices } from "@/core/game/travel";
import type { LessonAction } from "@/core/lesson/progress";
import { attemptRating } from "@/core/lesson/rating";
import { getLevel, levelsOf, levelVersions, type LessonDefinition } from "@/core/lessons";
import { activeLesson, activeProgress, appReducer, canPlay, continentStars, createInitialState, levelStatus, nextLevel, type AppState } from "@/core/progress/appState";
import { loadAppState, saveAppState, type KeyValueStorage } from "@/core/progress/storage";
import { loadMapData, regionMapFor, viewLimits, type RegionMap } from "@/geo/regionMap";
import { mapPadding, toScreen } from "../map/camera";
import { countryAt, ringsFor } from "../map/pick";
import { cardActions } from "./levelActions";
import { isPlayableInApp } from "./playable";

/*
 * Every European level played as the app plays it, on its real map: Discover and Find answered by taps resolved as
 * the map resolves them (pick.ts, small-country rings included) at phone sizes, Travel by its cards, Results and the
 * saved game by the shared code. The rules are the website's (src/core), tested there in depth; this checks the app
 * can drive every level through them, and that each level's countries can be tapped on a phone.
 */

const EUROPE = levelsOf("europe");
/** The levels the app plays: Level 1 and those after it, in order. */
const PLAYABLE = EUROPE.filter((level) => isPlayableInApp(level.id));

/**
 * Lesson maps on phones: a 360dp-wide phone's portrait map (the screen less its gutters, 40% of the height), the same
 * at 200% text (34%), and a 320dp phone's at 200% text, the smallest (LessonScreen's layout).
 */
const SIZES: readonly (readonly [number, number])[] = [
  [328, 320],
  [328, 272],
  [288, 193],
];

/** The landmark pictures the app bundles, by key (components/landmarkImages.ts, read as text: its requires are Metro's). */
const PICTURES = new Set(
  [...readFileSync(new URL("../components/landmarkImages.ts", import.meta.url), "utf8").matchAll(/^\s+"?([a-z-]+)"?: require\("@\/assets\/landmarks\/\1\.webp"\)/gm)].map((m) => m[1]),
);

const maps = new Map<string, RegionMap>();
beforeAll(async () => {
  for (const level of EUROPE) {
    for (const { lesson } of levelVersions(level)) {
      await loadMapData(lesson.map.dataset);
      maps.set(`${lesson.id}@${lesson.revision ?? 1}`, regionMapFor(lesson));
    }
  }
});
const mapOf = (lesson: LessonDefinition) => maps.get(`${lesson.id}@${lesson.revision ?? 1}`)!;

/** A country's label point on the level's map, in world units (LessonMap's). */
const labelAt = (map: RegionMap, id: CountryId) => map.project(map.labels[id] ?? getCountry(id).label.coordinates);

/** A tap on a country's label point in the start view of a map of size [w, h], resolved as LessonMap resolves it. */
function tapAt(lesson: LessonDefinition, [w, h]: readonly [number, number], id: CountryId): CountryId | null {
  const map = mapOf(lesson);
  const camera = viewLimits(map, w, h, mapPadding(w, h)).base;
  const rings = ringsFor(map.shapes, lesson.countries, camera, map.project);
  return countryAt(map.shapes, lesson.countries, camera, toScreen(camera, labelAt(map, id)), rings);
}

const step = (s: AppState, action: LessonAction) => appReducer(s, { type: "lesson", action });

/** A tap on the map in the current stage, as LessonScreen handles it. */
function tap(s: AppState, country: CountryId | null): AppState {
  const lesson = activeLesson(s);
  const p = activeProgress(s);
  if (!country) return s;
  if (p.stage === "discover") return lesson.countries.includes(country) ? step(s, { type: "discoverSelect", country }) : s;
  if (p.stage === "find") return step(s, { type: "findGuess", country });
  return s;
}

function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

/**
 * A level from its card to Travel on the phone map `size`: every country explored, and every Find answer tapped on
 * the first try (`helped` of them after a hint).
 */
function toTravel(s: AppState, levelId: string, size: readonly [number, number] = SIZES[0], helped = 0): AppState {
  const actions = cardActions(s, getLevel(levelId)!);
  expect(actions?.main.kind, levelId).toMatch(/^(open|restart)$/);
  s = actions!.main.kind === "restart" ? appReducer(s, { type: "restartLevel", levelId }) : appReducer(s, { type: "openLevel", levelId });
  const lesson = activeLesson(s);
  expect(lesson.id).toBe(levelId);
  for (const id of lesson.countries) s = tap(s, tapAt(lesson, size, id));
  expect(activeProgress(s).discover.explored, levelId).toEqual(lesson.countries);
  const order = [...lesson.countries];
  s = step(s, { type: "startFinding", order });
  for (const [i, target] of order.entries()) {
    if (i < helped) s = step(s, { type: "findHint" });
    s = tap(s, tapAt(lesson, size, target));
    expect(activeProgress(s).find!.question.solved, `${levelId}: ${target}`).toBe(true);
    s = step(s, { type: i === order.length - 1 ? "findToTravel" : "findNext" });
  }
  expect(activeProgress(s).stage, levelId).toBe("travel");
  return s;
}

/** A level from its card to Results (toTravel), the journey on a shortest route by its cards. */
function play(s: AppState, levelId: string, size: readonly [number, number] = SIZES[0], helped = 0): AppState {
  s = toTravel(s, levelId, size, helped);
  const lesson = activeLesson(s);
  const attempt = activeProgress(s).travel!;
  const route = shortestPath(lesson.borders, attempt.from, attempt.to)!;
  expect(route.length - 1, levelId).toBe(attempt.budget);
  for (const country of route.slice(1)) {
    // Each move is one of the cards the panel shows.
    const cards = travelChoices(activeProgress(s).travel!, lesson.borders, lesson.travel.nonNeighbourOptions);
    expect(cards.map((c) => c.country), `${levelId}: ${country}`).toContain(country);
    s = step(s, { type: "travelMove", country });
  }
  expect(activeProgress(s).stage, levelId).toBe("results");
  return s;
}

describe("every European level in the app", () => {
  it("are played in the app, from Level 1 on, each with its landmarks' pictures", () => {
    expect(EUROPE).toHaveLength(12);
    expect(PLAYABLE.map((l) => l.id)).toEqual(EUROPE.slice(0, PLAYABLE.length).map((l) => l.id));
    for (const level of PLAYABLE) {
      for (const { lesson } of levelVersions(level)) {
        for (const id of lesson.countries) {
          const illustration = getCountry(id).landmark?.illustration;
          if (illustration) expect(PICTURES.has(illustration), `${level.id}: ${illustration}`).toBe(true);
        }
      }
    }
  });

  it("each country can be tapped at its label point at the start view of every phone map, tiny ones by their ring", () => {
    for (const level of PLAYABLE) {
      for (const { lesson } of levelVersions(level)) {
        for (const size of SIZES) {
          for (const id of lesson.countries) expect(tapAt(lesson, size, id), `${level.id} r${lesson.revision ?? 1} ${size.join("x")}: ${id}`).toBe(id);
        }
      }
    }
  });

  it("rings only the countries drawn smaller than a ring: Luxembourg on the smallest map, and Andorra", () => {
    const ringed = (levelId: string, size: readonly [number, number]) => {
      const lesson = getLevel(levelId)!.lesson!;
      const map = mapOf(lesson);
      const camera = viewLimits(map, size[0], size[1], mapPadding(size[0], size[1])).base;
      return ringsFor(map.shapes, lesson.countries, camera, map.project).map((r) => r.id);
    };
    expect(ringed("western-europe-1", SIZES[2])).toEqual(["LUX"]);
    for (const size of SIZES) expect(ringed("iberian-journey", size)).toEqual(["AND"]);
    for (const level of EUROPE) for (const size of SIZES) expect(ringed(level.id, size).every((id) => id === "AND" || id === "LUX"), level.id).toBe(true);
  });

  it("in order, from a new game: each perfect, saved, and opening the next", () => {
    let s = createInitialState();
    const store = memoryStorage();
    for (const [i, level] of PLAYABLE.entries()) {
      expect(canPlay(s, level.id), level.id).toBe(true);
      if (i + 1 < EUROPE.length) expect(canPlay(s, EUROPE[i + 1].id), EUROPE[i + 1].id).toBe(false);
      s = play(s, level.id, SIZES[i % SIZES.length]);
      expect(attemptRating(activeProgress(s)), level.id).toBe(3);
      expect(activeProgress(s).records).toMatchObject({ discoverDone: true, findDone: true, travelDone: true, bestRating: 3 });
      // Saved, and read back as at the app's next launch.
      saveAppState(store, s);
      s = loadAppState(store);
      expect(levelStatus(s, level).kind, level.id).toBe("completed");
      // Results offers the next level, and none after the last.
      const next = nextLevel(s, level.id);
      if (i + 1 < EUROPE.length) {
        expect(next?.id).toBe(EUROPE[i + 1].id);
        expect(canPlay(s, next!.id)).toBe(true);
      } else expect(next).toBeNull();
    }
    expect(continentStars(s, "europe")).toEqual({ earned: 3 * PLAYABLE.length, max: 36 });
  });

  it("an assisted run earns fewer stars, and a later perfect one raises the best; a worse replay never lowers it", () => {
    let s = createInitialState();
    const levels = PLAYABLE.slice(0, 4);
    for (const level of levels) {
      s = play(s, level.id, SIZES[0], 1);
      expect(attemptRating(activeProgress(s)), level.id).toBe(2);
    }
    expect(continentStars(s, "europe").earned).toBe(2 * levels.length);
    const last = levels[levels.length - 1].id;
    s = play(s, last);
    expect(activeProgress(s).records.bestRating).toBe(3);
    s = play(s, last, SIZES[1], 2);
    expect(attemptRating(activeProgress(s))).toBe(1);
    expect(activeProgress(s).records.bestRating).toBe(3);
    expect(continentStars(s, "europe").earned).toBe(2 * levels.length + 1);
  });

  it("leaving a level mid-lesson completes nothing and opens nothing; Continue resumes it", () => {
    let s = createInitialState();
    const level = PLAYABLE[PLAYABLE.length - 1];
    const lesson = level.lesson!;
    for (const before of PLAYABLE.slice(0, -1)) s = play(s, before.id);
    s = appReducer(s, { type: "openLevel", levelId: level.id });
    const [first, second] = lesson.countries;
    s = tap(s, tapAt(lesson, SIZES[2], first));
    s = step(s, { type: "startFinding", order: [...lesson.countries] });
    s = tap(s, tapAt(lesson, SIZES[2], second));
    const store = memoryStorage();
    saveAppState(store, appReducer(s, { type: "goHome" }));
    s = loadAppState(store);
    expect(levelStatus(s, level).kind).not.toBe("completed");
    expect(s.levels[level.id].records).toMatchObject({ findDone: false, travelDone: false, bestRating: null });
    expect(continentStars(s, "europe").earned).toBe(3 * (PLAYABLE.length - 1));
    s = appReducer(s, { type: "openLevel", levelId: level.id });
    expect(activeProgress(s)).toMatchObject({ stage: "find", find: { index: 0, question: { target: first, wrongGuesses: [second], solved: false } } });
  });

  it("Level 7: Andorra answered through its ring; France, shown at the start, moves nothing and says so", () => {
    let s = createInitialState();
    for (const level of PLAYABLE.slice(0, 6)) s = play(s, level.id);
    const lesson = getLevel("iberian-journey")!.lesson!;
    s = appReducer(s, { type: "openLevel", levelId: lesson.id });
    s = step(s, { type: "startFinding", order: ["AND", "PRT", "ESP", "FRA", "ITA"] });
    // The smallest map: Andorra is a few pixels across, its ring 24.
    const [w, h] = SIZES[2];
    const map = mapOf(lesson);
    const camera = viewLimits(map, w, h, mapPadding(w, h)).base;
    const [ring] = ringsFor(map.shapes, lesson.countries, camera, map.project);
    expect(ring.id).toBe("AND");
    // Near the ring's edge, over Spain or France: still Andorra.
    s = tap(s, countryAt(map.shapes, lesson.countries, camera, [ring.x + 10, ring.y + 5], [ring]));
    expect(activeProgress(s).find!.question).toMatchObject({ target: "AND", solved: true, wrongGuesses: [] });
    for (const [i, target] of (["PRT", "ESP", "FRA", "ITA"] as const).entries()) {
      s = step(s, { type: "findNext" });
      s = tap(s, tapAt(lesson, SIZES[2], target));
      if (i === 3) s = step(s, { type: "findToTravel" });
    }
    const cards = travelChoices(activeProgress(s).travel!, lesson.borders, lesson.travel.nonNeighbourOptions);
    expect(cards).toEqual([
      { country: "ESP", neighbour: true },
      { country: "FRA", neighbour: false },
    ]);
    const after = step(s, { type: "travelMove", country: "FRA" });
    expect(activeProgress(after).travel!.path).toEqual(["PRT"]);
    expect(activeProgress(after).travelNotice).toMatchObject({ kind: "notNeighbour", country: "FRA" });
    // A non-neighbour chosen is no help used: the journey on, three stars.
    const done = (["ESP", "FRA", "ITA"] as const).reduce((acc, country) => step(acc, { type: "travelMove", country }), after);
    expect(attemptRating(activeProgress(done))).toBe(3);
  });

  it("Levels 4 and 8: the travel-only neighbours are offered as moves, and never learned", () => {
    for (const [levelId, extra] of [
      ["along-the-adriatic", ["HUN", "SRB"]],
      ["eastern-europe", ["LVA"]],
    ] as const) {
      const lesson = getLevel(levelId)!.lesson!;
      expect(lesson.travelOnly).toEqual(extra);
      for (const id of extra) expect(lesson.countries).not.toContain(id);
    }
    // Level 4, from Montenegro: Croatia, Bosnia and Herzegovina, and Serbia (travel-only).
    let s = createInitialState();
    for (const level of PLAYABLE.slice(0, 3)) s = play(s, level.id);
    s = toTravel(s, "along-the-adriatic");
    const lesson = activeLesson(s);
    expect(travelChoices(activeProgress(s).travel!, lesson.borders).map((c) => c.country)).toContain("SRB");
  });
});

describe("Travel states with a single choice (the shared rules, audited)", () => {
  it("in every current journey, a single choice comes only where the destination is already out of reach", () => {
    for (const level of EUROPE) {
      const lesson = level.lesson!;
      const opts = lesson.travel.nonNeighbourOptions;
      // Every state a journey can reach, by its cards.
      const walk = (path: CountryId[], left: number): void => {
        const here = path[path.length - 1];
        if (here === lesson.travel.mission.to || left === 0) return;
        const attempt = { missionId: lesson.travel.mission.id, from: path[0], to: lesson.travel.mission.to, budget: path.length - 1 + left, path, status: "playing" as const, hintUsed: false, undoUsed: false };
        const cards = travelChoices(attempt, lesson.borders, opts);
        if (cards.length === 1) {
          // One crossing left, and the one card isn't the destination: the journey runs out whatever is chosen.
          expect(left, `${level.id}: ${path.join(">")}`).toBe(1);
          expect(cards[0].country, `${level.id}: ${path.join(">")}`).not.toBe(lesson.travel.mission.to);
        }
        for (const c of cards.filter((c) => c.neighbour)) walk([...path, c.country], left - 1);
      };
      const budget = shortestPath(lesson.borders, lesson.travel.mission.from, lesson.travel.mission.to)!.length - 1;
      walk([lesson.travel.mission.from], budget);
    }
  });
});

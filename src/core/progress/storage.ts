import type { CountryId } from "../content/types";
import { isValidOrder, MAX_HINT_LEVEL, type FindAnswer, type FindFeedback, type FindQuestion, type FindSession, type HintLevel } from "../game/find";
import { crossingBudget, type TravelAttempt, type TravelStatus } from "../game/travel";
import { isConnectedRoute } from "../game/graph";
import { isLocale } from "../i18n/locales";
import { getLevel, hasPlayableLevels, isContinentId, LESSONS } from "../lessons";
import type { LessonDefinition } from "../lessons/types";
import {
  createLessonProgress,
  EMPTY_RECORDS,
  findScore,
  type FindScore,
  type LessonProgress,
  type LessonRecords,
  type LessonStage,
  type TravelResult,
} from "../lesson/progress";
import { attemptRating, betterRating, isStarRating } from "../lesson/rating";
import { canPlay, createInitialState, STATE_VERSION, type AppState } from "./appState";

export const STORAGE_KEY = "arimap:state";
/**
 * Where a save in another format (version 1, or a newer version this build
 * cannot read) is copied before it is replaced, so it is never lost silently.
 */
export const BACKUP_KEY = "arimap:state:backup";

/** Level 1's id, the only level in version 1 saves. */
const V1_LEVEL_ID = "western-europe-1";

/** Minimal storage interface so web (localStorage) and future native stores can plug in. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadAppState(storage: KeyValueStorage | null): AppState {
  if (!storage) return createInitialState();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    backUpOtherVersion(storage, raw);
    return parseSavedState(raw);
  } catch {
    return createInitialState();
  }
}

function backUpOtherVersion(storage: KeyValueStorage, raw: string | null) {
  if (!raw) return;
  try {
    const version = (JSON.parse(raw) as { version?: unknown } | null)?.version;
    if (version !== STATE_VERSION && storage.getItem(BACKUP_KEY) === null) storage.setItem(BACKUP_KEY, raw);
  } catch {
    // Not JSON, or storage full: nothing worth keeping, or no room to keep it.
  }
}

export function saveAppState(storage: KeyValueStorage | null, state: AppState): void {
  try {
    // "New best!" belongs to the moment it was earned: never saved, so a refresh never shows it again.
    storage?.setItem(STORAGE_KEY, JSON.stringify({ ...state, newBest: undefined }));
  } catch {
    // Storage full or blocked (private mode): the game keeps working in memory.
  }
}

// --- Parsing -------------------------------------------------------------
// Saved data is untrusted: anything missing or inconsistent is dropped or
// rebuilt from game rules. Derived values (budgets, statuses, "independent"
// flags) are recomputed, never read, so bad data cannot grant achievements.
// Each level is parsed on its own, so a malformed level never costs another
// level its progress.

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const STAGES: readonly LessonStage[] = ["discover", "find", "travel", "results"];

/**
 * Reads a save. Version 2 holds every level's progress (`levels`), the level
 * being played (`levelId`), the order the levels were last active in
 * (`recent`), the screen, and the continent whose levels were last shown
 * (`continent`, since continents were added). Version 1 held one level
 * (`lessonId`, `lessons`): its progress becomes Level 1's, which it always was.
 * Saves from the two-round Find are converted as before (see migrateLegacyFind).
 *
 * The screen reopens as saved: a level only if it is started and can be played;
 * a continent's level selection only if that continent has playable levels. A
 * save from before continents existed says "welcome" for the level selection,
 * which held Europe's levels then: it reopens there. Anything else opens the
 * continents. Builds from before continents read "continents" and "levels" as
 * their level selection, and ignore `continent`.
 */
export function parseSavedState(raw: string | null): AppState {
  if (!raw) return createInitialState();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return createInitialState();
  }
  if (!isObj(data)) return createInitialState();

  const locale = isLocale(data.locale) ? data.locale : undefined;
  const state = createInitialState(locale);
  let levels: unknown;
  let levelId: unknown;
  let recent: unknown;
  if (data.version === STATE_VERSION) {
    ({ levels, levelId, recent } = data);
  } else if (data.version === 1) {
    levels = isObj(data.lessons) ? { [V1_LEVEL_ID]: data.lessons[V1_LEVEL_ID] } : undefined;
    levelId = V1_LEVEL_ID;
  } else {
    // Unknown (e.g. future) versions: keep only the language preference (the save itself is backed up on load).
    return state;
  }

  if (isObj(levels)) {
    for (const [id, lesson] of Object.entries(LESSONS)) {
      const progress = parseLessonProgress(lesson, levels[id]);
      if (progress) state.levels[id] = progress;
    }
  }
  if (typeof levelId === "string" && levelId in LESSONS) state.levelId = levelId;
  // Most recent first, playable levels only, each once; a level with progress but missing here goes last.
  const listed = Array.isArray(recent) ? recent.filter((id): id is string => typeof id === "string" && id in LESSONS) : [];
  const started = Object.keys(state.levels).filter((id) => state.levels[id].started);
  state.recent = [...new Set([...(state.levels[state.levelId]?.started ? [state.levelId] : []), ...listed, ...started])];
  const continent = isContinentId(data.continent) && hasPlayableLevels(data.continent) ? data.continent : null;
  state.continent = continent ?? getLevel(state.levelId)!.continent;
  if (data.screen === "lesson" && state.levels[state.levelId]?.started && canPlay(state, state.levelId)) {
    state.screen = "lesson";
    state.continent = getLevel(state.levelId)!.continent;
  } else if (data.screen === "welcome" || (data.screen === "levels" && continent)) {
    state.screen = "levels";
  }
  return state;
}

export function parseLessonProgress(lesson: LessonDefinition, value: unknown): LessonProgress | null {
  if (!isObj(value)) return null;
  const progress = createLessonProgress(lesson, parseRecords(lesson, value.records));
  progress.started = value.started === true;

  const isActive = (v: unknown): v is CountryId => typeof v === "string" && lesson.countries.includes(v);
  if (isObj(value.discover)) {
    const d = value.discover;
    progress.discover = {
      selected: isActive(d.selected) ? d.selected : null,
      explored: Array.isArray(d.explored) ? [...new Set(d.explored.filter(isActive))] : [],
    };
  }
  progress.find = parseFindSession(lesson, isLegacyFind(value.find) ? migrateLegacyFind(value.find) : value.find);
  progress.travel = parseTravelAttempt(lesson, value.travel);
  progress.lastTravelResult = parseTravelResult(lesson, value.lastTravelResult);

  // A completed Find whose score was dropped (an old two-round score, see parseScore)
  // is scored again from its answers.
  if (progress.records.findDone && progress.find?.status === "complete") {
    const score = findScore(progress.find);
    progress.records.lastFindScore ??= score;
    progress.records.bestFindScore ??= score;
  }

  // The old round summary ("findSummary") resumes as Find, on its last answered question.
  const saved = value.stage === "findSummary" ? "find" : value.stage;
  const stage = STAGES.includes(saved as LessonStage) ? (saved as LessonStage) : "discover";
  progress.stage = stageIsConsistent(stage, progress) ? stage : "discover";

  // A journey replay is only ever in Travel or at its Results. Saves from before ratings don't say:
  // a journey under way in a completed level may be one, so it is taken as one (never rated).
  const replay = typeof value.journeyReplay === "boolean" ? value.journeyReplay : progress.stage === "travel" && progress.records.travelDone;
  progress.journeyReplay = replay && progress.records.findDone && (progress.stage === "travel" || progress.stage === "results");
  // The rating of the Results kept (a full attempt's, with its complete Find and journey) counts
  // towards the best: so a save from before ratings gets the stars its own results support, and a
  // completion record alone gets none.
  progress.records.bestRating = betterRating(progress.records.bestRating, attemptRating(progress));
  return progress;
}

function stageIsConsistent(stage: LessonStage, p: LessonProgress): boolean {
  switch (stage) {
    case "discover":
      return true;
    case "find":
      return p.find?.status === "asking";
    case "travel":
      return p.travel !== null && p.travel.status !== "arrived";
    case "results":
      return p.travel?.status === "arrived" && p.lastTravelResult !== null;
  }
}

/** A Find score is out of the lesson's countries; others (from the old two-round Find, out of twice as many) are dropped. */
function parseScore(lesson: LessonDefinition, v: unknown): FindScore | null {
  if (!isObj(v) || !isInt(v.independent) || v.total !== lesson.countries.length) return null;
  if (v.independent < 0 || v.independent > v.total) return null;
  return { independent: v.independent, total: v.total };
}

function parseRecords(lesson: LessonDefinition, v: unknown): LessonRecords {
  if (!isObj(v)) return { ...EMPTY_RECORDS };
  return {
    discoverDone: v.discoverDone === true,
    findDone: v.findDone === true,
    travelDone: v.travelDone === true,
    lastFindScore: parseScore(lesson, v.lastFindScore),
    bestFindScore: parseScore(lesson, v.bestFindScore),
    travelWithoutHelp: v.travelWithoutHelp === true,
    // A rating is only ever earned by completing the level; anything else stored is ignored.
    bestRating: isStarRating(v.bestRating) && v.travelDone === true ? v.bestRating : null,
  };
}

function parseHintLevel(v: unknown): HintLevel {
  // Malformed hint data is treated as fully assisted rather than independent.
  return isInt(v) && v >= 0 && v <= MAX_HINT_LEVEL ? (v as HintLevel) : MAX_HINT_LEVEL;
}

/**
 * Saves from before Find became one round of five hold two rounds: `orders`
 * (two orders of the five countries), `round`, and `results` per round, with a
 * round summary ("roundComplete") after each. Only the first round is kept:
 * - still in the first round (or its summary): the same question, answers and hints;
 * - in the second round (or after it): the first round, all five answered, is
 *   the completed Find, and play resumes on its last answer, ready to continue
 *   to Travel (or stays in Travel or Results if the player was already there).
 *   Answers from the unfinished second round are dropped.
 */
function isLegacyFind(v: unknown): v is Obj {
  return isObj(v) && Array.isArray(v.orders) && !("order" in v);
}

function migrateLegacyFind(v: Obj): Obj | null {
  const { orders, round, results } = v;
  if (!Array.isArray(orders) || !Array.isArray(results) || !isInt(round) || round < 0 || round >= orders.length) return null;
  if (round === 0) return { order: orders[0], index: v.index, question: v.question, results: results[0], status: "asking" };
  const order = orders[0];
  const answers = results[0];
  if (!Array.isArray(order) || !Array.isArray(answers) || answers.length !== order.length || order.length === 0) return null;
  const last = answers[answers.length - 1];
  if (!isObj(last)) return null;
  return {
    order,
    index: order.length - 1,
    // Which wrong countries were tapped isn't needed once answered: the answer keeps their number.
    question: { target: order[order.length - 1], wrongGuesses: [], hintLevel: last.hintLevel, solved: true, feedback: { kind: "correct", country: order[order.length - 1] } },
    results: answers,
    status: v.status === "complete" ? "complete" : "asking",
  };
}

function parseFindSession(lesson: LessonDefinition, v: unknown): FindSession | null {
  if (!isObj(v) || !isValidOrder(v.order, lesson.countries)) return null;
  const order = v.order;
  const { index } = v;
  if (!isInt(index) || index < 0 || index >= order.length) return null;

  const q = v.question;
  if (!isObj(q) || q.target !== order[index] || !Array.isArray(q.wrongGuesses)) return null;
  const wrongGuesses = q.wrongGuesses.filter(
    (id): id is CountryId => typeof id === "string" && lesson.countries.includes(id) && id !== q.target,
  );
  const question: FindQuestion = {
    target: order[index],
    wrongGuesses,
    hintLevel: parseHintLevel(q.hintLevel),
    solved: q.solved === true,
    feedback: parseFeedback(lesson, q.feedback),
  };

  // One answer per question asked so far.
  const list = v.results;
  if (!Array.isArray(list) || list.length !== index + (question.solved ? 1 : 0)) return null;
  const results: FindAnswer[] = [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!isObj(a) || a.target !== order[i] || !isInt(a.wrongGuesses) || a.wrongGuesses < 0) return null;
    const hintLevel = parseHintLevel(a.hintLevel);
    results.push({
      target: order[i],
      wrongGuesses: a.wrongGuesses,
      hintLevel,
      independent: a.wrongGuesses === 0 && hintLevel === 0,
    });
  }

  const lastAnswered = index === order.length - 1 && question.solved;
  const status: FindSession["status"] = v.status === "complete" && lastAnswered ? "complete" : "asking";
  return { order, index, question, results, status };
}

function parseFeedback(lesson: LessonDefinition, v: unknown): FindFeedback | null {
  if (!isObj(v)) return null;
  if (v.kind === "outside") return { kind: "outside" };
  if ((v.kind === "correct" || v.kind === "wrong") && typeof v.country === "string" && lesson.countries.includes(v.country)) {
    return { kind: v.kind, country: v.country };
  }
  return null;
}

function parseRoute(lesson: LessonDefinition, v: unknown, budget: number): CountryId[] | null {
  const { from } = lesson.travel.mission;
  if (!Array.isArray(v) || v[0] !== from || v.length - 1 > budget) return null;
  if (!v.every((id) => typeof id === "string" && lesson.countries.includes(id))) return null;
  return isConnectedRoute(lesson.borders, v) ? (v as CountryId[]) : null;
}

function parseTravelAttempt(lesson: LessonDefinition, v: unknown): TravelAttempt | null {
  const mission = lesson.travel.mission;
  if (!isObj(v) || v.missionId !== mission.id) return null;
  const budget = crossingBudget(lesson.borders, mission);
  const path = parseRoute(lesson, v.path, budget);
  if (!path) return null;
  const here = path[path.length - 1];
  // A path cannot continue past the destination.
  if (path.indexOf(mission.to) !== -1 && path.indexOf(mission.to) !== path.length - 1) return null;
  const status: TravelStatus = here === mission.to ? "arrived" : path.length - 1 >= budget ? "outOfCrossings" : "playing";
  return {
    missionId: mission.id,
    from: mission.from,
    to: mission.to,
    budget,
    path,
    status,
    hintUsed: v.hintUsed !== false,
    undoUsed: v.undoUsed !== false,
  };
}

function parseTravelResult(lesson: LessonDefinition, v: unknown): TravelResult | null {
  const mission = lesson.travel.mission;
  if (!isObj(v) || v.missionId !== mission.id) return null;
  const budget = crossingBudget(lesson.borders, mission);
  const route = parseRoute(lesson, v.route, budget);
  if (!route || route[route.length - 1] !== mission.to) return null;
  const hintUsed = v.hintUsed !== false;
  const undoUsed = v.undoUsed !== false;
  return { missionId: mission.id, route, budget, hintUsed, undoUsed, independent: !hintUsed && !undoUsed };
}

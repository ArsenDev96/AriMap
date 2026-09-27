import type { CountryId } from "../content/types";
import { areValidOrders, MAX_HINT_LEVEL, type FindAnswer, type FindFeedback, type FindQuestion, type FindSession, type HintLevel } from "../game/find";
import { crossingBudget, type TravelAttempt, type TravelStatus } from "../game/travel";
import { isConnectedRoute } from "../game/graph";
import { isLocale } from "../i18n/locales";
import { LESSONS } from "../lessons";
import type { LessonDefinition } from "../lessons/types";
import {
  createLessonProgress,
  EMPTY_RECORDS,
  type FindScore,
  type LessonProgress,
  type LessonRecords,
  type LessonStage,
  type TravelResult,
} from "../lesson/progress";
import { createInitialState, STATE_VERSION, type AppState } from "./appState";

export const STORAGE_KEY = "arimap:state";

/** Minimal storage interface so web (localStorage) and future native stores can plug in. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadAppState(storage: KeyValueStorage | null): AppState {
  if (!storage) return createInitialState();
  try {
    return parseSavedState(storage.getItem(STORAGE_KEY));
  } catch {
    return createInitialState();
  }
}

export function saveAppState(storage: KeyValueStorage | null, state: AppState): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked (private mode): the game keeps working in memory.
  }
}

// --- Parsing -------------------------------------------------------------
// Saved data is untrusted: anything missing or inconsistent is dropped or
// rebuilt from game rules. Derived values (budgets, statuses, "independent"
// flags) are recomputed, never read, so bad data cannot grant achievements.

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const STAGES: readonly LessonStage[] = ["discover", "find", "findSummary", "travel", "results"];

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
  // Unknown (e.g. future) versions: keep only the language preference.
  if (data.version !== STATE_VERSION) return createInitialState(locale);

  const state = createInitialState(locale);
  if (typeof data.lessonId === "string" && data.lessonId in LESSONS) state.lessonId = data.lessonId;
  if (isObj(data.lessons)) {
    for (const [id, lesson] of Object.entries(LESSONS)) {
      const progress = parseLessonProgress(lesson, data.lessons[id]);
      if (progress) state.lessons[id] = progress;
    }
  }
  if (data.screen === "lesson" && state.lessons[state.lessonId]?.started) state.screen = "lesson";
  return state;
}

export function parseLessonProgress(lesson: LessonDefinition, value: unknown): LessonProgress | null {
  if (!isObj(value)) return null;
  const progress = createLessonProgress(lesson, parseRecords(value.records));
  progress.started = value.started === true;

  const isActive = (v: unknown): v is CountryId => typeof v === "string" && lesson.countries.includes(v);
  if (isObj(value.discover)) {
    const d = value.discover;
    progress.discover = {
      selected: isActive(d.selected) ? d.selected : null,
      explored: Array.isArray(d.explored) ? [...new Set(d.explored.filter(isActive))] : [],
    };
  }
  progress.find = parseFindSession(lesson, value.find);
  progress.travel = parseTravelAttempt(lesson, value.travel);
  progress.lastTravelResult = parseTravelResult(lesson, value.lastTravelResult);

  const stage = STAGES.includes(value.stage as LessonStage) ? (value.stage as LessonStage) : "discover";
  progress.stage = stageIsConsistent(stage, progress) ? stage : "discover";
  return progress;
}

function stageIsConsistent(stage: LessonStage, p: LessonProgress): boolean {
  switch (stage) {
    case "discover":
      return true;
    case "find":
      return p.find?.status === "asking";
    case "findSummary":
      return p.find?.status === "roundComplete";
    case "travel":
      return p.travel !== null && p.travel.status !== "arrived";
    case "results":
      return p.travel?.status === "arrived" && p.lastTravelResult !== null;
  }
}

function parseScore(v: unknown): FindScore | null {
  if (!isObj(v) || !isInt(v.independent) || !isInt(v.total)) return null;
  if (v.total <= 0 || v.independent < 0 || v.independent > v.total) return null;
  return { independent: v.independent, total: v.total };
}

function parseRecords(v: unknown): LessonRecords {
  if (!isObj(v)) return EMPTY_RECORDS;
  return {
    discoverDone: v.discoverDone === true,
    findDone: v.findDone === true,
    travelDone: v.travelDone === true,
    lastFindScore: parseScore(v.lastFindScore),
    bestFindScore: parseScore(v.bestFindScore),
    travelWithoutHelp: v.travelWithoutHelp === true,
  };
}

function parseHintLevel(v: unknown): HintLevel {
  // Malformed hint data is treated as fully assisted rather than independent.
  return isInt(v) && v >= 0 && v <= MAX_HINT_LEVEL ? (v as HintLevel) : MAX_HINT_LEVEL;
}

function parseFindSession(lesson: LessonDefinition, v: unknown): FindSession | null {
  if (!isObj(v) || !areValidOrders(v.orders, lesson.countries, lesson.find.rounds)) return null;
  const orders = v.orders;
  const { round, index } = v;
  if (!isInt(round) || !isInt(index) || round < 0 || round >= orders.length) return null;
  const order = orders[round];
  if (index < 0 || index >= order.length) return null;

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

  if (!Array.isArray(v.results) || v.results.length !== orders.length) return null;
  const results: FindAnswer[][] = [];
  for (let r = 0; r < orders.length; r++) {
    const expected = r < round ? orders[r].length : r === round ? index + (question.solved ? 1 : 0) : 0;
    const list = v.results[r];
    if (!Array.isArray(list) || list.length !== expected) return null;
    const answers: FindAnswer[] = [];
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!isObj(a) || a.target !== orders[r][i] || !isInt(a.wrongGuesses) || a.wrongGuesses < 0) return null;
      const hintLevel = parseHintLevel(a.hintLevel);
      answers.push({
        target: orders[r][i],
        wrongGuesses: a.wrongGuesses,
        hintLevel,
        independent: a.wrongGuesses === 0 && hintLevel === 0,
      });
    }
    results.push(answers);
  }

  const lastOfRound = index === order.length - 1 && question.solved;
  let status: FindSession["status"] = "asking";
  if (v.status === "roundComplete" && lastOfRound) status = "roundComplete";
  if (v.status === "complete" && lastOfRound && round === orders.length - 1) status = "complete";
  return { orders, round, index, question, results, status };
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

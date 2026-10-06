import { DEFAULT_LOCALE, type Locale } from "../i18n/locales";
import { createFindOrder } from "../game/find";
import type { RandomSource } from "../game/random";
import {
  DEFAULT_LESSON_ID,
  getLesson,
  getLevel,
  hasPlayableLevels,
  LEVELS,
  levelsOf,
  levelVersion,
  levelVersions,
  type ContinentId,
  type LevelInfo,
  type LevelVersion,
} from "../lessons";
import type { LessonDefinition } from "../lessons/types";
import { createLessonProgress, lessonReducer, type LessonAction, type LessonProgress, type LessonStage } from "../lesson/progress";
import { attemptRating, MAX_STARS } from "../lesson/rating";

/** Version 2: several levels. Version 1 (one level) is migrated on load (see storage.ts). */
export const STATE_VERSION = 2;

/**
 * "continents": the home screen, choosing a continent (and Continue). "levels": a continent's
 * level selection (`continent`). "lesson": playing `levelId`. Saves from before continents
 * existed say "welcome" for the level selection, which then held Europe's levels only: they
 * open Europe's level selection (storage.ts), with no migration.
 */
export type Screen = "continents" | "levels" | "lesson";

export interface AppState {
  version: typeof STATE_VERSION;
  locale: Locale;
  screen: Screen;
  /** The continent whose levels are shown, or were last shown or played: Back and Home keep it. */
  continent: ContinentId;
  /** The level being played, or last played: Home keeps it. */
  levelId: string;
  /** Levels the player has opened, most recently active first. */
  recent: string[];
  /** Each level's own progress, by level id. */
  levels: Record<string, LessonProgress>;
  /**
   * The level whose full-level attempt has just improved its earlier best rating, for "New best!"
   * on the Results it reached. Only until the next action, and never saved (storage.ts), so a
   * refresh, a language change or View results never shows it again.
   */
  newBest?: string;
}

export type AppAction =
  | { type: "setLocale"; locale: Locale }
  /** Opens a playable, unlocked level where the player left it (or at Discover, the first time). */
  | { type: "openLevel"; levelId: string }
  /** Shows a continent's level selection (only a continent with a playable level). */
  | { type: "openContinent"; continent: ContinentId }
  /** Back to the continents: from a level (Home) or a continent's level selection (Back). Progress is kept. */
  | { type: "goHome" }
  /** Starts a level again from Discover. Only that level's current place is discarded; its records stay. */
  | { type: "restartLevel"; levelId: string }
  /** A gameplay action in the level being played. */
  | { type: "lesson"; action: LessonAction };

export function createInitialState(locale: Locale = DEFAULT_LOCALE): AppState {
  return { version: STATE_VERSION, locale, screen: "continents", continent: "europe", levelId: DEFAULT_LESSON_ID, recent: [], levels: {} };
}

/**
 * The version of a playable level's content its place is on: the one its saved progress names (an
 * attempt started before the level's countries changed keeps the earlier version, LevelInfo.earlier),
 * otherwise the current one. Its card shows that version's countries and description.
 */
export function versionOf(state: AppState, level: LevelInfo): LevelVersion | undefined {
  const progress = state.levels[level.id];
  return (progress && levelVersion(level, progress.revision)) || levelVersions(level)[0];
}

export function activeLesson(state: AppState): LessonDefinition {
  const level = getLevel(state.levelId);
  return (level && versionOf(state, level)?.lesson) ?? getLesson(DEFAULT_LESSON_ID)!;
}

export function activeProgress(state: AppState): LessonProgress {
  return progressOf(state, activeLesson(state));
}

export function progressOf(state: AppState, lesson: LessonDefinition): LessonProgress {
  return state.levels[lesson.id] ?? createLessonProgress(lesson);
}

/** A level is complete once its journey has been finished; that record is never taken back. */
export function isLevelComplete(state: AppState, levelId: string): boolean {
  return state.levels[levelId]?.records.travelDone === true;
}

export type LevelStatus =
  /** Not prepared yet: it can never be started. */
  | { kind: "comingSoon" }
  /** Playable, but its previous level must be completed first. */
  | { kind: "locked"; after: LevelInfo }
  | { kind: "ready" }
  | { kind: "inProgress"; stage: LessonStage }
  /** Completed; `stage` is where the player is in it now (e.g. replaying). */
  | { kind: "completed"; stage: LessonStage; started: boolean };

export function levelStatus(state: AppState, level: LevelInfo): LevelStatus {
  if (!level.lesson) return { kind: "comingSoon" };
  const after = level.unlockedBy ? getLevel(level.unlockedBy) : undefined;
  if (after && !isLevelComplete(state, after.id)) return { kind: "locked", after };
  const progress = state.levels[level.id];
  if (progress?.records.travelDone) return { kind: "completed", stage: progress.stage, started: progress.started };
  if (progress?.started) return { kind: "inProgress", stage: progress.stage };
  return { kind: "ready" };
}

/** Every level (of a continent, if given) completed: none left to start, none coming soon. Each stays open to replay. */
export function allLevelsComplete(state: AppState, continent?: ContinentId): boolean {
  return (continent ? levelsOf(continent) : LEVELS).every((level) => levelStatus(state, level).kind === "completed");
}

/**
 * A continent's levels and how many are completed. Counted from the permanent completion
 * records (isLevelComplete), so playing a level again or starting it over never lowers it.
 */
export function continentProgress(state: AppState, continent: ContinentId): { total: number; completed: number } {
  const levels = levelsOf(continent).filter((level) => level.lesson);
  return { total: levels.length, completed: levels.filter((level) => isLevelComplete(state, level.id)).length };
}

/**
 * A continent's stars: the sum of its playable levels' best ratings, out of MAX_STARS for each
 * playable level (none for a continent whose levels are all coming soon). A level never rated
 * (not completed, or completed before ratings with no Results to rate) adds none. Best ratings are
 * never lowered (betterRating), so playing a level again, starting it over or replaying its journey
 * never lowers the sum. It measures how well the levels were played, not how many were completed
 * (continentProgress).
 */
export function continentStars(state: AppState, continent: ContinentId): { earned: number; max: number } {
  const levels = levelsOf(continent).filter((level) => level.lesson);
  const earned = levels.reduce((sum, level) => sum + (state.levels[level.id]?.records.bestRating ?? 0), 0);
  return { earned, max: MAX_STARS * levels.length };
}

/** Whether a level can be opened: playable and unlocked. */
export function canPlay(state: AppState, levelId: string): boolean {
  const level = getLevel(levelId);
  if (!level) return false;
  const kind = levelStatus(state, level).kind;
  return kind !== "comingSoon" && kind !== "locked";
}

/**
 * Whether a level has an attempt under way to resume: started, and not at the Results of a
 * finished attempt. A level never completed that is started always has one; a completed level
 * has one while it is being played again (after Play again or Replay journey). Continue is
 * offered only for these; a finished attempt offers Play again instead.
 */
export function hasUnfinishedAttempt(state: AppState, levelId: string): boolean {
  const progress = state.levels[levelId];
  return progress?.started === true && progress.stage !== "results";
}

/**
 * Whether a level's finished attempt has its Results saved: at Results, with the route of the
 * journey that ended it (a save is only ever at Results with one, see storage.ts). View results
 * reopens them as they are. A completion record alone (an older save) has none, and none is made up.
 */
export function hasSavedResults(state: AppState, levelId: string): boolean {
  const progress = state.levels[levelId];
  return progress?.started === true && progress.stage === "results" && progress.lastTravelResult != null;
}

/**
 * The level Continue resumes: the most recently active playable level (of a continent, if
 * given) with an unfinished attempt (hasUnfinishedAttempt), on any continent otherwise. Null
 * when there is none.
 */
export function levelToContinue(state: AppState, continent?: ContinentId): LevelInfo | null {
  for (const id of state.recent) {
    const level = getLevel(id);
    if (level && (!continent || level.continent === continent) && canPlay(state, id) && hasUnfinishedAttempt(state, id)) return level;
  }
  return null;
}

/**
 * The level after this one in its continent, when it is playable and open (completing a level
 * opens the next): Results offers it as Next level. Null after the last playable level (the
 * next is coming soon, or there is none), and never a coming-soon one.
 */
export function nextLevel(state: AppState, levelId: string): LevelInfo | null {
  const level = getLevel(levelId);
  if (!level) return null;
  const levels = levelsOf(level.continent);
  const next = levels[levels.findIndex((l) => l.id === level.id) + 1];
  return next && canPlay(state, next.id) ? next : null;
}

/**
 * A continent's level selection's main action: continue its most recently active level with an
 * unfinished attempt (levelToContinue, a replay included); otherwise start its first playable
 * level not started yet (a new player's Level 1, or the level just unlocked). Null when every
 * playable level there is completed and none has an attempt under way.
 */
export function mainAction(state: AppState, continent: ContinentId = "europe"): { kind: "continue" | "start"; level: LevelInfo } | null {
  const resume = levelToContinue(state, continent);
  if (resume) return { kind: "continue", level: resume };
  const next = levelsOf(continent).find((level) => levelStatus(state, level).kind === "ready");
  return next ? { kind: "start", level: next } : null;
}

/** Creates the action that starts (or restarts) the Find activity with a fresh random order. */
export function startFindingAction(lesson: LessonDefinition, random: RandomSource = Math.random): LessonAction {
  return { type: "startFinding", order: createFindOrder(lesson.countries, random) };
}

function withProgress(state: AppState, progress: LessonProgress): AppState {
  if (state.levels[progress.lessonId] === progress) return state;
  return { ...state, levels: { ...state.levels, [progress.lessonId]: progress } };
}

const touch = (recent: readonly string[], id: string) => [id, ...recent.filter((r) => r !== id)];

export function appReducer(state: AppState, action: AppAction): AppState {
  // "New best!" lasts until the next action, whatever it is.
  return reduce(state.newBest === undefined ? state : { ...state, newBest: undefined }, action);
}

function reduce(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "setLocale":
      // Language is independent of gameplay: nothing else changes.
      return state.locale === action.locale ? state : { ...state, locale: action.locale };
    case "openLevel":
    case "restartLevel": {
      const lesson = getLesson(action.levelId);
      if (!lesson || !canPlay(state, action.levelId)) return state;
      const progress = progressOf(state, lesson);
      const next = action.type === "openLevel" && progress.started ? progress : lessonReducer(lesson, progress, { type: "begin" });
      const continent = getLevel(lesson.id)!.continent;
      return { ...withProgress(state, next), screen: "lesson", continent, levelId: lesson.id, recent: touch(state.recent, lesson.id) };
    }
    case "openContinent":
      if (!hasPlayableLevels(action.continent)) return state;
      return state.screen === "levels" && state.continent === action.continent ? state : { ...state, screen: "levels", continent: action.continent };
    case "goHome":
      return state.screen === "continents" ? state : { ...state, screen: "continents" };
    case "lesson": {
      const lesson = activeLesson(state);
      const before = progressOf(state, lesson);
      const current = getLesson(lesson.id)!;
      // Replay journey from Results on an earlier version of the level starts the current journey: the
      // level's place moves to the current version, keeping only its records (completion, stars).
      const after =
        action.action.type === "replayTravel" && lesson !== current && before.records.findDone
          ? lessonReducer(current, createLessonProgress(current, before.records), action.action)
          : lessonReducer(lesson, before, action.action);
      const next = withProgress(state, after);
      // A full-level attempt just completed, better than the level's earlier best (not its first rating).
      const rating = before.stage === "results" ? null : attemptRating(after);
      const previous = before.records.bestRating;
      return rating !== null && previous !== null && rating > previous ? { ...next, newBest: lesson.id } : next;
    }
  }
}

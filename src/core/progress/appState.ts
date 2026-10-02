import { DEFAULT_LOCALE, type Locale } from "../i18n/locales";
import { createFindOrder } from "../game/find";
import type { RandomSource } from "../game/random";
import { DEFAULT_LESSON_ID, getLesson, getLevel, LEVELS, type LevelInfo } from "../lessons";
import type { LessonDefinition } from "../lessons/types";
import { createLessonProgress, lessonReducer, type LessonAction, type LessonProgress, type LessonStage } from "../lesson/progress";

/** Version 2: several levels. Version 1 (one level) is migrated on load (see storage.ts). */
export const STATE_VERSION = 2;

export type Screen = "welcome" | "lesson";

export interface AppState {
  version: typeof STATE_VERSION;
  locale: Locale;
  screen: Screen;
  /** The level being played, or last played: Home keeps it. */
  levelId: string;
  /** Levels the player has opened, most recently active first. */
  recent: string[];
  /** Each level's own progress, by level id. */
  levels: Record<string, LessonProgress>;
}

export type AppAction =
  | { type: "setLocale"; locale: Locale }
  /** Opens a playable, unlocked level where the player left it (or at Discover, the first time). */
  | { type: "openLevel"; levelId: string }
  | { type: "goHome" }
  /** Starts a level again from Discover. Only that level's current place is discarded; its records stay. */
  | { type: "restartLevel"; levelId: string }
  /** A gameplay action in the level being played. */
  | { type: "lesson"; action: LessonAction };

export function createInitialState(locale: Locale = DEFAULT_LOCALE): AppState {
  return { version: STATE_VERSION, locale, screen: "welcome", levelId: DEFAULT_LESSON_ID, recent: [], levels: {} };
}

export function activeLesson(state: AppState): LessonDefinition {
  return getLesson(state.levelId) ?? getLesson(DEFAULT_LESSON_ID)!;
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

/** Every level completed: none left to start, none coming soon. Each stays open to replay. */
export function allLevelsComplete(state: AppState): boolean {
  return LEVELS.every((level) => levelStatus(state, level).kind === "completed");
}

/** Whether a level can be opened: playable and unlocked. */
export function canPlay(state: AppState, levelId: string): boolean {
  const level = getLevel(levelId);
  if (!level) return false;
  const kind = levelStatus(state, level).kind;
  return kind !== "comingSoon" && kind !== "locked";
}

/**
 * The home screen's main action: continue the most recently active level that
 * is started but not yet completed; otherwise start the first playable level
 * not started yet (a new player's Level 1, or the level just unlocked).
 * Null when every playable level is completed and none is in progress.
 */
export function mainAction(state: AppState): { kind: "continue" | "start"; level: LevelInfo } | null {
  for (const id of state.recent) {
    const level = getLevel(id);
    if (level && levelStatus(state, level).kind === "inProgress") return { kind: "continue", level };
  }
  const next = LEVELS.find((level) => levelStatus(state, level).kind === "ready");
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
      return { ...withProgress(state, next), screen: "lesson", levelId: lesson.id, recent: touch(state.recent, lesson.id) };
    }
    case "goHome":
      return state.screen === "welcome" ? state : { ...state, screen: "welcome" };
    case "lesson": {
      const lesson = activeLesson(state);
      return withProgress(state, lessonReducer(lesson, progressOf(state, lesson), action.action));
    }
  }
}

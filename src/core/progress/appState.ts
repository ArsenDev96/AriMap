import { DEFAULT_LOCALE, type Locale } from "../i18n/locales";
import { createRoundOrders } from "../game/find";
import type { RandomSource } from "../game/random";
import { DEFAULT_LESSON_ID, getLesson } from "../lessons";
import type { LessonDefinition } from "../lessons/types";
import { createLessonProgress, lessonReducer, type LessonAction, type LessonProgress } from "../lesson/progress";

export const STATE_VERSION = 1;

export type Screen = "welcome" | "lesson";

export interface AppState {
  version: typeof STATE_VERSION;
  locale: Locale;
  screen: Screen;
  lessonId: string;
  lessons: Record<string, LessonProgress>;
}

export type AppAction =
  | { type: "setLocale"; locale: Locale }
  | { type: "openLesson" }
  | { type: "goHome" }
  | { type: "startOver" }
  | { type: "lesson"; action: LessonAction };

export function createInitialState(locale: Locale = DEFAULT_LOCALE): AppState {
  return { version: STATE_VERSION, locale, screen: "welcome", lessonId: DEFAULT_LESSON_ID, lessons: {} };
}

export function activeLesson(state: AppState): LessonDefinition {
  return getLesson(state.lessonId) ?? getLesson(DEFAULT_LESSON_ID)!;
}

export function activeProgress(state: AppState): LessonProgress {
  const lesson = activeLesson(state);
  return state.lessons[lesson.id] ?? createLessonProgress(lesson);
}

/** Creates the action that starts (or restarts) the Find activity with fresh random orders. */
export function startFindingAction(lesson: LessonDefinition, random: RandomSource = Math.random): LessonAction {
  return { type: "startFinding", orders: createRoundOrders(lesson.countries, lesson.find.rounds, random) };
}

function withProgress(state: AppState, progress: LessonProgress): AppState {
  if (state.lessons[progress.lessonId] === progress) return state;
  return { ...state, lessons: { ...state.lessons, [progress.lessonId]: progress } };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  const lesson = activeLesson(state);
  const progress = activeProgress(state);
  switch (action.type) {
    case "setLocale":
      // Language is independent of gameplay: nothing else changes.
      return state.locale === action.locale ? state : { ...state, locale: action.locale };
    case "openLesson": {
      const next = progress.started ? progress : lessonReducer(lesson, progress, { type: "begin" });
      return { ...withProgress(state, next), screen: "lesson" };
    }
    case "goHome":
      return { ...state, screen: "welcome" };
    case "startOver":
      return { ...withProgress(state, lessonReducer(lesson, progress, { type: "begin" })), screen: "lesson" };
    case "lesson":
      return withProgress(state, lessonReducer(lesson, progress, action.action));
  }
}

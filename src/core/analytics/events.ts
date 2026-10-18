import type { Locale } from "../i18n/locales";
import { activeLesson, type AppAction, type AppState } from "../progress/appState";
import { EUROPE_STARS_TOTAL, europeStarCount, europeStarsSnapshot } from "../progress/europeStars";

/**
 * The few things AriMap measures (with the player's consent: src/web/analytics.ts sends them, docs/ANALYTICS.md),
 * and the exact parameters each one sends. Nothing else is ever sent: no names, emails, player or round ids, answers
 * or typed text. A round's id may be used on the device to send its events once, never as a parameter.
 *
 * Framework-independent: no React, DOM, storage or network.
 */

/** The app's screens, for one page view each as it opens (the address does not change between them). */
export type ScreenView =
  | { screen: "home" }
  | { screen: "levels" }
  | { screen: "lesson"; lessonId: string }
  | { screen: "challenge" }
  | { screen: "leaderboard" };

/** Where the leaderboard was opened from. */
export type LeaderboardSource = "home" | "challenge_ready" | "challenge_results";

/** How a result was shared: only once it succeeded (a closed share sheet is not a share). */
export type ShareMethod = "native_share" | "download" | "copy_link";

export type AnalyticsEvent =
  | { name: "page_view"; view: ScreenView }
  /** A round the server has just started for a press of Start (not one resumed). */
  | { name: "challenge_start" }
  /** A round's result as the server confirmed it. */
  | { name: "challenge_complete"; correct: number; elapsedMs: number }
  /** A lesson attempt begins: the whole level from Discover, or `replay`, its journey again. */
  | { name: "lesson_start"; lessonId: string; replay: boolean }
  /** That attempt reaches its Results. */
  | { name: "lesson_complete"; lessonId: string; replay: boolean }
  /** All of Europe's stars (EUROPE_STARS_TOTAL) reached for the first time, by playing. */
  | { name: "europe_mastered" }
  | { name: "leaderboard_open"; source: LeaderboardSource }
  | { name: "share_result"; method: ShareMethod };

const SCREEN_TITLES: Record<ScreenView["screen"], string> = {
  home: "Home",
  levels: "Levels",
  lesson: "Lesson",
  challenge: "Quick Challenge",
  leaderboard: "Leaderboard",
};

/**
 * A screen's own path (not a real address: the app has one), so each screen and lesson reads apart in reports.
 * Also the screen's key: one page view as it opens, none for a language change or a re-render.
 */
export function screenPath(view: ScreenView): string {
  return view.screen === "home" ? "/" : view.screen === "lesson" ? `/lesson/${view.lessonId}` : `/${view.screen}`;
}

/** The event's name and parameters as sent: these, and only these. The page's address is added where it is sent. */
export function eventParams(event: AnalyticsEvent, locale: Locale): { name: string; params: Record<string, string | number> } {
  const app_language = locale;
  switch (event.name) {
    case "page_view":
      return { name: "page_view", params: { page_title: SCREEN_TITLES[event.view.screen], app_language } };
    case "challenge_start":
    case "europe_mastered":
      return { name: event.name, params: { app_language } };
    case "challenge_complete":
      return { name: event.name, params: { correct: event.correct, elapsed_ms: event.elapsedMs, app_language } };
    case "lesson_start":
    case "lesson_complete":
      return { name: event.name, params: { lesson_id: event.lessonId, lesson_mode: event.replay ? "journey_replay" : "full", app_language } };
    case "leaderboard_open":
      return { name: event.name, params: { source: event.source, app_language } };
    case "share_result":
      return { name: event.name, params: { method: event.method, app_language } };
  }
}

/**
 * The lesson events of one action, from the app's state before and after it (appReducer): a lesson attempt
 * beginning (a level opened that had none under way, Start over, Play again, or Replay journey), that attempt
 * reaching its Results, and all of Europe's stars reached. Only actions count: a save loaded or brought in
 * with every star never sends "europe_mastered", and Results shown again send nothing.
 */
export function progressEvents(before: AppState, action: AppAction, after: AppState): AnalyticsEvent[] {
  if (after === before) return [];
  const events: AnalyticsEvent[] = [];
  if (action.type === "openLevel" || action.type === "restartLevel") {
    // openLevel resumes a level with an attempt under way, and begins one otherwise (appReducer).
    if (after.screen === "lesson" && (action.type === "restartLevel" || !before.levels[action.levelId]?.started)) {
      events.push({ name: "lesson_start", lessonId: action.levelId, replay: false });
    }
  } else if (action.type === "lesson") {
    const lessonId = activeLesson(after).id;
    const [was, now] = [before.levels[lessonId], after.levels[lessonId]];
    if (action.action.type === "replayTravel" && now && now !== was && now.journeyReplay && now.stage === "travel") {
      events.push({ name: "lesson_start", lessonId, replay: true });
    }
    if (now?.stage === "results" && was?.stage !== "results") {
      events.push({ name: "lesson_complete", lessonId, replay: now.journeyReplay });
    }
    const stars = (state: AppState) => europeStarCount(europeStarsSnapshot(state));
    if (stars(before) < EUROPE_STARS_TOTAL && stars(after) === EUROPE_STARS_TOTAL) events.push({ name: "europe_mastered" });
  }
  return events;
}

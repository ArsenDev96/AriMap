"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { progressEvents, screenPath, type ScreenView } from "@/core/analytics/events";
import { LOCALE_META } from "@/core/i18n/locales";
import { translate } from "@/core/i18n/translate";
import { activeLesson, activeProgress, appReducer, nextLevel, type AppAction } from "@/core/progress/appState";
import { loadAppState, saveAppState, type KeyValueStorage } from "@/core/progress/storage";
import { track, trackScreen } from "@/web/analytics";
import { LeaderboardScreen } from "./challenge/LeaderboardScreen";
import { QuickChallengeScreen } from "./challenge/QuickChallengeScreen";
import { readStoredChallenge } from "./challenge/roundSession";
import { ContinentScreen } from "./ContinentScreen";
import { diagnostics } from "./diagnostics";
import { DiagnosticsHud } from "./DiagnosticsHud";
import { I18nProvider } from "./i18n";
import { LessonScreen } from "./LessonScreen";
import { WelcomeScreen } from "./WelcomeScreen";

function browserStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The leaderboard's screen has an entry of its own in the browser's history (its state, at the same address), so the
 * browser's Back closes it and Forward opens it again; a refresh while it shows keeps it.
 */
const LEADERBOARD_ENTRY = { arimap: "leaderboard" } as const;
const isLeaderboardEntry = (state: unknown) => typeof state === "object" && state !== null && (state as { arimap?: unknown }).arimap === LEADERBOARD_ENTRY.arimap;

export default function Game() {
  const [state, reactDispatch] = useReducer(appReducer, null, () => loadAppState(browserStorage()));
  // Every action goes through here once (a press, never a render), with the state it acts on and the one it makes
  // (the same pure reducer React then runs, on the same actions in the same order, so this state is always React's
  // next one): the lesson events it causes are sent then (src/core/analytics). A save as it loads is no action, so
  // it sends nothing.
  const stateRef = useRef(state);
  const dispatch = useCallback((action: AppAction) => {
    const before = stateRef.current;
    const after = appReducer(before, action);
    stateRef.current = after;
    reactDispatch(action);
    for (const event of progressEvents(before, action, after)) track(event, after.locale);
  }, []);
  // The Quick Challenge, opened from the home screen. Kept here, not in the saved state: rounds are the server's,
  // and the challenge never changes lesson progress. After a refresh it opens again when a round was kept (one
  // under way, or a result still to confirm: roundSession.ts), so the round resumes, or its result shows. It stays
  // mounted while the language changes, so its timer runs on.
  const [challenge, setChallenge] = useState(() => readStoredChallenge() !== null);
  // The leaderboard, opened from the home screen: not in the saved state either. The home screen's scroll when it
  // opened, restored on the way back (with focus on its Leaderboard button).
  const [leaderboard, setLeaderboard] = useState(() => isLeaderboardEntry(window.history.state));
  const homeScroll = useRef(0);
  const [homeRestore, setHomeRestore] = useState<{ scrollTop: number } | null>(null);
  const clearHomeRestore = useCallback(() => setHomeRestore(null), []);
  const leaderboardRef = useRef(leaderboard);
  useEffect(() => {
    leaderboardRef.current = leaderboard;
  }, [leaderboard]);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const open = isLeaderboardEntry(e.state);
      if (leaderboardRef.current && !open) setHomeRestore({ scrollTop: homeScroll.current });
      setLeaderboard(open);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const openLeaderboard = (scrollTop: number) => {
    track({ name: "leaderboard_open", source: "home" }, state.locale);
    homeScroll.current = scrollTop;
    window.history.pushState(LEADERBOARD_ENTRY, "");
    setLeaderboard(true);
  };
  // Through the history when the board has its entry there (as the browser's Back would), so Forward still works.
  const closeLeaderboard = () => {
    if (isLeaderboardEntry(window.history.state)) return window.history.back();
    setLeaderboard(false);
    setHomeRestore({ scrollTop: homeScroll.current });
  };

  useEffect(() => {
    // TEMPORARY phone-lag diagnostics (see diagnostics.ts): ?freeze=1 never writes the save.
    if (diagnostics().freeze) return;
    saveAppState(browserStorage(), state);
  }, [state]);

  useEffect(() => {
    document.documentElement.lang = LOCALE_META[state.locale].htmlLang;
  }, [state.locale]);

  const lesson = activeLesson(state);
  const progress = activeProgress(state);

  // One page view as each screen opens (and each lesson): the address stays the same, so none is automatic.
  const view: ScreenView = challenge
    ? { screen: "challenge" }
    : leaderboard
      ? { screen: "leaderboard" }
      : state.screen === "continents"
        ? { screen: "home" }
        : state.screen === "levels"
          ? { screen: "levels" }
          : { screen: "lesson", lessonId: lesson.id };
  const viewPath = screenPath(view);
  useEffect(() => {
    trackScreen(view, state.locale);
    // The path names the screen and lesson; a new object for the same one is not a new screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewPath, state.locale]);

  return (
    <I18nProvider locale={state.locale}>
      <title>{`${translate(state.locale, "app.name")} — ${translate(state.locale, "app.tagline")}`}</title>
      {/* The screen comes from the save on the first render (the game renders on the client only), so no other screen shows first. */}
      {challenge ? (
        <QuickChallengeScreen dispatch={dispatch} progress={state} onClose={() => setChallenge(false)} />
      ) : leaderboard ? (
        <LeaderboardScreen dispatch={dispatch} onBack={closeLeaderboard} />
      ) : state.screen === "continents" ? (
        <ContinentScreen
          state={state}
          dispatch={dispatch}
          onPlayChallenge={() => setChallenge(true)}
          onLeaderboard={openLeaderboard}
          restore={homeRestore}
          onRestored={clearHomeRestore}
        />
      ) : state.screen === "levels" ? (
        <WelcomeScreen state={state} dispatch={dispatch} />
      ) : (
        <LessonScreen lesson={lesson} progress={progress} next={nextLevel(state, lesson.id)} newBest={state.newBest === lesson.id} dispatch={dispatch} />
      )}
      {diagnostics().hud && <DiagnosticsHud />}
    </I18nProvider>
  );
}

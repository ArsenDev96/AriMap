"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { LOCALE_META } from "@/core/i18n/locales";
import { translate } from "@/core/i18n/translate";
import { activeLesson, activeProgress, appReducer, nextLevel } from "@/core/progress/appState";
import { loadAppState, saveAppState, type KeyValueStorage } from "@/core/progress/storage";
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
  const [state, dispatch] = useReducer(appReducer, null, () => loadAppState(browserStorage()));
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

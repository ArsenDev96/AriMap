"use client";

import { useEffect, useReducer, useState } from "react";
import { LOCALE_META } from "@/core/i18n/locales";
import { translate } from "@/core/i18n/translate";
import { activeLesson, activeProgress, appReducer, nextLevel } from "@/core/progress/appState";
import { loadAppState, saveAppState, type KeyValueStorage } from "@/core/progress/storage";
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

export default function Game() {
  const [state, dispatch] = useReducer(appReducer, null, () => loadAppState(browserStorage()));
  // The Quick Challenge, opened from the home screen. Kept here, not in the saved state: rounds are the server's,
  // and the challenge never changes lesson progress. After a refresh it opens again when a round was kept (one
  // under way, or a result still to confirm: roundSession.ts), so the round resumes, or its result shows. It stays
  // mounted while the language changes, so its timer runs on.
  const [challenge, setChallenge] = useState(() => readStoredChallenge() !== null);

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
      ) : state.screen === "continents" ? (
        <ContinentScreen state={state} dispatch={dispatch} onPlayChallenge={() => setChallenge(true)} />
      ) : state.screen === "levels" ? (
        <WelcomeScreen state={state} dispatch={dispatch} />
      ) : (
        <LessonScreen lesson={lesson} progress={progress} next={nextLevel(state, lesson.id)} newBest={state.newBest === lesson.id} dispatch={dispatch} />
      )}
      {diagnostics().hud && <DiagnosticsHud />}
    </I18nProvider>
  );
}

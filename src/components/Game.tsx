"use client";

import { useEffect, useReducer } from "react";
import { LOCALE_META } from "@/core/i18n/locales";
import { translate } from "@/core/i18n/translate";
import { activeLesson, activeProgress, appReducer } from "@/core/progress/appState";
import { loadAppState, saveAppState, type KeyValueStorage } from "@/core/progress/storage";
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

  useEffect(() => {
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
      {state.screen === "welcome" ? (
        <WelcomeScreen lesson={lesson} progress={progress} dispatch={dispatch} />
      ) : (
        <LessonScreen lesson={lesson} progress={progress} dispatch={dispatch} />
      )}
    </I18nProvider>
  );
}

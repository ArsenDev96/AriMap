"use client";

import type { Dispatch } from "react";
import { LOCALE_META, LOCALES } from "@/core/i18n/locales";
import type { MessageKey } from "@/core/i18n/translate";
import type { LessonProgress, LessonStage } from "@/core/lesson/progress";
import type { AppAction } from "@/core/progress/appState";
import { useI18n } from "./i18n";
import styles from "./Header.module.css";

export function LanguageToggle({ dispatch, large = false }: { dispatch: Dispatch<AppAction>; large?: boolean }) {
  const { locale, t } = useI18n();
  return (
    <div role="group" aria-label={t("language.label")} className={`${styles.lang} ${large ? styles.langLarge : ""}`}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={LOCALE_META[l].htmlLang}
          aria-label={LOCALE_META[l].name}
          aria-pressed={locale === l}
          className={styles.langButton}
          onClick={() => dispatch({ type: "setLocale", locale: l })}
        >
          {LOCALE_META[l].short}
        </button>
      ))}
    </div>
  );
}

const STEPS: { key: MessageKey; stages: LessonStage[] }[] = [
  { key: "steps.discover", stages: ["discover"] },
  { key: "steps.find", stages: ["find", "findSummary"] },
  { key: "steps.travel", stages: ["travel", "results"] },
];

export function Header({ progress, dispatch }: { progress: LessonProgress; dispatch: Dispatch<AppAction> }) {
  const { t } = useI18n();
  const current = STEPS.findIndex((s) => s.stages.includes(progress.stage));
  return (
    <header className={styles.header}>
      <button type="button" className={styles.brand} onClick={() => dispatch({ type: "goHome" })} aria-label={t("app.home")}>
        <BrandMark />
        <span className={styles.brandName}>{t("app.name")}</span>
      </button>
      <ol className={styles.steps} aria-label={t("steps.label")}>
        {STEPS.map((step, i) => {
          const label = t(step.key);
          return (
            <li
              key={step.key}
              className={`${styles.step} ${i < current ? styles.stepDone : ""} ${i === current ? styles.stepCurrent : ""}`}
              aria-current={i === current ? "step" : undefined}
            >
              <span className={styles.stepDot} aria-hidden="true" />
              <span className={styles.stepLabel}>{label}</span>
            </li>
          );
        })}
      </ol>
      <LanguageToggle dispatch={dispatch} />
    </header>
  );
}

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--sea)" />
      <path d="M14 40c4-10 12-14 18-12s8-6 16-4c-2 8 0 14-6 20s-18 4-28-4z" fill="var(--land)" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M32 13c-6 0-10 4.5-10 10 0 7 10 17 10 17s10-10 10-17c0-5.5-4-10-10-10z" fill="var(--coral)" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="32" cy="23" r="3.6" fill="var(--bg)" />
    </svg>
  );
}

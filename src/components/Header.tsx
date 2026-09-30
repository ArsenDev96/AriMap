"use client";

import { useLayoutEffect, useRef, type Dispatch, type RefObject } from "react";
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

/** The lesson's three steps, each with its accent colour (see the stage tokens in globals.css). */
export const STEPS: { key: MessageKey; accent: StageAccent; stages: LessonStage[] }[] = [
  { key: "steps.discover", accent: "discover", stages: ["discover"] },
  { key: "steps.find", accent: "find", stages: ["find"] },
  { key: "steps.travel", accent: "travel", stages: ["travel", "results"] },
];

export type StageAccent = "discover" | "find" | "travel";

export function accentFor(stage: LessonStage): StageAccent {
  return STEPS.find((s) => s.stages.includes(stage))!.accent;
}

/** Sized in em, so it grows with its dot when the text is enlarged (12px at the default size). */
function CheckIcon() {
  return (
    <svg width="1.05em" height="1.05em" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The room the three step dots need beside Home and the language toggle, in rem, so it grows with the text size. */
const STEPS_MIN_REM = 4.25;

type HeaderLayout = "row" | "stacked" | "tight";

/**
 * How the header fits its three groups: in one row when the steps have comfortable room
 * between Home and the language toggle; otherwise "stacked", the steps on a row of their
 * own; and "tight" (Home's icon hidden, less padding) when even Home and the toggle would
 * not share a row. Home, the toggle and the brand keep their width in the first two layouts,
 * so the room is worked out from their natural sizes, read with the tight rules switched
 * off (data-measuring). Checked again whenever the header, Home or the toggle changes size:
 * screen width, text size or language.
 *
 * Decided before the browser paints, so the header never shows a frame in the wrong layout
 * (e.g. the toggle wrapped under Home) and then jumps: the layout is written straight to the
 * header's data-layout attribute (the CSS follows it), first in a layout effect and then from
 * a ResizeObserver, whose callbacks run after layout but before paint. A React state update
 * there would only be applied after that frame had been painted.
 */
function useHeaderLayout(header: RefObject<HTMLElement | null>, steps: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const h = header.current!;
    const measure = () => {
      h.setAttribute("data-measuring", "");
      const cs = getComputedStyle(h);
      const gap = parseFloat(cs.columnGap) || 0;
      const inner = h.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const others = [...h.children].filter((el) => el !== steps.current && getComputedStyle(el).display !== "none");
      const used = others.reduce((w, el) => w + el.getBoundingClientRect().width, 0) + gap * (others.length - 1);
      h.removeAttribute("data-measuring");
      const stepsMin = STEPS_MIN_REM * parseFloat(getComputedStyle(document.documentElement).fontSize);
      const layout: HeaderLayout = inner - used - gap >= stepsMin ? "row" : used <= inner ? "stacked" : "tight";
      h.setAttribute("data-layout", layout);
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const el of [h, ...h.children]) if (el !== steps.current) observer.observe(el);
    return () => observer.disconnect();
  }, [header, steps]);
}

export function Header({ progress, dispatch }: { progress: LessonProgress; dispatch: Dispatch<AppAction> }) {
  const { t } = useI18n();
  const headerRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<HTMLOListElement>(null);
  // Too little room (narrow screens with enlarged text): the steps get a row of their own.
  useHeaderLayout(headerRef, stepsRef);
  // In Results the journey is finished: every step is done and none is current. Replay
  // journey returns to the Travel stage, which makes Travel current again.
  const current = progress.stage === "results" ? STEPS.length : STEPS.findIndex((s) => s.stages.includes(progress.stage));
  return (
    // data-layout is set by useHeaderLayout, not by React.
    <header ref={headerRef} className={styles.header}>
      {/* Wider screens only; on phones the Home button stands for it. */}
      <div className={styles.brand}>
        <BrandMark />
        <span className={styles.brandName}>{t("app.name")}</span>
      </div>
      {/* Back to the lesson overview; progress is kept, and Continue there resumes it. */}
      <button type="button" className={styles.home} onClick={() => dispatch({ type: "goHome" })} data-testid="home">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3.5 11 12 4l8.5 7M6 9.5V20h4.5v-5.5h3V20H18V9.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{t("nav.home")}</span>
      </button>
      <ol ref={stepsRef} className={styles.steps} aria-label={t("steps.label")}>
        {STEPS.map((step, i) => {
          const label = t(step.key);
          const done = i < current;
          return (
            <li
              key={step.key}
              className={`${styles.step} ${done ? styles.stepDone : ""} ${i === current ? styles.stepCurrent : ""}`}
              data-accent={step.accent}
              aria-current={i === current ? "step" : undefined}
            >
              {/* Done: a check; current and upcoming: the step's number. Colour is never the only cue. */}
              <span className={styles.stepDot} aria-hidden="true">
                {done ? <CheckIcon /> : i + 1}
              </span>
              <span className={styles.stepLabel} aria-hidden="true">
                {label}
              </span>
              <span className="visually-hidden">{done ? t("welcome.stepDone", { step: label }) : i === current ? label : t("welcome.stepTodo", { step: label })}</span>
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

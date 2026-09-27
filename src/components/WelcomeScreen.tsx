"use client";

import type { Dispatch } from "react";
import type { MessageKey } from "@/core/i18n/translate";
import type { LessonProgress } from "@/core/lesson/progress";
import type { LessonDefinition } from "@/core/lessons/types";
import type { AppAction } from "@/core/progress/appState";
import { BrandMark, LanguageToggle } from "./Header";
import { useI18n } from "./i18n";
import styles from "./WelcomeScreen.module.css";

interface Props {
  lesson: LessonDefinition;
  progress: LessonProgress;
  dispatch: Dispatch<AppAction>;
}

export function WelcomeScreen({ lesson, progress, dispatch }: Props) {
  const { t, tp, l, name } = useI18n();
  const { records } = progress;
  const complete = records.travelDone;
  const steps: { key: MessageKey; done: boolean }[] = [
    { key: "steps.discover", done: records.discoverDone },
    { key: "steps.find", done: records.findDone },
    { key: "steps.travel", done: records.travelDone },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.top}>
        <LanguageToggle dispatch={dispatch} large />
      </div>

      <section className={styles.hero}>
        <BrandMark size={72} />
        <h1 className={styles.title}>{t("app.name")}</h1>
        <p className={styles.tagline}>{t("app.tagline")}</p>
        <p className={styles.intro}>{t("welcome.intro")}</p>
      </section>

      <section className={styles.card} aria-labelledby="lesson-title">
        <p className={styles.region}>
          {l(lesson.regionName)} · {tp("welcome.countries", lesson.countries.length)}
        </p>
        <h2 id="lesson-title" className={styles.lessonTitle}>
          {l(lesson.title)}
        </h2>
        <p className={styles.countries}>{lesson.countries.map(name).join(" · ")}</p>

        <ol className={styles.steps}>
          {steps.map((s, i) => (
            <li key={s.key} className={s.done ? styles.stepDone : undefined}>
              <span className={styles.stepNumber} aria-hidden="true">
                {s.done ? "✓" : i + 1}
              </span>
              <span className="visually-hidden">{t(s.done ? "welcome.stepDone" : "welcome.stepTodo", { step: t(s.key) })}</span>
              <span aria-hidden="true">{t(s.key)}</span>
            </li>
          ))}
        </ol>

        {complete && <p className={styles.complete}>★ {t("welcome.lessonComplete")}</p>}

        <div className={styles.actions}>
          {!progress.started && (
            <button type="button" className="btn btn-primary btn-block" onClick={() => dispatch({ type: "openLesson" })}>
              {t("welcome.start")}
            </button>
          )}
          {progress.started && !complete && (
            <>
              <button type="button" className="btn btn-primary btn-block" onClick={() => dispatch({ type: "openLesson" })}>
                {t("welcome.continue")}
              </button>
              <button type="button" className="btn btn-secondary btn-block" onClick={() => dispatch({ type: "startOver" })}>
                {t("welcome.startOver")}
              </button>
            </>
          )}
          {progress.started && complete && (
            <>
              <button type="button" className="btn btn-primary btn-block" onClick={() => dispatch({ type: "startOver" })}>
                {t("welcome.playAgain")}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => {
                  dispatch({ type: "lesson", action: { type: "replayTravel" } });
                  dispatch({ type: "openLesson" });
                }}
              >
                {t("welcome.replayJourney")}
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

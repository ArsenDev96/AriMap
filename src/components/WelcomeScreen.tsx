"use client";

import Image from "next/image";
import { useRef, type Dispatch } from "react";
import type { LessonProgress } from "@/core/lesson/progress";
import type { LessonDefinition } from "@/core/lessons/types";
import type { AppAction } from "@/core/progress/appState";
import { BrandMark, LanguageToggle, STEPS } from "./Header";
import { useI18n } from "./i18n";
import { LANDMARK_IMAGES } from "./landmarks/LandmarkCard";
import styles from "./WelcomeScreen.module.css";

interface Props {
  lesson: LessonDefinition;
  progress: LessonProgress;
  dispatch: Dispatch<AppAction>;
}

export function WelcomeScreen({ lesson, progress, dispatch }: Props) {
  const { t, tp, l, name } = useI18n();
  const confirmRef = useRef<HTMLDialogElement>(null);
  const { records } = progress;
  const complete = records.travelDone;
  const done = [records.discoverDone, records.findDone, records.travelDone];

  return (
    <main className={styles.page}>
      {/* Everything but the main action scrolls here, above the action's own area: nothing is covered. */}
      <div className={styles.scroll} data-testid="welcome-scroll">
        <div className={styles.content}>
          <div className={styles.top}>
            <LanguageToggle dispatch={dispatch} large />
          </div>

          <section className={styles.hero}>
            <WelcomeArt />
            <div className={styles.titleRow}>
              <BrandMark size={48} />
              <h1 className={styles.title}>{t("app.name")}</h1>
            </div>
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

            {/* Each step in its colour, with a check when done or its number: colour is never the only cue. */}
            <ol className={styles.steps}>
              {STEPS.map((step, i) => (
                <li key={step.key} className={done[i] ? styles.stepDone : undefined} data-accent={step.accent}>
                  <span className={styles.stepNumber} aria-hidden="true">
                    {done[i] ? "✓" : i + 1}
                  </span>
                  <span className="visually-hidden">{t(done[i] ? "welcome.stepDone" : "welcome.stepTodo", { step: t(step.key) })}</span>
                  <span aria-hidden="true">{t(step.key)}</span>
                </li>
              ))}
            </ol>

            {complete && (
              <p className={styles.complete}>
                <span aria-hidden="true">★</span> {t("welcome.lessonComplete")}
              </p>
            )}

            {progress.started && (
              <button type="button" className={`btn btn-secondary btn-block ${styles.startOver}`} aria-haspopup="dialog" onClick={() => confirmRef.current?.showModal()}>
                {t("welcome.startOver")}
              </button>
            )}
          </section>
        </div>
      </div>

      {/* The main action in its own area at the bottom: always in view, never over the content.
          Continue returns to exactly where the player left (also after completing every step). */}
      <div className={styles.actionBar} data-testid="welcome-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={() => dispatch({ type: "openLesson" })}>
          {t(progress.started ? "welcome.continue" : "welcome.start")}
        </button>
      </div>

      {/* Start over discards the player's current progress, so it asks first. Keeping it is the default. */}
      <dialog
        ref={confirmRef}
        className={styles.dialog}
        aria-labelledby="start-over-title"
        aria-describedby="start-over-text"
        data-testid="start-over-dialog"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <form method="dialog" className={styles.dialogBody}>
          <h2 id="start-over-title" className={styles.dialogTitle}>
            {t("welcome.startOverTitle")}
          </h2>
          <p id="start-over-text">{t("welcome.startOverText")}</p>
          <div className={styles.dialogActions}>
            <button type="submit" className="btn btn-primary btn-block" autoFocus>
              {t("welcome.startOverKeep")}
            </button>
            <button type="submit" className="btn btn-secondary btn-block" onClick={() => dispatch({ type: "startOver" })}>
              {t("welcome.startOver")}
            </button>
          </div>
        </form>
      </dialog>
    </main>
  );
}

/** The lesson's five landmarks as stickers along a dashed route: a decorative start to the adventure. */
const ART = ["eiffel-tower", "atomium", "amsterdam-canal-houses", "adolphe-bridge", "brandenburg-gate"] as const;

function WelcomeArt() {
  return (
    <div className={styles.art} aria-hidden="true">
      <svg className={styles.artRoute} viewBox="0 0 300 100" preserveAspectRatio="none">
        <path d="M18 70 C 70 20, 100 90, 150 50 S 240 20, 282 62" fill="none" />
      </svg>
      {ART.map((id) => (
        <div key={id} className={styles.sticker}>
          <Image src={LANDMARK_IMAGES[id]} alt="" fill sizes="96px" className={styles.stickerImage} />
        </div>
      ))}
    </div>
  );
}

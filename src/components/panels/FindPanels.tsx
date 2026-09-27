"use client";

import { useEffect, useRef } from "react";
import { getCountry } from "@/core/content/countries";
import { countIndependent } from "@/core/game/find";
import type { MessageKey } from "@/core/i18n/translate";
import { useI18n } from "../i18n";
import type { PanelProps } from "../LessonScreen";
import styles from "../LessonScreen.module.css";

const HINT_BUTTON: Record<number, MessageKey> = { 0: "find.hint", 1: "find.hintMore", 2: "find.hintReveal" };

export function FindPanel({ progress, act }: PanelProps) {
  const { t, l, countryParams } = useI18n();
  const nextRef = useRef<HTMLButtonElement>(null);
  const session = progress.find;
  const solved = session?.question.solved ?? false;

  // Move focus to "Next" once answered so keyboard users can continue directly.
  useEffect(() => {
    if (solved) nextRef.current?.focus();
  }, [solved]);

  if (!session) return null;
  const { question, round, index } = session;
  const total = session.orders[round].length;
  const target = getCountry(question.target);
  const answer = session.results[round][index];
  const feedback = question.feedback;
  const done = index + (question.solved ? 1 : 0);

  let feedbackText = "";
  let feedbackClass = "";
  if (feedback?.kind === "correct") {
    feedbackText = t(answer?.independent ? "find.correct" : "find.correctAssisted", countryParams(feedback.country));
    feedbackClass = styles.feedbackCorrect;
  } else if (feedback?.kind === "wrong") {
    feedbackText = t("find.wrong", countryParams(feedback.country));
    feedbackClass = styles.feedbackWrong;
  } else if (feedback?.kind === "outside") {
    feedbackText = t("find.outside");
    feedbackClass = styles.feedbackWrong;
  }

  return (
    <>
      <div className={styles.heading}>
        <p className={styles.eyebrow}>
          {t("find.round", { round: round + 1, rounds: session.orders.length })} ·{" "}
          {t("find.question", { current: index + 1, total })}
        </p>
        <div
          className={styles.progressBar}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label={t("find.question", { current: index + 1, total })}
        >
          <div className={styles.progressFill} style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </div>

      <div className={styles.heading}>
        <h1 className={styles.title} data-testid="find-prompt">
          {t("find.prompt", countryParams(question.target))}
        </h1>
        {!question.solved && <p className={styles.lead}>{t("find.instructions")}</p>}
      </div>

      <div role="status" aria-live="polite">
        {feedbackText && (
          <p className={`${styles.feedback} ${feedbackClass}`} data-testid="find-feedback">
            {feedbackText}
            {feedback?.kind === "correct" && (
              <span className={styles.feedbackDetail}>{t(answer?.independent ? "find.firstTry" : "find.withHelp")}</span>
            )}
          </p>
        )}
      </div>

      {question.hintLevel > 0 && !question.solved && (
        <ul className={styles.hints} aria-live="polite">
          <li>
            {t("find.hintCapital", { capital: l(target.capital.name) })}
            {target.landmark && <> {t("find.hintLandmark", { landmark: l(target.landmark.nameInText) })}</>}
          </li>
          {question.hintLevel >= 2 && (
            <li>
              {l(target.hint)} {question.hintLevel === 2 && t("find.hintArea")}
            </li>
          )}
          {question.hintLevel >= 3 && <li>{t("find.hintRevealed")}</li>}
        </ul>
      )}

      <div className={`${styles.row} ${styles.footerSticky}`}>
        {!question.solved && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => act({ type: "findHint" })}
            disabled={question.hintLevel >= 3}
          >
            {t(HINT_BUTTON[question.hintLevel] ?? "find.hintReveal")}
          </button>
        )}
        {question.solved && (
          <button ref={nextRef} type="button" className="btn btn-primary btn-block" onClick={() => act({ type: "findNext" })}>
            {t("find.next")}
          </button>
        )}
      </div>
    </>
  );
}

export function FindSummaryPanel({ progress, act }: PanelProps) {
  const { t, name } = useI18n();
  const session = progress.find;
  if (!session) return null;
  const answers = session.results[session.round];
  const lastRound = session.round === session.orders.length - 1;

  return (
    <>
      <div className={styles.heading}>
        <p className={styles.eyebrow}>{t("steps.find")}</p>
        <h1 className={styles.title}>{t("find.roundDone", { round: session.round + 1 })}</h1>
      </div>
      <p className={styles.feedback + " " + styles.feedbackCorrect} data-testid="round-summary">
        {t("find.roundSummary", { count: countIndependent(answers), total: answers.length })}
      </p>
      <ul className={styles.resultList}>
        {answers.map((a) => (
          <li key={a.target}>
            <span>{name(a.target)}</span>
            <span className={`${styles.tag} ${a.independent ? styles.tagGood : styles.tagHelp}`}>
              {t(a.independent ? "find.resultIndependent" : "find.resultAssisted")}
            </span>
          </li>
        ))}
      </ul>
      <div className={`${styles.footer} ${styles.footerSticky}`}>
        <button type="button" className="btn btn-primary btn-block" onClick={() => act({ type: "findContinue" })}>
          {t(lastRound ? "find.toTravel" : "find.nextRound")}
        </button>
      </div>
    </>
  );
}

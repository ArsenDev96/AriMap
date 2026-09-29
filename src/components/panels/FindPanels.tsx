"use client";

import { useEffect, useRef } from "react";
import { getCountry } from "@/core/content/countries";
import { isLastAnswered } from "@/core/game/find";
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
  const { question, index } = session;
  const total = session.order.length;
  const target = getCountry(question.target);
  const answer = session.results[index];
  const feedback = question.feedback;
  const done = index + (question.solved ? 1 : 0);
  const last = isLastAnswered(session);

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
        <p className={styles.eyebrow} data-testid="find-progress">
          {t("find.question", { current: index + 1, total })}
        </p>
        {/* One segment per question: answered, the current one, still to come. */}
        <div
          className={styles.pips}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label={t("find.question", { current: index + 1, total })}
        >
          {session.order.map((id, i) => (
            <span key={id} className={`${styles.pip} ${i < done ? styles.pipDone : i === index ? styles.pipCurrent : ""}`} />
          ))}
        </div>
      </div>

      <div className={styles.heading}>
        <h1 className={`${styles.title} ${styles.questionTitle}`} data-testid="find-prompt">
          <Emphasized text={t("find.prompt", countryParams(question.target))} part={countryParams(question.target).country} />
        </h1>
        {!question.solved && <p className={styles.lead}>{t("find.instructions")}</p>}
      </div>

      <div role="status" aria-live="polite">
        {feedbackText && (
          <p className={`${styles.feedback} ${styles.feedbackWithIcon} ${feedbackClass}`} data-testid="find-feedback">
            <FeedbackIcon correct={feedback?.kind === "correct"} />
            <span>
              {feedbackText}
              {feedback?.kind === "correct" && (
                <span className={styles.feedbackDetail}>{t(answer?.independent ? "find.firstTry" : "find.withHelp")}</span>
              )}
            </span>
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
          <button
            ref={nextRef}
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => act({ type: last ? "findToTravel" : "findNext" })}
          >
            {t(last ? "find.toTravel" : "find.next")}
          </button>
        )}
      </div>
    </>
  );
}

/** `text` with `part` (the country asked for) emphasized, whatever the word order of the language. */
function Emphasized({ text, part }: { text: string; part: string }) {
  const at = text.indexOf(part);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className={styles.questionTarget}>{part}</span>
      {text.slice(at + part.length)}
    </>
  );
}

/** A check for a correct answer; a curved "try again" arrow otherwise. */
function FeedbackIcon({ correct }: { correct: boolean }) {
  return (
    <svg className={styles.feedbackIcon} width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      {correct ? (
        <path d="M7 12.5l3.3 3.3L17 9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M16.5 9.5A5 5 0 1 0 17 14M16.8 6.3v3.4h-3.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

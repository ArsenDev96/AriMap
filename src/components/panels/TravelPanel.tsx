"use client";

import { useEffect, useRef } from "react";
import { availableMoves, crossingsLeft, currentCountry, isAssisted } from "@/core/game/travel";
import { useI18n } from "../i18n";
import type { PanelProps } from "../LessonScreen";
import styles from "../LessonScreen.module.css";

interface Props extends PanelProps {
  hintVisible: boolean;
  onHint: () => void;
}

export function TravelPanel({ lesson, progress, act, hintVisible, onHint }: Props) {
  const { t, tp, name, countryParams } = useI18n();
  const stuckRef = useRef<HTMLDivElement>(null);
  const attempt = progress.travel;
  const isStuck = attempt?.status === "outOfCrossings";

  // On phones the panel is short: bring the Undo/Retry choice into view.
  useEffect(() => {
    if (isStuck) stuckRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isStuck]);

  if (!attempt) return null;

  const left = crossingsLeft(attempt);
  const here = currentCountry(attempt);
  const moves = availableMoves(attempt, lesson.borders);
  const stuck = attempt.status === "outOfCrossings";
  const hasMoved = attempt.path.length > 1;

  return (
    <>
      <div className={styles.heading}>
        <p className={styles.eyebrow}>{t("travel.title")}</p>
        <h1 className={styles.mission}>
          <span className={styles.missionStart}>
            <span className={`${styles.chip} ${styles.chipStart}`}>
              <span className="visually-hidden">{t("travel.from")}: </span>
              {name(attempt.from)}
            </span>
            <span aria-hidden="true">→</span>
          </span>
          <span className={`${styles.chip} ${styles.chipEnd}`}>
            <span className="visually-hidden">{t("travel.to")}: </span>
            {/* A destination flag: the map shows the destination in the same gold. */}
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 21V4M6 4h11l-2.5 4L17 12H6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {name(attempt.to)}
          </span>
        </h1>
        <p className={`${styles.lead} ${styles.travelLead}`}>{tp("travel.mission", attempt.budget)}</p>
      </div>

      <div className={styles.crossings}>
        <span className={styles.dots} aria-hidden="true">
          {Array.from({ length: attempt.budget }, (_, i) => (
            <span key={i} className={`${styles.dot} ${i < left ? styles.dotFull : ""}`} />
          ))}
        </span>
        <span data-testid="crossings-left">{tp("travel.crossingsLeft", left)}</span>
      </div>

      <div role="status" aria-live="polite">
        {!stuck && (
          <p className={`${styles.feedback} ${styles.travelStatus} ${hasMoved ? styles.feedbackCorrect : styles.feedbackInfo}`}>
            {hasMoved ? t("travel.moved", countryParams(here)) : t("travel.current", countryParams(here))}
          </p>
        )}
        {hintVisible && <p className={`${styles.muted} ${styles.small}`} style={{ marginTop: 6 }}>{t("travel.hintShown")}</p>}
      </div>

      {stuck ? (
        <div ref={stuckRef} className={`${styles.feedback} ${styles.feedbackWrong}`} data-testid="out-of-crossings">
          <p>{t("travel.outOfCrossings")}</p>
          <div className={styles.row} style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-primary" onClick={() => act({ type: "travelUndo" })}>
              {t("travel.undo")}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => act({ type: "travelRestart" })}>
              {t("travel.retry")}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <h2 className={styles.factLabel} id="neighbors-heading">
            {t("travel.choose")}
          </h2>
          {/* Cards show names only; focusing or hovering them never highlights the map. */}
          <div className={styles.neighbors} role="group" aria-labelledby="neighbors-heading">
            {moves.map((id) => (
              <button
                key={id}
                type="button"
                className={styles.neighborCard}
                data-testid={`move-${id}`}
                onClick={() => act({ type: "travelMove", country: id })}
              >
                <span>{name(id)}</span>
                <svg className={styles.neighborArrow} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h13M13 6.5 18.5 12 13 17.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {isAssisted(attempt) && <p className={styles.helpUsed}>{t("travel.helpUsed")}</p>}

      <div className={styles.row} data-testid="travel-tools">
        <button type="button" className="btn btn-secondary" onClick={onHint} disabled={stuck}>
          {t("travel.hint")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => act({ type: "travelUndo" })} disabled={!hasMoved}>
          {t("travel.undo")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => act({ type: "travelRestart" })} disabled={!hasMoved}>
          {t("travel.restart")}
        </button>
      </div>
      <p className={styles.note}>{t("travel.region")}</p>
    </>
  );
}

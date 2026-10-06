"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { availableMoves, crossingsLeft, currentCountry, isAssisted, isDeadEnd } from "@/core/game/travel";
import { useI18n } from "../i18n";
import type { PanelProps } from "../LessonScreen";
import styles from "../LessonScreen.module.css";

interface Props extends PanelProps {
  hintVisible: boolean;
  onHint: () => void;
}

/** The arrow drawn on every neighbour card. */
function NeighborArrow() {
  return (
    <svg className={styles.neighborArrow} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 6.5 18.5 12 13 17.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Two columns of neighbour cards only when every card fits half the row with its name on one
 * line: the widest card's own width (name, padding, gap and arrow, in the loaded font at the
 * current text size) is measured in a hidden copy. Measured again when the row or a card's size
 * changes (screen width, text enlargement), when fonts finish loading, and for new names
 * (another country, another language). Otherwise one column.
 */
function useNeighborColumns(labelsKey: string) {
  const gridRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState<1 | 2>(1);
  useLayoutEffect(() => {
    const grid = gridRef.current;
    const measure = measureRef.current;
    if (!grid || !measure) return;
    const update = () => {
      const cards = [...measure.children];
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
      const half = (grid.clientWidth - gap) / 2;
      const widest = Math.max(0, ...cards.map((c) => c.getBoundingClientRect().width));
      // A pixel to spare, so subpixel rounding never wraps a name that just fits.
      setColumns(cards.length > 1 && widest + 1 <= half ? 2 : 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(grid);
    for (const card of measure.children) observer.observe(card);
    const fonts = document.fonts;
    fonts?.addEventListener("loadingdone", update);
    void fonts?.ready.then(update);
    return () => {
      observer.disconnect();
      fonts?.removeEventListener("loadingdone", update);
    };
  }, [labelsKey]);
  return { gridRef, measureRef, columns };
}

export function TravelPanel({ lesson, progress, act, hintVisible, onHint }: Props) {
  const { t, tp, name, countryParams } = useI18n();
  const stuckRef = useRef<HTMLDivElement>(null);
  const attempt = progress.travel;
  // Out of crossings, or a dead end with crossings left (every neighbour already on the route).
  const isStuck = !!attempt && (attempt.status === "outOfCrossings" || isDeadEnd(attempt, lesson.borders));
  const labelsKey = attempt ? availableMoves(attempt, lesson.borders).map((id) => name(id)).join("|") : "";
  const { gridRef, measureRef, columns } = useNeighborColumns(labelsKey);

  // On phones the panel is short: bring the Undo/Retry choice into view.
  useEffect(() => {
    if (isStuck) stuckRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isStuck]);

  if (!attempt) return null;

  const left = crossingsLeft(attempt);
  const here = currentCountry(attempt);
  const moves = availableMoves(attempt, lesson.borders);
  const deadEnd = isDeadEnd(attempt, lesson.borders);
  const stuck = attempt.status === "outOfCrossings" || deadEnd;
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
            {/* Its own box, so a name wider than the whole line can break rather than run out of the chip. */}
            <span className={styles.chipName}>{name(attempt.to)}</span>
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
        // Its own element (not the neighbours' box restyled), so it is at full size when scrolled into view.
        // A dead end says so, not that the crossings ran out: some are left, but no neighbour is new.
        <div
          key={deadEnd ? "dead-end" : "stuck"}
          ref={stuckRef}
          className={`${styles.feedback} ${styles.feedbackWrong}`}
          data-testid={deadEnd ? "dead-end" : "out-of-crossings"}
        >
          <p>{deadEnd ? t("travel.deadEnd", countryParams(here)) : t("travel.outOfCrossings")}</p>
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
          <div className={styles.neighborsArea}>
            {/* Cards show names only; focusing or hovering them never highlights the map. */}
            <div ref={gridRef} className={styles.neighbors} data-columns={columns} role="group" aria-labelledby="neighbors-heading">
              {moves.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={styles.neighborCard}
                  data-testid={`move-${id}`}
                  onClick={() => act({ type: "travelMove", country: id })}
                >
                  <span className={styles.neighborLabel}>{name(id)}</span>
                  <NeighborArrow />
                </button>
              ))}
            </div>
            {/* The same cards with each name on one line, hidden and inert: their widths choose the columns. */}
            <div ref={measureRef} className={styles.neighborMeasure} aria-hidden="true" inert>
              {moves.map((id) => (
                <span key={id} className={styles.neighborCard}>
                  <span className={styles.neighborLabel}>{name(id)}</span>
                  <NeighborArrow />
                </span>
              ))}
            </div>
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
      <p className={styles.note} data-testid="travel-note">
        {t("travel.region")}
      </p>
    </>
  );
}

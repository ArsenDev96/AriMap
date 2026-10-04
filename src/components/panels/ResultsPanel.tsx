"use client";

import { useState } from "react";
import { attemptRating, nextStar } from "@/core/lesson/rating";
import { getContinent, getLevel, type LevelInfo } from "@/core/lessons";
import { useI18n } from "../i18n";
import type { PanelProps } from "../LessonScreen";
import { RestartDialog, type RestartRequest } from "../RestartDialog";
import { Stars } from "../Stars";
import styles from "../LessonScreen.module.css";

/**
 * A finished journey: the route, the Find score, and what to do next. The main action, pinned at
 * the bottom, is Next level when another playable level follows in the same continent (opening it
 * at Discover, or where it was left: opening never resets it), otherwise Back to levels (never a
 * coming-soon level). Above it, in the page: Replay journey, and Play again for the whole level,
 * which asks first (RestartDialog). Nothing advances by itself, and nothing here clears a result.
 *
 * Under the banner, the stars (rating.ts): this attempt's, and the level's best when it differs;
 * "New best!" when this attempt has just beaten an earlier best; for 1 or 2 stars, what earns the
 * next. A journey replay has no rating of its own: the best is shown, with a word on how to earn more.
 */
export function ResultsPanel({ lesson, progress, act, dispatch, next, newBest }: PanelProps & { next: LevelInfo | null; newBest: boolean }) {
  const { t, l, name } = useI18n();
  const [confirm, setConfirm] = useState<RestartRequest | null>(null);
  const level = getLevel(lesson.id)!;
  const result = progress.lastTravelResult;
  if (!result) return null;
  const used = result.route.length - 1;
  const last = result.route.length - 1;
  const help = [result.hintUsed && t("results.helpHint"), result.undoUsed && t("results.helpUndo")].filter(Boolean);
  const findScore = progress.records.lastFindScore;
  // Each of the five questions of the Find just played (the score above counts the same answers).
  const findAnswers = progress.find?.status === "complete" ? progress.find.results : [];
  const rating = attemptRating(progress);
  const best = progress.records.bestRating;
  const need = rating !== null ? nextStar(findAnswers, result) : null;
  const total = findAnswers.length;
  const stars = (count: number) => t("stars.count", { count });

  return (
    <>
      {/* A cheerful arrival: a star and confetti pop in once (not with reduced motion). */}
      <div className={styles.celebration} data-testid="celebration">
        <CelebrationArt />
        <h1 className={styles.title}>{t("results.title")}</h1>
      </div>

      {(rating !== null || best !== null || progress.journeyReplay) && (
        <section className={styles.rating} aria-labelledby="results-stars" data-testid="rating">
          <h2 className="visually-hidden" id="results-stars">
            {t("stars.title")}
          </h2>
          {rating !== null && (
            <p className={styles.ratingRow} data-testid="rating-attempt" data-stars={rating}>
              <span className={styles.ratingLabel}>{t("stars.thisAttempt")}</span>
              <Stars count={rating} celebrate={newBest} />
              <span className={styles.ratingCount}>{stars(rating)}</span>
            </p>
          )}
          {best !== null && best !== rating && (
            <p className={`${styles.ratingRow} ${styles.ratingBest}`} data-testid="rating-best" data-stars={best}>
              <span className={styles.ratingLabel}>{t("stars.best")}</span>
              <Stars count={best} />
              <span className={styles.ratingCount}>{stars(best)}</span>
            </p>
          )}
          {newBest && (
            <p className={styles.newBest} data-testid="new-best">
              {t("stars.newBest")}
            </p>
          )}
          {need && (
            <p className={styles.ratingNext} data-testid="rating-next" data-need={need}>
              {t(`stars.next.${need}`, { most: total - 1, total })}
            </p>
          )}
          {rating === null && (
            <p className={styles.ratingNext} data-testid="rating-replay">
              {t(best !== null ? "stars.journeyReplay" : "stars.journeyReplayNone")}
            </p>
          )}
        </section>
      )}

      <section className={styles.card} aria-labelledby="results-travel">
        <h2 className={styles.sectionTitle} id="results-travel">
          {t("results.route")}
        </h2>
        <ol className={styles.route} data-testid="result-route">
          {result.route.map((id, i) => {
            const role = i === 0 ? "start" : i === last ? "end" : "stop";
            return (
              <li
                key={`${id}-${i}`}
                className={`${styles.stop} ${role === "start" ? styles.stopStart : role === "end" ? styles.stopEnd : ""}`}
              >
                <span className={styles.stopMarker} aria-hidden="true" />
                <span className={styles.stopText}>
                  <span className={styles.stopName}>{name(id)}</span>
                  <span className={styles.stopRole}>
                    {t(role === "start" ? "travel.from" : role === "end" ? "travel.to" : "results.stop")}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className={styles.statRow} data-testid="result-crossings">
          <span className={styles.factLabel}>{t("results.crossingsLabel")}</span>
          <span className={styles.statValue}>{t("results.crossings", { used, budget: result.budget })}</span>
        </p>
        <p className={styles.statRow} data-testid="result-help">
          <span className={styles.factLabel}>{t("results.help")}</span>
          <span className={styles.statValue}>{help.length > 0 ? help.join(", ") : t("results.helpNone")}</span>
        </p>
        {result.independent ? (
          <div className={styles.badge} data-testid="badge">
            <svg className={styles.badgeIcon} width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
              <circle cx="22" cy="22" r="20" fill="var(--amber)" stroke="var(--ink)" strokeWidth="2.5" />
              <path d="M22 10l3.5 7.5 8 1-6 5.5 1.6 8L22 28l-7.1 4 1.6-8-6-5.5 8-1z" fill="#fff" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <div>
              <p className={styles.badgeTitle}>{t("results.badge")}</p>
              <p className={`${styles.muted} ${styles.small}`}>{t("results.badgeText")}</p>
            </div>
          </div>
        ) : (
          <p className={styles.note}>{t("results.noBadge")}</p>
        )}
      </section>

      {findScore && (
        <section className={styles.card} aria-labelledby="results-find" data-testid="result-find">
          <h2 className={styles.sectionTitle} id="results-find">
            {t("results.findTitle")}
          </h2>
          <div className={styles.findScore}>
            <span className={styles.findScoreValue}>
              {findScore.independent}/{findScore.total}
            </span>
            <span>{t("results.find", { count: findScore.independent, total: findScore.total })}</span>
          </div>
          {findAnswers.length > 0 && (
            <ul className={styles.resultList} data-testid="result-find-answers">
              {findAnswers.map((a) => (
                <li key={a.target} data-country={a.target}>
                  <span>{name(a.target)}</span>
                  <span className={`${styles.tag} ${a.independent ? styles.tagGood : styles.tagHelp}`}>
                    {t(a.independent ? "find.resultIndependent" : "find.resultAssisted")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* The other ways on, in the page above the pinned main action (Home is in the header). */}
      <div className={styles.resultsActions} data-testid="results-actions">
        <button
          type="button"
          className="btn btn-secondary"
          aria-label={t("level.forLevel", { action: t("results.replay"), level: l(level.title) })}
          data-testid="replay-journey"
          onClick={() => act({ type: "replayTravel" })}
        >
          {t("results.replay")}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          aria-haspopup="dialog"
          aria-label={t("level.forLevel", { action: t("welcome.playAgain"), level: l(level.title) })}
          data-testid="results-play-again"
          onClick={() => setConfirm({ level, mode: "playAgain" })}
        >
          {t("welcome.playAgain")}
        </button>
      </div>

      <div className={`${styles.footer} ${styles.footerSticky} ${styles.resultsMain}`}>
        {next ? (
          <button
            type="button"
            className={`btn btn-primary btn-block ${styles.nextAction}`}
            data-testid="next-level"
            data-level={next.id}
            // The level it opens in full, also when narrow screens show less of it.
            aria-label={t("results.nextLevelLabel", { level: t("level.number", { number: next.number }), title: l(next.title) })}
            onClick={() => dispatch({ type: "openLevel", levelId: next.id })}
          >
            <span>{t("results.nextLevel")}</span>
            <span className={styles.nextActionLevel}>
              {t("level.number", { number: next.number })}
              <span className={styles.nextActionTitle}> · {l(next.title)}</span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-block"
            aria-label={t("results.backToLevelsLabel", { continent: l(getContinent(level.continent).nameOf) })}
            data-testid="back-to-levels"
            onClick={() => dispatch({ type: "openContinent", continent: level.continent })}
          >
            {t("results.backToLevels")}
          </button>
        )}
      </div>

      <RestartDialog request={confirm} onClose={() => setConfirm(null)} dispatch={dispatch} />
    </>
  );
}

function CelebrationArt() {
  return (
    <svg className={styles.celebrationArt} width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
      <circle className={styles.confetti} cx="10" cy="18" r="4" fill="var(--discover)" />
      <circle className={styles.confetti} cx="66" cy="12" r="3.5" fill="var(--travel)" />
      <rect className={styles.confetti} x="60" y="56" width="8" height="8" rx="2" fill="var(--coral)" />
      <rect className={styles.confetti} x="6" y="52" width="7" height="7" rx="2" fill="var(--find)" />
      <path
        className={styles.celebrationStar}
        d="M38 12l7.6 15.4 17 2.5-12.3 12 2.9 16.9L38 50.8l-15.2 8 2.9-16.9-12.3-12 17-2.5z"
        fill="var(--amber)"
        stroke="var(--ink)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

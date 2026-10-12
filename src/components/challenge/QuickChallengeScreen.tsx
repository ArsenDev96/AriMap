"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import {
  answer,
  challengeResult,
  CHALLENGE_POOL,
  createChallenge,
  currentQuestion,
  feedbackOf,
  remainingMs,
  startChallenge,
  tick,
  type AnswerRecord,
  type ChallengeResult,
  type ChallengeRound,
  type MissedQuestion,
} from "@/core/challenge/quickChallenge";
import type { CountryId } from "@/core/content/types";
import type { AppAction } from "@/core/progress/appState";
import { LanguageToggle } from "../Header";
import { useI18n } from "../i18n";
import { ChallengeMap, type ChallengeTone } from "./ChallengeMap";
import styles from "./QuickChallengeScreen.module.css";

/** How often the timer and feedback are brought up to date while a round is played (ms). */
const TICK_MS = 100;

/**
 * The round's clock: milliseconds since it was made, never running backwards. It takes the later of the
 * page's own clock (performance.now, which some browsers pause while the page is in the background or the
 * device sleeps) and the wall clock (Date.now, which the device's settings can move), so neither a pause
 * nor a clock set back gives the player extra time.
 */
function createClock(): () => number {
  const [page0, wall0] = [performance.now(), Date.now()];
  let last = 0;
  return () => (last = Math.max(last, performance.now() - page0, Date.now() - wall0));
}

interface Props {
  dispatch: Dispatch<AppAction>;
  /** Back to the home screen. */
  onClose: () => void;
}

/**
 * The Quick Challenge, from Start to its results and their review on the map. The rules (questions, answers,
 * timer, results) are the core's (src/core/challenge/quickChallenge.ts); this screen keeps the round in
 * memory only (never saved, and lesson progress, stars and unlocks are never touched), brings it up to the
 * clock, and draws it. It stays mounted while the language changes, so the timer runs on.
 */
export function QuickChallengeScreen({ dispatch, onClose }: Props) {
  const { t, tp, name } = useI18n();
  const [clock] = useState(createClock);
  // The round is read and replaced through a ref as well as state, so two taps in one frame are answered
  // against the round as the first one left it (the second is then rejected).
  const [round, setRoundState] = useState<ChallengeRound>(() => createChallenge(Math.random));
  const roundRef = useRef(round);
  const update = useCallback((next: (r: ChallengeRound) => ChallengeRound) => {
    const r = next(roundRef.current);
    if (r === roundRef.current) return;
    roundRef.current = r;
    setRoundState(r);
  }, []);
  const [now, setNow] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const playing = round.status === "playing";
  useEffect(() => {
    if (!playing) return;
    const refresh = () => {
      const time = clock();
      update((r) => tick(r, time));
      setNow(time);
    };
    refresh();
    const timer = window.setInterval(refresh, TICK_MS);
    // Back from the background: up to date at once (timers there run late, or not at all).
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [playing, clock, update]);

  const start = () => {
    const time = clock();
    update((r) => startChallenge(r, time));
    setNow(time);
  };
  const respond = (country: CountryId | null) => {
    const question = currentQuestion(roundRef.current);
    if (!question) return;
    const time = clock();
    update((r) => answer(r, question.index, country, time).round);
    setNow(time);
  };
  const playAgain = () => {
    setReviewing(false);
    update(() => createChallenge(Math.random));
  };

  const result = useMemo(() => challengeResult(round), [round]);
  const feedback = feedbackOf(round);
  const question = currentQuestion(round);
  const phase = result ? (reviewing ? "review" : "results") : round.status;

  const [selected, setSelected] = useState<CountryId | null>(null);
  const tones = useMemo(() => mapTones(round, result, feedback), [round, result, feedback]);

  return (
    <div className={styles.screen} data-phase={phase} data-testid="challenge-screen">
      <header className={styles.header}>
        <button type="button" className={styles.home} onClick={onClose} aria-label={t("challengeGame.backLabel")}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{t("nav.home")}</span>
        </button>
        <h1 className={styles.title}>
          <BoltIcon />
          {t("challenge.label")}
        </h1>
        <LanguageToggle dispatch={dispatch} />
      </header>

      <main className={styles.main}>
        <div className={styles.mapArea}>
          <ChallengeMap
            pool={CHALLENGE_POOL}
            tones={tones}
            names={phase === "review" ? reviewNames(result!, selected) : undefined}
            focus={phase === "review" ? selected : null}
            onTap={phase === "playing" ? respond : phase === "review" ? (id) => setSelected(id) : undefined}
            onReady={() => setMapReady(true)}
          />
        </div>

        <section className={styles.panel} data-testid="challenge-panel">
          {phase === "ready" && (
            <div className={styles.intro}>
              <p className={styles.lead}>{t("challenge.title", { count: round.questions.length })}</p>
              <p className={styles.text}>{t("challengeGame.intro", { time: tp("challenge.seconds", round.rules.durationMs / 1000) })}</p>
              <button type="button" className={`btn btn-primary ${styles.wide}`} onClick={start} disabled={!mapReady} data-testid="challenge-start">
                {mapReady ? t("welcome.start") : t("challengeGame.loading")}
              </button>
            </div>
          )}

          {phase === "playing" && (
            <Playing
              round={round}
              now={now}
              target={question?.target ?? feedback?.target ?? null}
              feedback={feedback}
              onSkip={() => respond(null)}
            />
          )}

          {phase === "results" && result && (
            <Results
              result={result}
              onReview={() => {
                setSelected(result.missed[0]?.target ?? result.questions[0].target);
                setReviewing(true);
              }}
              onPlayAgain={playAgain}
              onHome={onClose}
              onLessons={() => {
                dispatch({ type: "openContinent", continent: "europe" });
                onClose();
              }}
            />
          )}

          {phase === "review" && result && (
            <Review result={result} selected={selected} onSelect={setSelected} onBack={() => setReviewing(false)} name={name} />
          )}
        </section>
      </main>
    </div>
  );
}

/** The map's colours: the answer just given (its feedback), or the whole round once it has ended. */
function mapTones(round: ChallengeRound, result: ChallengeResult | null, feedback: AnswerRecord | null): Partial<Record<CountryId, ChallengeTone>> {
  if (result) {
    const tones: Partial<Record<CountryId, ChallengeTone>> = {};
    for (const q of result.questions) if (q.outcome === "wrong" && q.chosen && !tones[q.chosen]) tones[q.chosen] = "chosen";
    for (const q of result.questions) tones[q.target] = q.outcome === "correct" ? "correct" : "missed";
    return tones;
  }
  if (!feedback || round.status !== "playing") return {};
  // Right: found. Wrong: the country tapped, and where the right one was. Skipped: where it was.
  if (feedback.outcome === "correct") return { [feedback.target]: "correct" };
  return { [feedback.target]: "missed", ...(feedback.chosen ? { [feedback.chosen]: "chosen" } : {}) };
}

/** In the review: the selected question's country and, when it was answered wrongly, the country chosen. */
function reviewNames(result: ChallengeResult, selected: CountryId | null): CountryId[] {
  const q = result.questions.find((q) => q.target === selected);
  if (!q) return selected ? [selected] : [];
  return q.outcome === "wrong" && q.chosen ? [q.target, q.chosen] : [q.target];
}

function Playing({
  round,
  now,
  target,
  feedback,
  onSkip,
}: {
  round: ChallengeRound;
  now: number;
  target: CountryId | null;
  feedback: AnswerRecord | null;
  onSkip: () => void;
}) {
  const { t, name } = useI18n();
  const left = remainingMs(round, now);
  const seconds = Math.ceil(left / 1000);
  const score = round.answers.filter((a) => a.outcome === "correct").length;
  return (
    <div className={styles.playing}>
      <div className={styles.status}>
        <span className={styles.count}>{t("find.question", { current: round.index + 1, total: round.questions.length })}</span>
        <span className={styles.score}>{t("challengeGame.score", { score })}</span>
        <span className={styles.clock} data-low={seconds <= 10 ? "" : undefined} role="timer" aria-label={t("challengeGame.timeLeft", { seconds })}>
          <ClockIcon />
          {seconds}
        </span>
      </div>
      <div className={styles.bar} aria-hidden="true">
        <div className={styles.barFill} style={{ transform: `scaleX(${left / round.rules.durationMs})` }} />
      </div>
      {/* What to find and how the last answer went, announced as they change (the timer is not). */}
      <div aria-live="polite">
        <p className={styles.find}>{t("challengeGame.find")}</p>
        <p className={styles.target} data-testid="challenge-target">
          {target ? name(target) : ""}
        </p>
        <p className={styles.feedback} data-outcome={feedback?.outcome} data-testid="challenge-feedback">
          {feedback?.outcome === "correct" && t("challengeGame.correct")}
          {feedback?.outcome === "wrong" && t("challengeGame.wrong", { name: name(feedback.chosen!) })}
          {feedback?.outcome === "skipped" && t("challengeGame.skipped")}
          {!feedback && t("find.instructions")}
        </p>
      </div>
      <button type="button" className={`btn btn-secondary ${styles.wide}`} onClick={onSkip} disabled={!!feedback} data-testid="challenge-skip">
        {t("challengeGame.skip")}
      </button>
    </div>
  );
}

function Results({
  result,
  onReview,
  onPlayAgain,
  onHome,
  onLessons,
}: {
  result: ChallengeResult;
  onReview: () => void;
  onPlayAgain: () => void;
  onHome: () => void;
  onLessons: () => void;
}) {
  const { t, tp, name } = useI18n();
  const counts = [
    { key: "correct", label: t("challengeResults.correct"), value: result.correct },
    { key: "incorrect", label: t("challengeResults.incorrect"), value: result.incorrect },
    { key: "skipped", label: t("challengeResults.skipped"), value: result.skipped },
    { key: "unanswered", label: t("challengeResults.unanswered"), value: result.unanswered },
  ];
  return (
    <div className={styles.results} data-testid="challenge-results" data-end={result.endReason}>
      <h2 className={styles.resultTitle}>{t(result.endReason === "timeUp" ? "challengeResults.timeUp" : "challengeResults.complete")}</h2>
      <p className={styles.resultScore} aria-label={t("challengeResults.scoreLabel", { score: result.score, total: result.total })}>
        <strong>{result.score}</strong>
        <span>/ {result.total}</span>
      </p>
      {result.endReason === "completed" && (
        <p className={styles.text}>{t("challengeResults.time", { time: tp("challenge.seconds", Math.max(1, Math.round(result.elapsedMs / 1000))) })}</p>
      )}
      <dl className={styles.counts}>
        {counts.map((c) => (
          <div key={c.key} className={styles.countTile} data-kind={c.key}>
            <dt>{c.label}</dt>
            <dd>{c.value}</dd>
          </div>
        ))}
      </dl>

      <h3 className={styles.subtitle}>{t("challengeResults.missedTitle")}</h3>
      {result.missed.length === 0 ? (
        <p className={styles.text}>{t("challengeResults.missedNone")}</p>
      ) : (
        <ul className={styles.missed} data-testid="challenge-missed">
          {result.missed.map((q) => (
            <li key={q.index} className={styles.missedItem} data-outcome={q.outcome}>
              <span className={styles.missedName}>{name(q.target)}</span>
              <span className={styles.missedDetail}>{missedDetail(q, t, name)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <button type="button" className="btn btn-secondary" onClick={onReview} data-testid="challenge-review">
          {t("challengeResults.review")}
        </button>
        <button type="button" className="btn btn-primary" onClick={onPlayAgain} data-testid="challenge-play-again">
          {t("welcome.playAgain")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onLessons}>
          {t("challengeResults.lessons")}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onHome}>
          {t("challengeResults.home")}
        </button>
      </div>
    </div>
  );
}

function missedDetail(q: MissedQuestion, t: ReturnType<typeof useI18n>["t"], name: (id: CountryId) => string): string {
  if (q.outcome === "wrong") return t("challengeResults.chose", { name: name(q.chosen!) });
  return t(q.outcome === "skipped" ? "challengeResults.wasSkipped" : "challengeResults.notReached");
}

function Review({
  result,
  selected,
  onSelect,
  onBack,
  name,
}: {
  result: ChallengeResult;
  selected: CountryId | null;
  onSelect: (id: CountryId) => void;
  onBack: () => void;
  name: (id: CountryId) => string;
}) {
  const { t } = useI18n();
  const current = result.questions.find((q) => q.target === selected);
  return (
    <div className={styles.review} data-testid="challenge-review-panel">
      <h2 className={styles.resultTitle}>{t("challengeReview.title")}</h2>
      <p className={styles.text}>{t("challengeReview.text")}</p>
      <ul className={styles.legend} aria-hidden="true">
        <li data-tone="correct">{t("challengeReview.found")}</li>
        <li data-tone="missed">{t("challengeReview.missed")}</li>
        <li data-tone="chosen">{t("challengeReview.chosen")}</li>
      </ul>
      <ul className={styles.chips}>
        {result.questions.map((q) => (
          <li key={q.index}>
            <button
              type="button"
              className={styles.chip}
              data-tone={q.outcome === "correct" ? "correct" : "missed"}
              aria-pressed={q.target === selected}
              onClick={() => onSelect(q.target)}
            >
              {name(q.target)}
            </button>
          </li>
        ))}
      </ul>
      {current && current.outcome !== "correct" && <p className={styles.text}>{missedDetail(current as MissedQuestion, t, name)}</p>}
      <button type="button" className={`btn btn-primary ${styles.wide}`} onClick={onBack}>
        {t("challengeReview.back")}
      </button>
    </div>
  );
}

function BoltIcon() {
  return (
    <svg className={styles.bolt} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13.5 2 4.5 13.5h6L9.5 22l9-11.5h-6z" fill="currentColor" stroke="#c07d05" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

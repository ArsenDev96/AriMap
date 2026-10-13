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
import dialogStyles from "../WelcomeScreen.module.css";
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
  // The next question as soon as the feedback ends, not up to a tick later (a quarter of a 400 ms feedback).
  const feedbackUntil = round.feedback?.until ?? null;
  useEffect(() => {
    if (feedbackUntil === null) return;
    const timer = window.setTimeout(() => {
      const time = clock();
      update((r) => tick(r, time));
      setNow(time);
    }, Math.max(0, feedbackUntil - clock()));
    return () => window.clearTimeout(timer);
  }, [feedbackUntil, clock, update]);

  // Home during a round asks first. The round runs on while the question shows, and ends it if the time runs out.
  const [confirmLeave, setConfirmLeave] = useState(false);
  const goHome = () => (roundRef.current.status === "playing" ? setConfirmLeave(true) : onClose());

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
  const names = useMemo(() => (result ? roundNames(result) : undefined), [result]);
  const feedback = feedbackOf(round);
  const question = currentQuestion(round);
  const phase = result ? (reviewing ? "review" : "results") : round.status;

  const [selected, setSelected] = useState<CountryId | null>(null);
  const tones = useMemo(() => mapTones(round, result, feedback), [round, result, feedback]);

  return (
    <div className={styles.screen} data-phase={phase} data-testid="challenge-screen">
      <header className={styles.header}>
        <button type="button" className={styles.home} onClick={goHome} aria-label={t("challengeGame.backLabel")} aria-haspopup={playing ? "dialog" : undefined}>
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
            names={names}
            focus={phase === "review" ? selected : null}
            onTap={phase === "playing" ? respond : phase === "review" ? (id) => setSelected(id) : undefined}
            onReady={() => setMapReady(true)}
            // A round's questions are drawn once (answers keep the same list): a new list is a new round, at the start view.
            viewKey={round.questions}
            // The round's end closes "About the map" (on a phone the results hide the map, and the dialog with it).
            aboutKey={round.status}
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

      <LeaveDialog
        open={confirmLeave && playing}
        seconds={Math.ceil(remainingMs(round, now) / 1000)}
        onStay={() => setConfirmLeave(false)}
        onLeave={onClose}
      />
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

/**
 * Named on the map once the round has ended (its results and review; never during it): the round's countries only,
 * whatever their outcome, the missed ones (wrong, skipped, not reached) first, each in the round's order, so where
 * names would overlap those are the ones shown (ChallengeMap's `names`). A wrong choice outside the round is coloured,
 * not named: the results and the review say which it was.
 */
function roundNames(result: ChallengeResult): CountryId[] {
  const missed = result.questions.filter((q) => q.outcome !== "correct");
  const found = result.questions.filter((q) => q.outcome === "correct");
  return [...missed, ...found].map((q) => q.target);
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
          {feedback?.outcome === "wrong" && t("challengeGame.wrong")}
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
  // Focus lost as the round ended (the control that had it is gone, or hidden with the map on a phone, "About the
  // map" included): to the results' title, so the next Tab, and a screen reader, start there. A frame later, once
  // the map's own effects (AboutMap's closeKey) have run; a focused element no longer drawn counts as lost.
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el.getClientRects().length === 0) titleRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const counts = [
    { key: "correct", label: t("challengeResults.correct"), value: result.correct },
    { key: "incorrect", label: t("challengeResults.incorrect"), value: result.incorrect },
    { key: "skipped", label: t("challengeResults.skipped"), value: result.skipped },
    { key: "unanswered", label: t("challengeResults.unanswered"), value: result.unanswered },
  ];
  return (
    <div className={styles.results} data-testid="challenge-results" data-end={result.endReason}>
      <h2 className={styles.resultTitle} ref={titleRef} tabIndex={-1}>
        {t(result.endReason === "timeUp" ? "challengeResults.timeUp" : "challengeResults.complete")}
      </h2>
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

      {/* What to do next, before the list: within reach on a phone however long the list is. */}
      <div className={styles.actions}>
        <button type="button" className="btn btn-primary" onClick={onPlayAgain} data-testid="challenge-play-again">
          {t("welcome.playAgain")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onReview} data-testid="challenge-review">
          {t("challengeResults.review")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onLessons} data-testid="challenge-lessons">
          {t("challengeResults.lessons")}
        </button>
      </div>

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

/**
 * Leaving a round in progress loses it, so Home asks first; staying is the default (Escape and a tap outside
 * stay too). Nothing pauses: the round's deadline holds, its seconds counting down in the question, and when it
 * passes the question closes by itself (`open` turns false) and the results show behind it.
 */
function LeaveDialog({ open, seconds, onStay, onLeave }: { open: boolean; seconds: number; onStay: () => void; onLeave: () => void }) {
  const { t, tp } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={dialogStyles.dialog}
      aria-labelledby="challenge-leave-title"
      aria-describedby="challenge-leave-text"
      data-testid="challenge-leave-dialog"
      onClose={onStay}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      <form method="dialog" className={dialogStyles.dialogBody}>
        <h2 id="challenge-leave-title" className={dialogStyles.dialogTitle}>
          {t("challengeLeave.title")}
        </h2>
        <p id="challenge-leave-text">{t("challengeLeave.text")}</p>
        <p className={styles.leaveTime}>
          <span className={styles.clock} data-low={seconds <= 10 ? "" : undefined} role="timer" data-testid="challenge-leave-time">
            <ClockIcon />
            {t("challengeLeave.timeLeft", { time: tp("challenge.seconds", seconds) })}
          </span>
        </p>
        <div className={dialogStyles.dialogActions}>
          <button type="submit" className="btn btn-primary btn-block" autoFocus data-testid="challenge-leave-stay">
            {t("challengeLeave.stay")}
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={onLeave} data-testid="challenge-leave-confirm">
            {t("challengeLeave.leave")}
          </button>
        </div>
      </form>
    </dialog>
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

"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type Dispatch, type FormEvent } from "react";
import {
  answer,
  challengeResult,
  CHALLENGE_POOL,
  CHALLENGE_RULES,
  currentQuestion,
  feedbackOf,
  remainingMs,
  tick,
  type AnswerRecord,
  type ChallengeResult,
  type ChallengeRound,
  type MissedQuestion,
} from "@/core/challenge/quickChallenge";
import { localRoundOf, replayQueued, requestTiming, serverResult, timedClockOffset, uncountedAnswers, type ServerRound } from "@/core/challenge/serverRound";
import type { CountryId } from "@/core/content/types";
import { LOCALE_META, type Locale } from "@/core/i18n/locales";
import type { MessageKey } from "@/core/i18n/translate";
import { PlayerServiceError, type PlayerState } from "@/core/player/api";
import { hasGrant } from "@/core/player/attempts";
import { checkDisplayName, type DisplayNameProblem } from "@/core/player/displayName";
import type { AppAction, AppState } from "@/core/progress/appState";
import { europeStarCount, europeStarsSnapshot, hasAllEuropeStars } from "@/core/progress/europeStars";
import { webBackend, type Backend } from "@/web/backend";
import { LanguageToggle } from "../Header";
import { useI18n } from "../i18n";
import { roundSeconds } from "@/core/challenge/share";
import { ChallengeMap, type ChallengeTone } from "./ChallengeMap";
import { Leaderboard } from "./Leaderboard";
import { clearStoredChallenge, readStoredChallenge, RoundSession, storeRound, type Confirmation, type Connection } from "./roundSession";
import { ShareResultDialog } from "./ShareResult";
import dialogStyles from "../WelcomeScreen.module.css";
import styles from "./QuickChallengeScreen.module.css";

/** How often the timer and feedback are brought up to date while a round is played (ms). */
const TICK_MS = 100;

/** The map's view before a round has questions. */
const NO_QUESTIONS: readonly CountryId[] = [];

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

/** A new id for one press of Start (crypto.randomUUID needs a secure context; the bytes do not). */
function newRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

interface Props {
  dispatch: Dispatch<AppAction>;
  /** Saved lesson progress, read (never changed) for the all-stars reward. */
  progress: AppState;
  /** Back to the home screen. */
  onClose: () => void;
}

type LoadState = "loading" | "loaded" | "failed" | "unavailable";

/**
 * The Quick Challenge, from Start to its results and their review on the map. Rounds are the server's
 * (src/core/challenge/serverRound.ts): Start spends one attempt and the server draws the questions and sets the one
 * deadline; each answer is shown at once by the rules on the device (quickChallenge.ts) and sent in the background
 * (roundSession.ts); the result is provisional until the server confirms it, and only a confirmed result is shared.
 * A round under way resumes after a refresh, or in another tab, with its time running on. Lesson progress, stars
 * and unlocks are only read, for the all-stars reward. The screen stays mounted while the language changes, so the
 * timer runs on.
 */
export function QuickChallengeScreen({ dispatch, progress, onClose }: Props) {
  const { t, tp, name } = useI18n();
  const [clock] = useState(createClock);
  const [backend] = useState(webBackend);
  // The stars are read once: they can not change while the challenge is open.
  const [stars] = useState(() => europeStarsSnapshot(progress));
  const [loadState, setLoadState] = useState<LoadState>(backend ? "loading" : "unavailable");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [starsGranted, setStarsGranted] = useState(false);

  // The round is read and replaced through a ref as well as state, so two taps in one frame are answered
  // against the round as the first one left it (the second is then rejected).
  const [round, setRoundState] = useState<ChallengeRound | null>(null);
  const roundRef = useRef<ChallengeRound | null>(null);
  const setRound = useCallback((r: ChallengeRound | null) => {
    roundRef.current = r;
    setRoundState(r);
  }, []);
  const update = useCallback(
    (next: (r: ChallengeRound) => ChallengeRound) => {
      const current = roundRef.current;
      if (!current) return;
      const r = next(current);
      if (r !== current) setRound(r);
    },
    [setRound],
  );
  const [server, setServer] = useState<ServerRound | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>("playing");
  const [connection, setConnection] = useState<Connection>("ok");
  const sessionRef = useRef<RoundSession | null>(null);
  const aliveRef = useRef(true);
  const [now, setNow] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  // One press of Start, until the server has answered it: a retry sends the same id, so it never spends twice.
  const requestIdRef = useRef<string | null>(null);
  // The leaderboard, over the ready screen or the results (both kept as they were, hidden): Back returns to the
  // control that opened it. Only reads: it never starts a round or spends an attempt.
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const leaderboardOpenerRef = useRef<HTMLElement | null>(null);
  const openLeaderboard = () => {
    leaderboardOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setLeaderboardOpen(true);
  };
  const closeLeaderboard = () => {
    setLeaderboardOpen(false);
    const opener = leaderboardOpenerRef.current;
    requestAnimationFrame(() => opener?.focus());
  };

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      sessionRef.current?.dispose();
      sessionRef.current = null;
    };
  }, []);

  /** Plays the server's round on the device, from its answers and any given here before a refresh. */
  const beginRound = useCallback(
    (s: ServerRound, offset: number) => {
      if (!backend || !aliveRef.current) return;
      sessionRef.current?.dispose();
      sessionRef.current = null;
      setReviewing(false);
      setLeaderboardOpen(false);
      setServer(s);
      setConnection("ok");
      if (s.status === "finished") {
        storeRound(s.id);
        setConfirmation("confirmed");
        setRound(localRoundOf(s, offset));
        return;
      }
      // Answers this browser gave before a refresh (or in another tab) and the server has not decided: played on top.
      const stored = readStoredChallenge();
      const { round: local, kept } = replayQueued(localRoundOf(s, offset), stored?.roundId === s.id ? stored.queue : []);
      const time = clock();
      setConfirmation("playing");
      setRound(tick(local, time));
      setNow(time);
      sessionRef.current = new RoundSession(
        backend,
        s,
        offset,
        clock,
        {
          localRound: () => roundRef.current,
          onServerRound: setServer,
          onResync: (r) => setRound(tick(r, clock())),
          onConfirmation: setConfirmation,
          onConnection: setConnection,
        },
        kept,
      );
    },
    [backend, clock, setRound],
  );

  // The player (signed in anonymously the first time), the all-stars reward if it is due, and the round under way
  // or, after a refresh, the result of the round kept.
  useEffect(() => {
    if (!backend) {
      clearStoredChallenge();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const timing = requestTiming(clock);
        let state = await backend.load(timing);
        const offset = timedClockOffset(timing, state.serverTime);
        if (!hasGrant(state.grants, "allEuropeStars") && hasAllEuropeStars(stars)) {
          try {
            const claim = await backend.claimAllEuropeStars(stars);
            if (claim.ok) {
              state = { ...claim.state, activeRound: state.activeRound, serverTime: state.serverTime };
              if (claim.granted && !cancelled) setStarsGranted(true);
            }
          } catch {
            // Asked for again the next time the challenge opens.
          }
        }
        if (cancelled) return;
        setPlayer(state);
        setLoadState("loaded");
        if (state.activeRound) return beginRound(state.activeRound, offset);
        const stored = readStoredChallenge();
        if (!stored) return;
        const kept = await backend.finishRound(stored.roundId).catch(() => null);
        if (cancelled || !kept) return;
        if (kept.ok) beginRound(kept.round, offset);
        else clearStoredChallenge(stored.roundId);
      } catch (e) {
        if (!cancelled) setLoadState(e instanceof PlayerServiceError && e.code === "notConfigured" ? "unavailable" : "failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backend, clock, stars, beginRound, loadAttempt]);

  const playing = round?.status === "playing";
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
  const feedbackUntil = round?.feedback?.until ?? null;
  useEffect(() => {
    if (feedbackUntil === null) return;
    const timer = window.setTimeout(() => {
      const time = clock();
      update((r) => tick(r, time));
      setNow(time);
    }, Math.max(0, feedbackUntil - clock()));
    return () => window.clearTimeout(timer);
  }, [feedbackUntil, clock, update]);

  // The round has ended on the device: the server's result is asked for.
  const ended = round?.status === "finished";
  useEffect(() => {
    if (ended) sessionRef.current?.end();
  }, [ended]);

  // Leaving keeps the round's id while its result is unconfirmed (or the round runs on), so it can be come back to.
  const close = () => {
    if (server && !playing && confirmation !== "confirming" && confirmation !== "failed") clearStoredChallenge(server.id);
    onClose();
  };
  // Home during a round asks first. The round runs on while the question shows, and ends it if the time runs out.
  const [confirmLeave, setConfirmLeave] = useState(false);
  const goHome = () => (roundRef.current?.status === "playing" ? setConfirmLeave(true) : close());

  const start = async () => {
    if (!backend || starting) return;
    setStarting(true);
    setStartFailed(false);
    requestIdRef.current ??= newRequestId();
    try {
      const timing = requestTiming(clock);
      const res = await backend.startRound(requestIdRef.current, timing);
      const offset = res.ok ? timedClockOffset(timing, res.serverTime) : 0;
      requestIdRef.current = null;
      if (!aliveRef.current) return;
      setPlayer(res.state);
      if (res.ok) beginRound(res.round, offset);
    } catch {
      if (aliveRef.current) setStartFailed(true);
    } finally {
      if (aliveRef.current) setStarting(false);
    }
  };
  const respond = (country: CountryId | null) => {
    const current = roundRef.current;
    const question = current && currentQuestion(current);
    if (!current || !question) return;
    const time = clock();
    const res = answer(current, question.index, country, time);
    setRound(res.round);
    setNow(time);
    if (res.result !== "rejected") sessionRef.current?.answer({ index: question.index, country, atMs: Math.max(0, Math.round(time - current.startedAt!)) });
  };
  const playAgain = () => {
    sessionRef.current?.dispose();
    sessionRef.current = null;
    if (server) clearStoredChallenge(server.id);
    setReviewing(false);
    setLeaderboardOpen(false);
    setRound(null);
    setServer(null);
    setConfirmation("playing");
    setStartFailed(false);
  };
  const openLessons = () => {
    if (server && !playing) clearStoredChallenge(server.id);
    dispatch({ type: "openContinent", continent: "europe" });
    onClose();
  };

  // Provisional: the device's own scoring. Confirmed: the server's, which is the one shown, reviewed and shared.
  const provisional = useMemo(() => (round ? challengeResult(round) : null), [round]);
  const confirmed = useMemo(() => (confirmation === "confirmed" && server ? serverResult(server) : null), [confirmation, server]);
  const result = confirmed ?? provisional;
  const uncounted = confirmed && round && server ? uncountedAnswers(round, server) : 0;
  const names = useMemo(() => (result ? roundNames(result) : undefined), [result]);
  const feedback = round ? feedbackOf(round) : null;
  const question = round ? currentQuestion(round) : null;
  const phase = loadState !== "loaded" ? loadState : !round ? "ready" : result ? (reviewing ? "review" : "results") : "playing";
  const showLeaderboard = leaderboardOpen && (phase === "ready" || phase === "results");

  const [selected, setSelected] = useState<CountryId | null>(null);
  const tones = useMemo(() => mapTones(round, result, feedback), [round, result, feedback]);
  const lead = t("challenge.title", { count: CHALLENGE_RULES.questions });
  const intro = t("challengeGame.intro", { time: tp("challenge.seconds", CHALLENGE_RULES.durationMs / 1000) });

  return (
    <div className={styles.screen} data-phase={showLeaderboard ? "leaderboard" : phase === "loading" || phase === "failed" || phase === "unavailable" ? "ready" : phase} data-testid="challenge-screen">
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
            viewKey={round?.questions ?? NO_QUESTIONS}
            // The round's end closes "About the map" (on a phone the results hide the map, and the dialog with it).
            aboutKey={round?.status ?? "ready"}
          />
        </div>

        <section className={styles.panel} data-testid="challenge-panel">
          {phase === "loading" && (
            <div className={styles.intro}>
              <p className={styles.lead}>{lead}</p>
              <p className={styles.text}>{intro}</p>
              <button type="button" className={`btn btn-primary ${styles.wide}`} disabled data-testid="challenge-start">
                {t("challengeGame.loadingPlayer")}
              </button>
            </div>
          )}

          {(phase === "failed" || phase === "unavailable") && (
            <div className={styles.intro} data-testid="challenge-unavailable">
              <p className={styles.lead}>{lead}</p>
              <p className={styles.error} role="alert">
                {t(phase === "failed" ? "challengeGame.loadFailed" : "challengeGame.unavailable")}
              </p>
              {phase === "failed" && (
                <button
                  type="button"
                  className={`btn btn-secondary ${styles.wide}`}
                  onClick={() => {
                    setLoadState("loading");
                    setLoadAttempt((n) => n + 1);
                  }}
                >
                  {t("challengeGame.retry")}
                </button>
              )}
            </div>
          )}

          {phase === "ready" && player && backend && (
            <div className={styles.intro} hidden={showLeaderboard}>
              <p className={styles.lead}>{lead}</p>
              <p className={styles.text}>{intro}</p>
              {starsGranted && (
                <p className={styles.notice} role="status" data-testid="challenge-stars-reward">
                  {t("challengeGame.starsReward")}
                </p>
              )}
              {player.attemptsLeft === 0 ? (
                <NoAttempts player={player} stars={europeStarCount(stars)} onLessons={openLessons} />
              ) : (
                <>
                  <p className={styles.attempts} data-testid="challenge-attempts">
                    {tp("challengeGame.attemptsLeft", player.attemptsLeft)}
                  </p>
                  {startFailed && (
                    <p className={styles.error} role="alert">
                      {t("challengeGame.startFailed")}
                    </p>
                  )}
                  {/* The first round asks for the optional name; once a round has been played it is offered on Results. */}
                  {player.displayName === null && player.roundsStarted === 0 ? (
                    <NameForm backend={backend} mode="start" disabled={!mapReady || starting} onSaved={setPlayer} onStart={start} />
                  ) : (
                    <button type="button" className={`btn btn-primary ${styles.wide}`} onClick={start} disabled={!mapReady || starting} data-testid="challenge-start">
                      {!mapReady ? t("challengeGame.loading") : starting ? t("challengeGame.starting") : t("welcome.start")}
                    </button>
                  )}
                </>
              )}
              <button type="button" className={`btn btn-secondary ${styles.wide}`} onClick={openLeaderboard} disabled={starting} data-testid="challenge-leaderboard-open">
                {t("challengeLeaderboard.open")}
              </button>
            </div>
          )}

          {phase === "playing" && round && (
            <Playing
              round={round}
              now={now}
              target={question?.target ?? feedback?.target ?? null}
              feedback={feedback}
              reconnecting={connection === "retrying"}
              onSkip={() => respond(null)}
            />
          )}

          {phase === "results" && result && (
            <Results
              result={result}
              confirmed={confirmed}
              confirmation={confirmation}
              uncounted={uncounted}
              player={player}
              backend={backend}
              onNameSaved={setPlayer}
              onRetryConfirm={() => sessionRef.current?.retry()}
              onReview={() => {
                setSelected(result.missed[0]?.target ?? result.questions[0].target);
                setReviewing(true);
              }}
              onPlayAgain={playAgain}
              onHome={close}
              onLessons={openLessons}
              onLeaderboard={openLeaderboard}
              hidden={showLeaderboard}
            />
          )}

          {showLeaderboard && backend && <Leaderboard backend={backend} onBack={closeLeaderboard} />}

          {phase === "review" && result && (
            <Review result={result} selected={selected} onSelect={setSelected} onBack={() => setReviewing(false)} name={name} />
          )}
        </section>
      </main>

      <LeaveDialog
        open={confirmLeave && playing}
        seconds={round ? Math.ceil(remainingMs(round, now) / 1000) : 0}
        onStay={() => setConfirmLeave(false)}
        onLeave={onClose}
      />
    </div>
  );
}

/** The map's colours: the answer just given (its feedback), or the whole round once it has ended. */
function mapTones(round: ChallengeRound | null, result: ChallengeResult | null, feedback: AnswerRecord | null): Partial<Record<CountryId, ChallengeTone>> {
  if (result) {
    const tones: Partial<Record<CountryId, ChallengeTone>> = {};
    for (const q of result.questions) if (q.outcome === "wrong" && q.chosen && !tones[q.chosen]) tones[q.chosen] = "chosen";
    for (const q of result.questions) tones[q.target] = q.outcome === "correct" ? "correct" : "missed";
    return tones;
  }
  if (!round || !feedback || round.status !== "playing") return {};
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
  reconnecting,
  onSkip,
}: {
  round: ChallengeRound;
  now: number;
  target: CountryId | null;
  feedback: AnswerRecord | null;
  /** Answers are waiting to reach the server: play goes on, and they count if they arrive in time. */
  reconnecting: boolean;
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
      <p className={styles.connection} role="status" data-testid="challenge-connection">
        {reconnecting ? t("challengeGame.reconnecting") : ""}
      </p>
    </div>
  );
}

/** No attempts left: the lessons' reward, if it is still to be earned. No ads, and no practice rounds. */
function NoAttempts({ player, stars, onLessons }: { player: PlayerState; stars: number; onLessons: () => void }) {
  const { t } = useI18n();
  const rewardLeft = !hasGrant(player.grants, "allEuropeStars");
  return (
    <div className={styles.noAttempts} data-testid="challenge-no-attempts">
      <p className={styles.lead}>{t("challengeAttempts.noneTitle")}</p>
      <p className={styles.text}>{rewardLeft ? t("challengeAttempts.earnStars", { stars }) : t("challengeAttempts.usedAll")}</p>
      {rewardLeft && (
        <button type="button" className={`btn btn-primary ${styles.wide}`} onClick={onLessons} data-testid="challenge-no-attempts-lessons">
          {t("challengeResults.lessons")}
        </button>
      )}
    </div>
  );
}

const NAME_PROBLEMS: Readonly<Record<DisplayNameProblem, MessageKey>> = {
  tooShort: "challengeName.tooShort",
  tooLong: "challengeName.tooLong",
  characters: "challengeName.characters",
  noLetter: "challengeName.noLetter",
  link: "challengeName.link",
  reserved: "challengeName.reserved",
  blocked: "challengeName.blocked",
};

function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_META[locale].htmlLang, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/**
 * The optional display name: before the first round (Save and start, Skip and start), or on Results when it was
 * skipped (Save name). Checked on the device by the server's own rules, then saved by the server, which decides.
 */
function NameForm({
  backend,
  mode,
  disabled = false,
  onSaved,
  onStart,
}: {
  backend: Backend;
  mode: "start" | "results";
  disabled?: boolean;
  onSaved: (state: PlayerState) => void;
  onStart?: () => void;
}) {
  const { t, locale } = useI18n();
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || disabled) return;
    const check = checkDisplayName(value);
    if (!check.ok) return setError(t(NAME_PROBLEMS[check.problem]));
    setSaving(true);
    setError(null);
    try {
      const res = await backend.setDisplayName(check.name);
      if (res.ok) {
        onSaved(res.state);
        onStart?.();
      } else if (res.problem === "rateLimited") setError(t("challengeName.rateLimited", { time: formatTime(res.retryAt, locale) }));
      else setError(t(NAME_PROBLEMS[res.problem]));
    } catch {
      setError(t("challengeName.saveFailed"));
    } finally {
      setSaving(false);
    }
  };
  const Title = mode === "start" ? "h2" : "h3";
  return (
    <form className={styles.nameForm} onSubmit={save} noValidate data-testid={`challenge-name-${mode}`}>
      <Title className={styles.nameTitle}>{t(mode === "start" ? "challengeName.title" : "challengeName.resultsTitle")}</Title>
      <p className={styles.text} id={`${id}-hint`}>
        {t(mode === "start" ? "challengeName.text" : "challengeName.resultsText")}
      </p>
      <label className={styles.nameLabel} htmlFor={`${id}-input`}>
        {t("challengeName.label")}
      </label>
      <input
        id={`${id}-input`}
        className={styles.nameInput}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={40}
        autoComplete="nickname"
        spellCheck={false}
        aria-describedby={error ? `${id}-hint ${id}-error` : `${id}-hint`}
        aria-invalid={error ? true : undefined}
        data-testid="challenge-name-input"
      />
      {error && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.nameActions}>
        <button type="submit" className={`btn btn-primary ${styles.wide}`} disabled={disabled || saving} data-testid="challenge-name-save">
          {t(mode === "start" ? "challengeName.saveStart" : "challengeName.save")}
        </button>
        {mode === "start" && (
          <button type="button" className={`btn btn-secondary ${styles.wide}`} onClick={onStart} disabled={disabled || saving} data-testid="challenge-name-skip">
            {t("challengeName.skipStart")}
          </button>
        )}
      </div>
    </form>
  );
}

function Results({
  result,
  confirmed,
  confirmation,
  uncounted,
  player,
  backend,
  onNameSaved,
  onRetryConfirm,
  onReview,
  onPlayAgain,
  onHome,
  onLessons,
  onLeaderboard,
  hidden,
}: {
  /** The result shown: the confirmed one once there is one, until then the device's provisional one. */
  result: ChallengeResult;
  confirmed: ChallengeResult | null;
  confirmation: Confirmation;
  /** Answers given on the device that reached the server too late to count. */
  uncounted: number;
  player: PlayerState | null;
  backend: Backend | null;
  onNameSaved: (state: PlayerState) => void;
  onRetryConfirm: () => void;
  onReview: () => void;
  onPlayAgain: () => void;
  onHome: () => void;
  onLessons: () => void;
  /** Opens the leaderboard: offered once the result is confirmed. */
  onLeaderboard: () => void;
  /** Kept as it is while the leaderboard shows over it. */
  hidden: boolean;
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
  const [sharing, setSharing] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const shareHintId = useId();
  const counts = [
    { key: "correct", label: t("challengeResults.correct"), value: result.correct },
    { key: "incorrect", label: t("challengeResults.incorrect"), value: result.incorrect },
    { key: "skipped", label: t("challengeResults.skipped"), value: result.skipped },
    { key: "unanswered", label: t("challengeResults.unanswered"), value: result.unanswered },
  ];
  return (
    <div className={styles.results} hidden={hidden} data-testid="challenge-results" data-end={result.endReason} data-confirmation={confirmation}>
      <h2 className={styles.resultTitle} ref={titleRef} tabIndex={-1}>
        {t(result.endReason === "timeUp" ? "challengeResults.timeUp" : "challengeResults.complete")}
      </h2>
      {/* Whether the server has confirmed the result: until it has, the score is the device's own. */}
      <div className={styles.confirm} data-state={confirmation} data-testid="challenge-confirmation">
        {confirmation === "confirmed" ? (
          <p role="status">
            <CheckIcon />
            {t("challengeConfirm.confirmed")}
          </p>
        ) : confirmation === "failed" ? (
          <>
            <p role="alert">{t("challengeConfirm.failed")}</p>
            <button type="button" className="btn btn-secondary" onClick={onRetryConfirm} data-testid="challenge-confirm-retry">
              {t("challengeGame.retry")}
            </button>
          </>
        ) : (
          <p role="status">{t("challengeConfirm.confirming")}</p>
        )}
      </div>
      <p
        className={styles.resultScore}
        data-provisional={confirmed ? undefined : ""}
        aria-label={`${t("challengeResults.scoreLabel", { score: result.score, total: result.total })}${confirmed ? "" : `. ${t("challengeConfirm.provisional")}`}`}
      >
        <strong>{result.score}</strong>
        <span>/ {result.total}</span>
      </p>
      {result.endReason === "completed" && (
        <p className={styles.text}>{t("challengeResults.time", { time: tp("challenge.seconds", roundSeconds(result.elapsedMs)) })}</p>
      )}
      {uncounted > 0 && <p className={styles.text}>{tp("challengeConfirm.uncounted", uncounted)}</p>}
      <dl className={styles.counts}>
        {counts.map((c) => (
          <div key={c.key} className={styles.countTile} data-kind={c.key}>
            <dt>{c.label}</dt>
            <dd>{c.value}</dd>
          </div>
        ))}
      </dl>

      {/* What to do next, before the list: within reach on a phone however long the list is. Sharing first, in gold,
          right under the score it shares (once the server has confirmed it); then Play again, Review, Explore lessons,
          and the leaderboard once the result is confirmed. */}
      <div className={styles.actions}>
        <button
          type="button"
          className={`btn ${styles.shareButton}`}
          onClick={() => setSharing(true)}
          disabled={!confirmed}
          aria-haspopup="dialog"
          aria-describedby={confirmed ? undefined : shareHintId}
          data-testid="challenge-share"
        >
          <ShareIcon />
          {t("challengeShare.button")}
        </button>
        <button type="button" className="btn btn-primary" onClick={onPlayAgain} data-testid="challenge-play-again">
          {t("welcome.playAgain")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onReview} data-testid="challenge-review">
          {t("challengeResults.review")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onLessons} data-testid="challenge-lessons">
          {t("challengeResults.lessons")}
        </button>
        {confirmed && (
          <button type="button" className="btn btn-secondary" onClick={onLeaderboard} data-testid="challenge-leaderboard-open">
            {t("challengeLeaderboard.open")}
          </button>
        )}
      </div>
      {!confirmed && (
        <p id={shareHintId} className={styles.shareLater}>
          {t("challengeConfirm.shareLater")}
        </p>
      )}
      {player && (
        <p className={styles.attempts} data-testid="challenge-attempts">
          {tp("challengeGame.attemptsLeft", player.attemptsLeft)}
        </p>
      )}

      {/* The name, if it was skipped: the best result stays private until one is saved. */}
      {player && backend && player.displayName === null && (
        <NameForm
          backend={backend}
          mode="results"
          onSaved={(state) => {
            setSavedName(state.displayName);
            onNameSaved(state);
          }}
        />
      )}
      {savedName && (
        <p className={styles.notice} role="status">
          {t("challengeName.saved", { name: savedName })}
        </p>
      )}

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

      {confirmed && <ShareResultDialog result={confirmed} displayName={player?.displayName ?? null} open={sharing} onClose={() => setSharing(false)} />}
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
 * Home during a round asks first: the attempt is already spent and the round runs on at the server, so leaving
 * only leaves the screen (coming back before the deadline carries on). Staying is the default (Escape and a tap
 * outside stay too). Nothing pauses: the round's deadline holds, its seconds counting down in the question, and
 * when it passes the question closes by itself (`open` turns false) and the results show behind it.
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

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 15V3.5m0 0L7.5 8M12 3.5 16.5 8M5 12v7a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
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

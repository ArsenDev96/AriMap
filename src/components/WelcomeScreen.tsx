"use client";

import Image from "next/image";
import { useEffect, useId, useLayoutEffect, useRef, useState, type Dispatch } from "react";
import { LEVELS, type LevelInfo } from "@/core/lessons";
import type { LessonStage } from "@/core/lesson/progress";
import { levelStatus, mainAction, type AppAction, type AppState, type LevelStatus } from "@/core/progress/appState";
import { BrandMark, LanguageToggle, STEPS } from "./Header";
import { useI18n } from "./i18n";
import { LANDMARK_IMAGES } from "./landmarks/LandmarkCard";
import styles from "./WelcomeScreen.module.css";

interface Props {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

/** A level to start over (or, once completed, to play again), waiting for the player to confirm. */
type Confirm = { level: LevelInfo; mode: "startOver" | "playAgain" };

/** Whether the player has played before: then the page leads with the levels, not the introduction. */
export function isReturning(state: AppState): boolean {
  return Object.values(state.levels).some((p) => p.started || p.records.discoverDone);
}

export function WelcomeScreen({ state, dispatch }: Props) {
  const { t, l } = useI18n();
  const confirmRef = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const main = mainAction(state);
  // Known from the save on the first render (the game renders on the client only), so the
  // page never switches layout after it appears.
  const returning = isReturning(state);

  // The "Up next" card's number, name and status are found at once. With several completed
  // levels above it (one line each), a short phone can leave its status under the action area:
  // the list then starts scrolled just enough to show it, never past the card's own top. Set
  // before the first paint, so nothing moves after the page appears.
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const status = scroll?.querySelector("[data-up-next] [data-testid='level-status']");
    const card = status?.closest("[data-up-next]");
    if (!scroll || !status || !card) return;
    const view = scroll.getBoundingClientRect();
    const bottom = status.getBoundingClientRect().bottom;
    if (bottom > view.bottom) scroll.scrollTop = Math.min(bottom + 12 - view.bottom, card.getBoundingClientRect().top - view.top);
  }, []);

  useEffect(() => {
    const dialog = confirmRef.current;
    if (confirm && dialog && !dialog.open) dialog.showModal();
  }, [confirm]);

  return (
    <main className={styles.page} data-returning={returning} data-testid="welcome">
      {/* Everything but the main action scrolls here, above the action's own area: nothing is covered. */}
      <div ref={scrollRef} className={styles.scroll} data-testid="welcome-scroll">
        <div className={styles.content}>
          {returning ? (
            // Returning players: the name, tagline and language in one row, and the artwork as a
            // slim ribbon (only where there is room for it), so the levels come first.
            <section className={styles.compactHero} data-testid="welcome-hero">
              <div className={styles.compactTop}>
                <div className={styles.compactBrand}>
                  <BrandMark size={40} />
                  <div>
                    <h1 className={styles.compactTitle}>{t("app.name")}</h1>
                    <p className={styles.compactTagline}>{t("app.tagline")}</p>
                  </div>
                </div>
                <LanguageToggle dispatch={dispatch} />
              </div>
              <WelcomeArt compact />
            </section>
          ) : (
            <>
              <div className={styles.top}>
                <LanguageToggle dispatch={dispatch} large />
              </div>

              <section className={styles.hero} data-testid="welcome-hero">
                <WelcomeArt />
                <div className={styles.titleRow}>
                  <BrandMark size={48} />
                  <h1 className={styles.title}>{t("app.name")}</h1>
                </div>
                <p className={styles.tagline}>{t("app.tagline")}</p>
                <p className={styles.intro}>{t("welcome.intro")}</p>
              </section>
            </>
          )}

          <section aria-labelledby="levels-title" className={styles.levelsSection}>
            <h2 id="levels-title" className={styles.levelsTitle}>
              {t("welcome.levels")}
            </h2>
            {returning && !main && (
              <p className={styles.allDone} data-testid="all-done">
                <CheckIcon />
                <span>{t("welcome.allDone")}</span>
              </p>
            )}
            <ol className={styles.levels} data-testid="levels">
              {LEVELS.map((level) => {
                const status = levelStatus(state, level);
                return (
                  <li key={level.id}>
                    <LevelCard
                      level={level}
                      status={status}
                      state={state}
                      dispatch={dispatch}
                      onConfirm={setConfirm}
                      // Returning players: the level the main action opens is marked on its card.
                      upNext={returning && main?.level.id === level.id}
                      // …and completed levels shrink to a line, their details and replay a tap away.
                      compact={returning && status.kind === "completed"}
                    />
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>

      {/* The main action in its own area at the bottom: always in view, never over the content.
          Continue returns to exactly where the player left the most recently active unfinished level. */}
      {main && (
        <div className={styles.actionBar} data-testid="welcome-actions">
          <button
            type="button"
            className={`btn btn-primary btn-block ${styles.mainAction}`}
            data-level={main.level.id}
            data-kind={main.kind}
            onClick={() => dispatch({ type: "openLevel", levelId: main.level.id })}
          >
            <span>{t(main.kind === "continue" ? "welcome.continue" : "welcome.start")}</span>
            <span className={styles.mainActionLevel}>
              {t("level.number", { number: main.level.number })}
              <span className={styles.mainActionTitle}> · {l(main.level.title)}</span>
            </span>
          </button>
        </div>
      )}

      {/* Starting a level over discards the player's place in it, so it asks first. Keeping it is the default. */}
      <dialog
        ref={confirmRef}
        className={styles.dialog}
        aria-labelledby="start-over-title"
        aria-describedby="start-over-text"
        data-testid="start-over-dialog"
        onClose={() => setConfirm(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        {confirm && (
          <form method="dialog" className={styles.dialogBody}>
            <h2 id="start-over-title" className={styles.dialogTitle}>
              {t(confirm.mode === "playAgain" ? "welcome.playAgainTitle" : "welcome.startOverTitle", { level: l(confirm.level.title) })}
            </h2>
            <p id="start-over-text">{t(confirm.mode === "playAgain" ? "welcome.playAgainText" : "welcome.startOverText")}</p>
            <div className={styles.dialogActions}>
              <button type="submit" className="btn btn-primary btn-block" autoFocus>
                {t(confirm.mode === "playAgain" ? "welcome.playAgainKeep" : "welcome.startOverKeep")}
              </button>
              <button type="submit" className="btn btn-secondary btn-block" onClick={() => dispatch({ type: "restartLevel", levelId: confirm.level.id })}>
                {t(confirm.mode === "playAgain" ? "welcome.playAgain" : "welcome.startOver")}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </main>
  );
}

const stepOf = (stage: LessonStage) => STEPS.find((s) => s.stages.includes(stage))!;

interface CardProps {
  level: LevelInfo;
  status: LevelStatus;
  state: AppState;
  dispatch: Dispatch<AppAction>;
  onConfirm: (confirm: Confirm) => void;
  /** The level the main action opens: marked "Up next". */
  upNext: boolean;
  /** Completed, for a returning player: a one-line summary that opens to show the rest. */
  compact: boolean;
}

/**
 * One level: its number, name, countries and status, each in words as well as
 * colour. A level that is coming soon or locked has no action at all.
 *
 * A playable one's actions, and when they ask first:
 * - Start (never started) and Continue open the level at once: nothing is lost.
 * - Start over (in progress) and Play again (completed, with a saved place: its
 *   Results, or a replay under way) ask first, naming the level. Confirming clears
 *   only that level's place; its records, its completion and the levels it
 *   unlocked stay, and no other level changes (restartLevel in appState.ts).
 * - Play again on a completed level with no saved place starts it at once.
 */
function LevelCard({ level, status, state, dispatch, onConfirm, upNext, compact }: CardProps) {
  const { t, l, name } = useI18n();
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);
  const titleId = `level-${level.id}-title`;
  const playable = status.kind !== "comingSoon" && status.kind !== "locked";
  const completed = status.kind === "completed";
  const progress = state.levels[level.id];
  const started = progress?.started === true;
  const records = progress?.records;
  const done = [records?.discoverDone, records?.findDone, records?.travelDone].map(Boolean);
  const title = l(level.title);
  const forLevel = (action: string) => t("level.forLevel", { action, level: title });
  const open = t(started ? "welcome.continue" : completed ? "welcome.playAgain" : "welcome.start");
  const restart = t(completed ? "welcome.playAgain" : "welcome.startOver");

  let statusText: string;
  let detail: string | null = null;
  switch (status.kind) {
    case "comingSoon":
      statusText = t("level.comingSoon");
      detail = t("level.comingSoonHint");
      break;
    case "locked":
      statusText = t("level.locked");
      detail = t("level.lockedHint", { level: l(status.after.title) });
      break;
    case "ready":
      statusText = t("level.ready");
      break;
    case "inProgress":
      statusText = t("level.inProgress", { step: t(stepOf(status.stage).key) });
      break;
    case "completed":
      statusText = t("level.completed");
      break;
  }

  // The level's number; a check once it is completed.
  const badge = (
    <span className={styles.levelBadge} aria-hidden="true">
      {completed ? <CheckIcon /> : level.number}
    </span>
  );
  const statusLine = (
    <span className={styles.status} data-testid="level-status">
      <StatusIcon kind={status.kind} />
      <span>
        <span className={styles.statusText}>{statusText}</span>
        {detail && <span className={styles.statusDetail}>{detail}</span>}
      </span>
    </span>
  );

  const body = (
    <>
      <p className={styles.levelDescription}>{l(level.description)}</p>
      <p className={styles.countries}>
        <span className="visually-hidden">{t("level.countries")} </span>
        {level.countries.map(name).join(" · ")}
      </p>

      {!compact && statusLine}

      {/* Each step in its colour, with a check when done or its number: colour is never the only cue. */}
      {playable && started && (
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
      )}

      {playable && (
        <div className={styles.levelActions}>
          {/* Named with the level (the visible word first), so each card's buttons can be told apart. */}
          <button type="button" className="btn btn-secondary" aria-label={forLevel(open)} onClick={() => dispatch({ type: "openLevel", levelId: level.id })}>
            {open}
          </button>
          {started && (
            <button
              type="button"
              className="btn btn-ghost"
              aria-haspopup="dialog"
              aria-label={forLevel(restart)}
              onClick={() => onConfirm({ level, mode: completed ? "playAgain" : "startOver" })}
            >
              {restart}
            </button>
          )}
        </div>
      )}
    </>
  );

  if (compact) {
    // A disclosure, as in the accordion pattern: a heading holding the button that shows the rest.
    return (
      <article
        className={styles.levelCard}
        data-status={status.kind}
        data-compact=""
        data-up-next={upNext || undefined}
        data-testid={`level-${level.id}`}
        aria-labelledby={titleId}
      >
        <h3 className={styles.summaryHeading}>
          <button
            type="button"
            className={styles.summary}
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={() => setExpanded((e) => !e)}
            data-testid="level-details-toggle"
          >
            {badge}
            <span className={styles.levelHeading}>
              <span className={styles.summaryLine}>
                <span className={styles.levelNumber}>{t("level.number", { number: level.number })}</span>
                {statusLine}
              </span>
              <span id={titleId} className={styles.levelTitle}>
                {title}
              </span>
            </span>
            <ChevronIcon />
          </button>
        </h3>
        <div id={detailsId} className={styles.details} hidden={!expanded}>
          {body}
        </div>
      </article>
    );
  }

  return (
    <article className={styles.levelCard} data-status={status.kind} data-up-next={upNext || undefined} data-testid={`level-${level.id}`} aria-labelledby={titleId}>
      <div className={styles.levelHead}>
        {badge}
        <div className={styles.levelHeading}>
          <p className={styles.levelNumber}>
            {t("level.number", { number: level.number })}
            {upNext && (
              <span className={styles.upNext} data-testid="up-next">
                {t("welcome.upNext")}
              </span>
            )}
          </p>
          <h3 id={titleId} className={styles.levelTitle}>
            {title}
          </h3>
        </div>
      </div>
      {body}
    </article>
  );
}

function ChevronIcon() {
  return (
    <svg className={styles.chevron} width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9.5l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="1.1em" height="1.1em" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A shape for each status, so it never relies on colour alone. */
function StatusIcon({ kind }: { kind: LevelStatus["kind"] }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", "aria-hidden": true, className: styles.statusIcon } as const;
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (kind) {
    case "comingSoon":
      // An hourglass: being prepared.
      return (
        <svg {...common}>
          <path d="M7 3.5h10M7 20.5h10M8 3.5c0 5 8 5.5 8 8.5s-8 3.5-8 8.5M16 3.5c0 5-8 5.5-8 8.5s8 3.5 8 8.5" {...stroke} />
        </svg>
      );
    case "locked":
      return (
        <svg {...common}>
          <rect x="5" y="10.5" width="14" height="10" rx="2.5" {...stroke} />
          <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" {...stroke} />
        </svg>
      );
    case "completed":
      return (
        <svg {...common}>
          <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" fill="currentColor" />
        </svg>
      );
    case "inProgress":
      // A half-filled circle: under way.
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" {...stroke} />
          <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
        </svg>
      );
    case "ready":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" {...stroke} />
          <path d="M10 8.2v7.6l6-3.8z" fill="currentColor" />
        </svg>
      );
  }
}

/** Level 1's five landmarks as stickers along a dashed route: a decorative start to the adventure. */
const ART = ["eiffel-tower", "atomium", "amsterdam-canal-houses", "adolphe-bridge", "brandenburg-gate"] as const;

/** `compact`: a slim ribbon for returning players, shown only where the screen has room (see the CSS). */
function WelcomeArt({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${styles.art} ${compact ? styles.artCompact : ""}`} aria-hidden="true" data-testid="welcome-art">
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

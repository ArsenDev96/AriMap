"use client";

import Image from "next/image";
import { useId, useLayoutEffect, useRef, useState, type Dispatch } from "react";
import landArt from "@/assets/map/world/land.webp";
import waterArt from "@/assets/map/world/water.webp";
import { getCountry } from "@/core/content/countries";
import { getContinent, levelsOf, type LevelInfo } from "@/core/lessons";
import type { LessonStage } from "@/core/lesson/progress";
import { WORLD_GRATICULE, WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH, WORLD_REGIONS } from "@/data/geo/world-map";
import { allLevelsComplete, hasSavedResults, hasUnfinishedAttempt, levelStatus, mainAction, versionOf, type AppAction, type AppState, type LevelStatus } from "@/core/progress/appState";
import { STEPS } from "./Header";
import { useI18n } from "./i18n";
import { LANDMARK_IMAGES } from "./landmarks/LandmarkCard";
import { RestartDialog, type RestartRequest } from "./RestartDialog";
import { Stars } from "./Stars";
import styles from "./WelcomeScreen.module.css";

interface Props {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

/** Whether the player has played before: then the page leads with the levels, not the introduction. */
export function isReturning(state: AppState): boolean {
  return Object.values(state.levels).some((p) => p.started || p.records.discoverDone);
}

/**
 * A continent's level selection (`state.continent`; Europe's holds the seven levels): Back to
 * the continents, the continent's name, its levels, and the main action in its own area below.
 */
export function WelcomeScreen({ state, dispatch }: Props) {
  const { t, l } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [confirm, setConfirm] = useState<RestartRequest | null>(null);
  const continent = getContinent(state.continent);
  const levels = levelsOf(continent.id);
  const main = mainAction(state, continent.id);
  const allComplete = allLevelsComplete(state, continent.id);
  // Known from the save on the first render (the game renders on the client only), so the
  // page never switches layout after it appears.
  const returning = isReturning(state);

  // Each card's head, beside or above its title (stackLevelHeads): worked out before the list
  // is first painted or scrolled below, again after every render (a language change changes the
  // titles), and whenever the list's size changes (its width, the text size, a card opened) or a
  // font finishes loading. It only sets an attribute, so it never renders again.
  useLayoutEffect(() => {
    if (listRef.current) stackLevelHeads(listRef.current);
  });
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => stackLevelHeads(list);
    const observer = new ResizeObserver(update);
    observer.observe(list);
    document.fonts?.addEventListener("loadingdone", update);
    return () => {
      observer.disconnect();
      document.fonts?.removeEventListener("loadingdone", update);
    };
  }, []);

  // The "Up next" card's number, name and status are found at once. With several completed
  // levels above it (one line each), a short phone can leave its status under the action area:
  // the list (only the list: the brand and language switch stay above it) then starts scrolled
  // just enough to show it: never past the card's own top, or, when the card is taller than the
  // list (very large text), never past its title. Set before the first paint, so nothing moves
  // after the page appears; only on arrival, so a position the player chose is kept (if a web font
  // finishes loading just after, it is worked out again, unless the player has scrolled by then).
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const reveal = () => {
      const card = scroll.querySelector("[data-up-next]");
      const status = card?.querySelector("[data-testid='level-status']");
      const title = card?.querySelector("[data-level-title]");
      if (!card || !status || !title) return scroll.scrollTop;
      // Positions within the list's content, and the height it shows.
      const top = scroll.getBoundingClientRect().top - scroll.scrollTop;
      const y = (el: Element, edge: "top" | "bottom") => el.getBoundingClientRect()[edge] - top;
      const height = scroll.clientHeight;
      const [statusBottom, cardTop, titleTop, titleBottom] = [y(status, "bottom"), y(card, "top"), y(title, "top"), y(title, "bottom")];
      if (statusBottom <= height) return (scroll.scrollTop = 0);
      // The status in view if the whole card fits; otherwise as much as the title allows.
      const limit = statusBottom - cardTop + 12 <= height ? cardTop : Math.min(titleTop, Math.max(cardTop, titleBottom + 12 - height));
      scroll.scrollTop = Math.min(statusBottom + 12 - height, limit);
      return scroll.scrollTop;
    };
    let applied = reveal();
    let active = true;
    void document.fonts?.ready.then(() => {
      if (active && scroll.scrollTop === applied) applied = reveal();
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className={`${styles.page} ${styles.levelsPage}`} data-returning={returning} data-continent={continent.id} data-testid="welcome">
      {/* Back to the continents (where AriMap, its tagline and the language are) above the scrolling list,
          so it stays in view however far the levels are scrolled (the list may start scrolled to the next
          level). The language is chosen on the continents and in a level; this page keeps it as it is. */}
      <header className={styles.compactHeader} data-testid="welcome-hero">
        <div className={styles.compactTop}>
          <button type="button" className={`btn btn-ghost ${styles.back}`} onClick={() => dispatch({ type: "goHome" })} data-testid="back-to-continents">
            <BackIcon />
            <span className={styles.backLabel}>{t("continents.back")}</span>
          </button>
        </div>
      </header>
      {/* Everything else but the main action scrolls here, between the header and the action's own
          area: nothing is covered. */}
      <div ref={scrollRef} className={styles.scroll} data-testid="welcome-scroll">
        <div className={styles.content}>
          <section aria-labelledby="levels-title" className={styles.levelsSection}>
            {returning && continent.id === "europe" && (
              // A small map of Europe (only where there is room for it): above the title on a phone, beside
              // it on a wide screen, so the levels come first.
              <EuropeBanner />
            )}
            {/* The page's title: the continent, where "Choose a level" was. */}
            <h1 id="levels-title" className={styles.levelsTitle} data-testid="continent-title">
              {l(continent.name)}
            </h1>
            {returning && !main && (
              // Nothing left to start. Once every level is completed (none coming soon), it says
              // so; every card still offers Play again.
              <p className={styles.allDone} data-testid="all-done" data-all-complete={allComplete || undefined}>
                <CheckIcon />
                <span>{allComplete ? t("welcome.allComplete", { count: levels.length }) : t("welcome.allDone")}</span>
              </p>
            )}
            <ol ref={listRef} className={styles.levels} data-testid="levels">
              {levels.map((level) => {
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
      <RestartDialog request={confirm} onClose={() => setConfirm(null)} dispatch={dispatch} />
    </main>
  );
}

const stepOf = (stage: LessonStage) => STEPS.find((s) => s.stages.includes(stage))!;

/**
 * Each level's picture on its card: the landmark of one of its own countries, one no other level
 * has (decorative; the level's name and countries say where it goes).
 */
const LEVEL_ART_COUNTRY: Readonly<Record<string, string>> = {
  "western-europe-1": "FRA",
  "around-the-alps": "CHE",
  "central-europe": "CZE",
  "along-the-adriatic": "HRV",
  "towards-greece": "GRC",
  "baltic-journey": "LTU",
  "iberian-journey": "ESP",
  "eastern-europe": "ROU",
};

function levelArt(level: LevelInfo) {
  const country = LEVEL_ART_COUNTRY[level.id];
  const key = country ? getCountry(country).landmark?.illustration : undefined;
  return key ? LANDMARK_IMAGES[key] : undefined;
}

interface CardProps {
  level: LevelInfo;
  status: LevelStatus;
  state: AppState;
  dispatch: Dispatch<AppAction>;
  onConfirm: (confirm: RestartRequest) => void;
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
 * - Start (never started) opens the level at once.
 * - Continue appears only for an attempt under way (hasUnfinishedAttempt: started and not at
 *   the Results of a finished attempt, a replay included) and resumes it at once. Beside it,
 *   Start over (never completed) or Play again (completed) asks first.
 * - A finished attempt (completed, at its Results) never offers Continue. View results reopens
 *   its saved Results at once, changing nothing; Play again beside it asks first, since they
 *   would be cleared. A completion record alone (an older save, no Results kept) offers Play again.
 * - Asking first names the level. Confirming clears only that level's place; its records, its
 *   completion and the levels it unlocked stay, and no other level changes (restartLevel in
 *   appState.ts). Play again on a completed level with no saved place starts it at once.
 */
function LevelCard({ level, status, state, dispatch, onConfirm, upNext, compact }: CardProps) {
  const { t, l, name } = useI18n();
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);
  const titleId = `level-${level.id}-title`;
  const playable = status.kind !== "comingSoon" && status.kind !== "locked";
  const completed = status.kind === "completed";
  const progress = state.levels[level.id];
  // The version of the level its attempt is on: an attempt from before its countries changed is shown as it is.
  const version = versionOf(state, level);
  const started = progress?.started === true;
  const records = progress?.records;
  const done = [records?.discoverDone, records?.findDone, records?.travelDone].map(Boolean);
  const title = l(level.title);
  const forLevel = (action: string) => t("level.forLevel", { action, level: title });
  // An attempt under way to resume; a finished one (at its Results) is played again instead, after asking.
  const resumable = hasUnfinishedAttempt(state, level.id);
  const finished = completed && started && !resumable;
  // Its Results, saved: viewed again as they are, without asking (nothing is reset).
  const viewable = completed && hasSavedResults(state, level.id);
  const openLevel = () => dispatch({ type: "openLevel", levelId: level.id });
  const open = t(resumable ? "welcome.continue" : completed ? "welcome.playAgain" : "welcome.start");
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

  // The level's number, in a circle; none once it is completed, where "Completed" and the stars say it
  // and the title has the room instead.
  const badge = !completed && (
    <span className={styles.levelBadge} aria-hidden="true" data-level-side="">
      {level.number}
    </span>
  );
  // The best stars earned (a completed full-level attempt's), once there are any: a row of their own
  // under the title, apart from "Completed", which then needs no icon of its own. One description for
  // the group, said once; none for a level never rated, which is not shown as a failed attempt.
  const best = completed ? (progress?.records.bestRating ?? null) : null;
  const stars = best !== null && (
    <span className={styles.levelStars} role="img" aria-label={t("stars.bestLabel", { stars: t("stars.count", { count: best }) })} data-testid="level-stars" data-stars={best}>
      <Stars count={best} />
    </span>
  );
  const statusLine = (
    <span className={styles.status} data-testid="level-status">
      {!stars && <StatusIcon kind={status.kind} />}
      <span>
        <span className={styles.statusText}>{statusText}</span>
        {detail && <span className={styles.statusDetail}>{detail}</span>}
      </span>
    </span>
  );

  const body = (
    <>
      <p className={styles.levelDescription}>{l(version?.description ?? level.description)}</p>
      <p className={styles.countries}>
        <span className="visually-hidden">{t("level.countries")} </span>
        {(version?.lesson.countries ?? level.countries).map(name).join(" · ")}
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
          {viewable ? (
            <>
              <button type="button" className="btn btn-secondary" aria-label={forLevel(t("welcome.viewResults"))} data-testid="view-results" onClick={openLevel}>
                {t("welcome.viewResults")}
              </button>
              <button type="button" className="btn btn-ghost" aria-haspopup="dialog" aria-label={forLevel(restart)} onClick={() => onConfirm({ level, mode: "playAgain" })}>
                {restart}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              aria-label={forLevel(open)}
              aria-haspopup={finished ? "dialog" : undefined}
              onClick={() => (finished ? onConfirm({ level, mode: "playAgain" }) : openLevel())}
            >
              {open}
            </button>
          )}
          {resumable && (
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
        data-tone={level.number}
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
            data-level-head=""
          >
            {badge}
            <span className={styles.levelHeading}>
              <span className={styles.summaryLine}>
                <span className={styles.levelNumber} data-level-number="">{t("level.number", { number: level.number })}</span>
                {statusLine}
              </span>
              <span id={titleId} className={styles.levelTitle} data-level-title="">
                {title}
              </span>
              {stars}
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

  // The level's landmark beside its name, where the name keeps its room (stackLevelHeads); never on a
  // compact card, which stays one line.
  const art = levelArt(level);
  return (
    <article
      className={styles.levelCard}
      data-status={status.kind}
      data-tone={level.number}
      data-up-next={upNext || undefined}
      data-testid={`level-${level.id}`}
      aria-labelledby={titleId}
    >
      <div className={styles.levelHead} data-level-head="">
        {badge}
        <div className={styles.levelHeading}>
          <p className={styles.levelNumber} data-level-number="">
            {t("level.number", { number: level.number })}
            {upNext && (
              <span className={styles.upNext} data-testid="up-next">
                {t("welcome.upNext")}
              </span>
            )}
          </p>
          <h3 id={titleId} className={styles.levelTitle} data-level-title="">
            {title}
          </h3>
        </div>
        {art && (
          <span className={styles.levelArt} aria-hidden="true" data-level-art="">
            <Image src={art} alt="" fill sizes="64px" className={styles.levelArtImage} />
          </span>
        )}
      </div>
      {body}
    </article>
  );
}

/**
 * A level card's head shows its number badge (or, completed, its chevron) beside the title,
 * the usual layout, while every word of the title fits the room beside them. When one doesn't
 * (enlarged text on a phone), the head is marked data-stacked: the badge and number (or the
 * number, status and chevron) go above the title, which has the card's whole width, so it wraps
 * between words; a word is broken only if it is wider than the whole card. Measured in the
 * text as laid out, in its language and loaded font, rather than guessed from the text size.
 */
function stackLevelHeads(list: HTMLElement) {
  for (const head of list.querySelectorAll<HTMLElement>("[data-level-head]")) {
    const title = head.querySelector("[data-level-title]");
    if (!title) continue;
    const style = getComputedStyle(head);
    // The gap beside the title in the usual layout (the stacked one spaces its row differently).
    const gap = parseFloat(style.getPropertyValue("--head-gap")) || 0;
    // The title's room beside the badge and chevron: the same in either layout.
    let room = head.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    for (const side of head.querySelectorAll(":scope > [data-level-side]")) {
      // Its width as laid out, not its box on screen: a chevron turning over (0.2s, as a card
      // opens) has a wider box mid-turn, which would understate the room. Hidden: none.
      const width = side.getBoundingClientRect().width > 0 ? parseFloat(getComputedStyle(side).width) || 0 : 0;
      if (width > 0) room -= width + gap;
    }
    // A completed card's status shares that room: its widest word, beside its icon (if it has one),
    // with the pill's padding. Worked out from the parts, not the pill's width, which is the same
    // whether or not the words have gone under the icon (see .status in the CSS). Its stars too: a
    // row that never breaks.
    let need = widestWord(title);
    const status = head.querySelector("[data-testid='level-status']");
    const statusText = status?.lastElementChild;
    if (status && statusText) {
      const s = getComputedStyle(status);
      const chrome = parseFloat(s.paddingLeft) + parseFloat(s.paddingRight) + parseFloat(s.borderLeftWidth) + parseFloat(s.borderRightWidth);
      const icon = status.firstElementChild !== statusText ? status.firstElementChild : null;
      const beside = icon ? icon.getBoundingClientRect().width + (parseFloat(s.columnGap) || 0) : 0;
      need = Math.max(need, chrome + beside + widestWord(statusText));
    }
    const stars = head.querySelector("[data-testid='level-stars']");
    if (stars) need = Math.max(need, stars.getBoundingClientRect().width);
    // The level's picture (a full card's) takes room beside the title only where the title keeps
    // every word whole and at least about 10rem: otherwise it gives way to the words. Its width as
    // set (shown or not), so the choice never flips back and forth.
    const art = head.querySelector(":scope > [data-level-art]");
    if (art) {
      const withArt = room - (parseFloat(getComputedStyle(art).width) || 0) - gap;
      const comfortable = 10 * parseFloat(getComputedStyle(document.documentElement).fontSize);
      head.toggleAttribute("data-art", withArt >= Math.max(need, comfortable));
    }
    // Stacked as soon as it needs more than the room, however little: a fraction of a pixel too wide is
    // enough for the browser to break the word (a completed card's status, with its stars, can come that close).
    head.toggleAttribute("data-stacked", need > room);
  }
}

/** The width of the widest word in an element, as laid out (the sum of its pieces, if it is broken). */
function widestWord(element: Element): number {
  let widest = 0;
  const range = document.createRange();
  const words = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = words.nextNode(); node; node = words.nextNode()) {
    for (const word of (node.textContent ?? "").matchAll(/\S+/g)) {
      range.setStart(node, word.index);
      range.setEnd(node, word.index + word[0].length);
      let width = 0;
      for (const piece of range.getClientRects()) width += piece.width;
      widest = Math.max(widest, width);
    }
  }
  return widest;
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className={styles.chevron} width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" data-level-side="">
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

/**
 * The part of the home screen's world map (src/data/geo/world-map.ts, map units) the banner frames: Europe
 * from Iceland to the Urals and from the North Cape to Crete, with a little sea around it (about 34–76°N;
 * the far Arctic islands are left out). Always shown whole, centred, at the map's own proportions (never
 * stretched or cropped): a banner wider than Europe shows only a little of the Atlantic and Greenland's
 * coast on one side and of Asia on the other.
 */
const EUROPE_VIEW = "392 40 280 116";

/**
 * Europe, as a small illustrated map: the home screen's painted water and Europe's painted land (green,
 * with its relief), clipped to Europe's own coastline, the neighbouring land a quiet pale green, and the
 * map's faint grid. Real geography only (the world map's data and images, already in the app's files: no
 * other download). Decorative: no names, nothing to press; the heading beside it says "Europe".
 */
function EuropeBanner() {
  const clip = useId();
  return (
    <div className={styles.banner} aria-hidden="true" data-testid="welcome-art">
      <svg className={styles.bannerMap} viewBox={EUROPE_VIEW} preserveAspectRatio="xMidYMid meet" focusable="false">
        <image href={waterArt.src} width={WORLD_MAP_WIDTH} height={WORLD_MAP_HEIGHT} preserveAspectRatio="none" />
        <path className={styles.bannerGrid} d={WORLD_GRATICULE} />
        {(Object.keys(WORLD_REGIONS) as (keyof typeof WORLD_REGIONS)[])
          .filter((region) => region !== "europe")
          .map((region) => (
            <path key={region} className={styles.bannerLand} d={WORLD_REGIONS[region]} />
          ))}
        <clipPath id={clip}>
          <path d={WORLD_REGIONS.europe} />
        </clipPath>
        <path className={styles.bannerEurope} d={WORLD_REGIONS.europe} />
        <image href={landArt.src} width={WORLD_MAP_WIDTH} height={WORLD_MAP_HEIGHT} preserveAspectRatio="none" clipPath={`url(#${clip})`} />
      </svg>
    </div>
  );
}

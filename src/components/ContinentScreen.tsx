"use client";

import type { Dispatch } from "react";
import { CONTINENTS, getContinent, hasPlayableLevels, type ContinentInfo } from "@/core/lessons";
import { continentProgress, levelToContinue, type AppAction, type AppState } from "@/core/progress/appState";
import { BrandMark, LanguageToggle } from "./Header";
import { useI18n } from "./i18n";
import { isReturning, WelcomeArt } from "./WelcomeScreen";
import page from "./WelcomeScreen.module.css";
import styles from "./ContinentScreen.module.css";

interface Props {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

/**
 * The home screen: the continents, each with its name and status in words. A continent with
 * playable levels opens its level selection; the others are coming soon and have no action.
 * Continue, in its own area below the list, resumes the most recently active unfinished level
 * of any continent, exactly where it was left. Without one, the first playable continent's
 * button is the main action. The page's frame (header, scrolling content, action area) is the
 * level selection's (WelcomeScreen.module.css).
 */
export function ContinentScreen({ state, dispatch }: Props) {
  const { t, l } = useI18n();
  const resume = levelToContinue(state);
  // Known from the save on the first render (the game renders on the client only), so the page never switches layout after it appears.
  const returning = isReturning(state);
  const primary = resume ? null : CONTINENTS.find((c) => hasPlayableLevels(c.id))?.id;

  return (
    <main className={page.page} data-returning={returning} data-testid="continents">
      <header className={page.compactHeader} data-testid="welcome-hero">
        <div className={page.compactTop}>
          <div className={page.compactBrand}>
            <BrandMark size={40} />
            <div>
              <h1 className={page.compactTitle}>{t("app.name")}</h1>
              <p className={page.compactTagline}>{t("app.tagline")}</p>
            </div>
          </div>
          <LanguageToggle dispatch={dispatch} />
        </div>
      </header>

      <div className={page.scroll} data-testid="continents-scroll">
        <div className={page.content}>
          {returning ? (
            <WelcomeArt compact />
          ) : (
            // A new player: the adventure's opening page, then the continents.
            <section className={styles.welcome}>
              <WelcomeArt />
              <p className={page.intro}>{t("welcome.intro")}</p>
            </section>
          )}

          <section aria-labelledby="continents-title" className={page.levelsSection}>
            <h2 id="continents-title" className={page.levelsTitle}>
              {t("continents.title")}
            </h2>
            <ul className={styles.continents} data-testid="continent-list">
              {CONTINENTS.map((continent) => (
                <li key={continent.id}>
                  <ContinentCard continent={continent} state={state} dispatch={dispatch} primary={continent.id === primary} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {resume && (
        <div className={page.actionBar} data-testid="continents-actions">
          <button
            type="button"
            className={`btn btn-primary btn-block ${page.mainAction}`}
            data-level={resume.id}
            data-kind="continue"
            // The whole destination, also when narrow screens show less of it.
            aria-label={t("continents.continueLabel", {
              action: t("welcome.continue"),
              continent: l(getContinent(resume.continent).name),
              level: t("level.number", { number: resume.number }),
              title: l(resume.title),
            })}
            onClick={() => dispatch({ type: "openLevel", levelId: resume.id })}
          >
            <span>{t("welcome.continue")}</span>
            <span className={page.mainActionLevel}>
              {l(getContinent(resume.continent).name)} · {t("level.number", { number: resume.number })}
              <span className={page.mainActionTitle}> · {l(resume.title)}</span>
            </span>
          </button>
        </div>
      )}
    </main>
  );
}

/** One continent: its name, and its levels and progress with a button, or "Coming soon" with no action. */
function ContinentCard({ continent, state, dispatch, primary }: { continent: ContinentInfo; state: AppState; dispatch: Dispatch<AppAction>; primary: boolean }) {
  const { t, tp, l } = useI18n();
  const playable = hasPlayableLevels(continent.id);
  const { total, completed } = continentProgress(state, continent.id);
  const titleId = `continent-${continent.id}-title`;
  return (
    <article
      className={styles.card}
      data-continent={continent.id}
      data-status={playable ? "open" : "comingSoon"}
      data-testid={`continent-${continent.id}`}
      aria-labelledby={titleId}
    >
      <div className={styles.head}>
        <GlobeIcon />
        <h3 id={titleId} className={styles.name}>
          {l(continent.name)}
        </h3>
      </div>
      {playable ? (
        <>
          <p className={styles.count} data-testid="continent-levels">
            {tp("continents.levels", total)}
          </p>
          <p className={styles.progress} data-testid="continent-progress">
            <StarIcon />
            <span>{tp("continents.completed", total, { completed })}</span>
          </p>
          {/* The same in words just above: the bar only adds to it. */}
          <span className={styles.bar} aria-hidden="true">
            <span style={{ width: `${(100 * completed) / Math.max(total, 1)}%` }} />
          </span>
          <button
            type="button"
            className={`btn ${primary ? "btn-primary" : "btn-secondary"} ${styles.explore}`}
            data-primary={primary || undefined}
            data-testid={`explore-${continent.id}`}
            onClick={() => dispatch({ type: "openContinent", continent: continent.id })}
          >
            {t("continents.explore", { continent: l(continent.nameInText) })}
          </button>
        </>
      ) : (
        <p className={styles.soon} data-testid="continent-status">
          <HourglassIcon />
          <span>
            <span className={styles.soonText}>{t("continents.comingSoon")}</span>
            <span className={styles.soonDetail}>{t("continents.comingSoonHint")}</span>
          </span>
        </p>
      )}
    </article>
  );
}

/** A small globe in the card's accent: decorative, the same for every continent (no flags, no invented artwork). */
function GlobeIcon() {
  return (
    <svg className={styles.globe} width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r="17" fill="var(--accent-soft)" stroke="var(--ink)" strokeWidth="2.4" />
      <ellipse cx="22" cy="22" rx="7.5" ry="17" fill="none" stroke="var(--accent)" strokeWidth="2.2" />
      <path d="M5.5 16.5h33M5.5 27.5h33M22 5v34" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" fill="currentColor" />
    </svg>
  );
}

function HourglassIcon() {
  return (
    <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 3.5h10M7 20.5h10M8 3.5c0 5 8 5.5 8 8.5s-8 3.5-8 8.5M16 3.5c0 5-8 5.5-8 8.5s8 3.5 8 8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

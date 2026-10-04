"use client";

import type { CSSProperties, Dispatch } from "react";
import { CONTINENTS, getContinent, hasPlayableLevels, type ContinentId, type ContinentInfo } from "@/core/lessons";
import { continentProgress, levelToContinue, type AppAction, type AppState } from "@/core/progress/appState";
import { WORLD_GRATICULE, WORLD_LABELS, WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH, WORLD_REGIONS, WORLD_SPHERE } from "@/data/geo/world-map";
import { BrandMark, LanguageToggle } from "./Header";
import { useI18n } from "./i18n";
import page from "./WelcomeScreen.module.css";
import styles from "./ContinentScreen.module.css";

interface Props {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

/** Drawn under the categories: geographic context, never selectable. */
const CONTEXT_REGIONS = ["oceania", "antarctica"] as const;

/**
 * The home screen: a world map of the continents. A continent with playable levels (Europe) opens
 * its level selection, from its land or its name; the others say "Coming soon" and do nothing.
 * Oceania and Antarctica are drawn as context only. The names are one list: over the map where it has
 * room for them (wide screens), otherwise beside it (a phone held sideways) or under it. Europe's levels
 * completed ("Completed: 2/7") are never on the map: under it on wide screens, otherwise with Europe's
 * button in the list (beneath it beside the map, beside it under the map). The action area below the content resumes the most
 * recently active unfinished level (Continue), or else opens Europe (Explore Europe). The page's
 * frame (header, scrolling content, action area) is the level selection's (WelcomeScreen.module.css).
 */
export function ContinentScreen({ state, dispatch }: Props) {
  const { t, l } = useI18n();
  const resume = levelToContinue(state);
  const playable = CONTINENTS.filter((c) => hasPlayableLevels(c.id));
  const open = (continent: ContinentId) => dispatch({ type: "openContinent", continent });

  return (
    <main className={page.page} data-testid="continents">
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
        <div className={`${page.content} ${styles.content}`}>
          <section aria-labelledby="continents-title" className={styles.layout}>
            <h2 id="continents-title" className={styles.title}>
              {t("continents.title")}
            </h2>

            <div className={styles.mapColumn}>
              <div className={styles.mapArea} data-testid="world-map">
                {/* The land is for pointers only: each name below is what the keyboard and assistive technology use. */}
                <svg
                  className={styles.map}
                  viewBox={`0 0 ${WORLD_MAP_WIDTH} ${WORLD_MAP_HEIGHT}`}
                  aria-hidden="true"
                  focusable="false"
                >
                  <path className={styles.water} d={WORLD_SPHERE} />
                  <path className={styles.graticule} d={WORLD_GRATICULE} />
                  {CONTEXT_REGIONS.map((region) => (
                    <path key={region} className={styles.region} data-region={region} d={WORLD_REGIONS[region]} />
                  ))}
                  {CONTINENTS.map((c) => (
                    <path
                      key={c.id}
                      className={styles.region}
                      data-region={c.id}
                      data-status={hasPlayableLevels(c.id) ? "open" : "comingSoon"}
                      data-testid={`map-region-${c.id}`}
                      d={WORLD_REGIONS[c.id]}
                      onClick={hasPlayableLevels(c.id) ? () => open(c.id) : undefined}
                    />
                  ))}
                  <path className={styles.rim} d={WORLD_SPHERE} />
                </svg>
              </div>

              {/* Wide screens: each playable continent's levels completed, under the map and off it (named,
                  as its button is on the map). Other layouts show them with its button instead (see the CSS). */}
              {playable.map((continent) => (
                <ContinentProgress key={continent.id} continent={continent} state={state} placement="map" />
              ))}
            </div>

            {/* Over the map (the same grid cell, the same size) or beside or under it: see the CSS. */}
            <ul className={styles.labels} aria-labelledby="continents-title" data-testid="continent-list">
              {CONTINENTS.map((continent) => (
                <ContinentLabel key={continent.id} continent={continent} state={state} onOpen={open} />
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div className={page.actionBar} data-testid="continents-actions">
        {resume ? (
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
        ) : (
          playable[0] && (
            <button
              type="button"
              className="btn btn-primary btn-block"
              data-primary
              data-testid={`explore-${playable[0].id}`}
              onClick={() => open(playable[0].id)}
            >
              {t("continents.explore", { continent: l(playable[0].nameInText) })}
            </button>
          )
        )}
      </div>
    </main>
  );
}

/**
 * A continent's levels completed, from the permanent records: "Completed: 2/7" (the count kept on one
 * line) and a bar, read in full ("2 of 7 Europe levels completed"). `placement`: under the map (wide
 * screens, with the continent's name, its button being on the map) or with its button in the list
 * (no name: the button beside it names it). The CSS shows one of the two.
 */
function ContinentProgress({ continent, state, placement }: { continent: ContinentInfo; state: AppState; placement: "map" | "label" }) {
  const { t, tp, l } = useI18n();
  const { total, completed } = continentProgress(state, continent.id);
  return (
    <div className={styles.progressArea} data-continent={continent.id} data-placement={placement} data-testid={`continent-${continent.id}-progress-area`}>
      <p className={styles.progress}>
        {placement === "map" && (
          <>
            <span className={styles.progressName} aria-hidden="true">
              {l(continent.name)}
            </span>{" "}
          </>
        )}
        <span className={styles.progressCount} aria-hidden="true">
          <StarIcon />
          <span data-testid="continent-progress">
            {t("continents.completedShort")} <span className={styles.fraction}>{`${completed}/${total}`}</span>
          </span>
        </span>
        <span className="visually-hidden">{tp("continents.completed", total, { completed, continent: l(continent.nameOf) })}</span>
      </p>
      {/* The same in words just above: the bar only adds to it. */}
      <span className={styles.bar} aria-hidden="true">
        <span style={{ width: `${(100 * completed) / Math.max(total, 1)}%` }} />
      </span>
    </div>
  );
}

/**
 * A category's name: for a continent with levels, a button with its name and an arrow (described by
 * its levels completed, shown beside it or under the map); otherwise its name and "Coming soon" in
 * words, with nothing to press or focus.
 */
function ContinentLabel({ continent, state, onOpen }: { continent: ContinentInfo; state: AppState; onOpen: (id: ContinentId) => void }) {
  const { t, tp, l } = useI18n();
  const { total, completed } = continentProgress(state, continent.id);
  const playable = hasPlayableLevels(continent.id);
  const { x, y } = WORLD_LABELS[continent.id];
  return (
    <li
      className={styles.label}
      data-continent={continent.id}
      data-status={playable ? "open" : "comingSoon"}
      data-testid={`continent-${continent.id}`}
      style={{ "--x": x, "--y": y } as CSSProperties}
    >
      {playable ? (
        <>
          <button
            type="button"
            className={styles.open}
            aria-describedby={`continent-${continent.id}-progress`}
            data-testid={`map-label-${continent.id}`}
            onClick={() => onOpen(continent.id)}
          >
            <span className={styles.name}>{l(continent.name)}</span>
            <ArrowIcon />
          </button>
          {/* Its description, wherever its progress is shown. */}
          <span id={`continent-${continent.id}-progress`} hidden>
            {tp("continents.completed", total, { completed, continent: l(continent.nameOf) })}
          </span>
          <ContinentProgress continent={continent} state={state} placement="label" />
        </>
      ) : (
        <>
          <span className={styles.name}>{l(continent.name)}</span>
          <span className={styles.soon} data-testid="continent-status">
            <HourglassIcon />
            {t("continents.comingSoon")}
          </span>
        </>
      )}
    </li>
  );
}

function ArrowIcon() {
  return (
    <svg className={styles.arrow} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
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
    <svg className={styles.icon} width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 3.5h10M7 20.5h10M8 3.5c0 5 8 5.5 8 8.5s-8 3.5-8 8.5M16 3.5c0 5-8 5.5-8 8.5s8 3.5 8 8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

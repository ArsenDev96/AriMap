"use client";

import type { Dispatch } from "react";
import { CONTINENTS, getContinent, hasPlayableLevels, type ContinentId, type ContinentInfo } from "@/core/lessons";
import { continentProgress, levelToContinue, type AppAction, type AppState } from "@/core/progress/appState";
import { WORLD_GRATICULE, WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH, WORLD_REGIONS, WORLD_SPHERE } from "@/data/geo/world-map";
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
type Region = keyof typeof WORLD_REGIONS;

/** Ids for the map's paints and its land clip (one world map on the page at a time). */
const ID = {
  water: "continents-water",
  waterGrain: "continents-water-grain",
  landGrain: "continents-land-grain",
  landLight: "continents-land-light",
  softLight: "continents-soft-light",
  softShade: "continents-soft-shade",
  land: "continents-land",
  region: (region: Region) => `continents-region-${region}`,
};

/**
 * Each category's silhouette on its card: a crop of the map's own land (the same geometry, in map
 * units), around its main landmass. North America's takes in Greenland; Europe's leaves out Svalbard.
 */
const SILHOUETTE_VIEW: Record<ContinentId, string> = {
  europe: "418 30 202 118",
  asia: "534 14 360 284",
  africa: "418 135 197 242",
  "north-america": "84 4 378 236",
  "south-america": "239 216 139 225",
};

/**
 * The home screen: a world map of the continents, then the categories as cards under it (or beside
 * it, when the screen is short and wide for its text: a phone held sideways, a desktop). A continent
 * with playable levels (Europe) opens its level selection, from its land or its card (its name is the
 * card's one button, for the keyboard and assistive technology); the others are tiles that say
 * "Coming soon" and do nothing. Oceania and Antarctica are drawn as context only. Europe's levels
 * completed ("Completed: 2/7") are shown once, on its card, never on the map. The action area below
 * the content resumes the most recently active unfinished level (Continue), or else opens Europe
 * (Explore Europe). The page's frame (header, scrolling content, action area) is the level
 * selection's (WelcomeScreen.module.css), in this screen's sky colours.
 */
export function ContinentScreen({ state, dispatch }: Props) {
  const { t, l } = useI18n();
  const resume = levelToContinue(state);
  const playable = CONTINENTS.filter((c) => hasPlayableLevels(c.id));
  const open = (continent: ContinentId) => dispatch({ type: "openContinent", continent });

  return (
    <main className={`${page.page} ${styles.screen}`} data-testid="continents">
      <header className={`${page.compactHeader} ${styles.header}`} data-testid="welcome-hero">
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

      <div className={`${page.scroll} ${styles.scroll}`} data-testid="continents-scroll">
        <div className={`${page.content} ${styles.content}`}>
          <section aria-labelledby="continents-title" className={styles.layout}>
            {/* Between two small sun-rays, where the whole heading fits on one line beside them (see the CSS). */}
            <h2 id="continents-title" className={styles.title}>
              <span className={styles.ray} aria-hidden="true" />
              <span className={styles.titleText}>{t("continents.title")}</span>
              <span className={styles.ray} aria-hidden="true" />
            </h2>

            <div className={styles.mapColumn}>
              <div className={styles.mapArea} data-testid="world-map">
                {/* The land is for pointers only: each card below is what the keyboard and assistive technology use. */}
                <svg
                  className={styles.map}
                  viewBox={`0 0 ${WORLD_MAP_WIDTH} ${WORLD_MAP_HEIGHT}`}
                  aria-hidden="true"
                  focusable="false"
                >
                  <MapPaints />
                  <path d={WORLD_SPHERE} fill={`url(#${ID.water})`} />
                  <path className={styles.overlay} d={WORLD_SPHERE} fill={`url(#${ID.waterGrain})`} />
                  <path className={styles.graticule} d={WORLD_GRATICULE} />
                  {CONTEXT_REGIONS.map((region) => (
                    <path key={region} id={ID.region(region)} className={styles.region} data-region={region} d={WORLD_REGIONS[region]} />
                  ))}
                  {CONTINENTS.map((c) => (
                    <path
                      key={c.id}
                      id={ID.region(c.id)}
                      className={styles.region}
                      data-region={c.id}
                      data-status={hasPlayableLevels(c.id) ? "open" : "comingSoon"}
                      data-testid={`map-region-${c.id}`}
                      d={WORLD_REGIONS[c.id]}
                      onClick={hasPlayableLevels(c.id) ? () => open(c.id) : undefined}
                    />
                  ))}
                  {/* An atlas's light and grain on the land: still, drawn once, and never in a tap's way. */}
                  <rect className={styles.overlay} width={WORLD_MAP_WIDTH} height={WORLD_MAP_HEIGHT} fill={`url(#${ID.landGrain})`} clipPath={`url(#${ID.land})`} />
                  <rect className={styles.overlay} width={WORLD_MAP_WIDTH} height={WORLD_MAP_HEIGHT} fill={`url(#${ID.landLight})`} clipPath={`url(#${ID.land})`} />
                  <path className={styles.rim} d={WORLD_SPHERE} />
                </svg>
              </div>
            </div>

            <ul className={styles.labels} aria-labelledby="continents-title" data-testid="continent-list">
              {CONTINENTS.map((continent) => (
                <ContinentLabel key={continent.id} continent={continent} state={state} onOpen={open} />
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div className={`${page.actionBar} ${styles.actionBar}`} data-testid="continents-actions">
        {resume ? (
          <button
            type="button"
            className={`btn btn-primary btn-block ${page.mainAction} ${styles.mainAction}`}
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
            <span className={styles.mainActionLabel}>
              {t("welcome.continue")}
              <ArrowIcon />
            </span>
            <span className={page.mainActionLevel}>
              {l(getContinent(resume.continent).name)} · {t("level.number", { number: resume.number })}
              <span className={page.mainActionTitle}> · {l(resume.title)}</span>
            </span>
          </button>
        ) : (
          playable[0] && (
            <button
              type="button"
              className={`btn btn-primary btn-block ${styles.mainAction}`}
              data-primary
              data-testid={`explore-${playable[0].id}`}
              onClick={() => open(playable[0].id)}
            >
              {t("continents.explore", { continent: l(playable[0].nameInText) })}
              <ArrowIcon />
            </button>
          )
        )}
      </div>
    </main>
  );
}

/**
 * The map's paints: turquoise water, lighter at the centre; and, for an illustrated atlas's feel,
 * soft still blotches of light and shade on the water and the land, and light from above on the
 * land. Patterns and gradients only (no filters): drawn once, at any size, with nothing to download.
 */
function MapPaints() {
  // Soft blotches, each wholly inside its tile (one cut by the tile's edge would show a straight line).
  const blots: [number, number, number, string][] = [
    [40, 42, 36, ID.softLight],
    [128, 34, 26, ID.softShade],
    [104, 100, 34, ID.softLight],
    [26, 112, 22, ID.softShade],
    [158, 108, 20, ID.softShade],
  ];
  return (
    <defs>
      <radialGradient id={ID.water} cx="50%" cy="44%" r="64%">
        <stop offset="0" stopColor="#8fe1f1" />
        <stop offset="0.55" stopColor="#4cbbe0" />
        <stop offset="1" stopColor="#268bc4" />
      </radialGradient>
      <radialGradient id={ID.softLight}>
        <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={ID.softShade}>
        <stop offset="0" stopColor="#0b3a5c" stopOpacity="0.5" />
        <stop offset="1" stopColor="#0b3a5c" stopOpacity="0" />
      </radialGradient>
      <pattern id={ID.landGrain} width="180" height="140" patternUnits="userSpaceOnUse">
        {blots.map(([cx, cy, r, paint]) => (
          <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} fill={`url(#${paint})`} opacity={paint === ID.softLight ? 0.4 : 0.14} />
        ))}
      </pattern>
      <pattern id={ID.waterGrain} width="300" height="220" patternUnits="userSpaceOnUse">
        {blots.map(([cx, cy, r, paint]) => (
          <circle key={`${cx},${cy}`} cx={cx * 1.65} cy={cy * 1.55} r={r * 1.5} fill={`url(#${paint})`} opacity={paint === ID.softLight ? 0.22 : 0.1} />
        ))}
      </pattern>
      <linearGradient id={ID.landLight} x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#0b3a5c" stopOpacity="0.12" />
      </linearGradient>
      {/* All the land, from the paths drawn below (their shapes only). */}
      <clipPath id={ID.land}>
        {[...CONTEXT_REGIONS, ...CONTINENTS.map((c) => c.id)].map((region) => (
          <use key={region} href={`#${ID.region(region)}`} />
        ))}
      </clipPath>
    </defs>
  );
}

/** A category's land, from the world map, alone: decorative (its name is beside it). */
function Silhouette({ continent }: { continent: ContinentId }) {
  return (
    <svg className={styles.silhouette} viewBox={SILHOUETTE_VIEW[continent]} aria-hidden="true" focusable="false">
      <path d={WORLD_REGIONS[continent]} />
    </svg>
  );
}

/**
 * A continent's levels completed, from the permanent records: "Completed: 2/7" (the count kept on one
 * line) and a bar, read in full ("2 of 7 Europe levels completed"), on its card under its name.
 */
function ContinentProgress({ continent, state }: { continent: ContinentInfo; state: AppState }) {
  const { t, tp, l } = useI18n();
  const { total, completed } = continentProgress(state, continent.id);
  return (
    <div className={styles.progressArea} data-continent={continent.id} data-testid={`continent-${continent.id}-progress-area`}>
      <p className={styles.progress}>
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
 * A category's card. For a continent with levels: its silhouette, its name and an arrow as its one
 * button (described by its levels completed, shown under it), and its progress; a tap anywhere on the
 * card opens it too (the keyboard reaches the button alone). Otherwise a tile with its silhouette, its
 * name and "Coming soon" in words, with nothing to press or focus, and no lock: nothing promises when.
 */
function ContinentLabel({ continent, state, onOpen }: { continent: ContinentInfo; state: AppState; onOpen: (id: ContinentId) => void }) {
  const { t, tp, l } = useI18n();
  const { total, completed } = continentProgress(state, continent.id);
  const playable = hasPlayableLevels(continent.id);
  return (
    <li
      className={styles.label}
      data-continent={continent.id}
      data-status={playable ? "open" : "comingSoon"}
      data-testid={`continent-${continent.id}`}
      // The button's own click (a tap, Enter or Space) reaches here too: one handler for the whole card.
      onClick={playable ? () => onOpen(continent.id) : undefined}
    >
      <Silhouette continent={continent.id} />
      {playable ? (
        <>
          <button type="button" className={styles.open} aria-describedby={`continent-${continent.id}-progress`} data-testid={`map-label-${continent.id}`}>
            <span className={styles.name}>{l(continent.name)}</span>
            <span className={styles.arrowBadge}>
              <ArrowIcon />
            </span>
          </button>
          {/* Its description, as its progress says it. */}
          <span id={`continent-${continent.id}-progress`} hidden>
            {tp("continents.completed", total, { completed, continent: l(continent.nameOf) })}
          </span>
          <ContinentProgress continent={continent} state={state} />
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

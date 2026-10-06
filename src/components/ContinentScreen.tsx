"use client";

import type { CSSProperties, Dispatch } from "react";
import landArt from "@/assets/map/world/land.webp";
import scenery from "@/assets/map/world/scenery.webp";
import waterArt from "@/assets/map/world/water.webp";
import { CONTINENTS, getContinent, hasPlayableLevels, type ContinentId, type ContinentInfo } from "@/core/lessons";
import { continentProgress, continentStars, levelToContinue, type AppAction, type AppState } from "@/core/progress/appState";
import { WORLD_GRATICULE, WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH, WORLD_REGIONS, WORLD_SPHERE } from "@/data/geo/world-map";
import { BrandMark, LanguageToggle } from "./Header";
import { useI18n } from "./i18n";
import { StarTotal } from "./Stars";
import page from "./WelcomeScreen.module.css";
import styles from "./ContinentScreen.module.css";

interface Props {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

/** Drawn under the categories: geographic context, never selectable. */
const CONTEXT_REGIONS = ["oceania", "antarctica"] as const;
type Region = keyof typeof WORLD_REGIONS;

/** Ids of the map's coastlines (one world map on the page at a time), reused by the cards' silhouettes. */
const ID = {
  region: (region: Region) => `continents-region-${region}`,
  silhouette: (continent: ContinentId) => `continents-silhouette-${continent}`,
};

/**
 * The page's painted scenery (a supplied painting, prepared by scripts/prepare-world-art.mjs): the sea and
 * foliage at the foot of the page, as a CSS image (ContinentScreen.module.css). The map's own painted water
 * and land (scripts/generate-world-art.mjs) are drawn in the map itself, in its own units, so they stay
 * aligned with its coasts.
 */
const ART_VARS = {
  "--scenery": `url(${scenery.src})`,
} as CSSProperties;

/**
 * Each category's silhouette on its card: a crop of the map's own land (the same geometry, in map
 * units), around its main landmass. North America's takes in Greenland but not the far Aleutians (past
 * the map's edge, on its right); Europe's leaves out Svalbard and Franz Josef Land.
 */
const SILHOUETTE_VIEW: Record<ContinentId, string> = {
  europe: "396 31 267 124",
  asia: "533 15 474 273",
  africa: "417 142 198 209",
  "north-america": "-9 8 454 230",
  "south-america": "239 211 138 197",
};

/**
 * The home screen: a flat world map of the continents, then the categories as cards under it (or beside
 * it, when the screen is short and wide for its text: a phone held sideways, a desktop). A continent
 * with playable levels (Europe) opens its level selection, from its land or its card (its name is the
 * card's one button, for the keyboard and assistive technology); the others are tiles that say
 * "Coming soon" and do nothing. Oceania and Antarctica are drawn as context only. Europe's levels
 * completed ("Completed: 2/8") are shown once, on its card, never on the map. The main action, right
 * under the cards, resumes the most recently active unfinished level (Continue: "Europe · Level 3", with
 * the level's title too in its accessible name), or else opens Europe (Explore Europe); it scrolls with
 * the content. The page's frame (header, scrolling content) is the level selection's
 * (WelcomeScreen.module.css), in this screen's sky colours.
 */
export function ContinentScreen({ state, dispatch }: Props) {
  const { t, l } = useI18n();
  const resume = levelToContinue(state);
  const playable = CONTINENTS.filter((c) => hasPlayableLevels(c.id));
  const open = (continent: ContinentId) => dispatch({ type: "openContinent", continent });

  return (
    <main className={`${page.page} ${styles.screen}`} style={ART_VARS} data-testid="continents">
      {/* Decoration only, behind everything: the sea and foliage at the foot of the page. */}
      <div className={styles.scenery} aria-hidden="true" />
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
            <h2 id="continents-title" className={styles.title}>
              <span className={styles.titleText}>{t("continents.title")}</span>
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
                  {/* The painted water (a plain colour until it loads), and the straight lines of latitude and
                      longitude on it. */}
                  <path className={styles.water} d={WORLD_SPHERE} />
                  <image className={styles.art} href={waterArt.src} width={WORLD_MAP_WIDTH} height={WORLD_MAP_HEIGHT} preserveAspectRatio="none" />
                  <path className={styles.graticule} d={WORLD_GRATICULE} />
                  {/* The coasts: each land in its colour (until the painted land loads) with a light edge on the water. */}
                  {[...CONTEXT_REGIONS, ...CONTINENTS.map((c) => c.id)].map((region) => (
                    <path
                      key={region}
                      id={ID.region(region)}
                      className={styles.coast}
                      // Oceania and Antarctica are drawn once, here; the categories again, on top, for taps.
                      {...((CONTEXT_REGIONS as readonly string[]).includes(region) ? { "data-region": region } : { "data-coast": region })}
                      d={WORLD_REGIONS[region]}
                    />
                  ))}
                  {/* The painted land: each continent's colour, shaded by its real terrain. */}
                  <image className={styles.art} href={landArt.src} width={WORLD_MAP_WIDTH} height={WORLD_MAP_HEIGHT} preserveAspectRatio="none" />
                  {/* The categories' land, for taps (Europe's, the one that opens) and Europe's outline: unpainted
                      inside, so the painted land shows through. */}
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
                </svg>
              </div>
            </div>

            <ul className={styles.labels} aria-labelledby="continents-title" data-testid="continent-list">
              {CONTINENTS.map((continent) => (
                <ContinentLabel key={continent.id} continent={continent} state={state} onOpen={open} />
              ))}
            </ul>

            {/* The main action, right under the cards (not held to the foot of the screen): on a short screen,
                or with enlarged text, it scrolls with them. */}
            <div className={styles.action} data-testid="continents-actions">
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
                  {/* The continent and level, short, so the button stays low; the title is in its accessible name. */}
                  <span className={page.mainActionLevel}>
                    {l(getContinent(resume.continent).name)} · {t("level.number", { number: resume.number })}
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
          </section>
        </div>
      </div>
    </main>
  );
}

/**
 * A category's land, from the world map, alone: decorative (its name is beside it). Its outline in its colour
 * with a light edge, and the map's painted land over it, clipped to that land (the image is already loaded for
 * the map, and in the same units, so it lines up).
 */
function Silhouette({ continent }: { continent: ContinentId }) {
  return (
    <svg className={styles.silhouette} viewBox={SILHOUETTE_VIEW[continent]} aria-hidden="true" focusable="false">
      <clipPath id={ID.silhouette(continent)}>
        <use href={`#${ID.region(continent)}`} />
      </clipPath>
      <path d={WORLD_REGIONS[continent]} />
      <image
        className={styles.art}
        href={landArt.src}
        width={WORLD_MAP_WIDTH}
        height={WORLD_MAP_HEIGHT}
        preserveAspectRatio="none"
        clipPath={`url(#${ID.silhouette(continent)})`}
      />
    </svg>
  );
}

/**
 * A continent's levels completed, from the permanent records: "Completed: 2/8" (the count kept on one
 * line, beside a check) and a bar, read in full ("2 of 8 Europe levels completed"), on its card under
 * its name; under them, apart from the bar, its stars ("★ 17/24", StarTotal), which measure how
 * well the levels were played rather than how many.
 */
function ContinentProgress({ continent, state }: { continent: ContinentInfo; state: AppState }) {
  const { t, tp, l } = useI18n();
  const { total, completed } = continentProgress(state, continent.id);
  const stars = continentStars(state, continent.id);
  return (
    <div className={styles.progressArea} data-continent={continent.id} data-testid={`continent-${continent.id}-progress-area`}>
      <p className={styles.progress}>
        <span className={styles.progressCount} aria-hidden="true">
          <CheckIcon />
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
      <StarTotal earned={stars.earned} max={stars.max} continentOf={l(continent.nameOf)} id={`continent-${continent.id}-stars`} />
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
          <button type="button" className={styles.open} aria-describedby={`continent-${continent.id}-progress continent-${continent.id}-stars`} data-testid={`map-label-${continent.id}`}>
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

/** Levels completed: a check, as in the level selection's "all completed" message (the star is for stars). */
function CheckIcon() {
  return (
    <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
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

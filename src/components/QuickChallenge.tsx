"use client";

import { useId } from "react";
import { CHALLENGE_RULES } from "@/core/challenge/quickChallenge";
import landArt from "@/assets/map/world/land.webp";
import waterArt from "@/assets/map/world/water.webp";
import { WORLD_GRATICULE, WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH, WORLD_REGIONS } from "@/data/geo/world-map";
import { EUROPE_BORDERS } from "@/data/geo/europe-borders";
import { useI18n } from "./i18n";
import styles from "./QuickChallenge.module.css";

/** The challenge's rules as the card states them: the game's own (src/core/challenge/quickChallenge.ts). */
const CHALLENGE = { countries: CHALLENGE_RULES.questions, seconds: CHALLENGE_RULES.durationMs / 1000 } as const;

/**
 * The art's frame in the home screen's world map units (src/data/geo/world-map.ts): western, central and
 * northern Europe, from 20°W to 40°E and 35°N to 73°N, centred on Denmark and the North Sea, so European
 * Russia stays at its eastern edge. It fills the art's area and is cropped to it, never stretched: a wide
 * band (a phone's) shows all of its width and the latitudes around 54°N, a taller area all of its height
 * and the longitudes around 10°E.
 */
const EUROPE_VIEW = "414 47 167 106";

/** A latitude's height on the world map (equirectangular: 90°N at the top, the equator in the middle). */
const latitudeY = (latitude: number) => WORLD_MAP_HEIGHT / 2 - (latitude * WORLD_MAP_WIDTH) / 360;

/**
 * The home screen's timed challenge, above the lessons: an illustrated Europe beside (or, on a narrow
 * card, above) the question, its two rules as small tiles, and its button, which opens the challenge
 * (QuickChallengeScreen).
 */
export function QuickChallenge({ onPlay }: { onPlay: () => void }) {
  const { t, tp } = useI18n();
  // "You have just {time}.": the time is set apart in coral, the sentence's words around it as they are.
  const [before, after = ""] = t("challenge.time").split("{time}");
  return (
    <section className={styles.challenge} aria-labelledby="challenge-title" data-testid="quick-challenge">
      <div className={styles.card}>
        <ChallengeArt />
        <div className={styles.body}>
          <p className={styles.label}>
            <BoltIcon />
            {t("challenge.label")}
          </p>
          <h2 id="challenge-title" className={styles.title}>
            {t("challenge.title", { count: CHALLENGE.countries })}
          </h2>
          <p className={styles.time}>
            {before}
            <strong className={styles.seconds}>{tp("challenge.seconds", CHALLENGE.seconds)}</strong>
            {after}
          </p>
          <ul className={styles.facts}>
            <li className={styles.fact}>
              <FlagIcon />
              <span className={styles.factText}>
                <span className={styles.factValue}>{CHALLENGE.countries}</span> <span className={styles.factUnit}>{tp("challenge.countriesUnit", CHALLENGE.countries)}</span>
              </span>
            </li>
            <li className={styles.fact}>
              <ClockIcon />
              <span className={styles.factText}>
                <span className={styles.factValue}>{CHALLENGE.seconds}</span> <span className={styles.factUnit}>{tp("challenge.secondsUnit", CHALLENGE.seconds)}</span>
              </span>
            </li>
          </ul>
          <button type="button" className={`btn btn-primary ${styles.play}`} onClick={onPlay} data-testid="play-challenge">
            {t("challenge.play")}
            <ArrowIcon />
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * Europe as a small illustrated map: the world map's painted water and Europe's painted land, clipped to its
 * coast, with its countries' borders as faint light lines, the neighbouring land a quiet pale green and the
 * map's faint grid (the same images the world map below already loads). The borders' data stops at 62°N
 * (src/data/geo/europe-borders.ts), so they fade out from 61°N rather than ending in Scandinavia.
 * Decorative and static: hidden from assistive technology and never a tap's target.
 */
function ChallengeArt() {
  const id = useId();
  const [clip, fade, fadeMask] = [`${id}clip`, `${id}fade`, `${id}fadeMask`];
  return (
    <div className={styles.art} aria-hidden="true">
      <svg className={styles.artMap} viewBox={EUROPE_VIEW} preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <clipPath id={clip}>
            <path d={WORLD_REGIONS.europe} />
          </clipPath>
          <linearGradient id={fade} gradientUnits="userSpaceOnUse" x1="0" y1={latitudeY(64)} x2="0" y2={latitudeY(61)}>
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>
          <mask id={fadeMask} maskUnits="userSpaceOnUse" x="0" y="0" width={WORLD_MAP_WIDTH} height={WORLD_MAP_HEIGHT}>
            <rect width={WORLD_MAP_WIDTH} height={WORLD_MAP_HEIGHT} fill={`url(#${fade})`} />
          </mask>
        </defs>
        <image href={waterArt.src} width={WORLD_MAP_WIDTH} height={WORLD_MAP_HEIGHT} preserveAspectRatio="none" />
        <path className={styles.artGrid} d={WORLD_GRATICULE} />
        {(Object.keys(WORLD_REGIONS) as (keyof typeof WORLD_REGIONS)[])
          .filter((region) => region !== "europe")
          .map((region) => (
            <path key={region} className={styles.artLand} d={WORLD_REGIONS[region]} />
          ))}
        <path className={styles.artEurope} d={WORLD_REGIONS.europe} />
        <image href={landArt.src} width={WORLD_MAP_WIDTH} height={WORLD_MAP_HEIGHT} preserveAspectRatio="none" clipPath={`url(#${clip})`} />
        {/* Clipped to the painted coast, so a border never runs out into the sea. */}
        <g clipPath={`url(#${clip})`} mask={`url(#${fadeMask})`}>
          <path className={styles.artBorders} d={EUROPE_BORDERS} />
        </g>
      </svg>
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

function FlagIcon() {
  return (
    <svg className={styles.factIcon} width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 21V4m0 1h11l-2 4 2 4H5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className={styles.factIcon} width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className={styles.arrow} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

import { MAX_STARS } from "../lesson/rating";
import type { AppState } from "./appState";

/**
 * All the stars across Europe's lessons: the condition for the Quick Challenge's one-time +2 attempts
 * (../player/attempts.ts) and, later, the Europe Geography Master award («Եվրոպայի աշխարհագրության
 * գիտակ» պարգև), not built yet.
 *
 * The lessons are fixed: the 12 Europe levels as of October 2026, 36 stars in all. A Europe level added
 * later does not change who qualifies.
 *
 * Trust: stars live only on the player's device (storage.ts), so a snapshot is the device's own report.
 * The server checks its shape and that every lesson has all its stars, but cannot tell whether they were
 * earned or edited into local storage.
 *
 * Framework-independent: no React, DOM, storage or network.
 */
export const EUROPE_STAR_LESSONS = [
  "western-europe-1",
  "around-the-alps",
  "central-europe",
  "along-the-adriatic",
  "towards-greece",
  "baltic-journey",
  "iberian-journey",
  "eastern-europe",
  "heart-of-the-balkans",
  "nordic-countries",
  "across-the-channel",
  "russia-and-western-neighbours",
] as const;

export type EuropeStarLesson = (typeof EUROPE_STAR_LESSONS)[number];

export const EUROPE_STARS_TOTAL = EUROPE_STAR_LESSONS.length * MAX_STARS;

/** Each fixed lesson's best stars, 0 when it has none. */
export type EuropeStarsSnapshot = Readonly<Record<EuropeStarLesson, number>>;

/** The device's snapshot, from its saved lesson progress (left unchanged). */
export function europeStarsSnapshot(state: AppState): EuropeStarsSnapshot {
  return Object.fromEntries(EUROPE_STAR_LESSONS.map((id) => [id, state.levels[id]?.records.bestRating ?? 0])) as EuropeStarsSnapshot;
}

export function europeStarCount(snapshot: EuropeStarsSnapshot): number {
  return EUROPE_STAR_LESSONS.reduce((sum, id) => sum + snapshot[id], 0);
}

export function hasAllEuropeStars(snapshot: EuropeStarsSnapshot): boolean {
  return europeStarCount(snapshot) === EUROPE_STARS_TOTAL;
}

/**
 * A snapshot sent by a device, or null: exactly the fixed lessons, each a whole number of stars from 0 to
 * the maximum, nothing else.
 */
export function parseEuropeStarsSnapshot(value: unknown): EuropeStarsSnapshot | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (entries.length !== EUROPE_STAR_LESSONS.length) return null;
  const lessons: readonly string[] = EUROPE_STAR_LESSONS;
  for (const [id, stars] of entries) {
    if (!lessons.includes(id) || !Number.isInteger(stars) || (stars as number) < 0 || (stars as number) > MAX_STARS) return null;
  }
  return Object.fromEntries(EUROPE_STAR_LESSONS.map((id) => [id, (value as Record<string, number>)[id]])) as EuropeStarsSnapshot;
}

import type { Locale } from "../i18n/locales";
import { translate, translatePlural } from "../i18n/translate";
import type { ChallengeResult, EndReason } from "./quickChallenge";

/**
 * A Quick Challenge result as it is shared: the card's numbers and words, from a finished round's ChallengeResult.
 * Framework-independent (no React, DOM or canvas), so a native app can share the same summary and text; the web
 * draws it as an image in src/components/challenge/shareCard.ts. See docs/QUICK-CHALLENGE-SHARING.md.
 *
 * Only the score, the round's size and its time are shared: never progress, answers or anything about the player.
 */

/** AriMap's public home page (the owner's, 2026-10-16): the shared link and the address on the card. */
export const SITE_URL = "https://ari-map.vercel.app";

/** The address as printed on the card: no scheme, no trailing slash. */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

/**
 * A round's time in whole seconds, as the Results show it and the card states it: rounded to the nearest second
 * (half up), at least 1. A round that ran out of time used all of it (its elapsedMs is the whole duration: 60).
 */
export function roundSeconds(elapsedMs: number): number {
  return Math.max(1, Math.round(elapsedMs / 1000));
}

export interface ShareSummary {
  endReason: EndReason;
  /** Correct answers, out of `total` (a completed round can still have mistakes). */
  correct: number;
  total: number;
  seconds: number;
}

export function shareSummary(result: ChallengeResult): ShareSummary {
  return { endReason: result.endReason, correct: result.correct, total: result.total, seconds: roundSeconds(result.elapsedMs) };
}

/** The card's words in one language. */
export interface ShareText {
  appName: string;
  label: string;
  /** "12/15". */
  score: string;
  /** "12/15 countries · 60 seconds". */
  found: string;
  /** "Can you beat my score?" */
  beat: string;
  /** The address printed on the card. */
  host: string;
  /** The link shared or copied: the public home page. */
  url: string;
  /** Text sent with the image to a share target. */
  message: string;
  /** The image's description (its alt text). */
  alt: string;
  /** The downloaded or shared file's name. */
  fileName: string;
}

export function shareText(summary: ShareSummary, locale: Locale): ShareText {
  const score = `${summary.correct}/${summary.total}`;
  const found = translate(locale, "challengeShare.found", {
    score,
    time: translatePlural(locale, "challenge.seconds", summary.seconds),
  });
  const beat = translate(locale, "challengeShare.beat");
  return {
    appName: translate(locale, "app.name"),
    label: translate(locale, "challenge.label"),
    score,
    found,
    beat,
    host: SITE_HOST,
    url: SITE_URL,
    message: translate(locale, "challengeShare.message", { found, beat, url: SITE_URL }),
    alt: translate(locale, "challengeShare.alt", { found }),
    fileName: `arimap-quick-challenge-${summary.correct}-of-${summary.total}.png`,
  };
}

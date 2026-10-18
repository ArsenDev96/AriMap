import type { Locale } from "../i18n/locales";
import { translate, translatePlural } from "../i18n/translate";
import type { ChallengeResult, EndReason } from "./quickChallenge";

/**
 * A Quick Challenge result as it is shared: the card's numbers and words, from a finished round's ChallengeResult.
 * Framework-independent (no React, DOM or canvas), so a native app can share the same summary and text; the web
 * draws it as an image in src/components/challenge/shareCard.ts. See docs/QUICK-CHALLENGE-SHARING.md.
 *
 * Only the score, the round's size, its time and, if the player saved one, their display name (the same public name the
 * leaderboard shows) are shared: never progress, answers or anything else about the player.
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
  /** The player's saved display name (the leaderboard's), or null: the card then has no name. */
  displayName: string | null;
}

export function shareSummary(result: ChallengeResult, displayName: string | null = null): ShareSummary {
  return { endReason: result.endReason, correct: result.correct, total: result.total, seconds: roundSeconds(result.elapsedMs), displayName };
}

/** Per language: whether the card's title and caption are set in spaced capitals (ShareText's `capitals`). */
const SPACED_CAPITALS: Readonly<Record<Locale, boolean>> = { en: true, hy: false };

/** The card's words in one language. */
export interface ShareText {
  appName: string;
  label: string;
  /** "12/15". */
  score: string;
  /** The player's display name, by the score; null when they have none. */
  player: string | null;
  /** "12/15 countries · 60 seconds" (the share message and the image's description). */
  found: string;
  /** The card's title: "Europe Quick Challenge". */
  title: string;
  /** The card's caption by the score, which states the score already: "Countries found". */
  caption: string;
  /** The round's time, by the caption: "60 seconds". */
  time: string;
  /**
   * Whether the card sets its title and caption in spaced capitals ("EUROPE QUICK CHALLENGE"): English does; Armenian
   * keeps its own case, as long Armenian words in capitals read slowly (and its title then fits one line).
   */
  capitals: boolean;
  /** "Can you beat my score?" (the share message). */
  beat: string;
  /** The card's invitation, beside its QR code: "Your turn!" */
  turn: string;
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
  const time = translatePlural(locale, "challenge.seconds", summary.seconds);
  const found = translate(locale, "challengeShare.found", { score, time });
  const beat = translate(locale, "challengeShare.beat");
  return {
    appName: translate(locale, "app.name"),
    label: translate(locale, "challenge.label"),
    score,
    player: summary.displayName,
    found,
    title: translate(locale, "challengeShare.cardTitle"),
    caption: translate(locale, "challengeShare.caption"),
    time,
    capitals: SPACED_CAPITALS[locale],
    beat,
    turn: translate(locale, "challengeShare.turn"),
    host: SITE_HOST,
    url: SITE_URL,
    message: translate(locale, "challengeShare.message", { found, beat, url: SITE_URL }),
    alt: summary.displayName === null ? translate(locale, "challengeShare.alt", { found }) : translate(locale, "challengeShare.altNamed", { found, name: summary.displayName }),
    fileName: `arimap-quick-challenge-${summary.correct}-of-${summary.total}.png`,
  };
}

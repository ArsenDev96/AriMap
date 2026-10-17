"use client";

import Image from "next/image";
import { CHALLENGE_RULES } from "@/core/challenge/quickChallenge";
import { BACKEND_CONFIGURED } from "@/web/backend";
import { useI18n } from "./i18n";
import styles from "./QuickChallenge.module.css";

/** The challenge's rules as the card states them: the game's own (src/core/challenge/quickChallenge.ts). */
const CHALLENGE = { countries: CHALLENGE_RULES.questions, seconds: CHALLENGE_RULES.durationMs / 1000 } as const;

/**
 * Europe, illustrated: a painted banner (1983 × 793) that fades to white at its foot. Served resized by the image
 * service, at the card's width on a phone and about half of it beside the words on a wider card.
 */
const BANNER = "/images/challenge/europe-home-banner.png";

/** The home screen's Leaderboard button: focused again on returning from the leaderboard (ContinentScreen). */
export const HOME_LEADERBOARD_ID = "home-leaderboard";

/**
 * The home screen's timed challenge, above the lessons: an illustrated Europe beside (or, on a narrow
 * card, above) the question, its two rules as small tiles, and its button, which opens the challenge
 * (QuickChallengeScreen). Under it, smaller, the leaderboard (when this build has a backend), which opens its own
 * screen (LeaderboardScreen): it starts nothing, and returning puts focus back on this button (HOME_LEADERBOARD_ID).
 */
export function QuickChallenge({ onPlay, onLeaderboard }: { onPlay: () => void; onLeaderboard: () => void }) {
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
          {BACKEND_CONFIGURED && (
            <button id={HOME_LEADERBOARD_ID} type="button" className={`btn btn-secondary ${styles.leaderboard}`} onClick={onLeaderboard} data-testid="home-leaderboard">
              <TrophyIcon />
              {t("challenge.leaderboard")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * The banner: whole and at its own proportions across a narrow card's top, its white foot running into the card;
 * on a wider card, filling the card's right side, cropped round Europe (never stretched) and fading into the white
 * beside the words (QuickChallenge.module.css). Decorative and static: hidden from assistive technology and never a
 * tap's target.
 */
function ChallengeArt() {
  return (
    <div className={styles.art} aria-hidden="true">
      <Image src={BANNER} alt="" fill sizes="(min-width: 900px) 50vw, 100vw" loading="eager" className={styles.artImage} />
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

function TrophyIcon() {
  return (
    <svg className={styles.trophy} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7.5 4h9v4.5a4.5 4.5 0 0 1-9 0zM7.5 6H5a2.5 2.5 0 0 0 2.9 3.4M16.5 6H19a2.5 2.5 0 0 1-2.9 3.4M12 13v4M8.5 20.5h7M9.5 17h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

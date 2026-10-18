"use client";

import { useEffect, useRef, useState, type Dispatch } from "react";
import type { AppAction } from "@/core/progress/appState";
import { webBackend } from "@/web/backend";
import { LanguageToggle } from "../Header";
import { useI18n } from "../i18n";
import { Leaderboard } from "./Leaderboard";
import challenge from "./QuickChallengeScreen.module.css";
import styles from "./LeaderboardScreen.module.css";

/**
 * The leaderboard as a screen of its own, opened from the home screen (Game.tsx): the Quick Challenge's header (Home,
 * the screen's title "Leaderboard", the language switch) and the board (Leaderboard.tsx, without a title of its own) on
 * a card with room to read it. It only reads the board: it starts no round and spends no attempt (a browser with no
 * session yet signs in anonymously first, as the challenge does). Home, the board's Back and the browser's Back all
 * return to the home screen as it was.
 */
export function LeaderboardScreen({ dispatch, onBack }: { dispatch: Dispatch<AppAction>; onBack: () => void }) {
  const { t } = useI18n();
  const [backend] = useState(webBackend);
  // The screen's title, so a screen reader starts there.
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className={challenge.screen} data-testid="leaderboard-screen">
      <header className={challenge.header}>
        <button type="button" className={challenge.home} onClick={onBack} aria-label={t("challengeGame.backLabel")} data-testid="leaderboard-home">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{t("nav.home")}</span>
        </button>
        <h1 className={`${challenge.title} ${styles.title}`} ref={titleRef} tabIndex={-1}>
          <svg className={challenge.bolt} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M13.5 2 4.5 13.5h6L9.5 22l9-11.5h-6z" fill="currentColor" stroke="#c07d05" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          {t("challenge.leaderboard")}
        </h1>
        <LanguageToggle dispatch={dispatch} />
      </header>
      <main className={styles.main}>
        <div className={styles.card}>
          {backend ? (
            <Leaderboard backend={backend} onBack={onBack} heading={false} />
          ) : (
            <p className={challenge.error} role="alert">
              {t("challengeGame.unavailable")}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

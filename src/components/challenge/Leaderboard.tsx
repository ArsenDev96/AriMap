"use client";

import { useEffect, useRef, useState } from "react";
import { leaderboardSeconds, type Leaderboard as Board, type LeaderboardEntry } from "@/core/challenge/leaderboard";
import type { Backend } from "@/web/backend";
import { useI18n } from "../i18n";
import styles from "./QuickChallengeScreen.module.css";

type Load = { state: "loading" } | { state: "loaded"; board: Board } | { state: "failed" };

/**
 * The all-time leaderboard (src/core/challenge/leaderboard.ts), read from the server each time it opens: the top 50
 * named players, then the player's own place if it is further down. The player's row is the one the server marks as
 * theirs from their session, never one found by name. Only reads: no attempt is spent. `heading`: its own title (and
 * focus on it as it opens), left out where the screen around it already has one (LeaderboardScreen).
 */
export function Leaderboard({ backend, onBack, heading = true }: { backend: Backend; onBack: () => void; heading?: boolean }) {
  const { t } = useI18n();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (heading) titleRef.current?.focus({ preventScroll: true });
  }, [heading]);

  useEffect(() => {
    let cancelled = false;
    backend.leaderboard().then(
      (board) => {
        if (!cancelled) setLoad({ state: "loaded", board });
      },
      () => {
        if (!cancelled) setLoad({ state: "failed" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [backend, attempt]);

  const board = load.state === "loaded" ? load.board : null;
  return (
    <div className={styles.leaderboard} data-testid="challenge-leaderboard" data-state={load.state}>
      {heading && (
        <h2 className={styles.resultTitle} ref={titleRef} tabIndex={-1}>
          {t("challengeLeaderboard.title")}
        </h2>
      )}
      <p className={styles.text}>{t("challengeLeaderboard.text")}</p>

      {load.state === "loading" && (
        <p className={styles.text} role="status">
          {t("challengeLeaderboard.loading")}
        </p>
      )}
      {load.state === "failed" && (
        <>
          <p className={styles.error} role="alert">
            {t("challengeLeaderboard.failed")}
          </p>
          <button
            type="button"
            className={`btn btn-secondary ${styles.wide}`}
            onClick={() => {
              setLoad({ state: "loading" });
              setAttempt((n) => n + 1);
            }}
            data-testid="challenge-leaderboard-retry"
          >
            {t("challengeGame.retry")}
          </button>
        </>
      )}
      {board && board.entries.length === 0 && (
        <p className={styles.text} data-testid="challenge-leaderboard-empty">
          {t("challengeLeaderboard.empty")}
        </p>
      )}
      {board && board.entries.length > 0 && (
        <table className={styles.board} data-testid="challenge-leaderboard-table">
          <thead>
            <tr>
              <th scope="col">{t("challengeLeaderboard.rank")}</th>
              <th scope="col">{t("challengeLeaderboard.name")}</th>
              <th scope="col">{t("challengeLeaderboard.score")}</th>
              <th scope="col">{t("challengeLeaderboard.time")}</th>
            </tr>
          </thead>
          <tbody>
            {board.entries.map((entry, i) => (
              <Row key={i} entry={entry} />
            ))}
            {board.own && (
              <>
                <tr className={styles.boardGap}>
                  <td colSpan={4}>{t("challengeLeaderboard.ownTitle")}</td>
                </tr>
                <Row entry={board.own} />
              </>
            )}
          </tbody>
        </table>
      )}
      {board?.privateBest && <p className={styles.notice}>{t("challengeLeaderboard.privateBest")}</p>}

      <button type="button" className={`btn btn-primary ${styles.wide}`} onClick={onBack} data-testid="challenge-leaderboard-back">
        {t("challengeLeaderboard.back")}
      </button>
    </div>
  );
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  const { t } = useI18n();
  return (
    <tr data-you={entry.isYou ? "" : undefined} aria-current={entry.isYou ? "true" : undefined}>
      <td>{entry.rank}</td>
      <th scope="row">
        <bdi>{entry.displayName}</bdi>
        {entry.isYou && <span className={styles.youTag}>{t("challengeLeaderboard.you")}</span>}
      </th>
      <td>
        {entry.score}/{entry.total}
      </td>
      <td>{t("challengeLeaderboard.seconds", { seconds: leaderboardSeconds(entry.elapsedMs) })}</td>
    </tr>
  );
}

"use client";

import { useEffect, useRef, type Dispatch } from "react";
import type { LevelInfo } from "@/core/lessons";
import type { AppAction } from "@/core/progress/appState";
import { useI18n } from "./i18n";
import styles from "./WelcomeScreen.module.css";

/** A level to start over (or, once completed, to play again), waiting for the player to confirm. */
export type RestartRequest = { level: LevelInfo; mode: "startOver" | "playAgain" };

/**
 * Starting a level over (or playing it again) discards the player's place in it, so it asks first,
 * naming the level; keeping it is the default. Confirming restarts only that level at Discover
 * (restartLevel in appState.ts): its records, its completion, the levels it unlocked and every
 * other level stay. Used by the level selection's cards and by Results' Play again.
 */
export function RestartDialog({ request, onClose, dispatch }: { request: RestartRequest | null; onClose: () => void; dispatch: Dispatch<AppAction> }) {
  const { t, l } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (request && dialog && !dialog.open) dialog.showModal();
  }, [request]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="start-over-title"
      aria-describedby="start-over-text"
      data-testid="start-over-dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      {request && (
        <form method="dialog" className={styles.dialogBody}>
          <h2 id="start-over-title" className={styles.dialogTitle}>
            {t(request.mode === "playAgain" ? "welcome.playAgainTitle" : "welcome.startOverTitle", { level: l(request.level.title) })}
          </h2>
          <p id="start-over-text">{t(request.mode === "playAgain" ? "welcome.playAgainText" : "welcome.startOverText")}</p>
          <div className={styles.dialogActions}>
            <button type="submit" className="btn btn-primary btn-block" autoFocus>
              {t(request.mode === "playAgain" ? "welcome.playAgainKeep" : "welcome.startOverKeep")}
            </button>
            <button type="submit" className="btn btn-secondary btn-block" onClick={() => dispatch({ type: "restartLevel", levelId: request.level.id })}>
              {t(request.mode === "playAgain" ? "welcome.playAgain" : "welcome.startOver")}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

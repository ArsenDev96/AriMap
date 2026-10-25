import type { LevelInfo } from "@/core/lessons";
import { hasSavedResults, hasUnfinishedAttempt, levelStatus, type AppState } from "@/core/progress/appState";

/** What a level card's button does: open the level as it is, or ask first and then start it over. */
export type CardAction =
  | { kind: "open"; label: "welcome.start" | "welcome.continue" | "welcome.playAgain" | "welcome.viewResults" }
  /** Asks first (the website's RestartDialog), then restartLevel. */
  | { kind: "restart"; mode: "startOver" | "playAgain" };

/**
 * A level card's actions, by the website's rules (src/components/WelcomeScreen.tsx, LevelCard):
 * - an attempt under way: Continue, and beside it Start over (never completed) or Play again (completed), which ask;
 * - a finished attempt with its Results saved: View results (opens them, changing nothing), and Play again, which asks;
 * - a finished attempt without them: Play again, which asks; a completion record alone (no attempt): Play again at once;
 * - otherwise Start. Locked and coming-soon levels have none.
 */
export function cardActions(state: AppState, level: LevelInfo): { main: CardAction; other: CardAction | null } | null {
  const status = levelStatus(state, level);
  if (status.kind === "comingSoon" || status.kind === "locked") return null;
  const completed = status.kind === "completed";
  const started = state.levels[level.id]?.started === true;
  const resumable = hasUnfinishedAttempt(state, level.id);
  if (completed && hasSavedResults(state, level.id)) {
    return { main: { kind: "open", label: "welcome.viewResults" }, other: { kind: "restart", mode: "playAgain" } };
  }
  if (resumable) {
    return { main: { kind: "open", label: "welcome.continue" }, other: { kind: "restart", mode: completed ? "playAgain" : "startOver" } };
  }
  if (completed) return { main: started ? { kind: "restart", mode: "playAgain" } : { kind: "open", label: "welcome.playAgain" }, other: null };
  return { main: { kind: "open", label: "welcome.start" }, other: null };
}

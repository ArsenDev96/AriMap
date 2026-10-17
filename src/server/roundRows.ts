import "server-only";
import type { ServerRound } from "@/core/challenge/serverRound";

/** A round as the database reports it (round_view in supabase/migrations/20261018120000_challenge_rounds.sql). */
export interface RoundRow {
  id: string;
  questions: string[];
  started_at_ms: number;
  deadline_ms: number;
  duration_ms: number;
  grace_ms: number;
  settle_ms: number;
  feedback_ms: number;
  status: "playing" | "finished";
  end_reason: "completed" | "time_up" | null;
  score: number | null;
  elapsed_ms: number | null;
  answers: { index: number; country: string | null; outcome: "correct" | "wrong" | "skipped"; elapsed_ms: number; voided: boolean }[];
}

export function toRound(row: RoundRow): ServerRound {
  return {
    id: row.id,
    questions: row.questions,
    startedAt: Number(row.started_at_ms),
    deadline: Number(row.deadline_ms),
    durationMs: row.duration_ms,
    graceMs: row.grace_ms,
    settleMs: row.settle_ms,
    feedbackMs: row.feedback_ms,
    status: row.status,
    endReason: row.end_reason === "time_up" ? "timeUp" : row.end_reason,
    score: row.score,
    elapsedMs: row.elapsed_ms,
    answers: row.answers.map((a) => ({ index: a.index, country: a.country, outcome: a.outcome, elapsedMs: Number(a.elapsed_ms), voided: a.voided })),
  };
}

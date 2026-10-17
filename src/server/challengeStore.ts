import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinishRoundResult, StartRoundResult, SubmitAnswersResult } from "@/core/challenge/api";
import { CHALLENGE_RULES, createChallenge } from "@/core/challenge/quickChallenge";
import { SERVER_ROUND_RULES, type AnswerReceipt, type QueuedAnswer } from "@/core/challenge/serverRound";
import { call, toState, type StateRow } from "./playerStore";
import type { DbClockRow, RequestClock } from "./requestClock";
import { toRound, type RoundRow } from "./roundRows";

/**
 * The round functions of the database (supabase/migrations/20261018120000_challenge_rounds.sql, timed as
 * 20261020120000_database_clock.sql has them), each one transaction, for a player id taken from a verified session
 * (playerRoute.ts). Rounds are timed on the database's clock alone: a round starts when its start request's token
 * was verified, and every answer of a request counts as received when the request arrived here, before its token was
 * checked; both told to the database as how long ago, measured here on the monotonic clock (requestClock.ts).
 */

/** Uniform in [0, 1) from the platform's cryptographic generator: the questions are drawn by the server. */
function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

/** Starts a round (spending one attempt) or returns the one under way; the questions are drawn only for a new round. */
export async function startRound(db: SupabaseClient, playerId: string, requestId: string, clock: RequestClock): Promise<StartRoundResult> {
  const fb = CHALLENGE_RULES.feedbackMs;
  if (fb.correct !== fb.wrong || fb.correct !== fb.skipped) throw new Error("The server's rounds need one feedback time for every outcome");
  const questions = createChallenge(secureRandom).questions;
  const row = await call<
    { ok: true; reused: boolean; round: RoundRow; state: StateRow } | { ok: false; problem: "no_attempts"; state: StateRow }
  >(
    db,
    "start_round",
    {
      p_player: playerId,
      p_request_id: requestId,
      p_questions: questions,
      p_duration_ms: CHALLENGE_RULES.durationMs,
      p_grace_ms: SERVER_ROUND_RULES.graceMs,
      p_settle_ms: SERVER_ROUND_RULES.settleMs,
      p_feedback_ms: fb.correct,
      p_since_verified_ms: clock.sinceVerifiedMs(),
    },
    clock,
  );
  const state = toState(row.state, clock);
  if (!row.ok) return { ok: false, problem: "noAttempts", state };
  return { ok: true, reused: row.reused, round: toRound(row.round), state, serverTime: state.serverTime };
}

const RECEIPT: Readonly<Record<string, AnswerReceipt["status"]>> = {
  accepted: "accepted",
  duplicate: "duplicate",
  conflict: "conflict",
  out_of_order: "outOfOrder",
  late: "late",
};

export async function submitAnswers(db: SupabaseClient, playerId: string, roundId: string, answers: readonly QueuedAnswer[], clock: RequestClock): Promise<SubmitAnswersResult> {
  const row = await call<
    | { ok: true; receipts: { index: number; status: string; outcome?: AnswerReceipt["outcome"]; voided?: boolean }[]; round: RoundRow; clock: DbClockRow }
    | { ok: false; problem: "not_found" }
  >(
    db,
    "submit_answers",
    {
      p_player: playerId,
      p_round: roundId,
      p_answers: answers.map((a) => ({ index: a.index, country: a.country, at_ms: a.atMs })),
      p_waited_ms: clock.waitedMs(),
    },
    clock,
  );
  if (!row.ok) return { ok: false, problem: "notFound" };
  const receipts = row.receipts.map((r): AnswerReceipt => {
    const status = RECEIPT[r.status];
    if (!status) throw new Error(`Unknown answer receipt: ${r.status}`);
    return { index: r.index, status, ...(r.outcome ? { outcome: r.outcome } : {}), ...(r.voided ? { voided: true } : {}) };
  });
  return { ok: true, receipts, round: toRound(row.round), serverTime: clock.serverTime() };
}

export async function finishRound(db: SupabaseClient, playerId: string, roundId: string, clock: RequestClock): Promise<FinishRoundResult> {
  const row = await call<{ ok: true; round: RoundRow; clock: DbClockRow } | { ok: false; problem: "not_found" }>(
    db,
    "finish_round",
    { p_player: playerId, p_round: roundId },
    clock,
  );
  if (!row.ok) return { ok: false, problem: "notFound" };
  return { ok: true, round: toRound(row.round), serverTime: clock.serverTime() };
}

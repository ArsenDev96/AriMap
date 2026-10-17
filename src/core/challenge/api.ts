import type { PlayerState } from "../player/api";
import type { AnswerReceipt, QueuedAnswer, RequestTiming, ServerRound, ServerTime } from "./serverRound";

/**
 * The Quick Challenge's server rounds, as the app asks for them: the same for the web and a future native app (the
 * web's implementation: src/web/backend.ts; the server's routes: src/app/api/challenge). Every reply carries the
 * server's times for its request on the database's clock (`serverTime`), which let the device place the round's deadline on its own
 * clock (serverRound.ts, clockOffset).
 *
 * Errors (no backend, no connection, a refused session, a server fault) are thrown as PlayerServiceError.
 *
 * Framework-independent: no React, DOM, storage or network.
 */

export type StartRoundResult =
  /** `reused`: the round already under way (the same press retried, a double press, another tab): nothing spent. */
  | { ok: true; round: ServerRound; reused: boolean; state: PlayerState; serverTime: ServerTime }
  | { ok: false; problem: "noAttempts"; state: PlayerState };

export type SubmitAnswersResult =
  | { ok: true; receipts: readonly AnswerReceipt[]; round: ServerRound; serverTime: ServerTime }
  | { ok: false; problem: "notFound" };

export type FinishRoundResult = { ok: true; round: ServerRound; serverTime: ServerTime } | { ok: false; problem: "notFound" };

export interface ChallengeService {
  /**
   * Starts a round, spending one attempt, or returns the round under way. `requestId` names one press of Start: send
   * the same id again to retry it. `timing`, if given, is filled in with the device's times for the request answered.
   */
  startRound(requestId: string, timing?: RequestTiming): Promise<StartRoundResult>;
  /** Sends every answer not yet decided on, in order (serverRound.ts, AnswerSync). Safe to repeat. */
  submitAnswers(roundId: string, answers: readonly QueuedAnswer[]): Promise<SubmitAnswersResult>;
  /** The round, ended first if its time has run out: its confirmed result once finished. Safe to repeat. */
  finishRound(roundId: string): Promise<FinishRoundResult>;
}

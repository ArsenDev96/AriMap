import type { CountryId } from "../content/types";
import {
  answer,
  CHALLENGE_POOL,
  CHALLENGE_RULES,
  challengeResult,
  type AnswerOutcome,
  type AnswerRecord,
  type ChallengeResult,
  type ChallengeRound,
  type ChallengeRules,
  type EndReason,
} from "./quickChallenge";

/**
 * The Quick Challenge as the server runs it (supabase/migrations/20261018120000_challenge_rounds.sql), and how a
 * device plays along. The server draws the questions, starts the one clock, receives each answer as it is given,
 * scores it against its own question, and ends the round: its result is the confirmed one. The device plays the
 * same round with the same rules (quickChallenge.ts), so every tap has its feedback at once, and sends its answers
 * in the background (AnswerSync); what it shows before the server confirms is provisional.
 *
 * Framework-independent: no React, DOM, storage, network or timers.
 */

/**
 * The server's own rules for a round, stored on each round as it starts. The allowance: an answer arriving up to
 * this long after the deadline still counts, for the time it spent on the network. A proposed default, not a proven
 * fairness guarantee: a slow connection still costs a player some of the round's time (docs/PLAYER-BACKEND.md).
 */
export const SERVER_ROUND_RULES = {
  graceMs: 1000,
  /**
   * How long after the deadline and its allowance a round stays open to requests that arrived in time but are still
   * being checked (the token, the database). The database ends a round under way only once this has passed too; it
   * never extends what counts as in time.
   */
  settleMs: 5000,
} as const;

/**
 * The server's times for one request, on the database's clock (the one that sets deadlines and times answers), in
 * milliseconds since 1970: when it reached the app's server (before its token was checked or the database called) and
 * when the reply left. Answers are timed by their arrival; the two together place the server's clock on the device's
 * (clockOffset), so the countdown shown and the deadline stored are on the same clock.
 */
export interface ServerTime {
  receivedAt: number;
  respondedAt: number;
}

/** An answer as the server received it. `elapsedMs`: from the round's start to its arrival, on the database's clock. */
export interface ServerAnswer {
  index: number;
  country: CountryId | null;
  outcome: AnswerOutcome;
  elapsedMs: number;
  /** It arrived sooner after the start than its question could have been reached: kept as skipped, never counted. */
  voided: boolean;
}

export interface ServerRound {
  id: string;
  questions: readonly CountryId[];
  /** On the database's clock, in milliseconds since 1970. The deadline is the one that counts. */
  startedAt: number;
  deadline: number;
  durationMs: number;
  graceMs: number;
  /** After the deadline and the allowance, how long until the server ends the round if nothing else has. */
  settleMs: number;
  feedbackMs: number;
  status: "playing" | "finished";
  /** Once finished: why, the score and the time (the whole duration when the time ran out). */
  endReason: EndReason | null;
  score: number | null;
  elapsedMs: number | null;
  answers: readonly ServerAnswer[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isOutcome = (v: unknown): v is AnswerOutcome => v === "correct" || v === "wrong" || v === "skipped";

/** A round as the app's server sends it, or null when it is not one. */
export function parseServerRound(v: unknown): ServerRound | null {
  if (!isObj(v) || typeof v.id !== "string" || !Array.isArray(v.questions) || !Array.isArray(v.answers)) return null;
  if (!v.questions.every((q) => typeof q === "string")) return null;
  for (const k of ["startedAt", "deadline", "durationMs", "graceMs", "settleMs", "feedbackMs"]) if (!isInt(v[k])) return null;
  if (v.status !== "playing" && v.status !== "finished") return null;
  const finished = v.status === "finished";
  if (finished !== (v.endReason === "completed" || v.endReason === "timeUp")) return null;
  if (finished !== isInt(v.score) || finished !== isInt(v.elapsedMs)) return null;
  const questions = v.questions as CountryId[];
  const answers: ServerAnswer[] = [];
  for (const a of v.answers) {
    if (!isObj(a) || !isInt(a.index) || a.index !== answers.length || a.index >= questions.length) return null;
    if (!(a.country === null || typeof a.country === "string") || !isOutcome(a.outcome) || !isInt(a.elapsedMs) || typeof a.voided !== "boolean") return null;
    answers.push({ index: a.index, country: a.country, outcome: a.outcome, elapsedMs: a.elapsedMs, voided: a.voided });
  }
  return {
    id: v.id,
    questions,
    startedAt: v.startedAt as number,
    deadline: v.deadline as number,
    durationMs: v.durationMs as number,
    graceMs: v.graceMs as number,
    settleMs: v.settleMs as number,
    feedbackMs: v.feedbackMs as number,
    status: v.status,
    endReason: finished ? (v.endReason as EndReason) : null,
    score: finished ? (v.score as number) : null,
    elapsedMs: finished ? (v.elapsedMs as number) : null,
    answers,
  };
}

// --- The one clock ------------------------------------------------------------------------------------------

/**
 * The device's clock less the server's, from one request: sent at `sentAt` and its reply received at `receivedAt`
 * (both on the device's clock), with the server's own times for it. As NTP does: the network is taken to take as long
 * each way, and the server's time between arrival and reply (checking the token, the database) is left out, so it
 * never moves the deadline the device shows. The server's deadline, on the device's clock, is `deadline + offset`.
 */
export function clockOffset(sentAt: number, receivedAt: number, server: ServerTime): number {
  return (sentAt - server.receivedAt + (receivedAt - server.respondedAt)) / 2;
}

/**
 * A service call's own times on the device's `clock`, filled in by the call (src/web/backend.ts): when the request
 * whose reply it returned was sent, taken just before that fetch (after the session was read or refreshed, and afresh
 * for a retry), and when that reply arrived. Null until a request has been answered.
 */
export interface RequestTiming {
  readonly clock: () => number;
  sentAt: number | null;
  receivedAt: number | null;
}

export function requestTiming(clock: () => number): RequestTiming {
  return { clock, sentAt: null, receivedAt: null };
}

/** clockOffset from a call's RequestTiming and its reply's serverTime. */
export function timedClockOffset(timing: RequestTiming, server: ServerTime): number {
  if (timing.sentAt === null || timing.receivedAt === null) throw new Error("The call was not timed");
  return clockOffset(timing.sentAt, timing.receivedAt, server);
}

export function isServerTime(v: unknown): v is ServerTime {
  return isObj(v) && isInt(v.receivedAt) && isInt(v.respondedAt) && v.respondedAt >= v.receivedAt;
}

// --- Playing the server's round on the device ----------------------------------------------------------------

function rulesOf(server: ServerRound): ChallengeRules {
  const fb = server.feedbackMs;
  return { ...CHALLENGE_RULES, questions: server.questions.length, durationMs: server.durationMs, feedbackMs: { correct: fb, wrong: fb, skipped: fb } };
}

function answerRecord(server: ServerRound, a: ServerAnswer): AnswerRecord {
  return {
    index: a.index,
    target: server.questions[a.index],
    outcome: a.outcome,
    ...(a.outcome === "wrong" && a.country ? { chosen: a.country } : {}),
    atMs: Math.min(a.elapsedMs, server.durationMs),
  };
}

/**
 * The server's round as the device plays it (quickChallenge.ts): its questions, its deadline on the device's clock
 * (`offset`, from clockOffset), and the answers the server has, the next question being the first it has not. A
 * finished round is finished here too, timed as the server timed it.
 */
export function localRoundOf(server: ServerRound, offset: number): ChallengeRound {
  const rules = rulesOf(server);
  const deadline = server.deadline + offset;
  const startedAt = deadline - rules.durationMs;
  const answers = server.answers.map((a) => answerRecord(server, a));
  const round: ChallengeRound = {
    rules,
    pool: CHALLENGE_POOL,
    questions: server.questions,
    status: "playing",
    startedAt,
    deadline,
    index: Math.min(answers.length, server.questions.length - 1),
    answers,
    feedback: null,
    endReason: null,
    endedAt: null,
  };
  if (server.status === "finished") return { ...round, status: "finished", endReason: server.endReason, endedAt: startedAt + server.elapsedMs! };
  return round;
}

/** The confirmed result: the server's finished round, scored and timed by the server. Null until it has finished. */
export function serverResult(server: ServerRound): ChallengeResult | null {
  return server.status === "finished" ? challengeResult(localRoundOf(server, 0)) : null;
}

/** Answers the device gave that the server did not count (they arrived after the round had ended). */
export function uncountedAnswers(local: ChallengeRound, server: ServerRound): number {
  return local.answers.filter((a) => !server.answers.some((s) => s.index === a.index)).length;
}

// --- Sending answers ---------------------------------------------------------------------------------------------

/** An answer as the device gave it: `atMs` from the round's start on the device's clock. */
export interface QueuedAnswer {
  index: number;
  country: CountryId | null;
  atMs: number;
}

export type ReceiptStatus = "accepted" | "duplicate" | "conflict" | "outOfOrder" | "late";

/** The server's word on one answer. */
export interface AnswerReceipt {
  index: number;
  status: ReceiptStatus;
  /** For accepted, duplicate and conflict: the outcome the server recorded. */
  outcome?: AnswerOutcome;
  voided?: boolean;
}

const RECEIPT_STATUSES: readonly ReceiptStatus[] = ["accepted", "duplicate", "conflict", "outOfOrder", "late"];

export function parseReceipt(v: unknown): AnswerReceipt | null {
  if (!isObj(v) || !isInt(v.index) || !RECEIPT_STATUSES.includes(v.status as ReceiptStatus)) return null;
  if (v.outcome !== undefined && !isOutcome(v.outcome)) return null;
  return { index: v.index, status: v.status as ReceiptStatus, ...(v.outcome ? { outcome: v.outcome as AnswerOutcome } : {}), ...(v.voided === true ? { voided: true } : {}) };
}

/**
 * The answers given on the device that the server has not yet decided on, in order. Every request sends all of them
 * (`pendingAnswers`): a retry, a request overtaking another, or answers queued while offline all arrive as the
 * same ordered list, and the server takes each once (a repeat is a "duplicate"). So the device never waits for one
 * answer's reply before sending the next, and nothing reaches the server out of order.
 *
 * The 400 ms rhythm, enforced on the server's clock alone: question n (from 0) can not arrive sooner than n feedback
 * gaps after the round's start, since each question shows only once the last answer's feedback has ended. Network
 * delay only makes answers later, so that bound never refuses an honest answer, and answers queued while offline and
 * arriving together are accepted in order, each still within the deadline and its allowance (the round's time is not
 * given back). The trade-off: the gap between two answers arriving together can not be enforced, so a device may
 * send several at once as soon as its time allows. The device's own times (atMs) prove nothing and decide nothing;
 * the server keeps them, flagging those that do not fit, for review.
 */
export interface AnswerSync {
  roundId: string;
  queue: readonly QueuedAnswer[];
}

export function createAnswerSync(roundId: string): AnswerSync {
  return { roundId, queue: [] };
}

export function queueAnswer(sync: AnswerSync, answer: QueuedAnswer): AnswerSync {
  if (sync.queue.some((q) => q.index === answer.index)) return sync;
  return { ...sync, queue: [...sync.queue, answer].sort((a, b) => a.index - b.index) };
}

export function pendingAnswers(sync: AnswerSync): readonly QueuedAnswer[] {
  return sync.queue;
}

/**
 * The queue after the server's receipts: every answer it has decided on (counted, repeated, refused) leaves the
 * queue; the rest stay. `resync`: the server's round is not the device's (another tab answered first, an answer
 * scored otherwise, or the device is behind), so the device plays on from the server's round with its own undecided
 * answers on top (replayQueued). The server's first accepted answer to each question stands.
 */
export function settleAnswers(sync: AnswerSync, receipts: readonly AnswerReceipt[], local: ChallengeRound): { sync: AnswerSync; resync: boolean } {
  const decided = new Set(receipts.map((r) => r.index));
  const resync = receipts.some((r) => {
    if (r.status === "conflict" || r.status === "outOfOrder") return true;
    // The server scored an answer otherwise than the device (it voided it, say): the server's round stands.
    const mine = local.answers.find((a) => a.index === r.index);
    return (r.status === "accepted" || r.status === "duplicate") && mine !== undefined && r.outcome !== mine.outcome;
  });
  return { sync: { ...sync, queue: sync.queue.filter((q) => !decided.has(q.index)) }, resync };
}

/**
 * Undecided answers played on top of a round (the server's, from localRoundOf): those that follow on from the
 * round's own answers, in order, at the device's times. `kept` are those applied; the first that does not follow
 * on (its question already answered on the server, or one missing before it) ends the replay, and it and the rest
 * are dropped: they could never be accepted.
 */
export function replayQueued(round: ChallengeRound, queue: readonly QueuedAnswer[]): { round: ChallengeRound; kept: QueuedAnswer[] } {
  let current = round;
  const kept: QueuedAnswer[] = [];
  for (const q of [...queue].sort((a, b) => a.index - b.index)) {
    if (q.index < round.answers.length) continue;
    const next = answer(current, q.index, q.country, current.startedAt! + q.atMs);
    if (next.result === "rejected") break;
    current = next.round;
    kept.push(q);
  }
  return { round: current, kept };
}

/**
 * One queue from several kept by this browser for the same round (tabs, and pages before a refresh): for each
 * question, `own`'s answer first, otherwise the earliest given. Which of two different answers counts is the
 * server's to decide: the first it receives.
 */
export function mergeQueues(own: readonly QueuedAnswer[], others: readonly (readonly QueuedAnswer[])[]): QueuedAnswer[] {
  const byIndex = new Map<number, QueuedAnswer>();
  for (const q of own) byIndex.set(q.index, q);
  for (const q of others.flat().sort((a, b) => a.atMs - b.atMs)) if (!byIndex.has(q.index)) byIndex.set(q.index, q);
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

// --- Kept on the device across a refresh ---------------------------------------------------------------------

/**
 * What a page keeps of its round, apart from lesson progress: the round's id (so a refresh comes back to it, or to its
 * confirmed result) and its answers not yet decided on (sent again after the refresh). Each page keeps its own, so
 * one tab never overwrites another's; they are merged when read (mergeQueues).
 */
export type StoredChallenge = AnswerSync;

export function parseStoredChallenge(raw: string | null): StoredChallenge | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!isObj(v) || typeof v.roundId !== "string" || !Array.isArray(v.queue)) return null;
    const queue: QueuedAnswer[] = [];
    for (const q of v.queue) {
      if (!isObj(q) || !isInt(q.index) || !isInt(q.atMs) || !(q.country === null || typeof q.country === "string")) return null;
      queue.push({ index: q.index, country: q.country, atMs: q.atMs });
    }
    return { roundId: v.roundId, queue };
  } catch {
    return null;
  }
}

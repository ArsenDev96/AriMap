import type { CountryId } from "../content/types";
import { shuffle, type RandomSource } from "../game/random";

/**
 * The Quick Challenge: find as many of a round's countries as you can on an unlabelled map of Europe,
 * against one timer for the whole round.
 *
 * Framework-independent: no React, DOM, storage or timers. The caller passes the time (`now`, in
 * milliseconds on any clock that never runs backwards) and the randomness (a RandomSource), so a round
 * plays out the same for the same inputs, on the web or in a future native app. State holds stable
 * country ids and outcomes only, never translated text.
 */

/**
 * The countries a round's questions are drawn from. Each has a whole shape in the map data
 * (src/data/geo/europe-west.topo.json) and a name in both languages, and is large enough to tap at a
 * whole-Europe view on a phone. Left out on purpose: Andorra, Luxembourg, Malta, Monaco, San Marino,
 * Liechtenstein and Vatican City (too small to tap there), Montenegro and Kosovo (the smallest left),
 * Norway, Sweden and Finland (the data stops at 62°N, cutting most of them off), Iceland (not in the
 * data), and the countries that lie mostly outside Europe or the data (Russia, Turkey, Kazakhstan).
 */
export const CHALLENGE_POOL: readonly CountryId[] = [
  // Western Europe and the British Isles.
  "PRT", "ESP", "FRA", "GBR", "IRL", "BEL", "NLD", "DNK",
  // Central Europe and Italy.
  "DEU", "CHE", "AUT", "ITA", "POL", "CZE", "SVK", "HUN", "SVN",
  // The Balkans and the south-east.
  "HRV", "BIH", "SRB", "ALB", "ROU", "BGR", "GRC",
  // The Baltic states and Eastern Europe.
  "EST", "LVA", "LTU", "BLR", "UKR", "MDA",
];

export interface ChallengeRules {
  /** Questions in a round, each a different country of the pool. */
  questions: number;
  /** The one timer for the whole round. */
  durationMs: number;
  /** How long each outcome's feedback shows before the next question (the timer keeps running). */
  feedbackMs: Readonly<Record<AnswerOutcome, number>>;
}

export const CHALLENGE_RULES: ChallengeRules = {
  questions: 15,
  durationMs: 45_000,
  feedbackMs: { correct: 700, wrong: 1400, skipped: 700 },
};

/** How a question was answered. A question the round ended before is "unanswered" (see ChallengeResult). */
export type AnswerOutcome = "correct" | "wrong" | "skipped";

export interface AnswerRecord {
  /** The question's place in the round (0-based). */
  index: number;
  target: CountryId;
  outcome: AnswerOutcome;
  /** The country tapped, for a wrong answer. */
  chosen?: CountryId;
  /** Milliseconds from the start of the round. */
  atMs: number;
}

/**
 * "ready": drawn, waiting for Start. "playing": the timer runs (feedback included). "finished": every
 * question answered, or the time ran out.
 */
export type ChallengeStatus = "ready" | "playing" | "finished";

/** Why a round ended: all its questions answered, or the timer ran out first. */
export type EndReason = "completed" | "timeUp";

export interface ChallengeRound {
  rules: ChallengeRules;
  /** The countries the player may tap as answers (every question is one of them). */
  pool: readonly CountryId[];
  /** The round's questions, in order. */
  questions: readonly CountryId[];
  status: ChallengeStatus;
  /** When Start was pressed, and when the time runs out (null until then). */
  startedAt: number | null;
  deadline: number | null;
  /** The question being asked, or answered and showing its feedback. */
  index: number;
  /** One per answered question, in order. */
  answers: readonly AnswerRecord[];
  /** The last answer's feedback, until `until`; while it shows, the round takes no other answer. */
  feedback: { index: number; until: number } | null;
  endReason: EndReason | null;
  /** When the round ended: the last answer, or the deadline. */
  endedAt: number | null;
}

/** Draws a round's questions: `rules.questions` different countries of the pool, in random order. */
export function createChallenge(random: RandomSource, options: { pool?: readonly CountryId[]; rules?: ChallengeRules } = {}): ChallengeRound {
  const pool = options.pool ?? CHALLENGE_POOL;
  const rules = options.rules ?? CHALLENGE_RULES;
  if (new Set(pool).size !== pool.length) throw new Error("The challenge pool lists a country twice");
  if (pool.length < rules.questions) throw new Error(`The challenge pool needs at least ${rules.questions} countries`);
  return {
    rules,
    pool,
    questions: shuffle(pool, random).slice(0, rules.questions),
    status: "ready",
    startedAt: null,
    deadline: null,
    index: 0,
    answers: [],
    feedback: null,
    endReason: null,
    endedAt: null,
  };
}

/** Starts the timer. Only from "ready": pressing Start again changes nothing. */
export function startChallenge(round: ChallengeRound, now: number): ChallengeRound {
  if (round.status !== "ready") return round;
  return { ...round, status: "playing", startedAt: now, deadline: now + round.rules.durationMs };
}

/** The question waiting for an answer now, or null (not started, showing feedback, or ended). */
export function currentQuestion(round: ChallengeRound): { index: number; target: CountryId } | null {
  if (round.status !== "playing" || round.feedback) return null;
  return { index: round.index, target: round.questions[round.index] };
}

/** Time left on the timer at `now`; stopped once the round has ended. */
export function remainingMs(round: ChallengeRound, now: number): number {
  if (round.deadline === null) return round.rules.durationMs;
  const at = round.endedAt ?? now;
  return Math.max(0, round.deadline - at);
}

/**
 * Brings the round up to `now`: ends it once the time is up, and after an answer's feedback moves on to
 * the next question (or ends it, after the last). Call it as often as convenient (each frame, when the
 * page comes back to the foreground): it changes nothing when there is nothing due.
 */
export function tick(round: ChallengeRound, now: number): ChallengeRound {
  if (round.status !== "playing") return round;
  const { feedback } = round;
  // The last answer ended the round when it was given (endReason, endedAt), whatever the time when its feedback ends.
  if (round.endReason === "completed") return feedback && now < feedback.until ? round : { ...round, status: "finished", feedback: null };
  if (now >= round.deadline!) return { ...round, status: "finished", feedback: null, endReason: "timeUp", endedAt: round.deadline };
  if (feedback && now >= feedback.until) return { ...round, index: round.index + 1, feedback: null };
  return round;
}

export type AnswerResult = "correct" | "wrong" | "skipped" | "rejected";

/**
 * Answers question `index` by tapping `country`, or skips it (`country` null). Rejected (the round
 * unchanged, but for ending it once the time is up) when the round is not playing, the time is up, the
 * last answer's feedback is still showing, `index` is not the question asked (a second tap meant for the
 * question just answered), or the country is not one of the pool's.
 */
export function answer(round: ChallengeRound, index: number, country: CountryId | null, now: number): { round: ChallengeRound; result: AnswerResult } {
  const current = tick(round, now);
  const question = currentQuestion(current);
  if (!question || question.index !== index) return { round: current, result: "rejected" };
  if (country !== null && !current.pool.includes(country)) return { round: current, result: "rejected" };
  const outcome: AnswerOutcome = country === null ? "skipped" : country === question.target ? "correct" : "wrong";
  const record: AnswerRecord = {
    index,
    target: question.target,
    outcome,
    ...(outcome === "wrong" ? { chosen: country! } : {}),
    atMs: now - current.startedAt!,
  };
  const answers = [...current.answers, record];
  const done = answers.length === current.questions.length;
  return {
    round: {
      ...current,
      answers,
      feedback: { index, until: now + current.rules.feedbackMs[outcome] },
      ...(done ? { endReason: "completed" as const, endedAt: now } : {}),
    },
    result: outcome,
  };
}

/** The feedback showing now, with its answer, or null. */
export function feedbackOf(round: ChallengeRound): AnswerRecord | null {
  return round.feedback ? (round.answers.find((a) => a.index === round.feedback!.index) ?? null) : null;
}

/** A question the player missed: answered wrong, skipped, or not reached before the time ran out. */
export interface MissedQuestion {
  index: number;
  target: CountryId;
  outcome: "wrong" | "skipped" | "unanswered";
  chosen?: CountryId;
}

export interface ChallengeResult {
  endReason: EndReason;
  /** One point per correct answer, out of `total`. */
  score: number;
  total: number;
  correct: number;
  incorrect: number;
  skipped: number;
  unanswered: number;
  /** From Start to the last answer, or the whole duration when the time ran out. */
  elapsedMs: number;
  /** Every question and how it went, in order. */
  questions: readonly (AnswerRecord | MissedQuestion)[];
  missed: readonly MissedQuestion[];
}

/** The round's outcome, once it has ended (null before). */
export function challengeResult(round: ChallengeRound): ChallengeResult | null {
  if (round.status !== "finished" || !round.endReason || round.startedAt === null || round.endedAt === null) return null;
  const questions = round.questions.map(
    (target, index): AnswerRecord | MissedQuestion => round.answers.find((a) => a.index === index) ?? { index, target, outcome: "unanswered" },
  );
  const count = (outcome: AnswerOutcome | "unanswered") => questions.filter((q) => q.outcome === outcome).length;
  const missed = questions
    .filter((q) => q.outcome !== "correct")
    .map((q): MissedQuestion => ({ index: q.index, target: q.target, outcome: q.outcome as MissedQuestion["outcome"], ...(q.chosen ? { chosen: q.chosen } : {}) }));
  const correct = count("correct");
  return {
    endReason: round.endReason,
    score: correct,
    total: round.questions.length,
    correct,
    incorrect: count("wrong"),
    skipped: count("skipped"),
    unanswered: count("unanswered"),
    elapsedMs: round.endedAt - round.startedAt,
    questions,
    missed,
  };
}

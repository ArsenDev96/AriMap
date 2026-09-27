import type { CountryId } from "../content/types";
import { shuffle, type RandomSource } from "./random";

/**
 * 0 = no hint, 1 = capital/landmark clue, 2 = target area shown, 3 = answer revealed.
 * Any level above 0 makes the answer "assisted".
 */
export type HintLevel = 0 | 1 | 2 | 3;
export const MAX_HINT_LEVEL: HintLevel = 3;

export type FindFeedback =
  | { kind: "correct"; country: CountryId }
  | { kind: "wrong"; country: CountryId }
  | { kind: "outside" };

export interface FindQuestion {
  target: CountryId;
  /** Wrong active countries tapped, in order (may repeat). */
  wrongGuesses: CountryId[];
  hintLevel: HintLevel;
  solved: boolean;
  /** Feedback for the most recent tap, cleared when the question changes. */
  feedback: FindFeedback | null;
}

export interface FindAnswer {
  target: CountryId;
  wrongGuesses: number;
  hintLevel: HintLevel;
  /** Found on the first attempt without hints. */
  independent: boolean;
}

export type FindStatus = "asking" | "roundComplete" | "complete";

export interface FindSession {
  /** One order of target countries per round. */
  orders: CountryId[][];
  round: number;
  index: number;
  question: FindQuestion;
  /** Answers per round, appended when a question is solved. */
  results: FindAnswer[][];
  status: FindStatus;
}

export type GuessOutcome = "correct" | "wrong" | "outside" | "ignored";

/**
 * Builds `rounds` shuffled orders of the given countries. Consecutive rounds use
 * different orders, and no target is asked twice in a row across a round boundary.
 */
export function createRoundOrders(
  countries: readonly CountryId[],
  rounds: number,
  random: RandomSource,
): CountryId[][] {
  const orders: CountryId[][] = [];
  for (let r = 0; r < rounds; r++) {
    const previous = orders[r - 1];
    let order = shuffle(countries, random);
    for (let attempt = 0; previous && attempt < 50 && !isGoodNextOrder(previous, order); attempt++) {
      order = shuffle(countries, random);
    }
    if (previous && !isGoodNextOrder(previous, order)) {
      // Deterministic fallback: rotate the previous order by one.
      order = [...previous.slice(1), previous[0]];
    }
    orders.push(order);
  }
  return orders;
}

function isGoodNextOrder(previous: readonly CountryId[], next: readonly CountryId[]): boolean {
  if (next.length < 2) return true;
  const differs = next.some((id, i) => id !== previous[i]);
  return differs && next[0] !== previous[previous.length - 1];
}

/** True when the orders are usable for a session over exactly these countries. */
export function areValidOrders(orders: unknown, countries: readonly CountryId[], rounds: number): orders is CountryId[][] {
  if (!Array.isArray(orders) || orders.length !== rounds) return false;
  const expected = [...countries].sort().join(",");
  const flat: unknown[] = orders.flat();
  if (!orders.every((o) => Array.isArray(o) && [...o].sort().join(",") === expected)) return false;
  return flat.every((id, i) => i === 0 || id !== flat[i - 1]);
}

function newQuestion(target: CountryId): FindQuestion {
  return { target, wrongGuesses: [], hintLevel: 0, solved: false, feedback: null };
}

export function createFindSession(orders: CountryId[][]): FindSession {
  if (orders.length === 0 || orders[0].length === 0) throw new Error("Find session needs at least one target");
  return {
    orders,
    round: 0,
    index: 0,
    question: newQuestion(orders[0][0]),
    results: orders.map(() => []),
    status: "asking",
  };
}

export function isIndependent(question: Pick<FindQuestion, "wrongGuesses" | "hintLevel">): boolean {
  return question.wrongGuesses.length === 0 && question.hintLevel === 0;
}

/** Handles a tap on a country. `active` lists the countries playable in this lesson. */
export function guess(
  session: FindSession,
  country: CountryId,
  active: readonly CountryId[],
): { session: FindSession; outcome: GuessOutcome } {
  const { question } = session;
  if (session.status !== "asking" || question.solved) return { session, outcome: "ignored" };

  if (!active.includes(country)) {
    // Taps on faded context countries are not counted as attempts.
    return { session: { ...session, question: { ...question, feedback: { kind: "outside" } } }, outcome: "outside" };
  }

  if (country !== question.target) {
    return {
      session: {
        ...session,
        question: {
          ...question,
          wrongGuesses: [...question.wrongGuesses, country],
          feedback: { kind: "wrong", country },
        },
      },
      outcome: "wrong",
    };
  }

  const solved: FindQuestion = { ...question, solved: true, feedback: { kind: "correct", country } };
  const answer: FindAnswer = {
    target: question.target,
    wrongGuesses: question.wrongGuesses.length,
    hintLevel: question.hintLevel,
    independent: isIndependent(question),
  };
  const results = session.results.map((r, i) => (i === session.round ? [...r, answer] : r));
  return { session: { ...session, question: solved, results }, outcome: "correct" };
}

export function requestHint(session: FindSession): FindSession {
  const { question } = session;
  if (session.status !== "asking" || question.solved || question.hintLevel >= MAX_HINT_LEVEL) return session;
  return { ...session, question: { ...question, hintLevel: (question.hintLevel + 1) as HintLevel } };
}

/** Moves on after a solved question: next question, or marks the round complete. */
export function nextQuestion(session: FindSession): FindSession {
  if (session.status !== "asking" || !session.question.solved) return session;
  const order = session.orders[session.round];
  const index = session.index + 1;
  if (index >= order.length) return { ...session, status: "roundComplete" };
  return { ...session, index, question: newQuestion(order[index]) };
}

/** Starts the next round after a round summary, or completes the session. */
export function nextRound(session: FindSession): FindSession {
  if (session.status !== "roundComplete") return session;
  const round = session.round + 1;
  if (round >= session.orders.length) return { ...session, status: "complete" };
  return { ...session, round, index: 0, question: newQuestion(session.orders[round][0]), status: "asking" };
}

export function countIndependent(answers: readonly FindAnswer[]): number {
  return answers.filter((a) => a.independent).length;
}

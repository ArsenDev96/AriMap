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

/** "asking" until the player moves on to Travel after the last answer. */
export type FindStatus = "asking" | "complete";

/** One question per lesson country, each asked exactly once, in `order`. */
export interface FindSession {
  order: CountryId[];
  index: number;
  question: FindQuestion;
  /** Answers in order, appended when a question is solved. */
  results: FindAnswer[];
  status: FindStatus;
}

export type GuessOutcome = "correct" | "wrong" | "outside" | "ignored";

/** A random order of the lesson's countries, each exactly once. */
export function createFindOrder(countries: readonly CountryId[], random: RandomSource): CountryId[] {
  return shuffle(countries, random);
}

/** True when `order` asks each of these countries exactly once. */
export function isValidOrder(order: unknown, countries: readonly CountryId[]): order is CountryId[] {
  return Array.isArray(order) && order.length === countries.length && [...order].sort().join(",") === [...countries].sort().join(",");
}

function newQuestion(target: CountryId): FindQuestion {
  return { target, wrongGuesses: [], hintLevel: 0, solved: false, feedback: null };
}

export function createFindSession(order: CountryId[]): FindSession {
  if (order.length === 0) throw new Error("Find session needs at least one target");
  return { order, index: 0, question: newQuestion(order[0]), results: [], status: "asking" };
}

export function isIndependent(question: Pick<FindQuestion, "wrongGuesses" | "hintLevel">): boolean {
  return question.wrongGuesses.length === 0 && question.hintLevel === 0;
}

/** True once the last question has been answered: the player can move on to Travel. */
export function isLastAnswered(session: FindSession): boolean {
  return session.question.solved && session.index === session.order.length - 1;
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
  return { session: { ...session, question: solved, results: [...session.results, answer] }, outcome: "correct" };
}

export function requestHint(session: FindSession): FindSession {
  const { question } = session;
  if (session.status !== "asking" || question.solved || question.hintLevel >= MAX_HINT_LEVEL) return session;
  return { ...session, question: { ...question, hintLevel: (question.hintLevel + 1) as HintLevel } };
}

/** Moves on after a solved question. The last question stays answered until `completeFind`. */
export function nextQuestion(session: FindSession): FindSession {
  if (session.status !== "asking" || !session.question.solved || isLastAnswered(session)) return session;
  const index = session.index + 1;
  return { ...session, index, question: newQuestion(session.order[index]) };
}

/** Ends the session once every question is answered. */
export function completeFind(session: FindSession): FindSession {
  if (session.status !== "asking" || !isLastAnswered(session)) return session;
  return { ...session, status: "complete" };
}

export function countIndependent(answers: readonly FindAnswer[]): number {
  return answers.filter((a) => a.independent).length;
}

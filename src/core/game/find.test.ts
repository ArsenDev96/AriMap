import { describe, expect, it } from "vitest";
import { westernEuropeLesson as lesson } from "../lessons/western-europe";
import {
  areValidOrders,
  countIndependent,
  createFindSession,
  createRoundOrders,
  guess,
  nextQuestion,
  nextRound,
  requestHint,
  type FindSession,
} from "./find";
import { seededRandom } from "./random";

const active = lesson.countries;
const ORDERS = [
  ["FRA", "BEL", "NLD", "LUX", "DEU"],
  ["LUX", "FRA", "DEU", "NLD", "BEL"],
];

function answerCorrectly(session: FindSession) {
  return guess(session, session.question.target, active).session;
}

describe("round orders", () => {
  it.each(Array.from({ length: 200 }, (_, seed) => seed))("seed %i: all countries each round, no repeats in a row", (seed) => {
    const orders = createRoundOrders(active, 2, seededRandom(seed));
    expect(orders).toHaveLength(2);
    for (const order of orders) expect([...order].sort()).toEqual([...active].sort());
    expect(orders[1]).not.toEqual(orders[0]);
    const flat = orders.flat();
    flat.forEach((id, i) => i > 0 && expect(id).not.toBe(flat[i - 1]));
    expect(areValidOrders(orders, active, 2)).toBe(true);
  });

  it("rejects malformed orders", () => {
    expect(areValidOrders([["FRA"]], active, 2)).toBe(false);
    expect(areValidOrders([ORDERS[0], ["BEL", "FRA", "NLD", "LUX", "DEU"]], active, 1)).toBe(false);
    // Round boundary repeat: DEU then DEU.
    expect(areValidOrders([ORDERS[0], ["DEU", "FRA", "BEL", "NLD", "LUX"]], active, 2)).toBe(false);
  });
});

describe("find answers", () => {
  it("counts a first-try answer without hints as independent", () => {
    const { session, outcome } = guess(createFindSession(ORDERS), "FRA", active);
    expect(outcome).toBe("correct");
    expect(session.results[0][0]).toMatchObject({ target: "FRA", independent: true });
  });

  it("identifies wrong answers and allows another attempt", () => {
    const start = createFindSession(ORDERS);
    const wrong = guess(start, "DEU", active);
    expect(wrong.outcome).toBe("wrong");
    expect(wrong.session.question.feedback).toEqual({ kind: "wrong", country: "DEU" });
    expect(wrong.session.question.solved).toBe(false);

    const right = guess(wrong.session, "FRA", active);
    expect(right.outcome).toBe("correct");
    expect(right.session.results[0][0]).toMatchObject({ wrongGuesses: 1, independent: false });
  });

  it("does not count taps on context countries as attempts", () => {
    const { session, outcome } = guess(createFindSession(ORDERS), "ESP", active);
    expect(outcome).toBe("outside");
    expect(session.question.wrongGuesses).toEqual([]);
    const done = answerCorrectly(session);
    expect(done.results[0][0].independent).toBe(true);
  });

  it("marks hinted and revealed answers as assisted", () => {
    let session = createFindSession(ORDERS);
    session = requestHint(session);
    expect(session.question.hintLevel).toBe(1);
    session = requestHint(requestHint(requestHint(session)));
    expect(session.question.hintLevel).toBe(3); // capped at the final reveal
    session = answerCorrectly(session);
    expect(session.results[0][0]).toMatchObject({ hintLevel: 3, independent: false });
  });

  it("ignores taps after the question is solved and resets state for the next question", () => {
    let session = answerCorrectly(createFindSession(ORDERS));
    expect(guess(session, "DEU", active).outcome).toBe("ignored");
    session = nextQuestion(session);
    expect(session.question).toEqual({ target: "BEL", wrongGuesses: [], hintLevel: 0, solved: false, feedback: null });
  });

  it("does not advance an unsolved question", () => {
    const start = createFindSession(ORDERS);
    expect(nextQuestion(start)).toBe(start);
  });

  it("completes two rounds and summarises independent answers", () => {
    let session = createFindSession(ORDERS);
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 5; i++) {
        if (round === 0 && i === 2) session = requestHint(session);
        session = nextQuestion(answerCorrectly(session));
      }
      expect(session.status).toBe("roundComplete");
      session = nextRound(session);
    }
    expect(session.status).toBe("complete");
    expect(countIndependent(session.results[0])).toBe(4);
    expect(countIndependent(session.results[1])).toBe(5);
  });
});

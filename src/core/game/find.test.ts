import { describe, expect, it } from "vitest";
import { westernEuropeLesson as lesson } from "../lessons/western-europe";
import {
  completeFind,
  countIndependent,
  createFindOrder,
  createFindSession,
  guess,
  isLastAnswered,
  isValidOrder,
  nextQuestion,
  requestHint,
  type FindSession,
} from "./find";
import { seededRandom } from "./random";

const active = lesson.countries;
const ORDER = ["FRA", "BEL", "NLD", "LUX", "DEU"];

function answerCorrectly(session: FindSession) {
  return guess(session, session.question.target, active).session;
}

describe("find order", () => {
  it.each(Array.from({ length: 200 }, (_, seed) => seed))("seed %i: each lesson country exactly once", (seed) => {
    const order = createFindOrder(active, seededRandom(seed));
    expect(order).toHaveLength(active.length);
    expect([...order].sort()).toEqual([...active].sort());
    expect(isValidOrder(order, active)).toBe(true);
  });

  it("is randomised", () => {
    const orders = new Set(Array.from({ length: 50 }, (_, seed) => createFindOrder(active, seededRandom(seed)).join()));
    expect(orders.size).toBeGreaterThan(20);
  });

  it("rejects malformed orders", () => {
    expect(isValidOrder(["FRA"], active)).toBe(false);
    expect(isValidOrder(["FRA", "FRA", "NLD", "LUX", "DEU"], active)).toBe(false);
    expect(isValidOrder([...ORDER, "BEL"], active)).toBe(false);
    expect(isValidOrder([ORDER, ORDER], active)).toBe(false);
    expect(isValidOrder("FRA,BEL,NLD,LUX,DEU", active)).toBe(false);
  });
});

describe("find answers", () => {
  it("counts a first-try answer without hints as independent", () => {
    const { session, outcome } = guess(createFindSession(ORDER), "FRA", active);
    expect(outcome).toBe("correct");
    expect(session.results[0]).toMatchObject({ target: "FRA", independent: true });
  });

  it("identifies wrong answers and allows another attempt", () => {
    const start = createFindSession(ORDER);
    const wrong = guess(start, "DEU", active);
    expect(wrong.outcome).toBe("wrong");
    expect(wrong.session.question.feedback).toEqual({ kind: "wrong", country: "DEU" });
    expect(wrong.session.question.solved).toBe(false);

    const right = guess(wrong.session, "FRA", active);
    expect(right.outcome).toBe("correct");
    expect(right.session.results[0]).toMatchObject({ wrongGuesses: 1, independent: false });
  });

  it("does not count taps on context countries as attempts", () => {
    const { session, outcome } = guess(createFindSession(ORDER), "ESP", active);
    expect(outcome).toBe("outside");
    expect(session.question.wrongGuesses).toEqual([]);
    const done = answerCorrectly(session);
    expect(done.results[0].independent).toBe(true);
  });

  it("marks hinted and revealed answers as assisted", () => {
    let session = createFindSession(ORDER);
    session = requestHint(session);
    expect(session.question.hintLevel).toBe(1);
    session = requestHint(requestHint(requestHint(session)));
    expect(session.question.hintLevel).toBe(3); // capped at the final reveal
    session = answerCorrectly(session);
    expect(session.results[0]).toMatchObject({ hintLevel: 3, independent: false });
  });

  it("ignores taps after the question is solved and resets state for the next question", () => {
    let session = answerCorrectly(createFindSession(ORDER));
    expect(guess(session, "DEU", active).outcome).toBe("ignored");
    session = nextQuestion(session);
    expect(session.question).toEqual({ target: "BEL", wrongGuesses: [], hintLevel: 0, solved: false, feedback: null });
  });

  it("does not advance an unsolved question", () => {
    const start = createFindSession(ORDER);
    expect(nextQuestion(start)).toBe(start);
  });

  it("asks five questions, one per country, then completes without a summary", () => {
    let session = createFindSession(ORDER);
    const asked: string[] = [];
    for (let i = 0; i < 5; i++) {
      asked.push(session.question.target);
      if (i === 2) session = requestHint(session);
      session = answerCorrectly(session);
      expect(session.status).toBe("asking");
      if (i < 4) {
        expect(isLastAnswered(session)).toBe(false);
        expect(completeFind(session)).toBe(session);
        session = nextQuestion(session);
      }
    }
    expect(asked).toEqual(ORDER);
    expect(isLastAnswered(session)).toBe(true);
    // The last answer stays on screen: "Next" does nothing, and moving on completes the session.
    expect(nextQuestion(session)).toBe(session);
    session = completeFind(session);
    expect(session.status).toBe("complete");
    expect(session.results.map((a) => a.target)).toEqual(ORDER);
    expect(countIndependent(session.results)).toBe(4);
    expect(guess(session, "FRA", active).outcome).toBe("ignored");
    expect(requestHint(session)).toBe(session);
  });
});

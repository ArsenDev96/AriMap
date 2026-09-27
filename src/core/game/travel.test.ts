import { describe, expect, it } from "vitest";
import { westernEuropeLesson as lesson } from "../lessons/western-europe";
import { shortestDistance, shortestPath, validateGraph } from "./graph";
import {
  availableMoves,
  createAttempt,
  crossingsLeft,
  isIndependentCompletion,
  markHintUsed,
  move,
  restart,
  undo,
  type TravelAttempt,
} from "./travel";

const graph = lesson.borders;
const mission = lesson.travel.mission;

function play(route: string[], start: TravelAttempt = createAttempt(graph, mission)) {
  let attempt = start;
  const outcomes = [];
  for (const country of route) {
    const result = move(attempt, graph, country);
    attempt = result.attempt;
    outcomes.push(result.outcome);
  }
  return { attempt, outcomes };
}

describe("border graph", () => {
  it("is symmetric and well-formed", () => {
    expect(validateGraph(graph)).toEqual([]);
  });

  it("reports asymmetric edges", () => {
    expect(validateGraph({ A: ["B"], B: [] })).toEqual(["A→B has no B→A"]);
  });

  it("finds the minimum number of crossings with BFS", () => {
    expect(shortestDistance(graph, "FRA", "NLD")).toBe(2);
    expect(shortestDistance(graph, "FRA", "BEL")).toBe(1);
    expect(shortestDistance(graph, "LUX", "NLD")).toBe(2);
    expect(shortestDistance(graph, "FRA", "FRA")).toBe(0);
    expect(shortestPath(graph, "FRA", "XXX")).toBeNull();
  });
});

describe("travel mission France → Netherlands", () => {
  it("computes a budget of 2 crossings", () => {
    const attempt = createAttempt(graph, mission);
    expect(attempt.budget).toBe(2);
    expect(crossingsLeft(attempt)).toBe(2);
  });

  it("offers every active neighbour and nothing else", () => {
    const attempt = createAttempt(graph, mission);
    expect([...availableMoves(attempt, graph)].sort()).toEqual(["BEL", "DEU", "LUX"]);
    const inBelgium = move(attempt, graph, "BEL").attempt;
    expect([...availableMoves(inBelgium, graph)].sort()).toEqual(["DEU", "FRA", "LUX", "NLD"]);
  });

  it.each([
    [["BEL", "NLD"]],
    [["DEU", "NLD"]],
  ])("accepts the shortest route via %j", (route) => {
    const { attempt, outcomes } = play(route);
    expect(outcomes).toEqual(["moved", "arrived"]);
    expect(attempt.status).toBe("arrived");
    expect(attempt.path).toEqual(["FRA", ...route]);
    expect(isIndependentCompletion(attempt)).toBe(true);
  });

  it("does not accept a longer, geographically valid route", () => {
    const { attempt, outcomes } = play(["LUX", "BEL"]);
    expect(outcomes).toEqual(["moved", "outOfCrossings"]);
    expect(attempt.status).toBe("outOfCrossings");
    expect(availableMoves(attempt, graph)).toEqual([]);
    // No further moves once the budget is spent, even to the destination.
    expect(move(attempt, graph, "NLD").outcome).toBe("invalid");
  });

  it("rejects moves to non-neighbours", () => {
    const start = createAttempt(graph, mission);
    expect(move(start, graph, "NLD").outcome).toBe("invalid");
    expect(move(start, graph, "ESP").outcome).toBe("invalid");
  });

  it("undo restores the route, budget and status, and records assistance", () => {
    const { attempt: stuck } = play(["LUX", "DEU"]);
    expect(stuck.status).toBe("outOfCrossings");
    const back = undo(stuck);
    expect(back.path).toEqual(["FRA", "LUX"]);
    expect(crossingsLeft(back)).toBe(1);
    expect(back.status).toBe("playing");
    expect(back.undoUsed).toBe(true);

    const start = undo(back);
    expect(start.path).toEqual(["FRA"]);
    expect(crossingsLeft(start)).toBe(2);

    const { attempt } = play(["BEL", "NLD"], start);
    expect(attempt.status).toBe("arrived");
    expect(isIndependentCompletion(attempt)).toBe(false);
  });

  it("undo is a no-op before the first move", () => {
    const start = createAttempt(graph, mission);
    expect(undo(start)).toBe(start);
    expect(start.undoUsed).toBe(false);
  });

  it("hints allow completion but not the independent distinction", () => {
    const hinted = markHintUsed(createAttempt(graph, mission));
    const { attempt } = play(["DEU", "NLD"], hinted);
    expect(attempt.status).toBe("arrived");
    expect(isIndependentCompletion(attempt)).toBe(false);
  });

  it("restart resets the route but keeps assistance already used", () => {
    const { attempt } = play(["LUX"], markHintUsed(createAttempt(graph, mission)));
    const fresh = restart(attempt);
    expect(fresh.path).toEqual(["FRA"]);
    expect(crossingsLeft(fresh)).toBe(2);
    expect(fresh.hintUsed).toBe(true);
  });
});

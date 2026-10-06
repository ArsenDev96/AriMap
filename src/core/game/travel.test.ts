import { describe, expect, it } from "vitest";
import { adriaticLesson } from "../lessons/adriatic";
import { westernEuropeLesson as lesson } from "../lessons/western-europe";
import { shortestDistance, shortestPath, validateGraph } from "./graph";
import {
  availableMoves,
  createAttempt,
  crossingsLeft,
  isDeadEnd,
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

  it("offers every active neighbour not yet on the route, and nothing else", () => {
    const attempt = createAttempt(graph, mission);
    expect([...availableMoves(attempt, graph)].sort()).toEqual(["BEL", "DEU", "LUX"]);
    // Belgium borders France too, but the journey started there.
    const inBelgium = move(attempt, graph, "BEL").attempt;
    expect([...availableMoves(inBelgium, graph)].sort()).toEqual(["DEU", "LUX", "NLD"]);
    expect(isDeadEnd(inBelgium, graph)).toBe(false);
  });

  it("never enters a country already on the route, the start included", () => {
    const inBelgium = move(createAttempt(graph, mission), graph, "BEL").attempt;
    const back = move(inBelgium, graph, "FRA");
    expect(back.outcome).toBe("invalid");
    expect(back.attempt).toBe(inBelgium);
  });

  it("undo makes the country it leaves a choice again, where it is a neighbour", () => {
    const { attempt } = play(["LUX"]);
    expect([...availableMoves(attempt, graph)].sort()).toEqual(["BEL", "DEU"]);
    const start = undo(attempt);
    expect([...availableMoves(start, graph)].sort()).toEqual(["BEL", "DEU", "LUX"]);
    const inBelgium = move(start, graph, "BEL").attempt;
    expect([...availableMoves(inBelgium, graph)].sort()).toEqual(["DEU", "LUX", "NLD"]);
  });

  it("keeps a longer route selectable: choices are not narrowed to those within the crossings left", () => {
    // Luxembourg is a real neighbour of France but not on a shortest route to the Netherlands.
    const start = createAttempt(graph, mission);
    expect(availableMoves(start, graph)).toContain("LUX");
    const { attempt } = play(["LUX"]);
    // From Luxembourg, neither choice reaches the Netherlands with the one crossing left; both are offered.
    expect([...availableMoves(attempt, graph)].sort()).toEqual(["BEL", "DEU"]);
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

  it("a route saved with a repeat (before repeats were excluded) is kept and can be undone", () => {
    // Out of crossings in a repeat: as before, Undo goes back along it.
    const saved: TravelAttempt = { ...createAttempt(graph, mission), path: ["FRA", "BEL", "FRA"], status: "outOfCrossings" };
    expect(isDeadEnd(saved, graph)).toBe(false);
    const back = undo(saved);
    expect(back.path).toEqual(["FRA", "BEL"]);
    expect([...availableMoves(back, graph)].sort()).toEqual(["DEU", "LUX", "NLD"]);
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

describe("a dead end with crossings left (Level 4, Montenegro → Italy)", () => {
  const adriatic = adriaticLesson.borders;
  const toItaly = adriaticLesson.travel.mission;
  const via = (route: string[]) => {
    let attempt = createAttempt(adriatic, toItaly);
    for (const country of route) attempt = move(attempt, adriatic, country).attempt;
    return attempt;
  };

  it("Montenegro → Croatia → Bosnia and Herzegovina: both its neighbours are on the route, a crossing left", () => {
    const attempt = via(["HRV", "BIH"]);
    expect(attempt.path).toEqual(["MNE", "HRV", "BIH"]);
    expect(attempt.status).toBe("playing");
    expect(crossingsLeft(attempt)).toBe(1);
    expect(availableMoves(attempt, adriatic)).toEqual([]);
    expect(isDeadEnd(attempt, adriatic)).toBe(true);
    for (const country of ["HRV", "MNE"]) expect(move(attempt, adriatic, country).outcome).toBe("invalid");
  });

  it("undo leaves it: Croatia offers Slovenia and Bosnia and Herzegovina again", () => {
    const back = undo(via(["HRV", "BIH"]));
    expect(back.path).toEqual(["MNE", "HRV"]);
    expect([...availableMoves(back, adriatic)].sort()).toEqual(["BIH", "SVN"]);
    expect(isDeadEnd(back, adriatic)).toBe(false);
    expect(back.undoUsed).toBe(true);
  });

  it("restart leaves it: back in Montenegro, Croatia and Bosnia and Herzegovina offered", () => {
    const fresh = restart(via(["HRV", "BIH"]));
    expect(fresh.path).toEqual(["MNE"]);
    expect([...availableMoves(fresh, adriatic)].sort()).toEqual(["BIH", "HRV"]);
  });

  it("through Bosnia and Herzegovina first is the longer way: out of crossings in Slovenia, not a dead end", () => {
    const longer = via(["BIH", "HRV"]);
    // Every real neighbour not on the route stays a choice, though none reaches Italy in time.
    expect(availableMoves(longer, adriatic)).toEqual(["SVN"]);
    const attempt = move(longer, adriatic, "SVN").attempt;
    expect(attempt.status).toBe("outOfCrossings");
    expect(isDeadEnd(attempt, adriatic)).toBe(false);
  });
});

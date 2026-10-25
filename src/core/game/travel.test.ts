import { describe, expect, it } from "vitest";
import { adriaticLesson } from "../lessons/adriatic";
import { westernEuropeLesson as lesson } from "../lessons/western-europe";
import { shortestDistance, shortestPath, validateGraph, type BorderGraph } from "./graph";
import {
  availableMoves,
  choose,
  createAttempt,
  crossingsLeft,
  isDeadEnd,
  isIndependentCompletion,
  markHintUsed,
  move,
  restart,
  travelChoices,
  travelStop,
  undo,
  type NonNeighbourOption,
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
    const { attempt } = play(["BEL"]);
    expect([...availableMoves(attempt, graph)].sort()).toEqual(["DEU", "LUX", "NLD"]);
    const start = undo(attempt);
    expect([...availableMoves(start, graph)].sort()).toEqual(["BEL", "DEU", "LUX"]);
    const inGermany = move(start, graph, "DEU").attempt;
    expect([...availableMoves(inGermany, graph)].sort()).toEqual(["BEL", "LUX", "NLD"]);
  });

  it("offers a wrong turn among the choices, then stops the journey there: off course, Undo or Restart", () => {
    // Luxembourg is a real neighbour of France but not on a shortest route to the Netherlands: a choice, not
    // narrowed away, while the destination can still be reached.
    const start = createAttempt(graph, mission);
    expect(availableMoves(start, graph)).toContain("LUX");
    expect(travelStop(start, graph)).toBeNull();
    const { attempt } = play(["LUX"]);
    // From Luxembourg the Netherlands is two crossings away, and one is left: the journey can't arrive, so it stops
    // there with a crossing left (until 2026-10-25 it offered Belgium and Germany, either running the crossings out).
    expect(crossingsLeft(attempt)).toBe(1);
    expect(attempt.status).toBe("playing");
    expect(travelStop(attempt, graph)).toBe("offCourse");
    expect(isDeadEnd(attempt, graph)).toBe(false);
    expect(availableMoves(attempt, graph)).toEqual([]);
    expect(travelChoices(attempt, graph)).toEqual([]);
    for (const country of ["BEL", "DEU"]) expect(move(attempt, graph, country)).toEqual({ attempt, outcome: "invalid" });
    // Undo and Restart go on, as from any stop.
    expect(travelStop(undo(attempt), graph)).toBeNull();
    expect(travelStop(restart(attempt), graph)).toBeNull();
  });

  it("is never off course on a shortest route, nor once arrived", () => {
    for (const route of [[], ["BEL"], ["DEU"]]) expect(travelStop(play(route).attempt, graph), route.join()).toBeNull();
    expect(travelStop(play(["BEL", "NLD"]).attempt, graph)).toBeNull();
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
    // France → Luxembourg → Belgium → the Netherlands is three crossings, the shortest two: it stops in Luxembourg.
    const { attempt, outcomes } = play(["LUX", "BEL", "NLD"]);
    expect(outcomes).toEqual(["moved", "invalid", "invalid"]);
    expect(attempt.path).toEqual(["FRA", "LUX"]);
    expect(travelStop(attempt, graph)).toBe("offCourse");
  });

  it("a route saved out of crossings (before 2026-10-25) stays so, and Undo goes back along it", () => {
    const saved: TravelAttempt = { ...createAttempt(graph, mission), path: ["FRA", "LUX", "BEL"], status: "outOfCrossings" };
    expect(travelStop(saved, graph)).toBe("outOfCrossings");
    expect(availableMoves(saved, graph)).toEqual([]);
    // No further moves once the budget is spent, even to the destination.
    expect(move(saved, graph, "NLD").outcome).toBe("invalid");
    const back = undo(saved);
    expect(back.path).toEqual(["FRA", "LUX"]);
    expect(travelStop(back, graph)).toBe("offCourse");
    expect(undo(back).path).toEqual(["FRA"]);
  });

  it("rejects moves to non-neighbours", () => {
    const start = createAttempt(graph, mission);
    expect(move(start, graph, "NLD").outcome).toBe("invalid");
    expect(move(start, graph, "ESP").outcome).toBe("invalid");
  });

  it("undo restores the route, budget and status, and records assistance", () => {
    const { attempt: stuck } = play(["LUX"]);
    expect(travelStop(stuck, graph)).toBe("offCourse");
    const start = undo(stuck);
    expect(start.path).toEqual(["FRA"]);
    expect(crossingsLeft(start)).toBe(2);
    expect(start.status).toBe("playing");
    expect(start.undoUsed).toBe(true);

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

describe("a dead end with crossings left (Level 4, Montenegro → Italy, before Hungary and Serbia)", () => {
  // Level 4's five countries alone, as before its Travel-only neighbours: Bosnia and Herzegovina entered from Croatia
  // was a dead end. Kept as a graph of its own to test the rule; the level now offers Serbia there (below).
  const adriatic: BorderGraph = {
    ITA: ["SVN"],
    SVN: ["ITA", "HRV"],
    HRV: ["SVN", "BIH", "MNE"],
    BIH: ["HRV", "MNE"],
    MNE: ["HRV", "BIH"],
  };
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

  it("through Bosnia and Herzegovina first is the longer way: off course there at once, not a dead end", () => {
    // Italy is three crossings from Bosnia and Herzegovina, and two are left; Croatia is new, so no dead end.
    const longer = via(["BIH", "HRV"]);
    expect(longer.path).toEqual(["MNE", "BIH"]);
    expect(crossingsLeft(longer)).toBe(2);
    expect(travelStop(longer, adriatic)).toBe("offCourse");
    expect(isDeadEnd(longer, adriatic)).toBe(false);
  });

  it("in the level, Serbia (Travel only) is new there: off course rather than a dead end, and no move offered", () => {
    let attempt = createAttempt(adriaticLesson.borders, toItaly);
    for (const country of ["HRV", "BIH"]) attempt = move(attempt, adriaticLesson.borders, country).attempt;
    expect(attempt.path).toEqual(["MNE", "HRV", "BIH"]);
    expect(travelStop(attempt, adriaticLesson.borders)).toBe("offCourse");
    expect(availableMoves(attempt, adriaticLesson.borders)).toEqual([]);
  });
});

describe("non-neighbour options: shown among the choices, never a move (Level 7's France, at the start in Portugal)", () => {
  const iberia: BorderGraph = {
    PRT: ["ESP"],
    ESP: ["PRT", "AND", "FRA"],
    AND: ["ESP", "FRA"],
    FRA: ["ESP", "AND", "ITA"],
    ITA: ["FRA"],
  };
  const toItaly = { id: "prt-to-ita", from: "PRT", to: "ITA" };
  const options: NonNeighbourOption[] = [{ route: ["PRT"], country: "FRA" }];

  it("is a choice at its route only, styled as one: the moves, then the option", () => {
    const start = createAttempt(iberia, toItaly);
    expect(travelChoices(start, iberia, options)).toEqual([
      { country: "ESP", neighbour: true },
      { country: "FRA", neighbour: false },
    ]);
    // Without options, or elsewhere on the journey, the choices are the moves.
    expect(travelChoices(start, iberia)).toEqual([{ country: "ESP", neighbour: true }]);
    const inSpain = move(start, iberia, "ESP").attempt;
    expect(travelChoices(inSpain, iberia, options).map((c) => c.country)).toEqual(availableMoves(inSpain, iberia));
    // A country that is a neighbour there is a move, never an option.
    expect(travelChoices(start, iberia, [{ route: ["PRT"], country: "ESP" }])).toEqual([{ country: "ESP", neighbour: true }]);
  });

  it("moves nothing when chosen: the same attempt (route, crossings, help), any number of times", () => {
    const start = createAttempt(iberia, toItaly);
    let attempt = start;
    for (let i = 0; i < 3; i++) {
      const result = choose(attempt, iberia, "FRA", options);
      expect(result.outcome).toBe("notNeighbour");
      expect(result.attempt).toBe(start);
      attempt = result.attempt;
    }
    expect(crossingsLeft(attempt)).toBe(3);
    expect(attempt).toMatchObject({ path: ["PRT"], status: "playing", hintUsed: false, undoUsed: false });
    // The graph is unchanged: as a move, France is invalid there.
    expect(move(start, iberia, "FRA").outcome).toBe("invalid");
    expect(choose(start, iberia, "FRA").outcome).toBe("invalid");
  });

  it("leaves real moves, wrong turns, Undo and Restart as they were", () => {
    const start = createAttempt(iberia, toItaly);
    expect(choose(start, iberia, "ESP", options)).toEqual(move(start, iberia, "ESP"));
    // Spain → Andorra, the wrong turn, is offered and taken; from Andorra Italy is two crossings away, one left.
    const andorra = choose(choose(start, iberia, "ESP", options).attempt, iberia, "AND", options).attempt;
    expect(andorra.path).toEqual(["PRT", "ESP", "AND"]);
    expect(travelStop(andorra, iberia)).toBe("offCourse");
    // Stopped there: no choices at all, and France is no move.
    expect(travelChoices(andorra, iberia, options)).toEqual([]);
    expect(choose(andorra, iberia, "FRA", options)).toEqual({ attempt: andorra, outcome: "invalid" });
    // Back at the start by Undo or Restart: the option is shown again.
    expect(travelChoices(undo(choose(start, iberia, "ESP", options).attempt), iberia, options).map((c) => c.country)).toEqual(["ESP", "FRA"]);
    expect(travelChoices(restart(andorra), iberia, options).map((c) => c.country)).toEqual(["ESP", "FRA"]);
  });
});

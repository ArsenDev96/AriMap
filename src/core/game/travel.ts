import type { CountryId } from "../content/types";
import type { TravelMission } from "../lessons/types";
import { areNeighbors, neighborsOf, shortestDistance, type BorderGraph } from "./graph";

export type TravelStatus = "playing" | "arrived" | "outOfCrossings";

export interface TravelAttempt {
  missionId: string;
  from: CountryId;
  to: CountryId;
  /** Minimum number of crossings, computed by BFS. */
  budget: number;
  /** Countries visited in order, starting with `from`. */
  path: CountryId[];
  status: TravelStatus;
  hintUsed: boolean;
  undoUsed: boolean;
}

export type MoveOutcome = "moved" | "arrived" | "outOfCrossings" | "invalid";

/**
 * A country shown among a journey's choices at one point of it although it is no neighbour of the country there:
 * a geography distractor (Level 7's France, at the start in Portugal). It is never an edge of the border graph:
 * choosing it moves nothing (outcome "notNeighbour"), and the player chooses again. Shown only while the route is
 * exactly `route` (so again after Undo or Restart back to it) and moves are possible.
 */
export interface NonNeighbourOption {
  route: readonly CountryId[];
  country: CountryId;
}

/** One of a state's choices: a real neighbour (a move) or a non-neighbour option (a distractor). */
export interface TravelChoice {
  country: CountryId;
  neighbour: boolean;
}

export type ChoiceOutcome = MoveOutcome | "notNeighbour";

const sameRoute = (a: readonly CountryId[], b: readonly CountryId[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/** The non-neighbour options shown at this state (never a neighbour of the current country, nor a country on the route). */
export function nonNeighbourChoices(a: TravelAttempt, graph: BorderGraph, options: readonly NonNeighbourOption[] = []): readonly CountryId[] {
  if (travelStop(a, graph)) return [];
  const here = currentCountry(a);
  return options
    .filter((o) => sameRoute(o.route, a.path) && !areNeighbors(graph, here, o.country) && !a.path.includes(o.country))
    .map((o) => o.country);
}

/** Every choice at this state: the moves (availableMoves), then the non-neighbour options shown there. */
export function travelChoices(a: TravelAttempt, graph: BorderGraph, options: readonly NonNeighbourOption[] = []): TravelChoice[] {
  return [
    ...availableMoves(a, graph).map((country) => ({ country, neighbour: true })),
    ...nonNeighbourChoices(a, graph, options).map((country) => ({ country, neighbour: false })),
  ];
}

/**
 * Takes one of the state's choices: a neighbour is a move (see move); a non-neighbour option shown here leaves the
 * attempt exactly as it was (no crossing, no route, no help recorded) with outcome "notNeighbour".
 */
export function choose(
  a: TravelAttempt,
  graph: BorderGraph,
  to: CountryId,
  options: readonly NonNeighbourOption[] = [],
): { attempt: TravelAttempt; outcome: ChoiceOutcome } {
  if (nonNeighbourChoices(a, graph, options).includes(to)) return { attempt: a, outcome: "notNeighbour" };
  return move(a, graph, to);
}

export function crossingBudget(graph: BorderGraph, mission: TravelMission): number {
  const distance = shortestDistance(graph, mission.from, mission.to);
  if (distance === null) throw new Error(`No route from ${mission.from} to ${mission.to}`);
  return distance;
}

export function createAttempt(graph: BorderGraph, mission: TravelMission): TravelAttempt {
  return {
    missionId: mission.id,
    from: mission.from,
    to: mission.to,
    budget: crossingBudget(graph, mission),
    path: [mission.from],
    status: mission.from === mission.to ? "arrived" : "playing",
    hintUsed: false,
    undoUsed: false,
  };
}

export const currentCountry = (a: TravelAttempt): CountryId => a.path[a.path.length - 1];
export const crossingsUsed = (a: TravelAttempt): number => a.path.length - 1;
export const crossingsLeft = (a: TravelAttempt): number => a.budget - crossingsUsed(a);

/** The current country's neighbours not yet on the route: where a move could go, were moves possible. */
const newNeighbours = (a: TravelAttempt, graph: BorderGraph) => neighborsOf(graph, currentCountry(a)).filter((id) => !a.path.includes(id));

/**
 * Whether the destination can still be reached from the current country within the crossings left, never entering a
 * country twice: breadth-first over the border graph without the route's countries (a shortest path there is the
 * shortest way on that enters none of them again).
 */
export function canStillArrive(a: TravelAttempt, graph: BorderGraph): boolean {
  if (a.status === "arrived") return true;
  const visited = new Set(a.path);
  let frontier = [currentCountry(a)];
  for (let step = 0; step < crossingsLeft(a) && frontier.length; step++) {
    const next: CountryId[] = [];
    for (const id of frontier) {
      for (const neighbour of neighborsOf(graph, id)) {
        if (neighbour === a.to) return true;
        if (!visited.has(neighbour)) {
          visited.add(neighbour);
          next.push(neighbour);
        }
      }
    }
    frontier = next;
  }
  return false;
}

export type TravelStop = "outOfCrossings" | "deadEnd" | "offCourse";

/**
 * Why a journey short of its destination can't go on, or null while it can. Only Undo or Retry go on from here.
 * - "outOfCrossings": the crossings ran out: a wrong turn took the last one (or, saved before 2026-10-25, went on past
 *   an earlier wrong turn).
 * - "deadEnd": crossings are left, but every neighbour of the current country is already on the route.
 * - "offCourse": crossings are left and neighbours are new, but none leads to the destination within them: the route
 *   has left every shortest one (the budget is the shortest distance, so any wrong turn does). Since 2026-10-25 the
 *   journey stops there, rather than offering moves that can only run the crossings out (docs/DATA.md, "Wrong turns
 *   stop off course").
 */
export function travelStop(a: TravelAttempt, graph: BorderGraph): TravelStop | null {
  if (a.status === "outOfCrossings") return "outOfCrossings";
  if (a.status !== "playing" || crossingsLeft(a) <= 0) return null;
  if (newNeighbours(a, graph).length === 0) return "deadEnd";
  return canStillArrive(a, graph) ? null : "offCourse";
}

/**
 * The current country's active neighbours not yet on this journey's route (the start included), while
 * moves are possible. Undo takes a country off the route, so it is offered again wherever it is a
 * neighbour. Wrong turns stay among the choices wherever the destination can still be reached (choices are
 * never narrowed to the winning ones); once it can't (travelStop), there are none.
 */
export function availableMoves(a: TravelAttempt, graph: BorderGraph): readonly CountryId[] {
  if (a.status !== "playing" || crossingsLeft(a) <= 0 || travelStop(a, graph)) return [];
  return newNeighbours(a, graph);
}

/**
 * Stopped short of the destination with crossings still left: every neighbour of the current country
 * is already on the route. Only Undo or Retry go on.
 */
export function isDeadEnd(a: TravelAttempt, graph: BorderGraph): boolean {
  return travelStop(a, graph) === "deadEnd";
}

function statusAfter(path: readonly CountryId[], a: TravelAttempt): TravelStatus {
  if (path[path.length - 1] === a.to) return "arrived";
  return path.length - 1 >= a.budget ? "outOfCrossings" : "playing";
}

export function move(
  a: TravelAttempt,
  graph: BorderGraph,
  to: CountryId,
): { attempt: TravelAttempt; outcome: MoveOutcome } {
  // A country already on the route is never entered again, and a journey that can no longer arrive goes no further.
  if (a.status !== "playing" || crossingsLeft(a) <= 0 || !areNeighbors(graph, currentCountry(a), to) || a.path.includes(to) || travelStop(a, graph)) {
    return { attempt: a, outcome: "invalid" };
  }
  const path = [...a.path, to];
  const status = statusAfter(path, a);
  return { attempt: { ...a, path, status }, outcome: status === "playing" ? "moved" : status };
}

/** Reverses the last move and restores its crossing. Using undo is recorded as assistance. */
export function undo(a: TravelAttempt): TravelAttempt {
  if (a.path.length <= 1 || a.status === "arrived") return a;
  return { ...a, path: a.path.slice(0, -1), status: "playing", undoUsed: true };
}

/** Resets the route. Assistance already used in this attempt stays recorded. */
export function restart(a: TravelAttempt): TravelAttempt {
  if (a.status === "arrived") return a;
  return { ...a, path: [a.from], status: "playing" };
}

export function markHintUsed(a: TravelAttempt): TravelAttempt {
  if (a.status !== "playing" || a.hintUsed) return a;
  return { ...a, hintUsed: true };
}

export function isAssisted(a: Pick<TravelAttempt, "hintUsed" | "undoUsed">): boolean {
  return a.hintUsed || a.undoUsed;
}

/** Completed within the BFS budget without hints or undo. */
export function isIndependentCompletion(a: TravelAttempt): boolean {
  return a.status === "arrived" && crossingsUsed(a) <= a.budget && !isAssisted(a);
}

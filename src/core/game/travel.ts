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
  if (a.status !== "playing" || crossingsLeft(a) <= 0) return [];
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

/**
 * The current country's active neighbours not yet on this journey's route (the start included), while
 * moves are possible. Undo takes a country off the route, so it is offered again wherever it is a
 * neighbour. Choices are never narrowed to those that still reach the destination within the
 * crossings left: a longer route stays possible, and runs out of crossings.
 */
export function availableMoves(a: TravelAttempt, graph: BorderGraph): readonly CountryId[] {
  if (a.status !== "playing" || crossingsLeft(a) <= 0) return [];
  return neighborsOf(graph, currentCountry(a)).filter((id) => !a.path.includes(id));
}

/**
 * Stopped short of the destination with crossings still left: every neighbour of the current country
 * is already on the route (a route saved before countries could not be visited twice can end so).
 * Only Undo or Retry go on.
 */
export function isDeadEnd(a: TravelAttempt, graph: BorderGraph): boolean {
  return a.status === "playing" && crossingsLeft(a) > 0 && availableMoves(a, graph).length === 0;
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
  // A country already on the route is never entered again.
  if (a.status !== "playing" || crossingsLeft(a) <= 0 || !areNeighbors(graph, currentCountry(a), to) || a.path.includes(to)) {
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

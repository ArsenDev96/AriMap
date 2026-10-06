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

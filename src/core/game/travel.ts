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

/** Every active neighbour of the current country while moves are possible. */
export function availableMoves(a: TravelAttempt, graph: BorderGraph): readonly CountryId[] {
  if (a.status !== "playing" || crossingsLeft(a) <= 0) return [];
  return neighborsOf(graph, currentCountry(a));
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
  if (a.status !== "playing" || crossingsLeft(a) <= 0 || !areNeighbors(graph, currentCountry(a), to)) {
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

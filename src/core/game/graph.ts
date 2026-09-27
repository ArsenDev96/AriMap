import type { CountryId } from "../content/types";

/** Undirected land-border graph as an adjacency list. */
export type BorderGraph = Readonly<Record<CountryId, readonly CountryId[]>>;

export function neighborsOf(graph: BorderGraph, id: CountryId): readonly CountryId[] {
  return graph[id] ?? [];
}

export function areNeighbors(graph: BorderGraph, a: CountryId, b: CountryId): boolean {
  return neighborsOf(graph, a).includes(b);
}

/** Returns human-readable problems; an empty array means the graph is valid. */
export function validateGraph(graph: BorderGraph): string[] {
  const problems: string[] = [];
  for (const [id, neighbors] of Object.entries(graph)) {
    const seen = new Set<CountryId>();
    for (const n of neighbors) {
      if (n === id) problems.push(`${id} borders itself`);
      if (seen.has(n)) problems.push(`${id} lists ${n} twice`);
      seen.add(n);
      if (!(n in graph)) problems.push(`${id} borders unknown country ${n}`);
      else if (!areNeighbors(graph, n, id)) problems.push(`${id}→${n} has no ${n}→${id}`);
    }
  }
  return problems;
}

/** Breadth-first search. Returns one shortest path including both ends, or null. */
export function shortestPath(graph: BorderGraph, from: CountryId, to: CountryId): CountryId[] | null {
  if (!(from in graph) || !(to in graph)) return null;
  const previous = new Map<CountryId, CountryId | null>([[from, null]]);
  const queue: CountryId[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) {
      const path: CountryId[] = [];
      for (let step: CountryId | null = to; step !== null; step = previous.get(step) ?? null) {
        path.unshift(step);
      }
      return path;
    }
    for (const next of neighborsOf(graph, current)) {
      if (!previous.has(next)) {
        previous.set(next, current);
        queue.push(next);
      }
    }
  }
  return null;
}

/** Minimum number of border crossings between two countries, or null if unreachable. */
export function shortestDistance(graph: BorderGraph, from: CountryId, to: CountryId): number | null {
  const path = shortestPath(graph, from, to);
  return path ? path.length - 1 : null;
}

/** True when every consecutive pair in the route shares a border. */
export function isConnectedRoute(graph: BorderGraph, route: readonly CountryId[]): boolean {
  if (route.length === 0 || !(route[0] in graph)) return false;
  return route.every((id, i) => i === 0 || areNeighbors(graph, route[i - 1], id));
}

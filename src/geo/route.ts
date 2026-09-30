import { getCountry } from "@/core/content/countries";
import type { CountryId, LonLat } from "@/core/content/types";

/** Key of a border between two countries, independent of travel direction. */
export function borderKey(a: CountryId, b: CountryId): string {
  return [a, b].sort().join("-");
}

/** Key of a route leg's turning points inside `country`, between its capital and the crossing into `other`. */
export function viaKey(country: CountryId, other: CountryId): string {
  return `${country}@${borderKey(country, other)}`;
}

export interface RouteSettings {
  /** Crossing point of each border, by borderKey. */
  crossings: Readonly<Record<string, LonLat>>;
  /** Turning points inside a country, from its capital towards a crossing, by viaKey. */
  via?: Readonly<Record<string, readonly LonLat[]>>;
}

export interface RoutePoints {
  points: LonLat[];
  /** Index in `points` of each country's capital, one per country of the path. */
  stops: number[];
}

/**
 * Schematic line for a journey through `path` (a sequence of neighbouring
 * countries): capital → border crossing → capital → … . Each move passes
 * through the two countries' shared border instead of cutting across other
 * countries or the sea; where a straight line between a capital and the
 * crossing would leave its country, the leg turns at the level's `via` points.
 * Reversed moves use the same crossing and turning points, so going back
 * retraces the line. A border without a configured crossing falls back to a
 * straight line between the capitals.
 */
export function routePoints(path: readonly CountryId[], { crossings, via = {} }: RouteSettings): RoutePoints {
  if (path.length === 0) return { points: [], stops: [] };
  const points: LonLat[] = [getCountry(path[0]).capital.coordinates];
  const stops = [0];
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]];
    const crossing = crossings[borderKey(a, b)];
    if (crossing) points.push(...(via[viaKey(a, b)] ?? []), crossing, ...[...(via[viaKey(b, a)] ?? [])].reverse());
    points.push(getCountry(b).capital.coordinates);
    stops.push(points.length - 1);
  }
  return { points, stops };
}

/** The points of `routePoints`. */
export function routeLine(path: readonly CountryId[], settings: RouteSettings): LonLat[] {
  return routePoints(path, settings).points;
}

/** A level's route settings. */
export function routeSettings(lesson: { map: { routeCrossings?: Readonly<Record<string, LonLat>>; routeVia?: Readonly<Record<string, readonly LonLat[]>> } }): RouteSettings {
  return { crossings: lesson.map.routeCrossings ?? {}, via: lesson.map.routeVia ?? {} };
}

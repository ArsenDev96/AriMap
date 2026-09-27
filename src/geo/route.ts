import { getCountry } from "@/core/content/countries";
import type { CountryId, LonLat } from "@/core/content/types";

/** Key of a border between two countries, independent of travel direction. */
export function borderKey(a: CountryId, b: CountryId): string {
  return [a, b].sort().join("-");
}

/**
 * Schematic line for a journey through `path` (a sequence of neighbouring
 * countries): capital → border crossing → capital → … . Each move passes
 * through the two countries' shared border instead of cutting across other
 * countries or the sea. Reversed moves use the same crossing, so going back
 * retraces the line. A border without a configured crossing falls back to a
 * straight line between the capitals.
 */
export function routeLine(path: readonly CountryId[], crossings: Readonly<Record<string, LonLat>>): LonLat[] {
  if (path.length === 0) return [];
  const points: LonLat[] = [getCountry(path[0]).capital.coordinates];
  for (let i = 1; i < path.length; i++) {
    const crossing = crossings[borderKey(path[i - 1], path[i])];
    if (crossing) points.push(crossing);
    points.push(getCountry(path[i]).capital.coordinates);
  }
  return points;
}

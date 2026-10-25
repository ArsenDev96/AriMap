import { RING_COUNTRIES } from "@/core/challenge/europe";
import { RING_RADIUS, type Ring } from "@/core/challenge/smallCountries";
import { COUNTRIES } from "@/core/content/countries";
import type { CountryId, LonLat } from "@/core/content/types";
import type { ChallengeMapData } from "@/geo/challengeMap";
import { insideOutlineOf } from "@/geo/hitTest";
import type { Transform } from "@/geo/regionMap";
import { toScreen, toWorld } from "../map/camera";
import type { Box, LabelRequest } from "../map/labels";

/** A country's label point: its content's, or a small country's ring point (the website's labelPoint). */
const labelPoint = (id: CountryId): LonLat | null => COUNTRIES[id]?.label.coordinates ?? RING_COUNTRIES[id] ?? null;

/**
 * The names the challenge's map shows (Results and the review), as labels.ts places them: `focus` first, then `names`
 * in order, each at its label point, a ring country's as a small one. Pure, so the layout is tested on the real map.
 */
export function nameRequests(map: ChallengeMapData, names: readonly CountryId[], focus: CountryId | null, camera: Transform, name: (id: CountryId) => string): LabelRequest[] {
  const ordered = focus ? [focus, ...names.filter((id) => id !== focus)] : names;
  return ordered.flatMap((id) => {
    const point = labelPoint(id);
    const shape = map.shapes.find((s) => s.id === id);
    if (!point || !shape) return [];
    const [[x0], [x1]] = shape.bounds;
    return [
      {
        id,
        text: name(id),
        anchor: toScreen(camera, map.project(point)),
        width: (x1 - x0) * camera.k,
        small: id in RING_COUNTRIES,
        badge: false,
        covers: (p) => insideOutlineOf(shape, toWorld(camera, p)) !== false,
      },
    ];
  });
}

/** The rings' boxes, which names and leaders keep clear of. */
export const ringBoxes = (rings: readonly Ring[]): Box[] => rings.map(({ x, y }) => ({ x0: x - RING_RADIUS, y0: y - RING_RADIUS, x1: x + RING_RADIUS, y1: y + RING_RADIUS }));

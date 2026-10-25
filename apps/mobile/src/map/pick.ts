import { RING_COUNTRIES, RING_OFFSETS } from "@/core/challenge/europe";
import { placeRing, ringAt, ringShown, type Ring } from "@/core/challenge/smallCountries";
import type { CountryId } from "@/core/content/types";
import { insideOutlineOf, outlineArea } from "@/geo/hitTest";
import type { CountryShape, Point, Transform } from "@/geo/regionMap";
import { toScreen, toWorld } from "./camera";

/** How far from a tap (px) a country is still taken as tapped, where the tap itself lands on none (the sea). */
export const TAP_REACH = 8;

/** Points around a tap, nearest first: TAP_REACH / 2 and TAP_REACH away, in eight directions. */
const AROUND: readonly Point[] = [0.5, 1].flatMap((r) =>
  Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4) * r * TAP_REACH, Math.sin((i * Math.PI) / 4) * r * TAP_REACH] as Point),
);

/**
 * The small-country rings of a view, as the Quick Challenge's (src/core/challenge/smallCountries.ts): each of `ids`
 * that is a ring country there (RING_COUNTRIES: Luxembourg, Andorra) while drawn smaller than a ring at zoom `t`,
 * at its ring point (or beside it, RING_OFFSETS: Luxembourg's, clear of Belgium), in RING_COUNTRIES' order. Every such country has one whatever is asked, so a ring never points
 * to an answer, and a press inside one answers it: Level 7's Andorra, a few pixels across on a phone, is tapped so
 * without zooming. `project` takes lon/lat to world units (the level map's projection).
 */
export function ringsFor(shapes: readonly CountryShape[], ids: readonly CountryId[], t: Transform, project: (lonLat: readonly [number, number]) => Point): Ring[] {
  return Object.entries(RING_COUNTRIES).flatMap(([id, point]) => {
    const shape = ids.includes(id) ? shapes.find((s) => s.id === id) : undefined;
    const area = shape && outlineArea(shape);
    if (area == null || !ringShown(area * t.k * t.k)) return [];
    const [x, y] = toScreen(t, project(point));
    return [placeRing(id, x, y, RING_OFFSETS[id])];
  });
}

/**
 * The country at a point on the map (px from its top-left, in view `t`), as the website's map answers a tap on its
 * drawn shapes: a small-country ring first (`rings`, as the Quick Challenge), then the level's countries, drawn over
 * the faded ones around them. A tap on none (the sea, just off a coast) takes the nearest country within TAP_REACH,
 * as a browser moves a touch to a nearby target; on land it is always the country under the finger, so a tap is
 * never given to a neighbour.
 */
export function countryAt(shapes: readonly CountryShape[], active: readonly CountryId[], t: Transform, [x, y]: Point, rings: readonly Ring[] = []): CountryId | null {
  const ring = ringAt(rings, x, y);
  if (ring) return ring;
  const own = shapes.filter((s) => active.includes(s.id));
  const context = shapes.filter((s) => !active.includes(s.id));
  const at = (p: Point) => {
    const world = toWorld(t, p);
    return own.find((s) => insideOutlineOf(s, world))?.id ?? context.find((s) => insideOutlineOf(s, world))?.id ?? null;
  };
  const exact = at([x, y]);
  if (exact) return exact;
  for (const [dx, dy] of AROUND) {
    const near = at([x + dx, y + dy]);
    if (near) return near;
  }
  return null;
}

import type { CountryId } from "@/core/content/types";
import { insideOutlineOf } from "@/geo/hitTest";
import type { CountryShape, Point, Transform } from "@/geo/regionMap";
import { toWorld } from "./camera";

/** How far from a tap (px) a country is still taken as tapped, where the tap itself lands on none (the sea). */
export const TAP_REACH = 8;

/** Points around a tap, nearest first: TAP_REACH / 2 and TAP_REACH away, in eight directions. */
const AROUND: readonly Point[] = [0.5, 1].flatMap((r) =>
  Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4) * r * TAP_REACH, Math.sin((i * Math.PI) / 4) * r * TAP_REACH] as Point),
);

/**
 * The country at a point on the map (px from its top-left, in view `t`), as the website's map answers a tap on its
 * drawn shapes: the level's countries are drawn over the faded ones around them, so they are asked first. A tap on
 * none (the sea, just off a coast) takes the nearest country within TAP_REACH, as a browser moves a touch to a nearby
 * target; on land it is always the country under the finger, so a tap is never given to a neighbour.
 */
export function countryAt(shapes: readonly CountryShape[], active: readonly CountryId[], t: Transform, [x, y]: Point): CountryId | null {
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

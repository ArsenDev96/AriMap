import type { CountryId } from "../content/types";

/**
 * The small-country rings' rules, framework-independent (no React, DOM or map code): which rings show, and which
 * country a press answers. The caller measures in screen pixels; where the rings are, and their size, is its own.
 *
 * Fair by construction: every ring country (europe.ts, RING_COUNTRIES) has a ring whenever it is drawn smaller
 * than one, in every round and whatever is asked, so a ring never points to the answer; and a ring is visible,
 * so no country is silently enlarged. A ring that would cover an asked neighbour is drawn beside its country, with
 * a leader (RING_OFFSETS). See docs/DATA.md, "Small-country rings".
 */

/** A ring's radius on screen, in CSS pixels: 24 px across, the smallest target WCAG 2.2 asks for (2.5.8). */
export const RING_RADIUS = 12;

/**
 * Whether a country shows its ring: while its own shape, at the current zoom, is smaller than the ring (its area
 * under the ring's, `area` in screen pixels²). Zoomed in further, the country is tapped as every other is.
 */
export function ringShown(area: number, radius = RING_RADIUS): boolean {
  return area < Math.PI * radius * radius;
}

export interface Ring {
  id: CountryId;
  /** The ring's centre, in screen pixels. */
  x: number;
  y: number;
  /** The country's point, where the ring is drawn beside it (RING_OFFSETS in europe.ts): a leader joins the two. */
  from?: { x: number; y: number };
}

/** Country `id`'s ring, for its point at (x, y) on screen: on the point, or `offset` pixels off it (RING_OFFSETS). */
export function placeRing(id: CountryId, x: number, y: number, offset?: readonly [number, number]): Ring {
  return offset ? { id, x: x + offset[0], y: y + offset[1], from: { x, y } } : { id, x, y };
}

/** A ring's leader, from its country's point to the ring's edge, or null for a ring on its point. */
export function ringLeader(ring: Ring, radius = RING_RADIUS): { x1: number; y1: number; x2: number; y2: number } | null {
  if (!ring.from) return null;
  const [dx, dy] = [ring.x - ring.from.x, ring.y - ring.from.y];
  const length = Math.hypot(dx, dy);
  if (length <= radius) return null;
  return { x1: ring.from.x, y1: ring.from.y, x2: ring.x - (dx / length) * radius, y2: ring.y - (dy / length) * radius };
}

/**
 * The country a press at (x, y) answers through a ring: the ring it is in, or where rings overlap, the one whose
 * centre is nearest (ties to the first in `rings`, which the caller keeps in a fixed order). Null outside every
 * ring: the press then answers by the shape under it. A ring is answered before any shape under it.
 */
export function ringAt(rings: readonly Ring[], x: number, y: number, radius = RING_RADIUS): CountryId | null {
  let found: CountryId | null = null;
  let best = radius * radius;
  for (const ring of rings) {
    const d = (ring.x - x) ** 2 + (ring.y - y) ** 2;
    if (d <= best && (found === null || d < best)) [found, best] = [ring.id, d];
  }
  return found;
}

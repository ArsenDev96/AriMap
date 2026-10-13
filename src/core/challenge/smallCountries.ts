import type { CountryId } from "../content/types";

/**
 * The small-country rings' rules, framework-independent (no React, DOM or map code): which rings show, and which
 * country a press answers. The caller measures in screen pixels; where the rings are, and their size, is its own.
 *
 * Fair by construction: every ring country (europe.ts, RING_COUNTRIES) has a ring whenever it is drawn smaller
 * than one, in every round and whatever is asked, so a ring never points to the answer; and a ring is visible,
 * so no country is silently enlarged. See docs/DATA.md, "Small-country rings".
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

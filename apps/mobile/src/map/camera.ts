import type { Bounds, Point, Transform } from "@/geo/regionMap";

/**
 * The lesson map's camera: how far it zooms and pans, as the website's map does with d3-zoom
 * (src/components/map/RegionMap.tsx): from the start view's zoom (or less, viewLimits' minScale) to MAX_ZOOM times
 * it, within viewLimits' translateExtent, constrained the way d3-zoom constrains. Pure, so it is tested on its own.
 */

/** As far in as the website's map zooms, relative to the start view. */
export const MAX_ZOOM = 8;
/** The zoom buttons' step (the website's). */
export const ZOOM_STEP = 1.6;

export interface CameraLimits {
  base: Transform;
  minScale: number;
  translateExtent: Bounds;
}

/** Room around the level's countries in the start view: the website's (4% of the map's shorter side, at least 10px). */
export function mapPadding(width: number, height: number): number {
  return Math.max(10, Math.min(width, height) * 0.04);
}

export const toWorld = (t: Transform, [x, y]: Point): Point => [(x - t.x) / t.k, (y - t.y) / t.k];
export const toScreen = (t: Transform, [x, y]: Point): Point => [x * t.k + t.x, y * t.k + t.y];

/**
 * d3-zoom's default constraint: the view (width × height on screen) stays within the extent, or is centred on it
 * where it is larger than the extent along that axis.
 */
export function constrain(t: Transform, width: number, height: number, [[ex0, ey0], [ex1, ey1]]: Bounds): Transform {
  const dx0 = (0 - t.x) / t.k - ex0;
  const dx1 = (width - t.x) / t.k - ex1;
  const dy0 = (0 - t.y) / t.k - ey0;
  const dy1 = (height - t.y) / t.k - ey1;
  const tx = dx1 > dx0 ? (dx0 + dx1) / 2 : Math.min(0, dx0) || Math.max(0, dx1);
  const ty = dy1 > dy0 ? (dy0 + dy1) / 2 : Math.min(0, dy0) || Math.max(0, dy1);
  return tx === 0 && ty === 0 ? t : { k: t.k, x: t.x + t.k * tx, y: t.y + t.k * ty };
}

const clampScale = (k: number, limits: CameraLimits) => Math.min(limits.base.k * MAX_ZOOM, Math.max(limits.minScale, k));

/** The view scaled to `k` (within the limits) about a point on screen, which stays where it is. */
export function zoomTo(t: Transform, k: number, [fx, fy]: Point, width: number, height: number, limits: CameraLimits): Transform {
  const scale = clampScale(k, limits);
  const [wx, wy] = toWorld(t, [fx, fy]);
  return constrain({ k: scale, x: fx - wx * scale, y: fy - wy * scale }, width, height, limits.translateExtent);
}

/** The view moved by a drag of (dx, dy) on screen. */
export function panBy(t: Transform, dx: number, dy: number, width: number, height: number, limits: CameraLimits): Transform {
  return constrain({ k: t.k, x: t.x + dx, y: t.y + dy }, width, height, limits.translateExtent);
}

/**
 * A pinch: the view as the gesture began (`start`), the two fingers' midpoint and distance then and now. The world
 * point under the first midpoint follows the fingers, scaled by how far they spread.
 */
export function pinch(
  start: Transform,
  from: { mid: Point; distance: number },
  to: { mid: Point; distance: number },
  width: number,
  height: number,
  limits: CameraLimits,
): Transform {
  const k = clampScale(start.k * (to.distance / Math.max(1, from.distance)), limits);
  const [wx, wy] = toWorld(start, from.mid);
  return constrain({ k, x: to.mid[0] - wx * k, y: to.mid[1] - wy * k }, width, height, limits.translateExtent);
}

/** Whether the view is (practically) the start view: "Show the whole map" has nothing to do. */
export function isBase(t: Transform, base: Transform): boolean {
  return Math.abs(t.k - base.k) < 1e-6 * base.k && Math.abs(t.x - base.x) < 0.5 && Math.abs(t.y - base.y) < 0.5;
}

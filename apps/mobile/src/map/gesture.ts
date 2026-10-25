import type { Point, Transform } from "@/geo/regionMap";
import { panBy, pinch, type CameraLimits } from "./camera";

/**
 * Tells a deliberate tap on the map from a pan or a pinch, by the website's rules (src/components/map/useTap.ts): a
 * tap is one finger that goes down and up within TAP_SLOP pixels and TAP_MAX_MS, so moving or pinching the map never
 * answers. Pure: the map feeds it the fingers on the map (in its own coordinates) and applies what it returns.
 */

/** Movement (px) beyond which a press becomes a drag, not a tap. */
export const TAP_SLOP = 10;
export const TAP_MAX_MS = 700;

export interface Finger {
  id: string;
  at: Point;
}

export interface MapGesture {
  /** The view when the current fingers went down (again after a finger joins or leaves). */
  view: Transform;
  /** Those fingers' positions then, by id. */
  fingers: ReadonlyMap<string, Point>;
  /** The press that may still be a tap: where and when it began. Null once it can't be one. */
  tap: { at: Point; time: number } | null;
}

export interface Viewport {
  width: number;
  height: number;
  limits: CameraLimits;
}

const midpoint = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** The first finger goes down on the map. */
export function beginGesture(view: Transform, fingers: readonly Finger[], time: number): MapGesture {
  return {
    view,
    fingers: new Map(fingers.map((f) => [f.id, f.at])),
    tap: fingers.length === 1 ? { at: fingers[0].at, time } : null,
  };
}

/**
 * Fingers moved, joined or left: the new view, and the gesture to go on with. When the fingers change, the gesture
 * starts again from the current view (so lifting one finger of a pinch keeps panning smoothly); a second finger means
 * it is no tap.
 */
export function moveGesture(g: MapGesture, current: Transform, fingers: readonly Finger[], viewport: Viewport): { gesture: MapGesture; view: Transform } {
  const same = fingers.length === g.fingers.size && fingers.every((f) => g.fingers.has(f.id));
  if (!same || fingers.length === 0) {
    const tap = fingers.length === 1 && g.tap && g.fingers.size === 1 && g.fingers.has(fingers[0].id) ? g.tap : null;
    return { gesture: { view: current, fingers: new Map(fingers.map((f) => [f.id, f.at])), tap }, view: current };
  }
  const { width, height, limits } = viewport;
  let tap = g.tap;
  if (fingers.length === 1) {
    const [f] = fingers;
    const was = g.fingers.get(f.id)!;
    if (tap && distance(f.at, tap.at) > TAP_SLOP) tap = null;
    // Within the slop the map stays still: a tap that wobbles never moves it.
    const view = tap ? g.view : panBy(g.view, f.at[0] - was[0], f.at[1] - was[1], width, height, limits);
    return { gesture: tap === g.tap ? g : { ...g, tap }, view };
  }
  const [a, b] = fingers;
  const [a0, b0] = [g.fingers.get(a.id)!, g.fingers.get(b.id)!];
  const view = pinch(g.view, { mid: midpoint(a0, b0), distance: distance(a0, b0) }, { mid: midpoint(a.at, b.at), distance: distance(a.at, b.at) }, width, height, limits);
  return { gesture: tap ? { ...g, tap: null } : g, view };
}

/** The last finger leaves the map at `at`: where the tap landed, or null when the press was no tap. */
export function endGesture(g: MapGesture, at: Point, time: number): Point | null {
  if (!g.tap || g.fingers.size > 1) return null;
  if (time - g.tap.time > TAP_MAX_MS || distance(at, g.tap.at) > TAP_SLOP) return null;
  return at;
}

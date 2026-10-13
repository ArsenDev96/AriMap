import { RING_RADIUS } from "@/core/challenge/smallCountries";
import type { Bounds, Transform } from "./regionMap";

/**
 * The Quick Challenge map's camera: its start view and the views it moves to, in world units (src/geo/challengeMap.ts)
 * and screen pixels. Plain arithmetic, no DOM or React, so a native app can share it; drawing is the caller's
 * (src/components/challenge/ChallengeMap.tsx).
 */

/** The view at scale `k` centred on the world point (cx, cy), moved as little as it takes to show nothing past `coverage`. */
export function viewAt(coverage: Bounds, k: number, cx: number, cy: number, width: number, height: number): Transform {
  const [[c0x, c0y], [c1x, c1y]] = coverage;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return { k, x: clamp(width / 2 - k * cx, width - k * c1x, -k * c0x), y: clamp(height / 2 - k * cy, height - k * c1y, -k * c0y) };
}

/**
 * Room the start view keeps between a small-country ring's centre and the map's edge (px): its radius, its white halo
 * (half .ringHalo's stroke) and a clear margin, so a ring by the frame's edge would show whole.
 */
const RING_EDGE_ROOM = RING_RADIUS + 1.75 + 6;

/**
 * The view fitting `frame` with `padding` px round it and every point of `marks` (world) at least RING_EDGE_ROOM px
 * inside the map: the largest zoom at which, on each axis, every lower bound (the frame's near edge, each mark) lies
 * within the room left by every upper one, then centred between them. Rings are drawn at a fixed size on screen, so
 * the room they need in world units depends on the zoom (as the levels keep their markers whole: keepMarksWhole in
 * regionMap.ts). Returns the zoom and the world point at the view's middle.
 */
export function fitWithRings(frame: Bounds, marks: readonly (readonly [number, number])[], width: number, height: number, padding: number) {
  const axes = ([0, 1] as const).map((d) => {
    const size = d === 0 ? width : height;
    const lower = [{ at: frame[0][d], room: padding }, ...marks.map((m) => ({ at: m[d], room: RING_EDGE_ROOM }))];
    const upper = [{ at: frame[1][d], room: padding }, ...marks.map((m) => ({ at: m[d], room: RING_EDGE_ROOM }))];
    let k = Infinity;
    for (const a of lower) for (const b of upper) if (b.at > a.at) k = Math.min(k, (size - a.room - b.room) / (b.at - a.at));
    return { size, lower, upper, k };
  });
  const k = Math.min(axes[0].k, axes[1].k);
  const [cx, cy] = axes.map(({ size, lower, upper }) => {
    const lo = Math.max(...lower.map((a) => a.room - a.at * k));
    const hi = Math.min(...upper.map((b) => size - b.room - b.at * k));
    return (size / 2 - (lo + hi) / 2) / k;
  });
  return { k, cx, cy };
}

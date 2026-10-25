import { describe, expect, it } from "vitest";
import type { Transform } from "@/geo/regionMap";
import type { CameraLimits } from "./camera";
import { beginGesture, endGesture, moveGesture, TAP_MAX_MS, TAP_SLOP } from "./gesture";

const base: Transform = { k: 1, x: 0, y: 0 };
// Room to pan and zoom: a large extent, from half to eight times the start view.
const viewport = { width: 300, height: 300, limits: { base, minScale: 0.5, translateExtent: [[-1000, -1000], [1300, 1300]] } as CameraLimits };
const one = (x: number, y: number, id = "1") => [{ id, at: [x, y] as const }];

describe("map gestures", () => {
  it("a press that stays put is a tap, where it was lifted", () => {
    const g = beginGesture(base, one(50, 50), 0);
    const { gesture, view } = moveGesture(g, base, one(53, 52), viewport);
    // Within the slop the map doesn't move.
    expect(view).toBe(base);
    expect(endGesture(gesture, [53, 52], 120)).toEqual([53, 52]);
  });

  it("a drag pans the map and is no tap, even if it comes back", () => {
    const g = beginGesture(base, one(50, 50), 0);
    const moved = moveGesture(g, base, one(50 + TAP_SLOP + 20, 50), viewport);
    expect(moved.view.x).toBeCloseTo(TAP_SLOP + 20);
    const back = moveGesture(moved.gesture, moved.view, one(50, 50), viewport);
    expect(endGesture(back.gesture, [50, 50], 200)).toBeNull();
  });

  it("a slow press is no tap", () => {
    const g = beginGesture(base, one(50, 50), 0);
    expect(endGesture(g, [50, 50], TAP_MAX_MS + 1)).toBeNull();
  });

  it("a second finger pinches, and the press is no tap even after it lifts", () => {
    const g = beginGesture(base, one(100, 100), 0);
    const two = [
      { id: "1", at: [100, 100] as const },
      { id: "2", at: [200, 100] as const },
    ];
    const joined = moveGesture(g, base, two, viewport);
    expect(joined.gesture.tap).toBeNull();
    const spread = moveGesture(joined.gesture, joined.view, [two[0], { id: "2", at: [300, 100] as const }], viewport);
    expect(spread.view.k).toBeCloseTo(2);
    const lifted = moveGesture(spread.gesture, spread.view, one(100, 100), viewport);
    expect(endGesture(lifted.gesture, [100, 100], 100)).toBeNull();
  });
});

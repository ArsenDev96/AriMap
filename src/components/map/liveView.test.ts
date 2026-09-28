import { describe, expect, it } from "vitest";
import { createLiveView, layerMove, MAX_LAYER_SCALE } from "./liveView";

const viewport = { width: 400, height: 300 };
const margin = { x: 200, y: 150 };
const drawn = { k: 2, x: -100, y: -50 };

/** Screen position of world point `w` in view `t`. */
const screen = (t: { k: number; x: number; y: number }, [wx, wy]: [number, number]) => [wx * t.k + t.x, wy * t.k + t.y];

describe("moving the drawn layer during a gesture", () => {
  it("puts every point of the drawn map where the live view shows it", () => {
    for (const live of [
      { k: 2, x: -40, y: -90 }, // pan
      { k: 3, x: -260, y: -140 }, // zoom in
      { k: 1.5, x: 10, y: 20 }, // zoom out
    ]) {
      const { s, dx, dy } = layerMove(drawn, live, viewport, margin);
      for (const w of [[0, 0], [123, 45], [300, 210]] as [number, number][]) {
        const [px, py] = screen(drawn, w);
        const [lx, ly] = screen(live, w);
        expect(px * s + dx).toBeCloseTo(lx, 9);
        expect(py * s + dy).toBeCloseTo(ly, 9);
      }
    }
  });

  it("is unchanged when the view is", () => {
    expect(layerMove(drawn, drawn, viewport, margin)).toEqual({ s: 1, dx: 0, dy: 0, covers: true });
  });

  it("asks for a redraw once the layer would leave part of the view uncovered", () => {
    const pan = (dx: number, dy: number) => layerMove(drawn, { ...drawn, x: drawn.x + dx, y: drawn.y + dy }, viewport, margin).covers;
    expect(pan(200, 0)).toBe(true);
    expect(pan(-200, 150)).toBe(true);
    expect(pan(201, 0)).toBe(false);
    expect(pan(0, -151)).toBe(false);
    // Zooming out about the view's centre: covered down to half the scale (with a margin of half the view).
    const zoom = (s: number) =>
      layerMove(drawn, { k: drawn.k * s, x: 200 - (200 - drawn.x) * s, y: 150 - (150 - drawn.y) * s }, viewport, margin).covers;
    expect(zoom(0.5)).toBe(true);
    expect(zoom(0.49)).toBe(false);
  });

  it("asks for a redraw once the layer would be magnified too far", () => {
    const zoom = (s: number) => layerMove(drawn, { k: drawn.k * s, x: 200 - (200 - drawn.x) * s, y: 150 - (150 - drawn.y) * s }, viewport, margin).covers;
    expect(zoom(MAX_LAYER_SCALE)).toBe(true);
    expect(zoom(MAX_LAYER_SCALE * 1.01)).toBe(false);
  });
});

describe("the live view", () => {
  it("notifies subscribers of each new view only", () => {
    const live = createLiveView({ k: 1, x: 0, y: 0 });
    let calls = 0;
    const off = live.subscribe(() => calls++);
    const next = { k: 2, x: 5, y: 5 };
    live.set(next);
    live.set(next);
    expect(calls).toBe(1);
    expect(live.get()).toBe(next);
    off();
    live.set({ k: 3, x: 0, y: 0 });
    expect(calls).toBe(1);
  });
});

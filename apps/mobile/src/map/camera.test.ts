import { describe, expect, it } from "vitest";
import { westernEuropeLesson } from "@/core/lessons/western-europe";
import { regionMapFor, viewLimits, type Transform } from "@/geo/regionMap";
import { constrain, isBase, mapPadding, MAX_ZOOM, panBy, pinch, toScreen, toWorld, zoomTo } from "./camera";

const [W, H] = [380, 320];
const map = regionMapFor(westernEuropeLesson);
const limits = viewLimits(map, W, H, mapPadding(W, H));

describe("the lesson map's camera", () => {
  it("maps screen and world points both ways", () => {
    const t: Transform = { k: 2, x: 10, y: -4 };
    expect(toWorld(t, toScreen(t, [123, 45]))).toEqual([123, 45]);
  });

  it("starts at the website's start view, which the limits keep as it is", () => {
    expect(constrain(limits.base, W, H, limits.translateExtent)).toEqual(limits.base);
    expect(isBase(limits.base, limits.base)).toBe(true);
  });

  it("zooms about a point, which stays under the finger", () => {
    const focal: [number, number] = [W / 2, H / 2];
    const before = toWorld(limits.base, focal);
    const zoomed = zoomTo(limits.base, limits.base.k * 2, focal, W, H, limits);
    expect(zoomed.k).toBeCloseTo(limits.base.k * 2);
    const after = toWorld(zoomed, focal);
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
  });

  it("zooms no further in than MAX_ZOOM, nor further out than the start view allows", () => {
    expect(zoomTo(limits.base, limits.base.k * 100, [0, 0], W, H, limits).k).toBeCloseTo(limits.base.k * MAX_ZOOM);
    expect(zoomTo(limits.base, limits.base.k / 100, [0, 0], W, H, limits).k).toBeCloseTo(limits.minScale);
  });

  it("pans only within the extent: a long drag stops at its edge", () => {
    const zoomed = zoomTo(limits.base, limits.base.k * 4, [W / 2, H / 2], W, H, limits);
    const far = panBy(zoomed, 100000, 0, W, H, limits);
    const [[ex0]] = limits.translateExtent;
    // The view's left edge is at the extent's left edge.
    expect(toWorld(far, [0, 0])[0]).toBeCloseTo(ex0, 6);
    expect(panBy(far, 50, 0, W, H, limits).x).toBeCloseTo(far.x, 6);
  });

  it("pinches about the fingers' midpoint", () => {
    const from = { mid: [100, 100] as [number, number], distance: 100 };
    const to = { mid: [100, 100] as [number, number], distance: 200 };
    const t = pinch(limits.base, from, to, W, H, limits);
    expect(t.k).toBeCloseTo(limits.base.k * 2);
    const was = toWorld(limits.base, [100, 100]);
    const now = toWorld(t, [100, 100]);
    expect(now[0]).toBeCloseTo(was[0], 6);
    expect(now[1]).toBeCloseTo(was[1], 6);
  });
});

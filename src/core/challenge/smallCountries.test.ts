/// <reference types="node" />
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fitWithRings, viewAt } from "@/geo/challengeCamera";
import { challengeMapFrom } from "@/geo/challengeMap";
import { insideOutlineOf } from "@/geo/hitTest";
import { applyTransform, type Transform } from "@/geo/regionMap";
import { CHALLENGE_POOL, RING_COUNTRIES, RING_OFFSETS } from "./europe";
import { placeRing, RING_RADIUS, ringAt, ringLeader, ringShown } from "./smallCountries";

const map = challengeMapFrom(JSON.parse(readFileSync(path.resolve(__dirname, "../../data/geo/europe-challenge.topo.json"), "utf8")));

/** The start view of a map `width` × `height` px, as the website's and the app's challenge maps fit it. */
function startView(width: number, height: number): Transform {
  const [[c0x, c0y], [c1x, c1y]] = map.coverage;
  const padding = Math.max(8, Math.min(width, height) * 0.03);
  const fit = fitWithRings(map.focusBounds, Object.values(RING_COUNTRIES).map(map.project), width, height, padding);
  const k = Math.max(fit.k, width / (c1x - c0x), height / (c1y - c0y));
  return viewAt(map.coverage, k, fit.cx, fit.cy, width, height);
}

/** The asked countries a disc at (x, y) on screen covers: each with the area covered, in px². */
function covered(view: Transform, x: number, y: number, r: number): Map<string, number> {
  const shapes = map.shapes.filter((s) => CHALLENGE_POOL.includes(s.id));
  const found = new Map<string, number>();
  const step = 0.5;
  for (let dy = -r; dy <= r; dy += step) {
    for (let dx = -r; dx <= r; dx += step) {
      if (dx * dx + dy * dy > r * r) continue;
      const world = [(x + dx - view.x) / view.k, (y + dy - view.y) / view.k] as const;
      const id = shapes.find((s) => insideOutlineOf(s, world))?.id;
      if (id) found.set(id, (found.get(id) ?? 0) + step * step);
    }
  }
  return found;
}

/** Phones' maps (a 320 dp phone's, a 360 dp phone's short and tall, a 390 px one's) and a desktop's. */
const SIZES = [
  [288, 330],
  [328, 300],
  [328, 368],
  [374, 427],
  [656, 718],
] as const;

describe("small-country rings", () => {
  it("a ring with an offset stands beside its country, with a leader from the country's point to the ring's edge", () => {
    expect(placeRing("AND", 10, 20)).toEqual({ id: "AND", x: 10, y: 20 });
    const ring = placeRing("LUX", 10, 20, [16, 0]);
    expect(ring).toEqual({ id: "LUX", x: 26, y: 20, from: { x: 10, y: 20 } });
    expect(ringLeader(ring)).toEqual({ x1: 10, y1: 20, x2: 26 - RING_RADIUS, y2: 20 });
    // A ring whose edge reaches its point needs no leader.
    expect(ringLeader(placeRing("LUX", 10, 20, [8, 0]))).toBeNull();
    expect(ringLeader(placeRing("AND", 10, 20))).toBeNull();
    // A press in the ring answers its country; at the country's own point, outside the ring, it doesn't.
    expect(ringAt([ring], 26 + RING_RADIUS - 1, 20)).toBe("LUX");
    expect(ringAt([ring], 10, 20)).toBeNull();
  });

  it("a press in Luxembourg's ring never falls on Belgium or another asked country but Germany and France, at any zoom it shows at", () => {
    const area = map.areas.get("LUX")!;
    for (const [width, height] of SIZES) {
      const base = startView(width, height);
      for (let zoom = 1; ringShown(area * (base.k * zoom) ** 2); zoom += 0.25) {
        const view = { ...base, k: base.k * zoom };
        const [x, y] = applyTransform(view, map.project(RING_COUNTRIES.LUX));
        const ring = placeRing("LUX", x, y, RING_OFFSETS.LUX);
        const under = [...covered(view, ring.x, ring.y, RING_RADIUS).keys()];
        expect(under.filter((id) => !["DEU", "FRA", "LUX"].includes(id)), `${width}×${height} at ×${zoom}`).toEqual([]);
      }
    }
  });

  it("at the start view, no press on Belgium falls in a ring, and the rings don't overlap", () => {
    for (const [width, height] of SIZES) {
      const view = startView(width, height);
      const rings = Object.entries(RING_COUNTRIES).map(([id, point]) => {
        const [x, y] = applyTransform(view, map.project(point));
        return placeRing(id, x, y, RING_OFFSETS[id]);
      });
      for (const ring of rings) expect(covered(view, ring.x, ring.y, RING_RADIUS).has("BEL")).toBe(false);
      const [a, b] = rings;
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(2 * (RING_RADIUS + 1.75));
    }
  });
});

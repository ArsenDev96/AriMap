/// <reference types="node" />
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHALLENGE_POOL, RING_COUNTRIES } from "@/core/challenge/europe";
import { RING_RADIUS } from "@/core/challenge/smallCountries";
import { getCountry } from "@/core/content/countries";
import { fitWithRings, viewAt } from "@/geo/challengeCamera";
import { challengeMapFrom } from "@/geo/challengeMap";
import type { Point, Transform } from "@/geo/regionMap";
import { toScreen } from "../map/camera";
import { countryAt, ringsFor } from "../map/pick";

/*
 * Every country the Quick Challenge asks can be tapped at its start view on small phones, without zooming: as the
 * challenge map answers a press (ChallengeMap.tsx, pick.ts), rings included.
 */

const map = challengeMapFrom(JSON.parse(readFileSync(path.resolve(__dirname, "../../../../src/data/geo/europe-challenge.topo.json"), "utf8")));

/** The start view, as ChallengeMap's limits make it. */
function startView(width: number, height: number): Transform {
  const [[c0x, c0y], [c1x, c1y]] = map.coverage;
  const padding = Math.max(8, Math.min(width, height) * 0.03);
  const fit = fitWithRings(map.focusBounds, Object.values(RING_COUNTRIES).map(map.project), width, height, padding);
  const k = Math.max(fit.k, width / (c1x - c0x), height / (c1y - c0y));
  return viewAt(map.coverage, k, fit.cx, fit.cy, width, height);
}

const STEP = 0.5;
/** A spot this wide (dp) answers the country wherever in it the finger's centre lands. */
const SPOT = 4;
const SPOT_OFFSETS: Point[] = [];
for (let dy = -SPOT / 2; dy <= SPOT / 2; dy += STEP) for (let dx = -SPOT / 2; dx <= SPOT / 2; dx += STEP) if (dx * dx + dy * dy <= (SPOT / 2) ** 2) SPOT_OFFSETS.push([dx, dy]);

/** Where on screen a press answers `id`: the area (dp²) and whether a whole SPOT-wide disc of it does. */
function tappable(view: Transform, id: string) {
  const rings = ringsFor(map.shapes, CHALLENGE_POOL, view, map.project);
  const shape = map.shapes.find((s) => s.id === id)!;
  const ring = rings.find((r) => r.id === id);
  let [[x0, y0], [x1, y1]] = shape.bounds.map(([x, y]) => toScreen(view, [x, y]));
  if (ring) [x0, y0, x1, y1] = [Math.min(x0, ring.x - RING_RADIUS), Math.min(y0, ring.y - RING_RADIUS), Math.max(x1, ring.x + RING_RADIUS), Math.max(y1, ring.y + RING_RADIUS)];
  const hits = new Set<string>();
  const key = (x: number, y: number) => `${Math.round(x / STEP)},${Math.round(y / STEP)}`;
  for (let y = Math.floor(y0) - 2; y <= y1 + 2; y += STEP) for (let x = Math.floor(x0) - 2; x <= x1 + 2; x += STEP) if (countryAt(map.shapes, CHALLENGE_POOL, view, [x, y], rings) === id) hits.add(key(x, y));
  const spot = [...hits].some((k) => {
    const [i, j] = k.split(",").map(Number);
    return SPOT_OFFSETS.every(([dx, dy]) => hits.has(key(i * STEP + dx, j * STEP + dy)));
  });
  return { area: hits.size * STEP * STEP, spot };
}

/** Maps of a 320 dp phone, a 360 dp phone with a short and a tall screen, and a 390 dp one. */
const PHONES = [
  [288, 330],
  [328, 300],
  [328, 368],
  [374, 427],
] as const;

describe("tapping the challenge's countries without zooming", () => {
  it("each of the 40 has a spot 4 dp across that answers it, on every phone size", () => {
    for (const [width, height] of PHONES) {
      const view = startView(width, height);
      const missing = CHALLENGE_POOL.filter((id) => !tappable(view, id).spot);
      expect(missing, `${width}×${height}`).toEqual([]);
    }
  }, 120_000);

  it("Belgium keeps nearly all its land (Luxembourg's ring stands beside it), and Luxembourg answers by its ring", () => {
    for (const [width, height] of PHONES) {
      const view = startView(width, height);
      // Belgium's land on screen: about 30,500 km² at the projection's scale.
      const land = map.areas.get("BEL")! * view.k * view.k;
      expect(tappable(view, "BEL").area, `${width}×${height}`).toBeGreaterThan(land * 0.9);
      const rings = ringsFor(map.shapes, CHALLENGE_POOL, view, map.project);
      const lux = rings.find((r) => r.id === "LUX")!;
      expect(countryAt(map.shapes, CHALLENGE_POOL, view, [lux.x, lux.y], rings)).toBe("LUX");
      expect(countryAt(map.shapes, CHALLENGE_POOL, view, toScreen(view, map.project(getCountry("BEL").label.coordinates)), rings)).toBe("BEL");
    }
  }, 60_000);
});

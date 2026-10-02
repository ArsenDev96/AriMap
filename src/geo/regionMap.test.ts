import { describe, expect, it } from "vitest";
import { geoContains } from "d3-geo";
import { feature, neighbors } from "topojson-client";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import topologyJson from "@/data/geo/europe-west.topo.json";
import { COUNTRIES } from "@/core/content/countries";
import { LESSONS, LEVELS } from "@/core/lessons";
import { shortestDistance, validateGraph, type BorderGraph } from "@/core/game/graph";
import { applyTransform, fitTransform, getRegionMap, MAP_DATA_CLIP, PROJECTION_FIT, regionMapFor, viewLimits, type Bounds } from "./regionMap";

const topology = topologyJson as unknown as Topology<{ countries: GeometryCollection }>;
const geometries = topology.objects.countries.geometries;

function shapeOf(id: string) {
  const g = geometries.find((x) => x.id === id)!;
  return feature(topology, g) as Feature<Polygon | MultiPolygon>;
}

/**
 * Landmarks on a coast that Natural Earth's 1:10m data draws coarser than the
 * monument: its real position may lie this far off the country's land in the data.
 * Dubrovnik's old town is about 0.5 km beyond the data's coastline (docs/DATA.md,
 * "Level 4"); every other landmark must lie inside its country.
 */
const COAST_MARGIN_KM: Readonly<Record<string, number>> = { "dubrovnik-city-walls": 0.6 };

/** Whether some point within `km` of `p` lies inside the country. */
function withinKm(id: string, p: readonly [number, number], km: number) {
  for (let d = 0.05; d <= km; d += 0.05)
    for (let a = 0; a < 360; a += 10) {
      const rad = (a * Math.PI) / 180;
      const q: [number, number] = [p[0] + (d / (111.32 * Math.cos((p[1] * Math.PI) / 180))) * Math.cos(rad), p[1] + (d / 110.57) * Math.sin(rad)];
      if (geoContains(shapeOf(id), q)) return true;
    }
  return false;
}

describe("prepared map data", () => {
  it("has unique country ids", () => {
    const ids = geometries.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const lesson of Object.values(LESSONS)) {
    it(`${lesson.id}: border graph matches shared boundaries in the data`, () => {
      const adjacency = neighbors(geometries);
      for (const id of lesson.countries) {
        const index = geometries.findIndex((g) => g.id === id);
        expect(index, id).toBeGreaterThanOrEqual(0);
        const fromData = adjacency[index].map((i) => String(geometries[i].id)).filter((n) => lesson.countries.includes(n));
        expect([...fromData].sort(), id).toEqual([...lesson.borders[id]].sort());
      }
    });

    it(`${lesson.id}: capitals, landmarks and label anchors fall inside their countries`, () => {
      for (const id of lesson.countries) {
        const c = COUNTRIES[id];
        expect(geoContains(shapeOf(id), [...c.label.coordinates]), `${id} label`).toBe(true);
        expect(geoContains(shapeOf(id), [...c.capital.coordinates]), `${id} capital`).toBe(true);
        if (c.landmark?.coordinates) {
          const inside = geoContains(shapeOf(id), [...c.landmark.coordinates]);
          const margin = COAST_MARGIN_KM[c.landmark.id];
          if (margin === undefined) expect(inside, `${id} landmark`).toBe(true);
          else expect(inside || withinKm(id, c.landmark.coordinates, margin), `${id} landmark within ${margin} km of its country`).toBe(true);
        }
      }
    });
  }

  it("keeps the quantization grid of Levels 1–4's data, so extending the clip box moved none of their coordinates", () => {
    // scripts/prepare-geo.mjs rounds on this grid whatever the box (docs/DATA.md, "Level 5").
    expect(topology.transform).toEqual({ scale: [0.0006186010505805053, 0.0003], translate: [-25.859486456999946, 32] });
  });

  it("towards-greece: keeps Greece's islands, each in Greece, and none of them clipped", () => {
    const greece = shapeOf("GRC");
    // Heraklion (Crete), Rhodes, Corfu, Mytilene (Lesbos), Chios, Kos, Gavdos (the southernmost), Thira (Santorini).
    for (const [name, p] of Object.entries({ Heraklion: [25.13, 35.335], Rhodes: [28.03, 36.24], Corfu: [19.85, 39.6], Mytilene: [26.4, 39.15], Chios: [26.0, 38.4], Kos: [27.1, 36.84], Gavdos: [24.09, 34.84], Thira: [25.43, 36.43] })) {
      expect(geoContains(greece, p as [number, number]), `${name} in Greece`).toBe(true);
      expect(geoContains(shapeOf("TUR"), p as [number, number]), `${name} in Turkey`).toBe(false);
    }
    // All of Greece lies well inside the clip box (no artificial edge cuts an island), and inside the
    // level's focus, so every island is within the start view and the pan limits.
    const map = regionMapFor(LESSONS["towards-greece"]);
    const [[gx0, gy0], [gx1, gy1]] = map.shapes.find((s) => s.id === "GRC")!.bounds;
    const [[fx0, fy0], [fx1, fy1]] = map.focusBounds;
    expect(gx0 >= fx0 && gy0 >= fy0 && gx1 <= fx1 && gy1 <= fy1).toBe(true);
    const [w, s, e] = MAP_DATA_CLIP;
    const points = (JSON.stringify(greece.geometry.coordinates).match(/-?[\d.]+,-?[\d.]+/g) ?? []).map((p) => p.split(",").map(Number));
    expect(Math.min(...points.map((p) => p[0]))).toBeGreaterThan(w + 1);
    expect(Math.min(...points.map((p) => p[1]))).toBeGreaterThan(s + 1);
    expect(Math.max(...points.map((p) => p[0]))).toBeLessThan(e - 1);
  });

  it("draws every level in the same projection, so the painted landscape lines up with each", () => {
    const [l1, l2] = [regionMapFor(LESSONS["western-europe-1"]), regionMapFor(LESSONS["around-the-alps"])];
    expect(PROJECTION_FIT).toEqual(LESSONS["western-europe-1"].countries);
    for (const p of [[6.865, 45.833], [12.4828, 41.8933], [16.3725, 48.2083]] as const) expect(l2.project(p)).toEqual(l1.project(p));
    expect(l2.shapes.find((s) => s.id === "FRA")!.d).toBe(l1.shapes.find((s) => s.id === "FRA")!.d);
  });

  // Levels 3–5 are not playable yet, but their proposed country groups are checked
  // now: every country is in the map data, and the group is connected by real land
  // borders, with at least one pair two crossings apart (a real Travel puzzle).
  for (const level of LEVELS.filter((l) => !l.lesson)) {
    it(`${level.id} (coming soon): its countries form a connected group of real neighbours`, () => {
      const adjacency = neighbors(geometries);
      const graph: BorderGraph = Object.fromEntries(
        level.countries.map((id) => {
          const index = geometries.findIndex((g) => g.id === id);
          expect(index, id).toBeGreaterThanOrEqual(0);
          return [id, adjacency[index].map((i) => String(geometries[i].id)).filter((n) => level.countries.includes(n))];
        }),
      );
      expect(validateGraph(graph)).toEqual([]);
      const distances = level.countries.flatMap((a) => level.countries.map((b) => shortestDistance(graph, a, b)));
      expect(distances.every((d) => d !== null)).toBe(true);
      expect(Math.max(...(distances as number[]))).toBeGreaterThanOrEqual(2);
    });
  }

  it("contains no overseas geometry", () => {
    const map = getRegionMap(["FRA", "BEL", "NLD", "LUX", "DEU"]);
    const france = map.shapes.find((s) => s.id === "FRA")!;
    const [[fx0, fy0], [fx1, fy1]] = france.bounds;
    const [[x0, y0], [x1, y1]] = map.focusBounds;
    expect(fx0).toBeGreaterThanOrEqual(x0);
    expect(fy0).toBeGreaterThanOrEqual(y0);
    expect(fx1).toBeLessThanOrEqual(x1);
    expect(fy1).toBeLessThanOrEqual(y1);
    // The focus area is regional (≈ France + Germany), not global.
    expect(x1 - x0).toBeGreaterThan(500);
    expect(x1 - x0).toBeLessThanOrEqual(1001);
  });

  it("fits the focus bounds inside a phone-sized viewport", () => {
    const map = getRegionMap(["FRA", "BEL", "NLD", "LUX", "DEU"]);
    const t = fitTransform(map.focusBounds, 360, 420, 12);
    const [[x0, y0], [x1, y1]] = map.focusBounds;
    expect(x0 * t.k + t.x).toBeGreaterThanOrEqual(11.99);
    expect(x1 * t.k + t.x).toBeLessThanOrEqual(348.01);
    expect(y0 * t.k + t.y).toBeGreaterThanOrEqual(11.99);
    expect(y1 * t.k + t.y).toBeLessThanOrEqual(408.01);
  });
});

describe("map coverage", () => {
  const lessons = Object.values(LESSONS);
  // Phones (portrait/landscape), tablets and desktops, including 320px and 1920px.
  const viewports = [
    [304, 294],
    [374, 388],
    [828, 260],
    [752, 470],
    [580, 690],
    [918, 720],
    [1464, 1000],
    [3000, 1350],
  ] as const;

  it("MAP_DATA_CLIP matches the box the dataset was clipped to", () => {
    // Land reaches the south, east and north edges of the clip box (North Africa and
    // Arabia, Iraq and Russia, Scandinavia), so those match the box used by
    // scripts/prepare-geo.mjs. The west edge lies in the open Atlantic. The extent of
    // the vertices themselves: geoBounds would follow great-circle edges, which bulge
    // off the clipped parallels (0.28° north of 62°N along Russia's long clipped edge,
    // far outside every level's coverage).
    let [bx0, by0, bx1, by1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const f of feature(topology, topology.objects.countries).features)
      for (const p of JSON.stringify(f.geometry ?? null).match(/-?[\d.]+,-?[\d.]+/g) ?? []) {
        const [x, y] = p.split(",").map(Number);
        [bx0, by0, bx1, by1] = [Math.min(bx0, x), Math.min(by0, y), Math.max(bx1, x), Math.max(by1, y)];
      }
    const [w, s, e, n] = MAP_DATA_CLIP;
    expect(bx0).toBeGreaterThanOrEqual(w);
    // The quantization grid rounds the clipped edges by at most about 30 m.
    expect(Math.abs(by0 - s)).toBeLessThan(0.001);
    expect(Math.abs(bx1 - e)).toBeLessThan(0.001);
    expect(Math.abs(by1 - n)).toBeLessThan(0.001);
  });

  for (const lesson of lessons) {
    const map = regionMapFor(lesson);

    it(`${lesson.id}: the coverage area lies inside the clipped data`, () => {
      const [w, s, e, n] = MAP_DATA_CLIP;
      const [[x0, y0], [x1, y1]] = map.coverage;
      for (let i = 0; i <= 50; i++) {
        const f = i / 50;
        for (const p of [
          [x0 + (x1 - x0) * f, y0],
          [x0 + (x1 - x0) * f, y1],
          [x0, y0 + (y1 - y0) * f],
          [x1, y0 + (y1 - y0) * f],
        ]) {
          const [lon, lat] = map.projection.invert!(p as [number, number])!;
          expect(lon).toBeGreaterThan(w);
          expect(lon).toBeLessThan(e);
          expect(lat).toBeGreaterThan(s);
          expect(lat).toBeLessThan(n);
        }
      }
    });

    for (const [width, height] of viewports) {
      it(`${lesson.id}: ${width}×${height} never shows beyond the data coverage`, () => {
        const { base, translateExtent } = viewLimits(map, width, height, 12);
        const inside = (b: Bounds) => {
          const [[c0x, c0y], [c1x, c1y]] = map.coverage;
          expect(b[0][0]).toBeGreaterThanOrEqual(c0x - 1e-6);
          expect(b[0][1]).toBeGreaterThanOrEqual(c0y - 1e-6);
          expect(b[1][0]).toBeLessThanOrEqual(c1x + 1e-6);
          expect(b[1][1]).toBeLessThanOrEqual(c1y + 1e-6);
        };
        // The base view (also the minimum zoom) and the pan limits both stay inside coverage.
        inside([
          [-base.x / base.k, -base.y / base.k],
          [(width - base.x) / base.k, (height - base.y) / base.k],
        ]);
        inside(translateExtent);
        // The focus stays centred in the base view.
        const [[fx0, fy0], [fx1, fy1]] = map.focusBounds;
        const [cx, cy] = applyTransform(base, [(fx0 + fx1) / 2, (fy0 + fy1) / 2]);
        expect(cx).toBeCloseTo(width / 2, 3);
        expect(cy).toBeCloseTo(height / 2, 3);
      });
    }

    it(`${lesson.id}: typical phone and desktop maps show every lesson country whole`, () => {
      for (const [width, height] of [
        [304, 294],
        [374, 388],
        [918, 720],
        [1464, 1000],
      ]) {
        const { base } = viewLimits(map, width, height, 12);
        const [[x0, y0], [x1, y1]] = map.focusBounds;
        const [sx0, sy0] = applyTransform(base, [x0, y0]);
        const [sx1, sy1] = applyTransform(base, [x1, y1]);
        expect(sx0).toBeGreaterThanOrEqual(0);
        expect(sy0).toBeGreaterThanOrEqual(0);
        expect(sx1).toBeLessThanOrEqual(width);
        expect(sy1).toBeLessThanOrEqual(height);
      }
    });
  }
});

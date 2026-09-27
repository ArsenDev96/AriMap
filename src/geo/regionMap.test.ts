import { describe, expect, it } from "vitest";
import { geoBounds, geoContains } from "d3-geo";
import { feature, neighbors } from "topojson-client";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import topologyJson from "@/data/geo/europe-west.topo.json";
import { COUNTRIES } from "@/core/content/countries";
import { LESSONS } from "@/core/lessons";
import { applyTransform, fitTransform, getRegionMap, MAP_DATA_CLIP, viewLimits, type Bounds } from "./regionMap";

const topology = topologyJson as unknown as Topology<{ countries: GeometryCollection }>;
const geometries = topology.objects.countries.geometries;

function shapeOf(id: string) {
  const g = geometries.find((x) => x.id === id)!;
  return feature(topology, g) as Feature<Polygon | MultiPolygon>;
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
        if (c.landmark?.coordinates) expect(geoContains(shapeOf(id), [...c.landmark.coordinates]), `${id} landmark`).toBe(true);
      }
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
    // Land reaches the south, east and north edges of the clip box (North Africa,
    // Russia, Scandinavia), so those match the box used by scripts/prepare-geo.mjs.
    // The west edge lies in the open Atlantic.
    const [[bx0, by0], [bx1, by1]] = geoBounds(feature(topology, topology.objects.countries));
    const [w, s, e, n] = MAP_DATA_CLIP;
    expect(bx0).toBeGreaterThanOrEqual(w);
    // geoBounds follows great-circle edges, which bulge slightly off the clipped parallels.
    expect(Math.abs(by0 - s)).toBeLessThan(0.1);
    expect(Math.abs(bx1 - e)).toBeLessThan(0.1);
    expect(Math.abs(by1 - n)).toBeLessThan(0.1);
  });

  for (const lesson of lessons) {
    const map = getRegionMap(lesson.countries);

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

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { geoContains, geoDistance } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import topologyJson from "@/data/geo/europe-west.topo.json";
import type { LonLat } from "@/core/content/types";
import relief from "@/assets/map/alps-relief.json";
import { getRegionMap } from "./regionMap";
import { FORESTS, MOUNTAIN_RANGES, SCENERY_FREE, WAVES, detailLevel, gridPoint, pointsAlong } from "./terrain";

const topology = topologyJson as unknown as Topology<{ countries: GeometryCollection }>;
const countries = (feature(topology, topology.objects.countries) as FeatureCollection<Polygon | MultiPolygon>).features;
const countryAt = (p: LonLat) => countries.find((f) => geoContains(f, [...p]))?.id ?? null;
const EARTH_KM = 6371;

/** Points on a circle of `km` around p. */
const ring = (p: LonLat, km: number, n = 12): LonLat[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return [p[0] + ((km / 111.32) * Math.cos(a)) / Math.cos((p[1] * Math.PI) / 180), p[1] + (km / 111.32) * Math.sin(a)];
  });

describe("terrain anchors", () => {
  it("each forest's centre lies in its country, never in the Low Countries", () => {
    for (const f of FORESTS) {
      expect(countryAt(f.center), f.id).toBe(f.country);
      expect(SCENERY_FREE.has(f.country), f.id).toBe(false);
    }
  });

  it("every crest point is on land, outside the Low Countries", () => {
    for (const range of MOUNTAIN_RANGES)
      for (const crest of range.crests)
        for (const p of crest) {
          const id = countryAt(p);
          expect(id, `${range.id} ${p}`).not.toBeNull();
          expect(SCENERY_FREE.has(String(id)), `${range.id} ${p} in ${id}`).toBe(false);
        }
  });

  it("wave marks are in open water, at least 25 km from any coast", () => {
    for (const w of WAVES) for (const p of [w.at, ...ring(w.at, 25)]) expect(countryAt(p), `${w.sea} ${p}`).toBeNull();
  });
});

describe("Alpine relief", () => {
  const map = getRegionMap(["FRA", "BEL", "NLD", "LUX", "DEU"]);

  it("was generated with the map's own projection", () => {
    for (const { lonLat, world } of relief.check) {
      const [x, y] = map.project(lonLat as unknown as LonLat);
      expect(Math.abs(x - world[0]), String(lonLat)).toBeLessThan(0.01);
      expect(Math.abs(y - world[1]), String(lonLat)).toBeLessThan(0.01);
    }
  });

  it("covers every Alpine crest point at both levels of detail, with the levels aligned", () => {
    const alps = MOUNTAIN_RANGES.find((r) => r.id === "alps")!;
    expect(alps.relief).toBe(true);
    const { base, detail } = relief.levels;
    // Same origin; sizes differ by less than a pixel of the coarser level.
    expect(detail.x).toBe(base.x);
    expect(detail.y).toBe(base.y);
    expect(Math.abs(detail.width - base.width)).toBeLessThan(1 / 1.6);
    expect(Math.abs(detail.height - base.height)).toBeLessThan(1 / 1.6);
    for (const crest of alps.crests)
      for (const point of crest) {
        const [x, y] = map.project(point);
        // Well inside, so the feathered edge never fades a crest.
        expect(x - base.x, String(point)).toBeGreaterThan(20);
        expect(base.x + base.width - x, String(point)).toBeGreaterThan(20);
        expect(y - base.y, String(point)).toBeGreaterThan(20);
        expect(base.y + base.height - y, String(point)).toBeGreaterThan(20);
      }
  });

  it("stays clear of the Low Countries", () => {
    const { base } = relief.levels;
    for (const id of SCENERY_FREE) {
      // The whole country lies north of the relief raster.
      const shape = map.shapes.find((s) => s.id === id)!;
      expect(shape.bounds[1][1], id).toBeLessThan(base.y);
    }
  });
});

describe("scenery level of detail", () => {
  it("keeps every coarser grid point at finer levels", () => {
    const cache = new Map();
    for (let level = 0; level < 4; level++) {
      const size = 100 / 2 ** level;
      for (let i = 0; i < 2 ** level; i++)
        for (let j = 0; j < 2 ** level; j++) {
          const p = gridPoint(7, 100, level, i, j, cache);
          // The same point is found again in its child cell one level down.
          const child = gridPoint(7, 100, level + 1, Math.floor(p[0] / (size / 2)), Math.floor(p[1] / (size / 2)), cache);
          expect(child).toEqual(p);
        }
    }
  });

  it("chooses spacing that stays at least the target on screen", () => {
    for (const k of [0.25, 0.4, 0.7, 1.3, 3, 5.6]) {
      const level = detailLevel(k, 30, 128);
      const spacing = 128 / 2 ** level;
      if (level > 0) expect(spacing * k).toBeGreaterThanOrEqual(30);
      expect((spacing / 2) * k < 30 || level === 6).toBe(true);
    }
  });

  it("places ridge points at a fixed phase, so finer spacing keeps the coarser points", () => {
    const line: [number, number][] = [
      [0, 0],
      [100, 0],
      [100, 60],
    ];
    const coarse = pointsAlong(line, 40, 20).map((p) => p.along);
    const fine = pointsAlong(line, 20, 20).map((p) => p.along);
    expect(coarse.every((a) => fine.includes(a))).toBe(true);
    expect(coarse).toEqual([20, 60, 100, 140]);
  });
});

/**
 * Optional check against Natural Earth's named physical regions (1:10m
 * geography_regions_polys, as GeoJSON). Run with
 *   NE_REGIONS=path/to/regions.geojson npx vitest run src/geo/terrain.test.ts
 * Every crest point must lie inside (or within 15 km of) its named range.
 */
describe.skipIf(!process.env.NE_REGIONS)("terrain against Natural Earth regions", () => {
  const regions = process.env.NE_REGIONS ? (JSON.parse(readFileSync(process.env.NE_REGIONS, "utf8")) as FeatureCollection) : null;

  // Natural Earth's rings are wound for planar use; test containment in the plane.
  const rings = (f: Feature) => {
    const g = f.geometry as Polygon | MultiPolygon;
    return (g.type === "Polygon" ? [g.coordinates] : g.coordinates).flat() as number[][][];
  };
  const inside = (f: Feature, [x, y]: LonLat) => {
    let hit = false;
    for (const r of rings(f))
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i];
        const [xj, yj] = r[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
      }
    return hit;
  };
  const nearestKm = (f: Feature, p: LonLat) => Math.min(...rings(f).flat().map((q) => geoDistance([...p], q as [number, number]) * EARTH_KM));

  for (const range of MOUNTAIN_RANGES.filter((r) => r.naturalEarth)) {
    it(`${range.id} follows Natural Earth's ${range.naturalEarth}`, () => {
      const region = regions!.features.find((f) => f.properties?.NAME_EN === range.naturalEarth);
      expect(region, range.naturalEarth!).toBeDefined();
      for (const crest of range.crests)
        for (const p of crest) {
          const ok = inside(region!, p) || nearestKm(region!, p) <= 15;
          expect(ok, `${range.id} ${p}: ${inside(region!, p) ? "inside" : `${nearestKm(region!, p).toFixed(0)} km outside`}`).toBe(true);
        }
    });
  }
});

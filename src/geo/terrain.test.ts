import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { geoContains, geoDistance } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import topologyJson from "@/data/geo/europe-west.topo.json";
import type { LonLat } from "@/core/content/types";
import { FORESTS, MOUNTAIN_RANGES, WAVES } from "./terrain";

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
  it("each forest's centre lies in its country", () => {
    for (const f of FORESTS) expect(countryAt(f.center), f.id).toBe(f.country);
  });

  it("every crest point is on land", () => {
    for (const range of MOUNTAIN_RANGES)
      for (const crest of range.crests) for (const p of crest) expect(countryAt(p), `${range.id} ${p}`).not.toBeNull();
  });

  it("wave marks are in open water, at least 25 km from any coast", () => {
    for (const w of WAVES) for (const p of [w.at, ...ring(w.at, 25)]) expect(countryAt(p), `${w.sea} ${p}`).toBeNull();
  });
});

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

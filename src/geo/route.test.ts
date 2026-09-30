import { describe, expect, it } from "vitest";
import { geoContains, geoDistance } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { Feature, MultiLineString, MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import topologyJson from "@/data/geo/europe-west.topo.json";
import { COUNTRIES } from "@/core/content/countries";
import type { CountryId, LonLat } from "@/core/content/types";
import { shortestDistance, type BorderGraph } from "@/core/game/graph";
import { LESSONS } from "@/core/lessons";
import { regionMapFor } from "./regionMap";
import { borderKey, routeLine, routePoints, routeSettings, viaKey } from "./route";

const topology = topologyJson as unknown as Topology<{ countries: GeometryCollection }>;
const EARTH_KM = 6371;
const km = (a: LonLat, b: LonLat) => geoDistance([...a], [...b]) * EARTH_KM;

function shapeOf(id: CountryId) {
  const g = topology.objects.countries.geometries.find((x) => x.id === id)!;
  return feature(topology, g) as Feature<Polygon | MultiPolygon>;
}

function sharedBorder(a: CountryId, b: CountryId): MultiLineString {
  return mesh(topology, topology.objects.countries, (x, y) => (x.id === a && y.id === b) || (x.id === b && y.id === a));
}

/** Points along the line as drawn: straight in the map projection, not along great circles. */
function drawnSamples(lesson: (typeof LESSONS)[string], from: LonLat, to: LonLat, steps = 400): LonLat[] {
  const map = regionMapFor(lesson);
  const [x0, y0] = map.project(from);
  const [x1, y1] = map.project(to);
  const out: LonLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    out.push(map.projection.invert!([x0 + (x1 - x0) * f, y0 + (y1 - y0) * f]) as unknown as LonLat);
  }
  return out;
}

/** Every path of the shortest length from `from` to `to`. */
function allShortestPaths(graph: BorderGraph, from: CountryId, to: CountryId): CountryId[][] {
  const length = shortestDistance(graph, from, to)!;
  const out: CountryId[][] = [];
  const walk = (path: CountryId[]) => {
    const here = path[path.length - 1];
    if (path.length - 1 === length) {
      if (here === to) out.push(path);
      return;
    }
    for (const next of graph[here]) if (!path.includes(next)) walk([...path, next]);
  };
  walk([from]);
  return out;
}

/** Near the crossing the drawn line may graze the (simplified) border line itself. */
const BORDER_TOLERANCE_KM = 3;

for (const lesson of Object.values(LESSONS)) {
  const crossings = lesson.map.routeCrossings ?? {};
  const via = lesson.map.routeVia ?? {};
  const settings = routeSettings(lesson);
  const moves = lesson.countries.flatMap((a) => lesson.borders[a].map((b) => [a, b] as const));

  describe(`${lesson.id}: Travel route line`, () => {
    it("has a crossing for exactly the level's borders, and turning points only for them", () => {
      const expected = new Set(moves.map(([a, b]) => borderKey(a, b)));
      expect(new Set(Object.keys(crossings))).toEqual(expected);
      for (const key of Object.keys(via)) expect(moves.some(([a, b]) => viaKey(a, b) === key), key).toBe(true);
    });

    for (const [a, b] of moves) {
      it(`${a} → ${b} crosses their shared border and stays in those two countries`, () => {
        const line = routeLine([a, b], settings);
        const crossing = crossings[borderKey(a, b)];
        const [viaA, viaB] = [via[viaKey(a, b)] ?? [], via[viaKey(b, a)] ?? []];
        expect(line).toEqual([COUNTRIES[a].capital.coordinates, ...viaA, crossing, ...[...viaB].reverse(), COUNTRIES[b].capital.coordinates]);

        // The crossing point is on the real shared border (a vertex of it, rounded to ~10 m).
        const border = sharedBorder(a, b).coordinates.flat() as unknown as LonLat[];
        expect(Math.min(...border.map((p) => km(p, crossing))), "distance to shared border").toBeLessThan(0.05);

        // Capital → (turning points →) crossing is drawn inside the start country, and on to the capital inside the next one.
        const at = line.indexOf(crossing);
        for (let i = 1; i < line.length; i++) {
          const country = i <= at ? a : b;
          const outside = drawnSamples(lesson, line[i - 1], line[i]).filter(
            (p) => km(p, crossing) > BORDER_TOLERANCE_KM && !geoContains(shapeOf(country), [...p]),
          );
          expect(outside, `${a} → ${b}: points outside ${country}`).toEqual([]);
        }
      });
    }

    it("retraces the same line for a reversed move", () => {
      for (const [a, b] of moves) expect(routeLine([b, a], settings)).toEqual([...routeLine([a, b], settings)].reverse());
    });

    it("adds one leg per move, so undo and restart remove it", () => {
      const [a, b] = moves[0];
      expect(routeLine([], settings)).toEqual([]);
      expect(routeLine([a], settings)).toEqual([COUNTRIES[a].capital.coordinates]);
      const one = routePoints([a, b], settings);
      const two = routePoints([a, b, a], settings);
      expect(one.stops).toEqual([0, one.points.length - 1]);
      expect(two.stops).toHaveLength(3);
      // Undoing the last move gives the line of the shorter path: a prefix of the longer line.
      expect(two.points.slice(0, one.points.length)).toEqual(one.points);
      for (const { points, stops } of [one, two]) stops.forEach((at, i) => expect(points[at]).toEqual(COUNTRIES[[a, b, a][i]].capital.coordinates));
    });

    it("draws every shortest journey only through its own countries", () => {
      const { from, to } = lesson.travel.mission;
      const paths = allShortestPaths(lesson.borders, from, to);
      if (lesson.id === "western-europe-1") {
        expect(paths.map((p) => p.join("→")).sort()).toEqual(["FRA→BEL→NLD", "FRA→DEU→NLD"]);
      }
      if (lesson.id === "around-the-alps") {
        expect(paths.map((p) => p.join("→")).sort()).toEqual(["FRA→CHE→AUT", "FRA→DEU→AUT", "FRA→ITA→AUT"]);
      }
      for (const path of paths) {
        const line = routeLine(path, settings);
        const others = lesson.countries.filter((id) => !path.includes(id));
        for (let i = 1; i < line.length; i++) {
          for (const p of drawnSamples(lesson, line[i - 1], line[i], 200)) {
            for (const id of others) expect(geoContains(shapeOf(id), [...p]), `${path.join("→")} enters ${id}`).toBe(false);
          }
        }
      }
    });
  });
}

describe("western-europe-1 regression: France → Germany", () => {
  it("does not pass through Belgium or Luxembourg", () => {
    const lesson = LESSONS["western-europe-1"];
    const line = routeLine(["FRA", "DEU"], routeSettings(lesson));
    for (let i = 1; i < line.length; i++) {
      for (const p of drawnSamples(lesson, line[i - 1], line[i])) {
        expect(geoContains(shapeOf("BEL"), [...p])).toBe(false);
        expect(geoContains(shapeOf("LUX"), [...p])).toBe(false);
      }
    }
  });
});

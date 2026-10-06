import { describe, expect, it } from "vitest";
import { geoBounds, geoContains, geoDistance } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { Feature, MultiLineString, MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import topologyJson from "@/data/geo/europe-west.topo.json";
import { COUNTRIES } from "@/core/content/countries";
import type { CountryId, LonLat } from "@/core/content/types";
import { shortestDistance, type BorderGraph } from "@/core/game/graph";
import { LESSON_VERSIONS, LESSONS, versionKey } from "@/core/lessons";
import { balticJourneyOriginalLesson } from "@/core/lessons/baltic-journey";
import { regionMapFor } from "./regionMap";
import { borderKey, routeLine, routePoints, routeSettings, viaKey } from "./route";

const topology = topologyJson as unknown as Topology<{ countries: GeometryCollection }>;
const EARTH_KM = 6371;
const km = (a: LonLat, b: LonLat) => geoDistance([...a], [...b]) * EARTH_KM;

const shapes = new Map<CountryId, Feature<Polygon | MultiPolygon>>();
function shapeOf(id: CountryId) {
  if (!shapes.has(id)) shapes.set(id, feature(topology, topology.objects.countries.geometries.find((x) => x.id === id)!) as Feature<Polygon | MultiPolygon>);
  return shapes.get(id)!;
}

/** Whether a point lies in the country; its bounding box is checked first, as there are 74 countries to try. */
const boxes = new Map<CountryId, [[number, number], [number, number]]>();
function inCountry(id: CountryId, p: LonLat) {
  if (!boxes.has(id)) boxes.set(id, geoBounds(shapeOf(id)));
  const [[x0, y0], [x1, y1]] = boxes.get(id)!;
  return p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1 && geoContains(shapeOf(id), [...p]);
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

const ALL_IDS = topology.objects.countries.geometries.map((g) => String(g.id));
const same = (p: LonLat, q: LonLat) => p[0] === q[0] && p[1] === q[1];

// Every version of every level: an attempt started on Level 6's first version still draws its journey.
for (const lesson of LESSON_VERSIONS) {
  const crossings = lesson.map.routeCrossings ?? {};
  const via = lesson.map.routeVia ?? {};
  const settings = routeSettings(lesson);
  const moves = lesson.countries.flatMap((a) => lesson.borders[a].map((b) => [a, b] as const));
  const links = lesson.map.routeLinks ?? [];
  /** The fixed link (a bridge inside one country) a leg segment follows, if any. */
  const linkOf = (country: CountryId, p: LonLat, q: LonLat) =>
    links.find((l) => l.country === country && ((same(l.points[0], p) && same(l.points[1], q)) || (same(l.points[0], q) && same(l.points[1], p))));

  describe(`${versionKey(lesson)}: Travel route line`, () => {
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
          const link = linkOf(country, line[i - 1], line[i]);
          if (link) {
            // A declared fixed link (a bridge inside the country) may cross water, but never another country.
            for (const p of drawnSamples(lesson, line[i - 1], line[i])) {
              for (const id of ALL_IDS.filter((x) => x !== country)) expect(inCountry(id, p), `${link.name} enters ${id}`).toBe(false);
            }
            continue;
          }
          const outside = drawnSamples(lesson, line[i - 1], line[i]).filter(
            (p) => km(p, crossing) > BORDER_TOLERANCE_KM && !geoContains(shapeOf(country), [...p]),
          );
          expect(outside, `${a} → ${b}: points outside ${country}`).toEqual([]);
        }
      });
    }

    it("uses each fixed link in a leg of its own country, joining two parts of that country's land", () => {
      for (const link of links) {
        expect(lesson.countries, link.name).toContain(link.country);
        // Short: a bridge, not a sea route.
        expect(km(link.points[0], link.points[1]), link.name).toBeLessThan(5);
        // Both ends on the country's land.
        for (const p of link.points) expect(geoContains(shapeOf(link.country), [...p]), `${link.name} end ${p}`).toBe(true);
        // Used by some leg of that country, as two consecutive points.
        const used = Object.entries(via).some(([key, points]) => key.startsWith(`${link.country}@`) && points.some((p, i) => i > 0 && linkOf(link.country, points[i - 1], p) === link));
        expect(used, link.name).toBe(true);
      }
    });

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
      // Through Czechia or Slovakia, and through Germany too: Germany borders both Poland and Austria.
      if (lesson.id === "central-europe") {
        expect(paths.map((p) => p.join("→")).sort()).toEqual(["POL→CZE→AUT", "POL→DEU→AUT", "POL→SVK→AUT"]);
      }
      // One: Croatia, then Slovenia, Italy's only neighbour here. Through Bosnia and Herzegovina is a crossing more.
      if (lesson.id === "along-the-adriatic") {
        expect(paths.map((p) => p.join("→"))).toEqual(["MNE→HRV→SVN→ITA"]);
      }
      // Two: through Romania or Serbia, then Bulgaria, Greece's only neighbour here.
      if (lesson.id === "towards-greece") {
        expect(paths.map((p) => p.join("→")).sort()).toEqual(["HUN→ROU→BGR→GRC", "HUN→SRB→BGR→GRC"]);
      }
      // Two: Lithuania or Belarus, then Latvia, Estonia's only neighbour here. Before Belarus replaced Germany: one, a chain.
      if (versionKey(lesson) === "baltic-journey-r2") {
        expect(paths.map((p) => p.join("→")).sort()).toEqual(["POL→BLR→LVA→EST", "POL→LTU→LVA→EST"]);
      }
      if (versionKey(lesson) === "baltic-journey") {
        expect(paths.map((p) => p.join("→"))).toEqual(["DEU→POL→LTU→LVA→EST"]);
      }
      // One: Spain, then France. Through Andorra is a crossing more.
      if (lesson.id === "iberian-journey") {
        expect(paths.map((p) => p.join("→"))).toEqual(["PRT→ESP→FRA→ITA"]);
      }
      // One: Ukraine, the only country that borders both Poland and Moldova.
      if (lesson.id === "eastern-europe") {
        expect(paths.map((p) => p.join("→"))).toEqual(["POL→UKR→MDA"]);
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

describe("central-europe: reuses Level 2's Germany–Austria line", () => {
  it("has the same crossing and turning points, so the same move is drawn the same in both levels", () => {
    const [alps, central] = [LESSONS["around-the-alps"], LESSONS["central-europe"]];
    expect(routeLine(["DEU", "AUT"], routeSettings(central))).toEqual(routeLine(["DEU", "AUT"], routeSettings(alps)));
    expect(routeLine(["DEU", "AUT"], routeSettings(central))).toHaveLength(5);
    // Level 3's other legs need no turning points.
    expect(Object.keys(central.map.routeVia ?? {}).sort()).toEqual(["AUT@AUT-DEU", "DEU@AUT-DEU"]);
  });
});

describe("towards-greece: Greece's leg runs up its own mainland", () => {
  const lesson = LESSONS["towards-greece"];
  const line = routeLine(["BGR", "GRC"], routeSettings(lesson));

  it("turns only on the Bulgarian–Greek border's legs; every other move is straight", () => {
    expect(Object.keys(lesson.map.routeVia ?? {}).sort()).toEqual(["BGR@BGR-GRC", "GRC@BGR-GRC"]);
    expect(lesson.map.routeLinks ?? []).toEqual([]);
    // Sofia, a turning point near Smolyan, the crossing in the Rhodopes, three in Greece, Athens.
    expect(line).toHaveLength(7);
  });

  it("never crosses the sea: every point drawn is on Greek or Bulgarian land, clear of North Macedonia and Turkey", () => {
    for (let i = 1; i < line.length; i++) {
      for (const p of drawnSamples(lesson, line[i - 1], line[i], 200)) {
        const crossing = lesson.map.routeCrossings!["BGR-GRC"];
        if (km(p, crossing) <= BORDER_TOLERANCE_KM) continue;
        expect(geoContains(shapeOf("GRC"), [...p]) || geoContains(shapeOf("BGR"), [...p]), `${p} at sea or abroad`).toBe(true);
        for (const id of ["MKD", "TUR", "ALB"]) expect(geoContains(shapeOf(id), [...p]), `${p} in ${id}`).toBe(false);
      }
    }
  });
});

describe("eastern-europe: straight legs through real border crossings, on land", () => {
  const lesson = LESSONS["eastern-europe"];
  const settings = routeSettings(lesson);

  it("needs no turning points and no fixed links: every leg is one straight line from a capital to a crossing", () => {
    expect(lesson.map.routeVia ?? {}).toEqual({});
    expect(lesson.map.routeLinks ?? []).toEqual([]);
    // Romania and Ukraine meet twice (Maramureș and Bukovina; the Danube delta): the crossing is on the northern border.
    expect(lesson.map.routeCrossings!["ROU-UKR"][1]).toBeGreaterThan(47.5);
  });

  it("draws Poland → Ukraine → Moldova on Polish, Ukrainian and Moldovan land, never in Belarus, Romania, Russia or at sea", () => {
    const path = ["POL", "UKR", "MDA"];
    const line = routeLine(path, settings);
    // Warsaw, the Polish–Ukrainian crossing, Kyiv, the Ukrainian–Moldovan crossing, Chisinau.
    expect(line).toHaveLength(5);
    const crossings = Object.values(lesson.map.routeCrossings ?? {});
    for (let i = 1; i < line.length; i++) {
      for (const p of drawnSamples(lesson, line[i - 1], line[i], 300)) {
        if (crossings.some((c) => km(p, c) <= BORDER_TOLERANCE_KM)) continue;
        expect(path.some((id) => geoContains(shapeOf(id), [...p])), `${p} at sea or abroad`).toBe(true);
        for (const id of ["BLR", "ROU", "RUS", "SVK", "HUN", "LTU"]) expect(geoContains(shapeOf(id), [...p]), `${p} in ${id}`).toBe(false);
      }
    }
  });
});

describe("baltic-journey: two ways north, each a straight line through real border crossings, on land", () => {
  const lesson = LESSONS["baltic-journey"];
  const settings = routeSettings(lesson);

  it("reuses Level 8's Poland–Belarus line and the first version's crossings; only Belarus–Lithuania and Belarus–Latvia are new", () => {
    expect(lesson.map.routeVia ?? {}).toEqual({});
    expect(lesson.map.routeLinks ?? []).toEqual([]);
    expect(routeLine(["POL", "BLR"], settings)).toEqual(routeLine(["POL", "BLR"], routeSettings(LESSONS["eastern-europe"])));
    for (const key of ["LTU-POL", "LTU-LVA", "EST-LVA"]) expect(lesson.map.routeCrossings![key], key).toEqual(balticJourneyOriginalLesson.map.routeCrossings![key]);
    // Rule 1's vertices: south-east of Vilnius, on the road to Minsk; east of Daugavpils.
    expect(lesson.map.routeCrossings!["BLR-LTU"]).toEqual([25.6162, 54.4412]);
    expect(lesson.map.routeCrossings!["BLR-LVA"]).toEqual([27.1107, 55.8362]);
    // The way through Lithuania is drawn as it was before Belarus replaced Germany.
    expect(routeLine(["POL", "LTU", "LVA", "EST"], settings)).toEqual(routeLine(["POL", "LTU", "LVA", "EST"], routeSettings(balticJourneyOriginalLesson)));
  });

  for (const path of [
    ["POL", "LTU", "LVA", "EST"],
    ["POL", "BLR", "LVA", "EST"],
  ]) {
    it(`draws ${path.join(" → ")} on its own countries' land, never at sea, in Russia (Kaliningrad) or in the other way's country`, () => {
      const line = routeLine(path, settings);
      // Warsaw, a crossing, a capital, a crossing, Riga, a crossing, Tallinn.
      expect(line).toHaveLength(7);
      const crossings = Object.values(lesson.map.routeCrossings ?? {});
      const other = path.includes("LTU") ? "BLR" : "LTU";
      for (let i = 1; i < line.length; i++) {
        for (const p of drawnSamples(lesson, line[i - 1], line[i], 300)) {
          if (crossings.some((c) => km(p, c) <= BORDER_TOLERANCE_KM)) continue;
          expect(path.some((id) => geoContains(shapeOf(id), [...p])), `${p} at sea or abroad`).toBe(true);
          for (const id of [other, "RUS", "UKR", "FIN"]) expect(geoContains(shapeOf(id), [...p]), `${p} in ${id}`).toBe(false);
        }
      }
    });
  }
});

describe("iberian-journey: reuses Level 2's France–Italy line; Lisbon's leg goes round the Tagus estuary", () => {
  const lesson = LESSONS["iberian-journey"];
  const settings = routeSettings(lesson);

  it("draws France → Italy exactly as Level 2 does, with its turning point inland of La Spezia", () => {
    expect(routeLine(["FRA", "ITA"], settings)).toEqual(routeLine(["FRA", "ITA"], routeSettings(LESSONS["around-the-alps"])));
    expect(routeLine(["FRA", "ITA"], settings)).toHaveLength(4);
    // The only other turning point is Portugal's, north of Lisbon; no fixed links.
    expect(Object.keys(lesson.map.routeVia ?? {}).sort()).toEqual(["ITA@FRA-ITA", "PRT@ESP-PRT"]);
    expect(lesson.map.routeLinks ?? []).toEqual([]);
  });

  it("never crosses the sea or the Tagus: the whole journey is on Portuguese, Spanish, French or Italian land, clear of Andorra", () => {
    const path = ["PRT", "ESP", "FRA", "ITA"];
    const line = routeLine(path, settings);
    // Lisbon, the turning point near Torres Vedras, the crossing, Madrid, the Pyrenees, Paris, the Alps, Lunigiana, Rome.
    expect(line).toHaveLength(9);
    const crossings = Object.values(lesson.map.routeCrossings ?? {});
    for (let i = 1; i < line.length; i++) {
      for (const p of drawnSamples(lesson, line[i - 1], line[i], 300)) {
        if (crossings.some((c) => km(p, c) <= BORDER_TOLERANCE_KM)) continue;
        expect(path.some((id) => geoContains(shapeOf(id), [...p])), `${p} at sea or abroad`).toBe(true);
        for (const id of ["AND", "MCO", "CHE", "SMR", "VAT"]) expect(geoContains(shapeOf(id), [...p]), `${p} in ${id}`).toBe(false);
      }
    }
    // A straight line from Lisbon to the crossing would cross the estuary.
    const straight = drawnSamples(lesson, COUNTRIES.PRT.capital.coordinates, lesson.map.routeCrossings!["ESP-PRT"], 300);
    expect(straight.some((p) => !geoContains(shapeOf("PRT"), [...p]))).toBe(true);
  });
});

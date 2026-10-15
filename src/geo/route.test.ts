import { describe, expect, it } from "vitest";
import { geoBounds, geoContains, geoDistance } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { Feature, MultiLineString, MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import topologyJson from "@/data/geo/europe-west.topo.json";
import northJson from "@/data/geo/europe-north.topo.json";
import channelJson from "@/data/geo/europe-channel.topo.json";
import { COUNTRIES } from "@/core/content/countries";
import type { CountryId, LonLat } from "@/core/content/types";
import { shortestDistance, type BorderGraph } from "@/core/game/graph";
import { availableMoves, createAttempt, currentCountry, move } from "@/core/game/travel";
import { LESSON_VERSIONS, LESSONS, travelCountries, versionKey } from "@/core/lessons";
import { balticJourneyOriginalLesson } from "@/core/lessons/baltic-journey";
import { regionMapFor, setMapData, setNorthData, type MapDataset } from "./regionMap";
import { borderKey, routeLine, routePoints, routeSettings, viaKey } from "./route";

const topology = topologyJson as unknown as Topology<{ countries: GeometryCollection }>;
/** Level 10's northern data, given to the map as loadMapData would. */
const north = northJson as unknown as Topology<{ countries: GeometryCollection }>;
setNorthData(north);
/** Level 11's Channel data, likewise. */
const channel = channelJson as unknown as Topology<{ countries: GeometryCollection }>;
setMapData("channel", channel);
const TOPOLOGIES: Readonly<Record<MapDataset, Topology<{ countries: GeometryCollection }>>> = { west: topology, north, channel };
const EARTH_KM = 6371;
const km = (a: LonLat, b: LonLat) => geoDistance([...a], [...b]) * EARTH_KM;

const shapes = new Map<string, Feature<Polygon | MultiPolygon>>();
function shapeOf(id: CountryId, dataset: MapDataset = "west") {
  const key = `${dataset}:${id}`;
  const data = TOPOLOGIES[dataset];
  if (!shapes.has(key)) shapes.set(key, feature(data, data.objects.countries.geometries.find((x) => x.id === id)!) as Feature<Polygon | MultiPolygon>);
  return shapes.get(key)!;
}

/** Whether a point lies in the country; its bounding box is checked first, as there are 74 countries to try. */
const boxes = new Map<string, [[number, number], [number, number]]>();
function inCountry(id: CountryId, p: LonLat, dataset: MapDataset = "west") {
  const key = `${dataset}:${id}`;
  if (!boxes.has(key)) boxes.set(key, geoBounds(shapeOf(id, dataset)));
  const [[x0, y0], [x1, y1]] = boxes.get(key)!;
  return p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1 && geoContains(shapeOf(id, dataset), [...p]);
}

function sharedBorder(a: CountryId, b: CountryId, dataset: MapDataset = "west"): MultiLineString {
  const data = TOPOLOGIES[dataset];
  return mesh(data, data.objects.countries, (x, y) => (x.id === a && y.id === b) || (x.id === b && y.id === a));
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

const same = (p: LonLat, q: LonLat) => p[0] === q[0] && p[1] === q[1];

/**
 * Every move a journey can make: from each mission's start, within its crossings (Undo and Restart only go back).
 * Every move of the earlier levels; Level 10's Norway → Finland, a real border, is never reached.
 */
function reachableMoves(lesson: (typeof LESSON_VERSIONS)[number]): Set<string> {
  const found = new Set<string>();
  const walk = (attempt: ReturnType<typeof createAttempt>) => {
    for (const next of availableMoves(attempt, lesson.borders)) {
      found.add(`${currentCountry(attempt)}>${next}`);
      walk(move(attempt, lesson.borders, next).attempt);
    }
  };
  for (const mission of [lesson.travel.mission, ...(lesson.travel.earlierMissions ?? [])]) walk(createAttempt(lesson.borders, mission));
  return found;
}

// Every version of every level: an attempt started on Level 6's first version still draws its journey.
for (const lesson of LESSON_VERSIONS) {
  const dataset = lesson.map.dataset ?? "west";
  const ALL_IDS = TOPOLOGIES[dataset].objects.countries.geometries.map((g) => String(g.id));
  const crossings = lesson.map.routeCrossings ?? {};
  const via = lesson.map.routeVia ?? {};
  const settings = routeSettings(lesson);
  const reachable = reachableMoves(lesson);
  // Every border of the level, its Travel-only neighbours' included (Levels 4, 8 and 10).
  const allMoves = travelCountries(lesson).flatMap((a) => lesson.borders[a].map((b) => [a, b] as const));
  // The moves drawn: every border with a crossing (both ways). Every reachable move has one (checked below).
  const moves = allMoves.filter(([a, b]) => borderKey(a, b) in crossings);
  const links = lesson.map.routeLinks ?? [];
  const borderLinks = lesson.map.borderLinks ?? [];
  /** The fixed link (a bridge inside one country) a leg segment follows, if any. */
  const linkOf = (country: CountryId, p: LonLat, q: LonLat) =>
    links.find((l) => l.country === country && ((same(l.points[0], p) && same(l.points[1], q)) || (same(l.points[0], q) && same(l.points[1], p))));
  /** The named fixed link between two countries (Level 10's Øresund) a leg segment follows, if any. */
  const borderLinkOf = (a: CountryId, b: CountryId, p: LonLat, q: LonLat) =>
    borderLinks.find(
      (l) => l.between.includes(a) && l.between.includes(b) && l.points.some((x, i) => i > 0 && ((same(l.points[i - 1], p) && same(x, q)) || (same(l.points[i - 1], q) && same(x, p)))),
    );

  describe(`${versionKey(lesson)}: Travel route line`, () => {
    it("has a crossing for every border a journey can cross, only for the level's borders, and turning points only for them", () => {
      for (const key of reachable) {
        const [a, b] = key.split(">");
        expect(borderKey(a, b) in crossings, `${key} has no crossing`).toBe(true);
      }
      const borders = new Set(allMoves.map(([a, b]) => borderKey(a, b)));
      for (const key of Object.keys(crossings)) expect(borders.has(key), key).toBe(true);
      // Levels 10 and 11 draw no leg no journey takes: Level 10's Norway–Finland, never reached within the crossings, and
      // Level 11's United Kingdom–Ireland, beyond the journey's end in the United Kingdom, have none. (Levels 8 and 9 kept
      // crossings for a border no journey reaches: Moldova–Romania, Greece–North Macedonia.)
      if (lesson.id === "nordic-countries" || lesson.id === "across-the-channel") {
        const crossed = new Set([...reachable].map((key) => borderKey(...(key.split(">") as [string, string]))));
        expect(new Set(Object.keys(crossings))).toEqual(crossed);
        expect(crossed.has(lesson.id === "nordic-countries" ? "FIN-NOR" : "GBR-IRL")).toBe(false);
      }
      for (const key of Object.keys(via)) expect(moves.some(([a, b]) => viaKey(a, b) === key), key).toBe(true);
    });

    for (const [a, b] of moves) {
      it(`${a} → ${b} crosses their shared border and stays in those two countries`, () => {
        const line = routeLine([a, b], settings);
        const crossing = crossings[borderKey(a, b)];
        const [viaA, viaB] = [via[viaKey(a, b)] ?? [], via[viaKey(b, a)] ?? []];
        expect(line).toEqual([COUNTRIES[a].capital.coordinates, ...viaA, crossing, ...[...viaB].reverse(), COUNTRIES[b].capital.coordinates]);

        const named = borderLinks.find((l) => l.between.includes(a) && l.between.includes(b));
        if (named) {
          // A fixed link, not a land border: the crossing is the national boundary on it, one of its points.
          expect(sharedBorder(a, b, dataset).coordinates).toEqual([]);
          expect(named.points.some((p) => same(p, crossing)), `${named.name}: the crossing is on the link`).toBe(true);
        } else {
          // The crossing point is on the real shared border (a vertex of it, rounded to ~10 m).
          const border = sharedBorder(a, b, dataset).coordinates.flat() as unknown as LonLat[];
          expect(Math.min(...border.map((p) => km(p, crossing))), "distance to shared border").toBeLessThan(0.05);
        }

        // Capital → (turning points →) crossing is drawn inside the start country, and on to the capital inside the next one.
        const at = line.indexOf(crossing);
        for (let i = 1; i < line.length; i++) {
          const country = i <= at ? a : b;
          const link = linkOf(country, line[i - 1], line[i]);
          if (link) {
            // A declared fixed link (a bridge inside the country) may cross water, but never another country.
            for (const p of drawnSamples(lesson, line[i - 1], line[i])) {
              for (const id of ALL_IDS.filter((x) => x !== country)) expect(inCountry(id, p, dataset), `${link.name} enters ${id}`).toBe(false);
            }
            continue;
          }
          const over = borderLinkOf(a, b, line[i - 1], line[i]);
          if (over) {
            // A named fixed link between the two countries may cross water, but never a third country.
            for (const p of drawnSamples(lesson, line[i - 1], line[i])) {
              for (const id of ALL_IDS.filter((x) => x !== a && x !== b)) expect(inCountry(id, p, dataset), `${over.name} enters ${id}`).toBe(false);
            }
            continue;
          }
          const outside = drawnSamples(lesson, line[i - 1], line[i]).filter(
            (p) => km(p, crossing) > BORDER_TOLERANCE_KM && !geoContains(shapeOf(country, dataset), [...p]),
          );
          expect(outside, `${a} → ${b}: points outside ${country}`).toEqual([]);
        }
      });
    }

    it("follows each named fixed link between two countries from one's land to the other's, its boundary on it", () => {
      for (const link of borderLinks) {
        const [a, b] = link.between;
        expect(lesson.countries, link.name).toContain(a);
        expect(lesson.countries, link.name).toContain(b);
        // Its ends on the two countries' land; its boundary point is the border's crossing.
        expect(geoContains(shapeOf(a, dataset), [...link.points[0]]), `${link.name} starts in ${a}`).toBe(true);
        expect(geoContains(shapeOf(b, dataset), [...link.points[link.points.length - 1]]), `${link.name} ends in ${b}`).toBe(true);
        const crossing = crossings[borderKey(a, b)];
        expect(link.points.some((p) => same(p, crossing)), link.name).toBe(true);
        // A bridge or a tunnel, not a sea route: the Øresund's 20.6 km from Kastrup to the Swedish shore, the Channel
        // Tunnel's line from portal to portal (50.45 km; simplified here, a little shorter).
        const length = link.points.slice(1).reduce((sum, p, i) => sum + km(link.points[i], p), 0);
        expect(length, link.name).toBeLessThan(link.name === "Channel Tunnel" ? 50.5 : 25);
        // Followed by both legs: each country's turning points end with the link's points on its side.
        const at = link.points.findIndex((p) => same(p, crossing));
        expect(via[viaKey(a, b)]?.slice(-at), `${a}'s leg follows ${link.name}`).toEqual(link.points.slice(0, at));
        expect(via[viaKey(b, a)]?.slice(-(link.points.length - at - 1)), `${b}'s leg follows ${link.name}`).toEqual(link.points.slice(at + 1).reverse());
      }
    });

    it("uses each fixed link in a leg of its own country, joining two parts of that country's land", () => {
      for (const link of links) {
        expect(lesson.countries, link.name).toContain(link.country);
        // Short: a bridge, not a sea route. Level 10's Great Belt Fixed Link (two bridges by Sprogø, which the data
        // doesn't show: one segment of 18.8 km in it, the link itself 18 km) is the only longer one.
        expect(km(link.points[0], link.points[1]), link.name).toBeLessThan(link.name === "Great Belt Fixed Link" ? 19 : 5);
        // Both ends on the country's land.
        for (const p of link.points) expect(geoContains(shapeOf(link.country, dataset), [...p]), `${link.name} end ${p}`).toBe(true);
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
      // One: Sweden over the Øresund, then Finland. Through Norway runs out of crossings.
      if (lesson.id === "nordic-countries") {
        expect(paths.map((p) => p.join("→"))).toEqual(["DNK→SWE→FIN"]);
      }
      // No shortest journey goes through a Travel-only country (Levels 4, 8 and 10).
      for (const path of paths) for (const id of lesson.travelOnly ?? []) expect(path, id).not.toContain(id);
      for (const path of paths) {
        const line = routeLine(path, settings);
        const others = travelCountries(lesson).filter((id) => !path.includes(id));
        for (let i = 1; i < line.length; i++) {
          for (const p of drawnSamples(lesson, line[i - 1], line[i], 200)) {
            for (const id of others) expect(geoContains(shapeOf(id, dataset), [...p]), `${path.join("→")} enters ${id}`).toBe(false);
          }
        }
      }
      // Level 10's line, sampled against Norway's coast and its Travel-only neighbours, takes about 11 s alone (7 s
      // before them): over the 5 s default.
    }, 30_000);
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

describe("heart-of-the-balkans: two ways to Skopje, on land; Athens's legs leave as Level 5's does", () => {
  const lesson = LESSONS["heart-of-the-balkans"];
  const settings = routeSettings(lesson);

  it("turns only where a straight leg would leave its country or graze its edge; no fixed links", () => {
    expect(Object.keys(lesson.map.routeVia ?? {}).sort()).toEqual(["ALB@ALB-MNE", "GRC@ALB-GRC", "GRC@GRC-MKD", "MNE@KOS-MNE"]);
    expect(lesson.map.routeLinks ?? []).toEqual([]);
    // Athens's first two turning points are Level 5's: north out of Attica, then west of Lamia.
    const level5 = LESSONS["towards-greece"].map.routeVia!["GRC@BGR-GRC"].slice(0, 2);
    expect(lesson.map.routeVia!["GRC@ALB-GRC"]).toEqual(level5);
    expect(lesson.map.routeVia!["GRC@GRC-MKD"]).toEqual(level5);
    // A straight line from Podgorica to the Kosovan crossing would cut through Albania's northern tip (Vermosh).
    const straight = drawnSamples(lesson, COUNTRIES.MNE.capital.coordinates, lesson.map.routeCrossings!["KOS-MNE"], 300);
    expect(straight.some((p) => inCountry("ALB", p))).toBe(true);
  });

  for (const path of [
    ["MNE", "KOS", "MKD"],
    ["MNE", "ALB", "MKD"],
    ["MNE", "ALB", "GRC"],
  ]) {
    it(`draws ${path.join(" → ")} on its own countries' land, never at sea, in Serbia, Bulgaria or the other way's country`, () => {
      const line = routeLine(path, settings);
      const crossings = Object.values(lesson.map.routeCrossings ?? {});
      const others = ["MNE", "KOS", "ALB", "MKD", "GRC"].filter((id) => !path.includes(id));
      for (let i = 1; i < line.length; i++) {
        for (const p of drawnSamples(lesson, line[i - 1], line[i], 300)) {
          if (crossings.some((c) => km(p, c) <= BORDER_TOLERANCE_KM)) continue;
          expect(path.some((id) => inCountry(id, p)), `${p} at sea or abroad`).toBe(true);
          for (const id of [...others, "SRB", "BGR", "TUR", "BIH"]) expect(inCountry(id, p), `${p} in ${id}`).toBe(false);
        }
      }
    });
  }
});

describe("nordic-countries: Germany (Travel only) is reached over Denmark's own bridges, never a ferry", () => {
  const lesson = LESSONS["nordic-countries"];
  const settings = routeSettings(lesson);

  it("keeps the Øresund the only link between two countries; Copenhagen's leg to Germany crosses the Great Belt and the Little Belt", () => {
    expect(lesson.map.borderLinks?.map((l) => l.name)).toEqual(["Øresund Bridge and Drogden Tunnel"]);
    expect(lesson.map.routeLinks?.map((l) => l.name)).toEqual(["Copenhagen's inner-harbour bridges", "Great Belt Fixed Link", "New Little Belt Bridge"]);
    const leg = lesson.map.routeVia![viaKey("DNK", "DEU")];
    for (const link of lesson.map.routeLinks!.slice(1)) {
      const at = leg.findIndex((p) => same(p, link.points[0]));
      expect(at, link.name).toBeGreaterThanOrEqual(0);
      expect(leg[at + 1], link.name).toEqual(link.points[1]);
    }
  });

  it("draws Denmark → Germany → Poland and → the Netherlands on those countries' land and Denmark's bridges, never in Sweden", () => {
    for (const path of [["DNK", "DEU", "POL"], ["DNK", "DEU", "NLD"]]) {
      const line = routeLine(path, settings);
      for (let i = 1; i < line.length; i++) {
        for (const p of drawnSamples(lesson, line[i - 1], line[i], 200)) {
          for (const id of ["SWE", "NOR", "BEL", "CZE", "LTU", "RUS"]) expect(inCountry(id, p, "north"), `${path.join("→")} enters ${id}`).toBe(false);
        }
      }
    }
  });
});

describe("across-the-channel: Berlin to London through France and the Channel Tunnel, on land and under the sea", () => {
  const lesson = LESSONS["across-the-channel"];
  const settings = routeSettings(lesson);
  const tunnel = lesson.map.borderLinks!.find((l) => l.name === "Channel Tunnel")!;

  it("keeps the Channel Tunnel the only link between two countries, with no fixed link inside one; Level 1's crossings on the Continent", () => {
    expect(lesson.map.borderLinks?.map((l) => [l.name, ...l.between])).toEqual([["Channel Tunnel", "FRA", "GBR"]]);
    expect(lesson.map.routeLinks ?? []).toEqual([]);
    // France and the United Kingdom share no land border; the frontier is on the tunnel, between its portals.
    expect(sharedBorder("FRA", "GBR", "channel").coordinates).toEqual([]);
    const crossing = lesson.map.routeCrossings!["FRA-GBR"];
    const at = tunnel.points.findIndex((p) => same(p, crossing));
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(tunnel.points.length - 1);
    // About 22.6 km from the French portal and 27.7 km from the English one, along the tunnel.
    const along = (points: readonly LonLat[]) => points.slice(1).reduce((sum, p, i) => sum + km(points[i], p), 0);
    expect(along(tunnel.points.slice(0, at + 1))).toBeCloseTo(22.6, 0);
    expect(along(tunnel.points.slice(at))).toBeCloseTo(27.7, 0);
    // The Continent's crossings are Level 1's (the same capitals, and vertices of the same borders in this data).
    const level1 = LESSONS["western-europe-1"].map.routeCrossings!;
    for (const key of ["BEL-FRA", "DEU-FRA", "BEL-DEU", "FRA-LUX", "BEL-LUX", "DEU-LUX"]) expect(lesson.map.routeCrossings![key], key).toEqual(level1[key]);
    // Paris and London reach the tunnel's portals in straight lines: their turning points are the tunnel's own.
    expect(lesson.map.routeVia![viaKey("FRA", "GBR")]).toEqual(tunnel.points.slice(0, at));
    expect(lesson.map.routeVia![viaKey("GBR", "FRA")]).toEqual(tunnel.points.slice(at + 1).reverse());
  });

  it("draws Germany → France → the United Kingdom on those countries' land and the tunnel only, never in Belgium, Luxembourg or the Netherlands", () => {
    const line = routeLine(["DEU", "FRA", "GBR"], settings);
    expect(line).toHaveLength(22);
    const ends = [tunnel.points[0], tunnel.points[tunnel.points.length - 1]];
    const crossings = Object.values(lesson.map.routeCrossings ?? {});
    for (let i = 1; i < line.length; i++) {
      const underSea = tunnel.points.some((p, j) => j > 0 && ((same(tunnel.points[j - 1], line[i - 1]) && same(p, line[i])) || (same(tunnel.points[j - 1], line[i]) && same(p, line[i - 1]))));
      for (const p of drawnSamples(lesson, line[i - 1], line[i], 200)) {
        for (const id of ["BEL", "LUX", "NLD", "CHE", "IRL", "JEY", "GGY"]) expect(inCountry(id, p, "channel"), `${p} in ${id}`).toBe(false);
        if (underSea || crossings.some((c) => km(p, c) <= BORDER_TOLERANCE_KM)) continue;
        expect(["DEU", "FRA", "GBR"].some((id) => inCountry(id, p, "channel")), `${p} at sea`).toBe(true);
      }
    }
    // The tunnel's portals are on land, in France and in the United Kingdom.
    expect(inCountry("FRA", ends[0], "channel")).toBe(true);
    expect(inCountry("GBR", ends[1], "channel")).toBe(true);
  });

  it("draws the wrong turns through Belgium and Luxembourg on the Continent, never towards the Channel", () => {
    for (const path of [["DEU", "BEL", "FRA"], ["DEU", "BEL", "LUX"], ["DEU", "LUX", "FRA"], ["DEU", "LUX", "BEL"], ["DEU", "FRA", "BEL"], ["DEU", "FRA", "LUX"]]) {
      const line = routeLine(path, settings);
      for (let i = 1; i < line.length; i++)
        for (const p of drawnSamples(lesson, line[i - 1], line[i], 200)) {
          for (const id of ["GBR", "NLD", "CHE"]) expect(inCountry(id, p, "channel"), `${path.join("→")}: ${p} in ${id}`).toBe(false);
        }
    }
  });
});

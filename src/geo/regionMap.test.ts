import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { geoContains } from "d3-geo";
import { feature, neighbors } from "topojson-client";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import topologyJson from "@/data/geo/europe-west.topo.json";
import northJson from "@/data/geo/europe-north.topo.json";
import channelJson from "@/data/geo/europe-channel.topo.json";
import eastJson from "@/data/geo/europe-east.topo.json";
import { COUNTRIES } from "@/core/content/countries";
import { LESSON_VERSIONS, LESSONS, LEVELS, travelCountries, versionKey } from "@/core/lessons";
import { balticJourneyOriginalLesson } from "@/core/lessons/baltic-journey";
import { shortestDistance, validateGraph, type BorderGraph } from "@/core/game/graph";
import {
  applyTransform,
  fitTransform,
  getRegionMap,
  isMapDataLoaded,
  MAP_DATA_CLIP,
  MARK_EDGE_CLEARANCE,
  maxMapWidth,
  PROJECTION_FIT,
  regionMapFor,
  setMapData,
  setNorthData,
  viewLimits,
  type Bounds,
  type MapDataset,
  type ScreenBox,
  type ScreenMark,
  type Transform,
} from "./regionMap";

const topology = topologyJson as unknown as Topology<{ countries: GeometryCollection }>;
const geometries = topology.objects.countries.geometries;
/** A dataset of its own, cut to a rectangle in world units round its level's coverage (frame.clip). */
type FramedTopology = Topology<{ countries: GeometryCollection }> & {
  projection: { rotate: [number, number]; scale: number; translate: [number, number] };
  frame: { clip: Bounds };
};
/** Level 10's northern data (scripts/prepare-north-geo.mjs), given to the map as loadMapData would. */
const north = northJson as unknown as FramedTopology;
setNorthData(north);
/** Level 11's Channel data (scripts/prepare-channel-geo.mjs), likewise. */
const channel = channelJson as unknown as FramedTopology;
setMapData("channel", channel);
/** Level 12's eastern data (scripts/prepare-east-geo.mjs), likewise. */
const east = eastJson as unknown as FramedTopology;
setMapData("east", east);
const TOPOLOGIES: Readonly<Record<MapDataset, Topology<{ countries: GeometryCollection }>>> = { west: topology, north, channel, east };
const FRAMED: Readonly<Record<Exclude<MapDataset, "west">, FramedTopology>> = { north, channel, east };

function shapeOf(id: string, dataset: MapDataset = "west") {
  const data = TOPOLOGIES[dataset];
  const g = data.objects.countries.geometries.find((x) => x.id === id)!;
  return feature(data, g) as Feature<Polygon | MultiPolygon>;
}

/**
 * Landmarks on a coast that Natural Earth's 1:10m data draws coarser than the
 * monument: its real position may lie this far off the country's land in the data.
 * Dubrovnik's old town is about 0.5 km beyond the data's coastline (docs/DATA.md,
 * "Level 4"), and Belém Tower, which stands at the edge of the Tagus, 0.32 km beyond it
 * ("Level 7"); every other landmark must lie inside its country.
 */
const COAST_MARGIN_KM: Readonly<Record<string, number>> = { "dubrovnik-city-walls": 0.6, "belem-tower": 0.4, kronborg: 0.3 };

/** Whether some point within `km` of `p` lies inside the country. */
function withinKm(id: string, p: readonly [number, number], km: number, dataset: MapDataset = "west") {
  for (let d = 0.05; d <= km; d += 0.05)
    for (let a = 0; a < 360; a += 10) {
      const rad = (a * Math.PI) / 180;
      const q: [number, number] = [p[0] + (d / (111.32 * Math.cos((p[1] * Math.PI) / 180))) * Math.cos(rad), p[1] + (d / 110.57) * Math.sin(rad)];
      if (geoContains(shapeOf(id, dataset), q)) return true;
    }
  return false;
}

describe("prepared map data", () => {
  it("has unique country ids", () => {
    for (const data of Object.values(TOPOLOGIES)) {
      const ids = data.objects.countries.geometries.map((g) => g.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  // Every version of every level (Level 6's first included: attempts started on it go on), each in its own data.
  for (const lesson of LESSON_VERSIONS) {
    const dataset = lesson.map.dataset ?? "west";
    it(`${versionKey(lesson)}: border graph matches shared boundaries in the data`, () => {
      const own = TOPOLOGIES[dataset].objects.countries.geometries;
      const adjacency = neighbors(own);
      // A named fixed link (Level 10's Øresund) joins two countries that share no boundary: it is the only way an edge
      // without one is accepted, and only for those two.
      const linked = (a: string, b: string) => (lesson.map.borderLinks ?? []).some((l) => l.between.includes(a) && l.between.includes(b));
      // The level's countries and its Travel-only neighbours (Levels 4, 8 and 10): every real border among them, and no other.
      const countries = travelCountries(lesson);
      expect(Object.keys(lesson.borders).sort()).toEqual([...countries].sort());
      for (const id of countries) {
        const index = own.findIndex((g) => g.id === id);
        expect(index, id).toBeGreaterThanOrEqual(0);
        const fromData = adjacency[index].map((i) => String(own[i].id)).filter((n) => countries.includes(n));
        for (const n of fromData) expect(linked(id, n), `${id}–${n} share a land border: not a fixed link`).toBe(false);
        expect([...fromData].sort(), id).toEqual(lesson.borders[id].filter((n) => !linked(id, n)).sort());
      }
      for (const link of lesson.map.borderLinks ?? []) {
        const [a, b] = link.between;
        expect(lesson.borders[a], link.name).toContain(b);
        expect(lesson.borders[b], link.name).toContain(a);
      }
    });

    if (lesson.travelOnly?.length) {
      it(`${versionKey(lesson)}: Travel-only countries' capitals and label anchors are in them, inside the area the map can show`, () => {
        const map = regionMapFor(lesson);
        const [[x0, y0], [x1, y1]] = map.coverage;
        for (const id of lesson.travelOnly!) {
          expect(lesson.countries, id).not.toContain(id);
          const c = COUNTRIES[id];
          for (const [what, p] of [["capital", c.capital.coordinates], ["label", c.label.coordinates]] as const) {
            expect(geoContains(shapeOf(id, dataset), [...p]), `${id} ${what}`).toBe(true);
            const [x, y] = map.project(p);
            expect(x >= x0 && x <= x1 && y >= y0 && y <= y1, `${id} ${what} in the coverage`).toBe(true);
          }
        }
      });
    }

    it(`${versionKey(lesson)}: capitals, landmarks and label anchors fall inside their countries`, () => {
      for (const id of lesson.countries) {
        const c = COUNTRIES[id];
        expect(geoContains(shapeOf(id, dataset), [...c.label.coordinates]), `${id} label`).toBe(true);
        // The level's own label point (`map.labels`, Level 12's Russia), where it has one.
        const own = lesson.map.labels?.[id];
        if (own) expect(geoContains(shapeOf(id, dataset), [...own]), `${id} level label`).toBe(true);
        expect(geoContains(shapeOf(id, dataset), [...c.capital.coordinates]), `${id} capital`).toBe(true);
        if (c.landmark?.coordinates) {
          const inside = geoContains(shapeOf(id, dataset), [...c.landmark.coordinates]);
          const margin = COAST_MARGIN_KM[c.landmark.id];
          if (margin === undefined) expect(inside, `${id} landmark`).toBe(true);
          else expect(inside || withinKm(id, c.landmark.coordinates, margin, dataset), `${id} landmark within ${margin} km of its country`).toBe(true);
        }
      }
    });
  }

  it("nordic-countries: its northern data is in the levels' projection, with Iceland, Jan Mayen and Åland as agreed and Svalbard left out", () => {
    // The same projection as the levels' (prepare-north-geo.mjs writes it), so the relief lines up.
    const map = regionMapFor(LESSONS["nordic-countries"]);
    const west = regionMapFor(LESSONS["western-europe-1"]);
    for (const p of [[12.5655, 55.6759], [-21.8954, 64.1355], [24.9354, 60.1695]] as const) expect(map.project(p)).toEqual(west.project(p));
    expect(north.projection.rotate).toEqual([-8, -50]);
    const ids = north.objects.countries.geometries.map((g) => String(g.id));
    // Åland merged into Finland; the Faroes and Greenland their own (faded) shapes, never Denmark's.
    expect(ids).not.toContain("ALD");
    expect(geoContains(shapeOf("FIN", "north"), [19.94, 60.1])).toBe(true);
    for (const [id, p] of [["FRO", [-6.77, 62.01]], ["GRL", [-22.0, 70.5]]] as const) {
      expect(geoContains(shapeOf(id, "north"), [...p]), id).toBe(true);
      expect(geoContains(shapeOf("DNK", "north"), [...p]), id).toBe(false);
    }
    // Bornholm is Denmark's; Peberholm, too small at this scale, is not in the data.
    expect(geoContains(shapeOf("DNK", "north"), [14.92, 55.12])).toBe(true);
    for (const id of ids) expect(geoContains(shapeOf(id, "north"), [12.7506, 55.5999]), id).toBe(false);
    // Jan Mayen is Norway's, inside the frame the mainland sets; Svalbard (Bjørnøya too) is left out.
    expect(geoContains(shapeOf("NOR", "north"), [-8.4, 71.0])).toBe(true);
    const [[, fy0]] = map.focusBounds;
    expect(map.project([-8.0, 71.15])[1]).toBeGreaterThan(fy0);
    for (const p of [[19.0, 74.43], [16.5, 77.0], [15.6, 78.2]] as const) for (const id of ids) expect(geoContains(shapeOf(id, "north"), [...p]), `${id} at ${p}`).toBe(false);
    // Crimea, where the data reaches it, is Ukraine's (as in the levels' data).
    for (let lon = 32.5; lon <= 36.6; lon += 0.1) for (let lat = 44.4; lat <= 46.2; lat += 0.1) expect(geoContains(shapeOf("RUS", "north"), [lon, lat])).toBe(false);
  });

  it("across-the-channel: its Channel data is in the levels' projection and on their grid, with the levels' shapes, Northern Ireland, Shetland, Orkney and Corsica, and the Crown Dependencies their own", () => {
    // The same projection and quantization grid as the levels' (prepare-channel-geo.mjs writes them), so the relief
    // lines up, and the shapes Level 1 draws are the same, vertex for vertex.
    const map = regionMapFor(LESSONS["across-the-channel"]);
    const west = regionMapFor(LESSONS["western-europe-1"]);
    for (const p of [[-0.1257, 51.5085], [-6.2489, 53.3331], [13.405, 52.52]] as const) expect(map.project(p)).toEqual(west.project(p));
    expect(channel.projection.rotate).toEqual([-8, -50]);
    expect(channel.transform).toEqual(topology.transform);
    for (const id of ["GBR", "IRL", "FRA", "BEL", "DEU", "LUX", "NLD"]) expect(shapeOf(id, "channel").geometry, id).toEqual(shapeOf(id).geometry);
    // So the focus is the levels' data's frame of the five.
    expect(map.focusBounds).toEqual(getRegionMap(LESSONS["across-the-channel"].countries).focusBounds);
    // Northern Ireland is the United Kingdom's: Belfast, Derry and Enniskillen, beside the border, not Ireland's.
    for (const [name, p] of Object.entries({ Belfast: [-5.93, 54.6], Derry: [-7.31, 54.996], Enniskillen: [-7.64, 54.34] })) {
      expect(geoContains(shapeOf("GBR", "channel"), p as [number, number]), name).toBe(true);
      expect(geoContains(shapeOf("IRL", "channel"), p as [number, number]), name).toBe(false);
    }
    // The UK–Ireland border, the island of Ireland's, is in the data: their shapes share it.
    const own = channel.objects.countries.geometries;
    const index = (id: string) => own.findIndex((g) => g.id === id);
    expect(neighbors(own)[index("GBR")].map((i) => own[i].id)).toEqual(["IRL"]);
    // Shetland, Orkney and the Hebrides are the United Kingdom's; Corsica is France's.
    for (const [name, p] of Object.entries({ Lerwick: [-1.145, 60.155], Unst: [-0.85, 60.75], Kirkwall: [-2.96, 58.98], Lewis: [-6.39, 58.21] }))
      expect(geoContains(shapeOf("GBR", "channel"), p as [number, number]), name).toBe(true);
    for (const [name, p] of Object.entries({ Bastia: [9.45, 42.7], Bonifacio: [9.16, 41.39] })) expect(geoContains(shapeOf("FRA", "channel"), p as [number, number]), name).toBe(true);
    // Shetland and Corsica set the frame's top and bottom: every part of the five lies inside the focus.
    const [[fx0, fy0], [fx1, fy1]] = map.focusBounds;
    for (const id of LESSONS["across-the-channel"].countries) {
      const [[x0, y0], [x1, y1]] = map.shapes.find((s) => s.id === id)!.bounds;
      expect(x0 >= fx0 && y0 >= fy0 && x1 <= fx1 && y1 <= fy1, id).toBe(true);
    }
    expect(map.project([-0.85, 60.75])[1] - fy0).toBeLessThan(10);
    expect(fy1 - map.project([9.16, 41.39])[1]).toBeLessThan(10);
    // The Crown Dependencies (Jersey, Guernsey, the Isle of Man) are their own shapes, faded as neighbours, never the
    // United Kingdom's; so are the Faroes, Denmark's.
    for (const [id, p] of [["JEY", [-2.13, 49.215]], ["GGY", [-2.54, 49.455]], ["IMN", [-4.48, 54.15]], ["FRO", [-6.77, 62.01]]] as const) {
      expect(geoContains(shapeOf(id, "channel"), [...p]), id).toBe(true);
      expect(geoContains(shapeOf("GBR", "channel"), [...p]), id).toBe(false);
    }
    // Crimea, where the data reaches it, is Ukraine's (as in the levels' data); Åland is Finland's.
    for (let lon = 32.5; lon <= 36.6; lon += 0.1) for (let lat = 44.4; lat <= 46.2; lat += 0.1) expect(geoContains(shapeOf("RUS", "channel"), [lon, lat])).toBe(false);
    expect(own.map((g) => g.id)).not.toContain("ALD");
    // Its close-up (Belgium's, with the Strait of Dover): beside its toggle on smaller maps, bottom-left on wide ones,
    // and never opened by itself; the only level that keeps it closed so (docs/DATA.md, "Level 11").
    expect(LESSONS["across-the-channel"].map.inset).toMatchObject({ country: "BEL", smallMapBeside: true, wideMapCorner: "bottom-left", autoOpen: false });
    for (const lesson of LESSON_VERSIONS) if (lesson.id !== "across-the-channel") expect(lesson.map.inset?.autoOpen, lesson.id).toBeUndefined();
  });

  it("russia-and-western-neighbours: its eastern data is in the levels' projection and on their grid, with their Estonia, Latvia and Belarus, Finland whole, Kaliningrad apart from Russia's mainland, and Russia framed by its western part only", () => {
    // The same projection and quantization grid as the levels' (prepare-east-geo.mjs writes them), so the relief lines
    // up, and the shapes Levels 6 and 8 draw are the same, vertex for vertex (their crossings stay vertices).
    const lesson = LESSONS["russia-and-western-neighbours"];
    const map = regionMapFor(lesson);
    const west = regionMapFor(LESSONS["western-europe-1"]);
    for (const p of [[37.6173, 55.7558], [24.7535, 59.437], [27.5586, 53.9006]] as const) expect(map.project(p)).toEqual(west.project(p));
    expect(east.projection.rotate).toEqual([-8, -50]);
    expect(east.transform).toEqual(topology.transform);
    for (const id of ["EST", "LVA", "BLR"]) expect(shapeOf(id, "east").geometry, id).toEqual(shapeOf(id).geometry);
    // Finland whole, to its north-western arm and the Teno at Utsjoki, with Åland merged into it.
    const own = east.objects.countries.geometries;
    expect(own.map((g) => g.id)).not.toContain("ALD");
    for (const [name, p] of Object.entries({ Mariehamn: [19.94, 60.1], Kilpisjärvi: [20.8, 69.05], Utsjoki: [27.03, 69.91] }))
      expect(geoContains(shapeOf("FIN", "east"), p as [number, number]), name).toBe(true);
    // Kaliningrad is Russia's, a part of its shape apart from the mainland: the one part holding it holds no Moscow.
    const rus = shapeOf("RUS", "east").geometry as MultiPolygon;
    expect(rus.type).toBe("MultiPolygon");
    const kaliningrad: [number, number] = [20.51, 54.71];
    const withIt = rus.coordinates.filter((coordinates) => geoContains({ type: "Polygon", coordinates }, kaliningrad));
    expect(withIt).toHaveLength(1);
    expect(geoContains({ type: "Polygon", coordinates: withIt[0] }, [...COUNTRIES.RUS.capital.coordinates])).toBe(false);
    // Its only neighbours, Lithuania and Poland, are not in the level: no move can enter it (the graph test above checks
    // Russia's edges are exactly its mainland borders with the other four).
    const index = (id: string) => own.findIndex((g) => g.id === id);
    expect(neighbors(own)[index("RUS")].map((i) => own[i].id)).toEqual(expect.arrayContaining(["LTU", "POL", "FIN", "EST", "LVA", "BLR"]));
    for (const id of ["LTU", "POL"]) expect(travelCountries(lesson), id).not.toContain(id);
    // Crimea, where the data reaches it (it doesn't here), is Ukraine's, as in the levels' data.
    for (let lon = 32.5; lon <= 36.6; lon += 0.1) for (let lat = 44.4; lat <= 46.2; lat += 0.1) expect(geoContains(shapeOf("RUS", "east"), [lon, lat])).toBe(false);
    // The frame: the other four whole, and Russia by its part within its box only (Saint Petersburg, and Moscow with room
    // to spare); Kaliningrad lies inside it too. Russia's whole shape runs far beyond it, east to the data's cut.
    const [[fx0, fy0], [fx1, fy1]] = map.focusBounds;
    for (const id of ["FIN", "EST", "LVA", "BLR"]) {
      const [[x0, y0], [x1, y1]] = map.shapes.find((s) => s.id === id)!.bounds;
      expect(x0 >= fx0 && y0 >= fy0 && x1 <= fx1 && y1 <= fy1, id).toBe(true);
    }
    for (const [name, p] of Object.entries({ Moscow: COUNTRIES.RUS.capital.coordinates, "Saint Petersburg": [30.31, 59.94], Kaliningrad: kaliningrad })) {
      const [x, y] = map.project(p as [number, number]);
      expect(x > fx0 && x < fx1 - 50 && y > fy0 && y < fy1, name).toBe(true);
    }
    expect(fx1 - fx0).toBeLessThan(1000);
    expect(fy1 - fy0).toBeLessThan(1400);
    expect(map.shapes.find((s) => s.id === "RUS")!.bounds[1][0] - fx1).toBeGreaterThan(1000);
    // The data was cut round this frame by the same box and coverage (scripts/prepare-east-geo.mjs), the coverage at
    // least 20 units inside the cut: its straight edges, which would draw as coast, are never in view.
    const script = readFileSync("scripts/prepare-east-geo.mjs", "utf8");
    expect(script).toContain(`const FRAME_WITHIN = { RUS: ${JSON.stringify(lesson.map.frameWithin!.RUS).replaceAll(",", ", ")} };`);
    expect(script).toContain(`const COVERAGE_HALF = [${lesson.map.coverageHalf!.join(", ")}];`);
    const [[c0x, c0y], [c1x, c1y]] = east.frame.clip;
    const [[x0, y0], [x1, y1]] = map.coverage;
    expect(Math.min(x0 - c0x, y0 - c0y, c1x - x1, c1y - y1)).toBeGreaterThanOrEqual(20);
    // Russia is named from its own point here (the Valdai Hills), inside the frame and Russia; its shared one, the Quick
    // Challenge's, lies east of the frame, off the phone maps, and is unchanged.
    const label = lesson.map.labels!.RUS!;
    const [lx, ly] = map.project(label);
    expect(lx > fx0 && lx < fx1 && ly > fy0 && ly < fy1).toBe(true);
    expect(map.project(COUNTRIES.RUS.label.coordinates)[0]).toBeGreaterThan(fx1);
    expect(COUNTRIES.RUS.label.coordinates).toEqual([44.0, 57.0]);
    // Only this level frames a country by a box, or names one from a point of its own.
    for (const other of LESSON_VERSIONS)
      if (other.id !== lesson.id) {
        expect(other.map.frameWithin, other.id).toBeUndefined();
        expect(other.map.labels, other.id).toBeUndefined();
      }
  });

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

  it("baltic-journey: keeps Estonia's islands, each in Estonia, and none of them clipped", () => {
    const estonia = shapeOf("EST");
    // Every part Natural Earth has for Estonia (docs/DATA.md, "Level 6"): Saaremaa (Kuressaare), Hiiumaa
    // (Kärdla), Muhu, Vormsi, Kihnu, Naissaar, and Ruhnu in the Gulf of Riga, nearer Latvia's coast.
    const islands = { Kuressaare: [22.485, 58.25], Kärdla: [22.75, 58.995], Muhu: [23.24, 58.6], Vormsi: [23.24, 59.0], Kihnu: [23.98, 58.13], Naissaar: [24.52, 59.57], Ruhnu: [23.26, 57.8] };
    for (const [name, p] of Object.entries(islands)) {
      expect(geoContains(estonia, p as [number, number]), `${name} in Estonia`).toBe(true);
      for (const other of ["LVA", "FIN", "RUS", "SWE"]) expect(geoContains(shapeOf(other), p as [number, number]), `${name} in ${other}`).toBe(false);
    }
    expect(estonia.geometry.type === "MultiPolygon" && estonia.geometry.coordinates.length).toBe(8);
    // All of Estonia lies inside the level's focus (in both its versions), so every island is within the start
    // view and the pan limits, and well inside the clip box (no artificial edge cuts an island).
    for (const lesson of [LESSONS["baltic-journey"], balticJourneyOriginalLesson]) {
      const map = regionMapFor(lesson);
      const [[ex0, ey0], [ex1, ey1]] = map.shapes.find((s) => s.id === "EST")!.bounds;
      const [[fx0, fy0], [fx1, fy1]] = map.focusBounds;
      expect(ex0 >= fx0 && ey0 >= fy0 && ex1 <= fx1 && ey1 <= fy1).toBe(true);
    }
    const n = MAP_DATA_CLIP[3];
    const points = (JSON.stringify(estonia.geometry.coordinates).match(/-?[\d.]+,-?[\d.]+/g) ?? []).map((p) => p.split(",").map(Number));
    expect(Math.max(...points.map((p) => p[1]))).toBeLessThan(n - 2);
    // The Curonian Spit is split between Lithuania (Nida) and Russia's Kaliningrad (Rybachy).
    expect(geoContains(shapeOf("LTU"), [21.0, 55.32])).toBe(true);
    expect(geoContains(shapeOf("RUS"), [20.82, 55.16])).toBe(true);
  });

  it("iberian-journey: shows Spain's islands and enclaves as Spain, leaves Madeira and the Azores out, and keeps Andorra's real outline", () => {
    // Madeira and the two Azores islands inside the clip box are erased (scripts/prepare-geo.mjs,
    // docs/DATA.md "Level 7"): no country has land there, so they can't stretch the frame.
    const atlantic = { Funchal: [-16.92, 32.65], "Porto Santo": [-16.34, 33.07], "Ponta Delgada": [-25.67, 37.74], "Santa Maria": [-25.1, 36.97] };
    for (const [name, p] of Object.entries(atlantic))
      for (const g of geometries) expect(geoContains(shapeOf(String(g.id)), p as [number, number]), `${name} in ${g.id}`).toBe(false);
    const portugal = shapeOf("PRT");
    const points = (f: Feature<Polygon | MultiPolygon>) => (JSON.stringify(f.geometry.coordinates).match(/-?[\d.]+,-?[\d.]+/g) ?? []).map((p) => p.split(",").map(Number));
    expect(Math.min(...points(portugal).map((p) => p[0]))).toBeGreaterThan(-9.6);
    // Spain: the Balearic Islands, Ceuta and Melilla on the African coast, and Llívia, its exclave inside France.
    const spain = { Palma: [2.65, 39.57], Mahón: [4.26, 39.89], Ibiza: [1.43, 38.98], Ceuta: [-5.32, 35.89], Melilla: [-2.94, 35.29], Llívia: [1.98, 42.465] };
    for (const [name, p] of Object.entries(spain)) {
      expect(geoContains(shapeOf("ESP"), p as [number, number]), `${name} in Spain`).toBe(true);
      for (const other of ["FRA", "MAR"]) expect(geoContains(shapeOf(other), p as [number, number]), `${name} in ${other}`).toBe(false);
    }
    // Andorra is one shape of its real size (about 30 × 24 km), between Spain and France only.
    const andorra = shapeOf("AND");
    expect(andorra.geometry.type).toBe("Polygon");
    const xs = points(andorra).map((p) => p[0]);
    const ys = points(andorra).map((p) => p[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.36, 1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.22, 1);
    // Everything of the five lies in the focus, and the focus well inside the coverage.
    const map = regionMapFor(LESSONS["iberian-journey"]);
    const [[fx0, fy0], [fx1, fy1]] = map.focusBounds;
    for (const id of LESSONS["iberian-journey"].countries) {
      const [[x0, y0], [x1, y1]] = map.shapes.find((s) => s.id === id)!.bounds;
      expect(x0 >= fx0 && y0 >= fy0 && x1 <= fx1 && y1 <= fy1, id).toBe(true);
    }
    // Portugal's west coast and Lampedusa set the frame's sides: Madeira would have widened it by a third.
    expect(fx1 - fx0).toBeLessThan(1600);
  });

  it("eastern-europe: draws Ukraine within its internationally recognised borders, Crimea included, and Moldova whole", () => {
    // Crimea is part of Ukraine (UN General Assembly resolution 68/262); the data does not follow
    // military control (scripts/prepare-geo.mjs, docs/DATA.md "Level 8"). Simferopol, Sevastopol,
    // Kerch and Yalta are in Ukraine, not Russia; so are Donetsk, Luhansk, Mariupol, Melitopol, Enerhodar, Nova Kakhovka and Kherson.
    const ukraine = shapeOf("UKR");
    for (const [name, p] of Object.entries({ Simferopol: [34.1, 44.95], Sevastopol: [33.52, 44.6], Kerch: [36.47, 45.36], Yalta: [34.16, 44.5], Donetsk: [37.8, 48.0], Luhansk: [39.3, 48.57], Mariupol: [37.55, 47.1], Melitopol: [35.37, 46.85], Enerhodar: [34.65, 47.5], NovaKakhovka: [33.36, 46.75], Kherson: [32.61, 46.64] })) {
      expect(geoContains(ukraine, p as [number, number]), `${name} in Ukraine`).toBe(true);
      expect(geoContains(shapeOf("RUS"), p as [number, number]), `${name} in Russia`).toBe(false);
    }
    // Russia keeps its own side of the Kerch Strait (Taman) and its mainland.
    for (const p of [[37.38, 45.27], [38.98, 45.04], [39.72, 47.24]]) expect(geoContains(shapeOf("RUS"), p as [number, number])).toBe(true);
    // Crimea joins the mainland at the Perekop isthmus: one part of Ukraine holds Kyiv and Simferopol, with no
    // border drawn between them.
    expect(geoContains(ukraine, [33.68, 46.15])).toBe(true);
    const parts = ukraine.geometry.type === "MultiPolygon" ? ukraine.geometry.coordinates : [ukraine.geometry.coordinates];
    const mainland = parts.find((rings) => geoContains({ type: "Polygon", coordinates: rings }, [30.52, 50.45]))!;
    expect(geoContains({ type: "Polygon", coordinates: mainland }, [34.1, 44.95])).toBe(true);
    const adjacency = neighbors(geometries);
    const rus = geometries.findIndex((g) => g.id === "RUS");
    expect(adjacency[geometries.findIndex((g) => g.id === "UKR")]).toContain(rus);
    // Transnistria is part of Moldova (Tiraspol, Rîbnița, Dubăsari), as in Natural Earth's Admin 0 data.
    for (const p of [[29.63, 46.84], [29.0, 47.77], [29.17, 47.27]]) {
      expect(geoContains(shapeOf("MDA"), p as [number, number])).toBe(true);
      expect(geoContains(ukraine, p as [number, number])).toBe(false);
    }
    // All five countries, Crimea and the Danube delta included, lie inside the level's focus.
    const map = regionMapFor(LESSONS["eastern-europe"]);
    const [[fx0, fy0], [fx1, fy1]] = map.focusBounds;
    for (const id of LESSONS["eastern-europe"].countries) {
      const [[x0, y0], [x1, y1]] = map.shapes.find((s) => s.id === id)!.bounds;
      expect(x0 >= fx0 && y0 >= fy0 && x1 <= fx1 && y1 <= fy1, id).toBe(true);
    }
    const crimea = map.project([34.1, 44.95]);
    expect(crimea[0] > fx0 && crimea[0] < fx1 && crimea[1] > fy0 && crimea[1] < fy1).toBe(true);
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
  const lessons = LESSON_VERSIONS;
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

    it(`${versionKey(lesson)}: the coverage area, and Travel's, lie inside the clipped data`, () => {
      // Travel's reaches further north only in Level 4 (travelReachNorth); in every other level it is the coverage.
      if (!lesson.map.travelReachNorth) expect(map.travelCoverage).toEqual(map.coverage);
      expect(map.travelCoverage[1]).toEqual(map.coverage[1]);
      const [[x0, y0], [x1, y1]] = map.travelCoverage;
      if (lesson.map.dataset) {
        // The northern and the Channel data are cut to a rectangle in world units (frame.clip), round this coverage.
        const [[c0x, c0y], [c1x, c1y]] = FRAMED[lesson.map.dataset].frame.clip;
        expect(x0 > c0x && y0 > c0y && x1 < c1x && y1 < c1y).toBe(true);
        return;
      }
      const [w, s, e, n] = MAP_DATA_CLIP;
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
      it(`${versionKey(lesson)}: ${width}×${height} never shows beyond the data coverage`, () => {
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

    it(`${versionKey(lesson)}: typical phone and desktop maps show every lesson country whole`, () => {
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

    it(`${versionKey(lesson)}: an ultra-wide map is shown no wider than keeps every lesson country whole, with half its padding`, () => {
      // Ultra-wide desktops (2560×1080, 3440×1440) and a short desktop window (1280×600): the map's height
      // there. At the widest width shown the countries keep half their padding; any wider and the coverage
      // would make the start view zoom in further, towards cutting them (Level 2 and Level 7 were cut at
      // 2560×1080 before).
      const margin = (width: number, height: number, padding: number) => {
        const { base } = viewLimits(map, width, height, padding);
        const [[x0, y0], [x1, y1]] = map.focusBounds;
        const [sx0, sy0] = applyTransform(base, [x0, y0]);
        const [sx1, sy1] = applyTransform(base, [x1, y1]);
        return Math.min(sx0, sy0, width - sx1, height - sy1);
      };
      for (const height of [992, 1352, 512, 300]) {
        const width = Math.floor(maxMapWidth(map, height));
        const padding = Math.max(10, height * 0.04);
        expect(width).toBeGreaterThan(height);
        expect(margin(width, height, padding)).toBeGreaterThanOrEqual(padding / 2 - 0.5);
        expect(margin(width + 40, height, padding)).toBeLessThan(padding / 2);
      }
    });
  }
});

describe("start view with markers kept whole", () => {
  /** The traveller's pin around its capital, in px (PIN_BOX in RegionMap.tsx): it stands 23px above the point. */
  const PIN = { x0: -8, y0: -23, x1: 8, y1: 2 };
  /** The map's padding for a size, as RegionMap sets it. */
  const paddingFor = (width: number, height: number) => Math.max(10, Math.min(width, height) * 0.04);
  const pinAt = (map: ReturnType<typeof regionMapFor>, country: string): ScreenMark => ({
    at: map.project(COUNTRIES[country].capital.coordinates),
    extent: PIN,
  });
  /** The mark's room to the map's edges at a view: left, top, right, bottom (px). */
  const room = (mark: ScreenMark, t: Transform, width: number, height: number) => {
    const [x, y] = applyTransform(t, mark.at);
    return [x + mark.extent.x0, y + mark.extent.y0, width - x - mark.extent.x1, height - y - mark.extent.y1];
  };
  /** The view's world area against the coverage and the pan limits (which d3-zoom keeps a smaller view inside). */
  const expectInside = (map: ReturnType<typeof regionMapFor>, t: Transform, width: number, height: number, extent: Bounds) => {
    const view: Bounds = [
      [-t.x / t.k, -t.y / t.k],
      [(width - t.x) / t.k, (height - t.y) / t.k],
    ];
    for (const d of [0, 1]) {
      expect(view[0][d]).toBeGreaterThanOrEqual(map.coverage[0][d] - 1e-6);
      expect(view[1][d]).toBeLessThanOrEqual(map.coverage[1][d] + 1e-6);
      if (view[1][d] - view[0][d] <= extent[1][d] - extent[0][d]) {
        expect(view[0][d]).toBeGreaterThanOrEqual(extent[0][d] - 1e-6);
        expect(view[1][d]).toBeLessThanOrEqual(extent[1][d] + 1e-6);
      }
    }
  };
  // Level 6 now (Poland, Belarus, Lithuania, Latvia, Estonia) and its first version (Germany in place of Belarus).
  const balticNow = regionMapFor(LESSONS["baltic-journey"]);
  const baltic = regionMapFor(balticJourneyOriginalLesson);

  it("baltic-journey: on 320px phones (304×231 and 304×261 maps), the pin in Tallinn and all five countries are whole, with a little less padding", () => {
    // The data reaches far enough north of Estonia here: the view moves, and zooms out a little, instead of zooming in.
    for (const [width, height] of [
      [304, 231],
      [304, 261],
    ]) {
      const padding = paddingFor(width, height);
      const tallinn = pinAt(balticNow, "EST");
      const region = viewLimits(balticNow, width, height, padding);
      // The countries' own start view cuts the pin's head: Tallinn is on the coast, 34 world units below the top of the five.
      expect(room(tallinn, region.base, width, height)[1]).toBeLessThan(0);
      const { base, minScale, translateExtent } = viewLimits(balticNow, width, height, padding, [tallinn]);
      for (const r of room(tallinn, base, width, height)) expect(r).toBeGreaterThanOrEqual(MARK_EDGE_CLEARANCE - 1e-6);
      expectInside(balticNow, base, width, height, translateExtent);
      expect(base.k).toBeLessThanOrEqual(region.base.k);
      expect(base.k / region.base.k).toBeGreaterThan(0.95);
      const [[fx0, fy0], [fx1, fy1]] = balticNow.focusBounds;
      const [sx0, sy0] = applyTransform(base, [fx0, fy0]);
      const [sx1, sy1] = applyTransform(base, [fx1, fy1]);
      for (const margin of [sx0, sy0, width - sx1, height - sy1]) expect(margin).toBeGreaterThanOrEqual(0);
      expect(minScale).toBeCloseTo(base.k, 9);
    }
  });

  it("baltic-journey (first version): on a 320×568 phone (304×231 map), the pin in Tallinn is whole, the view inside the data", () => {
    const [width, height] = [304, 231];
    const tallinn = pinAt(baltic, "EST");
    const region = viewLimits(baltic, width, height, paddingFor(width, height));
    // The countries' own start view cuts the pin's head: Tallinn is on the coast, 34 world units below the top of the five countries.
    expect(room(tallinn, region.base, width, height)[1]).toBeLessThan(0);
    const { base, minScale, translateExtent } = viewLimits(baltic, width, height, paddingFor(width, height), [tallinn]);
    for (const r of room(tallinn, base, width, height)) expect(r).toBeGreaterThanOrEqual(MARK_EDGE_CLEARANCE - 1e-6);
    expectInside(baltic, base, width, height, translateExtent);
    // The data ends just north of the view (the coverage's top edge), so the view zooms in by the least that fits
    // the pin there, never out: the countries keep their size, and only Germany's south runs past the bottom edge.
    expect(base.k).toBeGreaterThan(region.base.k);
    expect(base.k / region.base.k).toBeLessThan(1.1);
    expect(-base.y / base.k).toBeCloseTo(baltic.coverage[0][1], 6);
    const [[fx0, fy0], [fx1, fy1]] = baltic.focusBounds;
    const [sx0, sy0] = applyTransform(base, [fx0, fy0]);
    const [sx1, sy1] = applyTransform(base, [fx1, fy1]);
    expect(sx0).toBeGreaterThanOrEqual(0);
    expect(sx1).toBeLessThanOrEqual(width);
    expect(sy0).toBeGreaterThanOrEqual(0);
    expect(sy1 - height).toBeLessThan(20);
    // Zooming out still reaches the countries' own view.
    expect(minScale).toBeCloseTo(region.base.k, 9);
  });

  it("baltic-journey (first version): on a 320×640 phone (304×261 map), the pin in Tallinn and all five countries are whole", () => {
    const [width, height] = [304, 261];
    const padding = paddingFor(width, height);
    const tallinn = pinAt(baltic, "EST");
    expect(room(tallinn, viewLimits(baltic, width, height, padding).base, width, height)[1]).toBeLessThan(0);
    const { base, translateExtent } = viewLimits(baltic, width, height, padding, [tallinn]);
    for (const r of room(tallinn, base, width, height)) expect(r).toBeGreaterThanOrEqual(MARK_EDGE_CLEARANCE - 1e-6);
    expectInside(baltic, base, width, height, translateExtent);
    const [[fx0, fy0], [fx1, fy1]] = baltic.focusBounds;
    const [sx0, sy0] = applyTransform(base, [fx0, fy0]);
    const [sx1, sy1] = applyTransform(base, [fx1, fy1]);
    for (const margin of [sx0, sy0, width - sx1, height - sy1]) expect(margin).toBeGreaterThanOrEqual(0);
  });

  it("heart-of-the-balkans: on the shortest phone map (304×112, 200% text in Armenian on a 320×568 phone), the five are whole with their padding, the pin in Podgorica included", () => {
    // The coverage is wide enough that this map shows the countries' own fit instead of zooming in to fill its width.
    const map = regionMapFor(LESSONS["heart-of-the-balkans"]);
    const [width, height] = [304, 112];
    const padding = paddingFor(width, height);
    const [[fx0, fy0], [fx1, fy1]] = map.focusBounds;
    const margins = (t: Transform) => {
      const [[sx0, sy0], [sx1, sy1]] = [applyTransform(t, [fx0, fy0]), applyTransform(t, [fx1, fy1])];
      return [sx0, sy0, width - sx1, height - sy1];
    };
    const region = viewLimits(map, width, height, padding);
    expect(region.base).toEqual(fitTransform(map.focusBounds, width, height, padding));
    for (const m of margins(region.base)) expect(m).toBeGreaterThanOrEqual(padding - 1e-6);
    const podgorica = pinAt(map, "MNE");
    const { base, translateExtent } = viewLimits(map, width, height, padding, [podgorica]);
    for (const r of room(podgorica, base, width, height)) expect(r).toBeGreaterThanOrEqual(MARK_EDGE_CLEARANCE - 1e-6);
    for (const m of margins(base)) expect(m).toBeGreaterThanOrEqual(padding - 1e-6);
    expectInside(map, base, width, height, translateExtent);
  });

  it("nordic-countries: on the shortest phone map (304×112, 200% text in Armenian on a 320×568 phone), the five are whole with their padding, the pin in Copenhagen included", () => {
    // The coverage is wide enough that this map shows the countries' own fit instead of zooming in to fill its width.
    expect(isMapDataLoaded("north")).toBe(true);
    const map = regionMapFor(LESSONS["nordic-countries"]);
    for (const [width, height] of [
      [304, 112],
      [304, 150],
    ]) {
      const padding = paddingFor(width, height);
      const [[fx0, fy0], [fx1, fy1]] = map.focusBounds;
      const margins = (t: Transform) => {
        const [[sx0, sy0], [sx1, sy1]] = [applyTransform(t, [fx0, fy0]), applyTransform(t, [fx1, fy1])];
        return [sx0, sy0, width - sx1, height - sy1];
      };
      const region = viewLimits(map, width, height, padding);
      expect(region.base).toEqual(fitTransform(map.focusBounds, width, height, padding));
      for (const m of margins(region.base)) expect(m).toBeGreaterThanOrEqual(padding - 1e-6);
      const copenhagen = pinAt(map, "DNK");
      const { base, translateExtent } = viewLimits(map, width, height, padding, [copenhagen]);
      expect(base).toEqual(region.base);
      for (const r of room(copenhagen, base, width, height)) expect(r).toBeGreaterThanOrEqual(MARK_EDGE_CLEARANCE - 1e-6);
      expectInside(map, base, width, height, translateExtent);
    }
  });

  it("across-the-channel: on the shortest phone maps (304×112 and 304×150, 200% text on a 320×568 phone), the five are whole with their padding, the pin in Berlin and London included", () => {
    // The five are taller than wide (Corsica to Shetland): the coverage is wide enough, and tall enough, that these maps
    // show the countries' own fit, not a view zoomed in to fill them.
    expect(isMapDataLoaded("channel")).toBe(true);
    const map = regionMapFor(LESSONS["across-the-channel"]);
    for (const [width, height] of [
      [304, 112],
      [304, 150],
    ]) {
      const padding = paddingFor(width, height);
      const [[fx0, fy0], [fx1, fy1]] = map.focusBounds;
      const margins = (t: Transform) => {
        const [[sx0, sy0], [sx1, sy1]] = [applyTransform(t, [fx0, fy0]), applyTransform(t, [fx1, fy1])];
        return [sx0, sy0, width - sx1, height - sy1];
      };
      const region = viewLimits(map, width, height, padding);
      expect(region.base).toEqual(fitTransform(map.focusBounds, width, height, padding));
      for (const m of margins(region.base)) expect(m).toBeGreaterThanOrEqual(padding - 1e-6);
      for (const country of ["DEU", "GBR"]) {
        const pin = pinAt(map, country);
        const { base, translateExtent } = viewLimits(map, width, height, padding, [pin]);
        expect(base).toEqual(region.base);
        for (const r of room(pin, base, width, height)) expect(r).toBeGreaterThanOrEqual(MARK_EDGE_CLEARANCE - 1e-6);
        expectInside(map, base, width, height, translateExtent);
      }
    }
  });

  it("russia-and-western-neighbours: on the shortest phone maps (304×112 and 304×150, 200% text on a 320×568 phone), the five are whole with their padding, the pin in Tallinn and Minsk included", () => {
    // The frame is taller than wide (Belarus to the North Cape): the coverage is wide enough, and tall enough, that these
    // maps show the countries' own fit, not a view zoomed in to fill them.
    expect(isMapDataLoaded("east")).toBe(true);
    const map = regionMapFor(LESSONS["russia-and-western-neighbours"]);
    for (const [width, height] of [
      [304, 112],
      [304, 150],
    ]) {
      const padding = paddingFor(width, height);
      const [[fx0, fy0], [fx1, fy1]] = map.focusBounds;
      const margins = (t: Transform) => {
        const [[sx0, sy0], [sx1, sy1]] = [applyTransform(t, [fx0, fy0]), applyTransform(t, [fx1, fy1])];
        return [sx0, sy0, width - sx1, height - sy1];
      };
      const region = viewLimits(map, width, height, padding);
      expect(region.base).toEqual(fitTransform(map.focusBounds, width, height, padding));
      for (const m of margins(region.base)) expect(m).toBeGreaterThanOrEqual(padding - 1e-6);
      for (const country of ["EST", "BLR"]) {
        const pin = pinAt(map, country);
        const { base, translateExtent } = viewLimits(map, width, height, padding, [pin]);
        expect(base).toEqual(region.base);
        for (const r of room(pin, base, width, height)) expect(r).toBeGreaterThanOrEqual(MARK_EDGE_CLEARANCE - 1e-6);
        expectInside(map, base, width, height, translateExtent);
      }
    }
  });

  it("changes the start view only where the pin would be cut: every level, every capital, phones to wide desktops", () => {
    const changed: string[] = [];
    for (const lesson of LESSON_VERSIONS) {
      const map = regionMapFor(lesson);
      for (const [width, height] of [
        [304, 231],
        [304, 261],
        [374, 380],
        [396, 413],
        [932, 712],
        [1456, 992],
        [2096, 992],
      ]) {
        const padding = paddingFor(width, height);
        const region = viewLimits(map, width, height, padding);
        const [[fx0, fy0], [fx1, fy1]] = map.focusBounds;
        const [[sx0, sy0], [sx1, sy1]] = [applyTransform(region.base, [fx0, fy0]), applyTransform(region.base, [fx1, fy1])];
        // A map whose start view crops the countries already (Level 2 on a 2.1:1 map, where Berlin is beyond the top edge).
        const cropped = sx0 < -0.5 || sy0 < -0.5 || sx1 > width + 0.5 || sy1 > height + 0.5;
        for (const country of lesson.countries) {
          const pin = pinAt(map, country);
          const { base, translateExtent } = viewLimits(map, width, height, padding, [pin]);
          if (cropped || room(pin, region.base, width, height).every((r) => r >= MARK_EDGE_CLEARANCE)) {
            expect(base).toEqual(region.base);
            continue;
          }
          changed.push(`${versionKey(lesson)} ${country} ${width}×${height}`);
          for (const r of room(pin, base, width, height)) expect(r).toBeGreaterThanOrEqual(MARK_EDGE_CLEARANCE - 1e-6);
          expectInside(map, base, width, height, translateExtent);
        }
      }
    }
    // Only Tallinn, on the coast at the top of Level 6 (both versions), on 320px phones.
    expect(changed).toEqual(["baltic-journey-r2 EST 304×231", "baltic-journey-r2 EST 304×261", "baltic-journey EST 304×231", "baltic-journey EST 304×261"]);
  });

  it("leaves short maps as they are: landscape phones (cropped already) and 200% text, which would need more than a small zoom", () => {
    for (const [width, height] of [
      [724, 192],
      [828, 192],
      // 200% text on a 320×568 phone: the pin would need the view zoomed in 1.7 times.
      [304, 156],
      [304, 150],
    ]) {
      for (const map of [balticNow, baltic]) {
        const region = viewLimits(map, width, height, paddingFor(width, height));
        expect(viewLimits(map, width, height, paddingFor(width, height), [pinAt(map, "EST")]).base).toEqual(region.base);
      }
    }
  });

  describe("Level 4's traveller in Hungary (Travel only), at Budapest near the map's north edge", () => {
    const adriatic = LESSONS["along-the-adriatic"];
    const map = regionMapFor(adriatic);
    /** The same level without Travel's reach north, as before Hungary was added. */
    const before = getRegionMap(adriatic.countries, adriatic.map.coverageHalf, adriatic.map.dataset);
    const budapest = (): ScreenMark => ({ ...pinAt(map, "HUN"), keep: true });
    // Phones (portrait, landscape, 200% text: 304×112 in Armenian, 304×150 in English), tablets and desktops.
    const sizes = [
      [304, 112],
      [304, 150],
      [304, 231],
      [374, 388],
      [390, 420],
      [280, 240],
      [392, 280],
      [448, 310],
      [724, 192],
      [828, 260],
      [1366, 560],
      [1920, 900],
    ];

    it("reaches 160 units further north in Travel only, inside the data; Discover and Find (no reach) frame and pan as before", () => {
      expect(adriatic.map.travelReachNorth).toBe(160);
      expect(map.travelCoverage[0][1]).toBeCloseTo(map.coverage[0][1] - 160, 6);
      // Budapest is inside the coverage, but only 20 units inside its north edge.
      expect(budapest().at[1] - map.coverage[0][1]).toBeGreaterThan(0);
      expect(budapest().at[1] - map.coverage[0][1]).toBeLessThan(25);
      for (const [width, height] of sizes) {
        const padding = paddingFor(width, height);
        expect(viewLimits(map, width, height, padding)).toEqual(viewLimits(before, width, height, padding));
        // In Travel: the same start view and zoom limits; only the pan limit north is Travel's reach.
        const travel = viewLimits(map, width, height, padding, [], true);
        const plain = viewLimits(before, width, height, padding);
        expect(travel.base).toEqual(plain.base);
        expect(travel.minScale).toBe(plain.minScale);
        expect(travel.translateExtent[0][1]).toBeCloseTo(map.travelCoverage[0][1], 6);
        expect([travel.translateExtent[0][0], travel.translateExtent[1][0], travel.translateExtent[1][1]]).toEqual([
          plain.translateExtent[0][0],
          plain.translateExtent[1][0],
          plain.translateExtent[1][1],
        ]);
      }
    });

    it("keeps the traveller's pin in Budapest whole, with the usual clearance, on every map size, inside Travel's reach", () => {
      for (const [width, height] of sizes) {
        const { base, translateExtent } = viewLimits(map, width, height, paddingFor(width, height), [budapest()], true);
        for (const r of room(budapest(), base, width, height)) expect(r, `${width}×${height}`).toBeGreaterThanOrEqual(MARK_EDGE_CLEARANCE - 1e-6);
        const view: Bounds = [
          [-base.x / base.k, -base.y / base.k],
          [(width - base.x) / base.k, (height - base.y) / base.k],
        ];
        for (const d of [0, 1]) {
          expect(view[0][d]).toBeGreaterThanOrEqual(map.travelCoverage[0][d] - 1e-6);
          expect(view[1][d]).toBeLessThanOrEqual(map.travelCoverage[1][d] + 1e-6);
          if (view[1][d] - view[0][d] <= translateExtent[1][d] - translateExtent[0][d]) {
            expect(view[0][d]).toBeGreaterThanOrEqual(translateExtent[0][d] - 1e-6);
            expect(view[1][d]).toBeLessThanOrEqual(translateExtent[1][d] + 1e-6);
          }
        }
      }
      // Without the reach (as before), no size could show it whole at the start view but by zooming in far.
      const cut = sizes.filter(([width, height]) => {
        const { base } = viewLimits(before, width, height, paddingFor(width, height), [budapest()]);
        return room(budapest(), base, width, height).some((r) => r < MARK_EDGE_CLEARANCE - 1e-6);
      });
      expect(cut.length).toBeGreaterThan(0);
    });

    it("moves only for a pin it must keep: the level's own capitals in Travel start as without the reach where their pins fit", () => {
      const moved: string[] = [];
      for (const [width, height] of sizes) {
        const padding = paddingFor(width, height);
        const region = viewLimits(before, width, height, padding).base;
        for (const country of adriatic.countries) {
          const pin = pinAt(map, country);
          const plain = viewLimits(before, width, height, padding, [pin]).base;
          const travel = viewLimits(map, width, height, padding, [pin], true).base;
          // Where the pin fits the start view, or the view is left as it is without the reach (a short map that cuts
          // the countries already: the pin may be cut, as before), the same view.
          if (room(pin, region, width, height).every((r) => r >= MARK_EDGE_CLEARANCE - 1e-6) || JSON.stringify(plain) === JSON.stringify(region)) {
            expect(travel, `${country} ${width}×${height}`).toEqual(plain);
            continue;
          }
          // Where the view moves for the pin, the reach may move it north instead of zooming in: the pin whole, and
          // never zoomed in further than without the reach.
          for (const r of room(pin, travel, width, height)) expect(r, `${country} ${width}×${height}`).toBeGreaterThanOrEqual(MARK_EDGE_CLEARANCE - 1e-6);
          expect(travel.k).toBeLessThanOrEqual(plain.k + 1e-9);
          if (JSON.stringify(travel) !== JSON.stringify(plain)) moved.push(`${country} ${width}×${height}`);
        }
      }
      // Ljubljana and Zagreb at 200% text (English): moved north at the start zoom (×1.09 and ×1.02 without the reach).
      expect(moved).toEqual(["SVN 304×150", "HRV 304×150"]);
    });
  });

  describe("the traveller clear of the map controls and “About the map”", () => {
    /**
     * The zoom controls (RegionMap.module.css): 8px from the bottom-right corner, a column of three 44px buttons, or a
     * row on a map 190px tall or less; "About the map" with its margin in the top-right. In Travel and Results on such a
     * short map the controls are off it (`off`): below it with the panel below (200% text on a 320×568 phone: 304×150 in
     * English, 304×112 in Armenian, 304×156 in English Results), at the top of the panel beside it (the same in landscape,
     * 568×320: 280×182, 280×180, 280×188 in Results). The traveller then keeps clear of "About the map" only.
     */
    const chrome = (width: number, height: number, off = false): ScreenBox[] => [
      ...(off ? [] : [height <= 190 ? { x0: width - 142, y0: height - 54, x1: width - 8, y1: height - 8 } : { x0: width - 54, y0: height - 142, x1: width - 8, y1: height - 8 }]),
      { x0: width - 44, y0: 0, x1: width, y1: 44 },
    ];
    /** Whether the mark, at a view, keeps MARK_EDGE_CLEARANCE from an area on some side. */
    const clearOf = (mark: ScreenMark, t: Transform, b: ScreenBox) => {
      const [x, y] = applyTransform(t, mark.at);
      const c = MARK_EDGE_CLEARANCE - 1e-6;
      return x + mark.extent.x1 <= b.x0 - c || x + mark.extent.x0 >= b.x1 + c || y + mark.extent.y1 <= b.y0 - c || y + mark.extent.y0 >= b.y1 + c;
    };
    // Phones (320×568, 390×844, landscape) and, with 200% text, the controls off the map (320×568 and landscape), a
    // tablet and a desktop.
    const sizes: [number, number, boolean][] = [
      [304, 231, false],
      [304, 150, true],
      [304, 112, true],
      [374, 380, false],
      [280, 240, false],
      [280, 182, true],
      [280, 180, true],
      [448, 310, false],
      [932, 712, false],
    ];
    const nordic = LESSONS["nordic-countries"];
    const traveller = (map: ReturnType<typeof regionMapFor>, lesson: (typeof LESSON_VERSIONS)[number], country: string, width: number, height: number, off: boolean): ScreenMark => ({
      ...pinAt(map, country),
      keep: (lesson.travelOnly ?? []).includes(country),
      clearOf: chrome(width, height, off),
    });

    it("nordic-countries: in every country the traveller can stand in (Germany, Poland and the Netherlands too), and in Results, the pin is whole and uncovered", () => {
      const map = regionMapFor(nordic);
      for (const [width, height, off] of sizes)
        for (const country of travelCountries(nordic)) {
          if (country === "ISL") continue; // No journey reaches Iceland.
          const pin = traveller(map, nordic, country, width, height, off);
          const { base, translateExtent } = viewLimits(map, width, height, paddingFor(width, height), [pin]);
          const at = `${country} ${width}×${height}`;
          for (const r of room(pin, base, width, height)) expect(r, at).toBeGreaterThanOrEqual(MARK_EDGE_CLEARANCE - 1e-6);
          for (const b of chrome(width, height, off)) expect(clearOf(pin, base, b), at).toBe(true);
          expectInside(map, base, width, height, translateExtent);
        }
    });

    it("nordic-countries: with the controls off the map (200% text on a 320×568 phone, and in landscape), no start view zooms in, and Helsinki, the destination, stays in view", () => {
      const map = regionMapFor(nordic);
      const helsinki = map.project(COUNTRIES.FIN.capital.coordinates);
      for (const [width, height] of [
        [304, 150],
        [304, 112],
        [304, 156],
        [280, 182],
        [280, 180],
        [280, 188],
      ]) {
        const padding = paddingFor(width, height);
        const own = viewLimits(map, width, height, padding).base;
        for (const country of travelCountries(nordic)) {
          if (country === "ISL") continue;
          const pin = traveller(map, nordic, country, width, height, true);
          const { base } = viewLimits(map, width, height, padding, [pin]);
          const at = `${country} ${width}×${height}`;
          // The countries' own zoom, or a little less (×0.93 at least) for a Travel-only country's pin at the bottom edge.
          expect(base.k, at).toBeLessThanOrEqual(own.k + 1e-9);
          expect(base.k / own.k, at).toBeGreaterThan(0.9);
          for (const r of room(pin, base, width, height)) expect(r, at).toBeGreaterThanOrEqual(MARK_EDGE_CLEARANCE - 1e-6);
          const [hx, hy] = applyTransform(base, helsinki);
          expect(hx > 0 && hx < width && hy > 0 && hy < height, `${at}: Helsinki in view`).toBe(true);
        }
      }
    });

    it("nordic-countries: with the controls on the map, Warsaw's pin lay under them on 320px and 390px phones and in landscape; the view moves no further than it must", () => {
      const map = regionMapFor(nordic);
      for (const [width, height] of [
        [304, 231],
        [374, 380],
        [280, 240],
      ]) {
        const padding = paddingFor(width, height);
        const warsaw = traveller(map, nordic, "POL", width, height, false);
        const before = viewLimits(map, width, height, padding, [{ ...warsaw, clearOf: undefined }]).base;
        expect(clearOf(warsaw, before, chrome(width, height)[0]), `${width}×${height}`).toBe(false);
        const { base } = viewLimits(map, width, height, padding, [warsaw]);
        // Just clear of the controls: on their left, or above them, by MARK_EDGE_CLEARANCE.
        const [x, y] = applyTransform(base, warsaw.at);
        const controls = chrome(width, height)[0];
        const gaps = [controls.x0 - (x + warsaw.extent.x1), controls.y0 - (y + warsaw.extent.y1)];
        expect(Math.max(...gaps), `${width}×${height}`).toBeCloseTo(MARK_EDGE_CLEARANCE, 6);
      }
    });

    const channelLesson = LESSONS["across-the-channel"];

    it("across-the-channel: in every country of the level and Luxembourg (Travel only), and in Results, the traveller's pin is whole and uncovered", () => {
      // Ireland too, though this level's journey ends in the United Kingdom: a pin there is as whole as anywhere.
      const map = regionMapFor(channelLesson);
      for (const [width, height, off] of sizes)
        for (const country of travelCountries(channelLesson)) {
          const pin = traveller(map, channelLesson, country, width, height, off);
          const { base, translateExtent } = viewLimits(map, width, height, paddingFor(width, height), [pin]);
          const at = `${country} ${width}×${height}`;
          for (const r of room(pin, base, width, height)) expect(r, at).toBeGreaterThanOrEqual(MARK_EDGE_CLEARANCE - 1e-6);
          for (const b of chrome(width, height, off)) expect(clearOf(pin, base, b), at).toBe(true);
          expectInside(map, base, width, height, translateExtent);
        }
    });

    it("across-the-channel: with the controls off the map (200% text on a 320×568 phone, and in landscape), no start view zooms in, and London, the destination, stays in view", () => {
      const map = regionMapFor(channelLesson);
      const london = map.project(COUNTRIES.GBR.capital.coordinates);
      for (const [width, height] of [
        [304, 150],
        [304, 112],
        [304, 156],
        [280, 182],
        [280, 180],
        [280, 188],
      ]) {
        const padding = paddingFor(width, height);
        const own = viewLimits(map, width, height, padding).base;
        for (const country of travelCountries(channelLesson)) {
          const pin = traveller(map, channelLesson, country, width, height, true);
          const { base } = viewLimits(map, width, height, padding, [pin]);
          const at = `${country} ${width}×${height}`;
          expect(base.k, at).toBeLessThanOrEqual(own.k + 1e-9);
          expect(base.k / own.k, at).toBeGreaterThan(0.9);
          for (const r of room(pin, base, width, height)) expect(r, at).toBeGreaterThanOrEqual(MARK_EDGE_CLEARANCE - 1e-6);
          const [lx, ly] = applyTransform(base, london);
          expect(lx > 0 && lx < width && ly > 0 && ly < height, `${at}: London in view`).toBe(true);
        }
      }
    });

    const eastLesson = LESSONS["russia-and-western-neighbours"];

    it("russia-and-western-neighbours: in every country of the level, and in Results, the traveller's pin is whole and uncovered", () => {
      // Finland too, reached only by a wrong turn through Russia; Russia's pin is Moscow's, on its mainland.
      const map = regionMapFor(eastLesson);
      for (const [width, height, off] of sizes)
        for (const country of travelCountries(eastLesson)) {
          const pin = traveller(map, eastLesson, country, width, height, off);
          const { base, translateExtent } = viewLimits(map, width, height, paddingFor(width, height), [pin]);
          const at = `${country} ${width}×${height}`;
          for (const r of room(pin, base, width, height)) expect(r, at).toBeGreaterThanOrEqual(MARK_EDGE_CLEARANCE - 1e-6);
          for (const b of chrome(width, height, off)) expect(clearOf(pin, base, b), at).toBe(true);
          expectInside(map, base, width, height, translateExtent);
        }
    });

    it("russia-and-western-neighbours: with the controls off the map (200% text on a 320×568 phone, and in landscape), no start view zooms in, and Minsk, the destination, stays in view", () => {
      const map = regionMapFor(eastLesson);
      const minsk = map.project(COUNTRIES.BLR.capital.coordinates);
      for (const [width, height] of [
        [304, 150],
        [304, 112],
        [304, 156],
        [280, 182],
        [280, 180],
        [280, 188],
      ]) {
        const padding = paddingFor(width, height);
        const own = viewLimits(map, width, height, padding).base;
        for (const country of travelCountries(eastLesson)) {
          const pin = traveller(map, eastLesson, country, width, height, true);
          const { base } = viewLimits(map, width, height, padding, [pin]);
          const at = `${country} ${width}×${height}`;
          expect(base.k, at).toBeLessThanOrEqual(own.k + 1e-9);
          expect(base.k / own.k, at).toBeGreaterThan(0.9);
          for (const r of room(pin, base, width, height)) expect(r, at).toBeGreaterThanOrEqual(MARK_EDGE_CLEARANCE - 1e-6);
          const [mx, my] = applyTransform(base, minsk);
          expect(mx > 0 && mx < width && my > 0 && my < height, `${at}: Minsk in view`).toBe(true);
        }
      }
    });

    it("changes the start view only where the pin was under the controls or “About the map”: every level, every country the traveller can stand in", () => {
      for (const lesson of LESSON_VERSIONS) {
        const map = regionMapFor(lesson);
        for (const [width, height, off] of sizes) {
          const padding = paddingFor(width, height);
          const travel = (lesson.map.travelReachNorth ?? 0) > 0;
          for (const country of travelCountries(lesson)) {
            const pin = traveller(map, lesson, country, width, height, off);
            const plain = viewLimits(map, width, height, padding, [{ ...pin, clearOf: undefined }], travel).base;
            const { base } = viewLimits(map, width, height, padding, [pin], travel);
            const at = `${versionKey(lesson)} ${country} ${width}×${height}`;
            if (chrome(width, height, off).every((b) => clearOf(pin, plain, b))) expect(base, at).toEqual(plain);
            else for (const b of chrome(width, height, off)) expect(clearOf(pin, base, b), at).toBe(true);
          }
        }
      }
    });
  });
});

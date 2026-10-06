import { describe, expect, it } from "vitest";
import { geoContains } from "d3-geo";
import { feature, neighbors } from "topojson-client";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import topologyJson from "@/data/geo/europe-west.topo.json";
import { COUNTRIES } from "@/core/content/countries";
import { LESSON_VERSIONS, LESSONS, LEVELS, versionKey } from "@/core/lessons";
import { balticJourneyOriginalLesson } from "@/core/lessons/baltic-journey";
import { shortestDistance, validateGraph, type BorderGraph } from "@/core/game/graph";
import { applyTransform, fitTransform, getRegionMap, MAP_DATA_CLIP, MARK_EDGE_CLEARANCE, maxMapWidth, PROJECTION_FIT, regionMapFor, viewLimits, type Bounds, type ScreenMark, type Transform } from "./regionMap";

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
 * "Level 4"), and Belém Tower, which stands at the edge of the Tagus, 0.32 km beyond it
 * ("Level 7"); every other landmark must lie inside its country.
 */
const COAST_MARGIN_KM: Readonly<Record<string, number>> = { "dubrovnik-city-walls": 0.6, "belem-tower": 0.4 };

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

  // Every version of every level (Level 6's first included: attempts started on it go on).
  for (const lesson of LESSON_VERSIONS) {
    it(`${versionKey(lesson)}: border graph matches shared boundaries in the data`, () => {
      const adjacency = neighbors(geometries);
      for (const id of lesson.countries) {
        const index = geometries.findIndex((g) => g.id === id);
        expect(index, id).toBeGreaterThanOrEqual(0);
        const fromData = adjacency[index].map((i) => String(geometries[i].id)).filter((n) => lesson.countries.includes(n));
        expect([...fromData].sort(), id).toEqual([...lesson.borders[id]].sort());
      }
    });

    it(`${versionKey(lesson)}: capitals, landmarks and label anchors fall inside their countries`, () => {
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

    it(`${versionKey(lesson)}: the coverage area lies inside the clipped data`, () => {
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
});

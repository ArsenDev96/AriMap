import type { CountryId, LonLat } from "@/core/content/types";
import type { Point, RegionMap } from "./regionMap";

/**
 * Illustrated scenery for the Discover map: mountain ridges, forests and a few
 * wave marks, anchored to real places. Sources and simplifications are listed
 * in docs/TERRAIN.md; src/geo/terrain.test.ts checks every anchor against the
 * map data (and, when NE_REGIONS is set, against Natural Earth's named ranges).
 */

export type RangeKind = "alpine" | "rocky" | "hills";

export interface MountainRange {
  id: string;
  /** Natural Earth region name the crests lie in, or null (see `peaks`). */
  naturalEarth: string | null;
  kind: RangeKind;
  /**
   * Drawn as painted relief from elevation data (Scenery's `AlpineRelief`)
   * instead of mountain symbols. The crests still anchor the range for tests.
   */
  relief?: true;
  /** Crest lines, west to east, through named summits (lon, lat). */
  crests: readonly (readonly LonLat[])[];
}

export type ForestKind = "broadleaf" | "conifer";

export interface Forest {
  id: string;
  country: CountryId;
  /** Coordinate of the forest's Wikipedia article. */
  center: LonLat;
  /** Approximate radius of the wooded area. */
  radiusKm: number;
  kind: ForestKind;
}

export const MOUNTAIN_RANGES: readonly MountainRange[] = [
  {
    id: "alps",
    naturalEarth: "Alps",
    kind: "alpine",
    relief: true,
    crests: [
      // Main chain: Mercantour, Monte Viso, Mont Blanc, Monte Rosa, Gotthard, Bernina, Ortler, Wildspitze, Grossglockner, Niedere Tauern.
      [[7.13, 44.14], [7.09, 44.67], [6.95, 45.15], [6.87, 45.83], [7.87, 45.94], [8.57, 46.56], [9.91, 46.38], [10.55, 46.51], [10.87, 46.89], [11.8, 47.05], [12.7, 47.08], [13.9, 47.3], [15.2, 47.55]],
      // Western ranges: Écrins, Belledonne, Aravis.
      [[6.15, 44.45], [6.36, 44.92], [6.05, 45.3], [6.35, 45.85]],
      // Bernese Alps and Glarus Alps: Jungfrau, Titlis, Tödi.
      [[7.2, 46.33], [7.96, 46.54], [8.44, 46.77], [8.91, 46.81]],
      // Northern Limestone Alps: Säntis, Allgäu, Zugspitze, Dachstein.
      [[9.34, 47.25], [10.25, 47.38], [10.99, 47.42], [11.8, 47.55], [12.9, 47.58], [13.61, 47.48], [14.6, 47.65], [15.6, 47.72]],
      // Southern Alps: Adamello, Marmolada, Triglav.
      [[10.5, 46.16], [11.85, 46.44], [12.6, 46.45], [13.84, 46.38]],
    ],
  },
  {
    id: "pyrenees",
    naturalEarth: "Pyrenees",
    kind: "alpine",
    // Pic du Midi d'Ossau, Aneto, Canigó.
    crests: [[[-1.55, 43.05], [-0.44, 42.84], [0.2, 42.72], [0.66, 42.63], [1.5, 42.58], [2.46, 42.52], [2.9, 42.45]]],
  },
  {
    id: "cantabrian",
    naturalEarth: "Cantabrian Mountains",
    kind: "rocky",
    // Picos de Europa (Torre Cerredo).
    crests: [[[-6.9, 42.95], [-5.9, 43.05], [-4.85, 43.2], [-4.1, 43.05], [-3.3, 43.1]]],
  },
  {
    id: "apennines",
    naturalEarth: "Appennino Ligure",
    kind: "rocky",
    // Northern Apennines to Monte Cimone and Gran Sasso.
    crests: [[[9.0, 44.55], [9.8, 44.45], [10.7, 44.19], [11.6, 43.9], [12.4, 43.5], [13.0, 43.0], [13.57, 42.47], [14.1, 42.0], [15.0, 41.4]]],
  },
  {
    id: "dinaric",
    naturalEarth: "Dinaric Alps",
    kind: "rocky",
    crests: [[[14.5, 45.6], [15.3, 44.9], [16.2, 44.1], [17.3, 43.5], [18.4, 42.9]]],
  },
  {
    id: "massif-central",
    naturalEarth: "Massif Central",
    kind: "hills",
    crests: [
      // Chaîne des Puys, Puy de Sancy, Plomb du Cantal, Aubrac, Mont Lozère, Mont Aigoual.
      [[2.97, 45.77], [2.81, 45.53], [2.76, 45.06], [3.1, 44.7], [3.74, 44.43], [3.58, 44.12]],
      // Monts du Forez and the Vivarais.
      [[3.8, 45.7], [4.25, 45.25], [4.3, 44.9]],
    ],
  },
  {
    id: "vosges",
    naturalEarth: "Vosges Mountains",
    kind: "hills",
    // Down to the Grand Ballon.
    crests: [[[7.3, 48.7], [7.1, 48.25], [7.1, 47.9], [6.85, 47.82]]],
  },
  {
    id: "jura",
    naturalEarth: "Jura Mountains",
    kind: "hills",
    // From the Crêt de la Neige north-east.
    crests: [[[5.94, 46.27], [6.25, 46.6], [6.7, 46.9], [7.15, 47.2], [7.7, 47.4]]],
  },
  {
    id: "black-forest",
    naturalEarth: null,
    kind: "hills",
    // Feldberg to Hornisgrinde.
    crests: [[[8.01, 47.88], [8.1, 48.25], [8.2, 48.61]]],
  },
  {
    id: "swabian-jura",
    naturalEarth: null,
    kind: "hills",
    crests: [[[8.75, 48.12], [9.35, 48.3], [10.1, 48.62]]],
  },
  {
    id: "harz",
    naturalEarth: "Harz",
    kind: "hills",
    // Around the Brocken.
    crests: [[[10.35, 51.8], [10.62, 51.8], [10.95, 51.68]]],
  },
  {
    id: "ore",
    naturalEarth: "Ore Mountains",
    kind: "hills",
    // Fichtelberg.
    crests: [[[12.3, 50.33], [12.96, 50.43], [13.5, 50.65], [13.95, 50.8]]],
  },
  {
    id: "bohemian-forest",
    naturalEarth: "Böhmerwald",
    kind: "hills",
    // Großer Arber.
    crests: [[[12.55, 49.7], [13.13, 49.11], [13.8, 48.77]]],
  },
  {
    id: "sudetes",
    naturalEarth: "Sudetes",
    kind: "hills",
    // Sněžka.
    crests: [[[15.0, 50.85], [15.74, 50.74], [16.4, 50.4], [17.1, 50.2]]],
  },
  {
    id: "grampians",
    // Natural Earth's Scottish polygon ("Cruach nam Miseag") is a thin strip along
    // the Highland edge, so this range is anchored on its summits instead.
    naturalEarth: null,
    kind: "rocky",
    // Ben Nevis to the Cairngorms.
    crests: [[[-5.0, 56.8], [-4.3, 56.9], [-3.64, 57.12], [-3.1, 56.95]]],
  },
  {
    id: "cambrian",
    naturalEarth: "Cambrian Mountains",
    kind: "hills",
    // Snowdon southwards.
    crests: [[[-4.08, 53.07], [-3.85, 52.6], [-3.75, 52.25], [-3.6, 51.9]]],
  },
];

/**
 * Named forests. None in Belgium, the Netherlands or Luxembourg (the Ardennes,
 * Veluwe and Oesling are left out on purpose): the crowded Low Countries stay clear.
 */
export const FORESTS: readonly Forest[] = [
  { id: "landes", country: "FRA", center: [-0.58, 44.18], radiusKm: 60, kind: "conifer" },
  { id: "compiegne", country: "FRA", center: [2.88, 49.38], radiusKm: 10, kind: "broadleaf" },
  { id: "morvan", country: "FRA", center: [4.0, 47.08], radiusKm: 25, kind: "broadleaf" },
  { id: "vosges", country: "FRA", center: [7.0, 48.0], radiusKm: 35, kind: "conifer" },
  { id: "black-forest", country: "DEU", center: [8.05, 48.25], radiusKm: 45, kind: "conifer" },
  { id: "palatinate", country: "DEU", center: [7.88, 49.29], radiusKm: 20, kind: "broadleaf" },
  { id: "odenwald", country: "DEU", center: [9.02, 49.58], radiusKm: 16, kind: "broadleaf" },
  { id: "spessart", country: "DEU", center: [9.43, 49.9], radiusKm: 20, kind: "broadleaf" },
  { id: "rothaar", country: "DEU", center: [8.25, 51.08], radiusKm: 25, kind: "conifer" },
  { id: "teutoburg", country: "DEU", center: [8.82, 51.9], radiusKm: 15, kind: "broadleaf" },
  { id: "solling", country: "DEU", center: [9.6, 51.73], radiusKm: 12, kind: "broadleaf" },
  { id: "harz", country: "DEU", center: [10.63, 51.75], radiusKm: 20, kind: "conifer" },
  { id: "thuringian", country: "DEU", center: [10.75, 50.67], radiusKm: 25, kind: "conifer" },
  { id: "bavarian", country: "DEU", center: [12.67, 49.0], radiusKm: 30, kind: "conifer" },
  { id: "schorfheide", country: "DEU", center: [13.82, 52.97], radiusKm: 18, kind: "conifer" },
  { id: "tuchola", country: "POL", center: [18.0, 53.6], radiusKm: 35, kind: "conifer" },
  { id: "new-forest", country: "GBR", center: [-1.62, 50.86], radiusKm: 12, kind: "broadleaf" },
  { id: "thetford", country: "GBR", center: [0.65, 52.46], radiusKm: 12, kind: "conifer" },
  { id: "kielder", country: "GBR", center: [-2.53, 55.21], radiusKm: 15, kind: "conifer" },
  { id: "galloway", country: "GBR", center: [-4.42, 55.12], radiusKm: 18, kind: "conifer" },
];

/** A few wave marks in open water, well away from coasts. */
export const WAVES: readonly { sea: string; at: LonLat }[] = [
  { sea: "Bay of Biscay", at: [-4.0, 45.3] },
  { sea: "Atlantic, off Brittany", at: [-7.0, 47.8] },
  { sea: "Celtic Sea", at: [-7.5, 50.3] },
  { sea: "Atlantic, west of Ireland", at: [-11.0, 53.0] },
  { sea: "Irish Sea", at: [-5.4, 53.6] },
  { sea: "North Sea", at: [3.0, 55.0] },
  { sea: "North Sea (south)", at: [3.2, 53.6] },
  { sea: "Skagerrak", at: [9.5, 57.8] },
  { sea: "Baltic Sea", at: [16.5, 55.6] },
  { sea: "Balearic Sea", at: [3.2, 41.2] },
  { sea: "Gulf of Lion", at: [4.2, 42.6] },
  { sea: "Ligurian Sea", at: [8.4, 43.6] },
  { sea: "Tyrrhenian Sea", at: [11.5, 41.4] },
  { sea: "Adriatic Sea", at: [14.5, 43.4] },
];

/** Countries kept free of all scenery: Luxembourg and the crowded Low Countries. */
export const SCENERY_FREE: ReadonlySet<CountryId> = new Set(["BEL", "NLD", "LUX"]);

// --- Pure helpers (shared by the renderer and the tests) -----------------------

/** Deterministic hash of the arguments to [0, 1). */
export function hash01(...parts: number[]): number {
  let h = 2166136261;
  for (const p of parts) {
    h ^= Math.round(p * 1000) | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
}

/** World units per kilometre around a point (the projection is equal-area, so this is close to uniform). */
export function worldPerKm(map: RegionMap, at: LonLat): number {
  const a = map.project(at);
  const b = map.project([at[0], at[1] + 1 / 111.32]);
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * Zoom level of detail: the finest nested spacing `base / 2^level` that is still
 * at least `targetPx` on screen at scale k. Coarser levels' points are kept at
 * finer levels, so zooming in adds scenery rather than moving it.
 */
export function detailLevel(k: number, targetPx: number, base: number, maxLevel = 6): number {
  const level = Math.floor(Math.log2((base * k) / targetPx));
  return Math.max(0, Math.min(maxLevel, level));
}

/** Points along a polyline at `phase + n * spacing` (arc length), with the local direction. */
export function pointsAlong(line: readonly Point[], spacing: number, phase: number): { at: Point; along: number; dir: Point }[] {
  const out: { at: Point; along: number; dir: Point }[] = [];
  let start = 0;
  let next = phase % spacing;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const len = Math.hypot(bx - ax, by - ay);
    if (len === 0) continue;
    const dir: Point = [(bx - ax) / len, (by - ay) / len];
    while (next <= start + len) {
      const t = next - start;
      out.push({ at: [ax + dir[0] * t, ay + dir[1] * t], along: next, dir });
      next += spacing;
    }
    start += len;
  }
  return out;
}

/**
 * Nested jittered grid: one point per cell at `level` (cell size base / 2^level).
 * A cell containing its parent cell's point keeps it, so each level contains the
 * previous one.
 */
export function gridPoint(seed: number, base: number, level: number, i: number, j: number, cache: Map<string, Point>): Point {
  const key = `${seed}:${level}:${i}:${j}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = base / 2 ** level;
  let point: Point | null = null;
  if (level > 0) {
    const parent = gridPoint(seed, base, level - 1, i >> 1, j >> 1, cache);
    if (Math.floor(parent[0] / size) === i && Math.floor(parent[1] / size) === j) point = parent;
  }
  if (!point) {
    const jx = 0.15 + 0.7 * hash01(seed, level, i, j, 1);
    const jy = 0.15 + 0.7 * hash01(seed, level, i, j, 2);
    point = [(i + jx) * size, (j + jy) * size];
  }
  cache.set(key, point);
  return point;
}

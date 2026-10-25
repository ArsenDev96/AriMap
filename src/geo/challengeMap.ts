import { geoAzimuthalEqualArea, geoPath, type GeoProjection } from "d3-geo";
import { feature, mesh, neighbors } from "topojson-client";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { CountryId } from "@/core/content/types";
import type { Bounds, CountryShape, RegionMap } from "./regionMap";

/**
 * The Quick Challenge's map of the whole of Europe, from its own data (src/data/geo/europe-challenge.topo.json,
 * made by scripts/prepare-challenge-geo.mjs): Iceland to the Urals, the Mediterranean to the Arctic islands. The
 * levels' data (regionMap.ts) stops at 62°N and 48°E; this file is loaded only when the challenge opens, so no
 * level's download changes. Drawn in the levels' projection (the data carries its scale and translation), so the
 * levels' painted relief tiles line up with it.
 */

type ChallengeTopology = Topology<{ countries: GeometryCollection<{ name: string }> }> & {
  projection: { rotate: [number, number]; scale: number; translate: [number, number] };
  /** `sourceClip`: the lon/lat box (west, south, east, north) the source was first cut to (prepare-challenge-geo.mjs). */
  frame: { focus: Bounds; coverage: Bounds; sourceClip: [number, number, number, number] };
};

/** A region map of the whole of Europe, with each country's area in world units² (for the small-country rings). */
export interface ChallengeMapData extends RegionMap {
  /**
   * The start view's frame (`focusBounds`): Europe from Iceland to the Urals and from Cape Nordkinn to Crete, the
   * Arctic islands above it panned to; the map never shows past `coverage`.
   */
  areas: ReadonlyMap<CountryId, number>;
  /**
   * Each country's outline as stroked (its borders, and the review's selection): its shape's outline without the
   * edges where the data was cut (`sourceClip`), which are neither borders nor coasts. The shape's own path where it
   * has none (all but Russia and Greenland).
   */
  outlines: ReadonlyMap<CountryId, string>;
  /**
   * Each country's land neighbours: the countries it shares a border with in the data (TopoJSON's shared arcs, so a
   * border is never lost to simplification and a sea never counts). The app's neighbours round asks them.
   */
  neighbours: ReadonlyMap<CountryId, readonly CountryId[]>;
}

let loading: Promise<ChallengeMapData> | null = null;

/** Loads and projects the challenge's map (once per page). */
export function loadChallengeMap(): Promise<ChallengeMapData> {
  loading ??= import("@/data/geo/europe-challenge.topo.json").then((module) => challengeMapFrom(module.default));
  return loading;
}

/**
 * Projects the challenge's map from its data file's contents: what loadChallengeMap does once the file has loaded. The
 * app hands the file over itself (Metro's development server can't serve its import() from outside apps/mobile).
 */
export function challengeMapFrom(data: unknown): ChallengeMapData {
  const topology = data as ChallengeTopology;
  const { rotate, scale, translate } = topology.projection;
  const projection: GeoProjection = geoAzimuthalEqualArea().rotate(rotate).scale(scale).translate(translate);
  const path = geoPath(projection);
  const collection = feature(topology, topology.objects.countries) as FeatureCollection<Polygon | MultiPolygon, { name: string }>;
  const cut = cutAlong(topology.frame.sourceClip);
  const coasts = coastPaths(topology, path, cut);
  const features = collection.features.filter((f) => f.geometry);
  const shapes: CountryShape[] = features.map((f: Feature<Polygon | MultiPolygon>) => ({
    id: String(f.id),
    d: path(f) ?? "",
    coast: coasts.get(String(f.id)) ?? "",
    bounds: path.bounds(f) as unknown as Bounds,
  }));
  return {
    projection,
    shapes,
    // The countries' own label points (ChallengeMap.tsx's labelPoint): no level's.
    labels: {},
    focusBounds: topology.frame.focus,
    coverage: topology.frame.coverage,
    // No Travel here: the same area.
    travelCoverage: topology.frame.coverage,
    project: (point) => (projection([point[0], point[1]]) ?? [0, 0]) as [number, number],
    areas: new Map(features.map((f) => [String(f.id), path.area(f)])),
    neighbours: neighboursOf(topology.objects.countries.geometries),
    outlines: new Map(
      shapes.map((s, i) => {
        const g = features[i].geometry;
        const rings = g.type === "Polygon" ? g.coordinates : g.coordinates.flat();
        return [s.id, rings.some((ring) => ring.some((p, j) => j > 0 && cut(ring[j - 1], p))) ? linesPath(rings, path, cut) : s.d];
      }),
    ),
  };
}

/** The countries each geometry shares an arc with: its land neighbours. */
function neighboursOf(geometries: GeometryCollection["geometries"]): Map<CountryId, CountryId[]> {
  const ids = geometries.map((g) => String(g.id));
  const shared = neighbors(geometries);
  return new Map(ids.map((id, i) => [id, shared[i].map((j) => ids[j])]));
}

/**
 * Whether the segment a→b lies along an edge of the lon/lat box the source was cut to: a cut, not a coast or a
 * border. The data's quantization puts a point on that edge within far less than EPSILON degrees of it.
 */
function cutAlong([west, south, east, north]: readonly number[]) {
  const EPSILON = 1e-6;
  const on = (v: number, edge: number) => Math.abs(v - edge) < EPSILON;
  return (a: Position, b: Position) =>
    [west, east].some((lon) => on(a[0], lon) && on(b[0], lon)) || [south, north].some((lat) => on(a[1], lat) && on(b[1], lat));
}

/**
 * Lines as one SVG path, each broken where it runs along a cut (`cut`) and drawn in pieces between them. A line that
 * comes back to its start with no cut (an island, a ring) is closed, so it keeps its round join there.
 */
function linesPath(lines: Position[][], path: ReturnType<typeof geoPath>, cut: (a: Position, b: Position) => boolean): string {
  const same = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1];
  let d = "";
  for (const line of lines) {
    let run: Position[] = [line[0]];
    let broken = false;
    for (let i = 1; i < line.length; i++) {
      if (cut(line[i - 1], line[i])) {
        if (run.length > 1) d += path({ type: "LineString", coordinates: run }) ?? "";
        run = [line[i]];
        broken = true;
      } else run.push(line[i]);
    }
    if (run.length > 1) d += (path({ type: "LineString", coordinates: run }) ?? "") + (!broken && line.length > 2 && same(line[0], line[line.length - 1]) ? "Z" : "");
  }
  return d;
}

/** Each country's coast as SVG paths, as the levels' map draws them (coastPaths in regionMap.ts), without the data's cuts. */
function coastPaths(topology: ChallengeTopology, path: ReturnType<typeof geoPath>, cut: (a: Position, b: Position) => boolean): Map<string, string> {
  const coasts = new Map<string, string>();
  for (const g of topology.objects.countries.geometries) {
    if (g.type == null || g.id == null) continue;
    const lines = mesh(topology, topology.objects.countries, (a, b) => a === b && a === g).coordinates;
    coasts.set(String(g.id), linesPath(lines, path, cut));
  }
  return coasts;
}

import { geoAzimuthalEqualArea, geoPath, type GeoProjection } from "d3-geo";
import { feature, mesh } from "topojson-client";
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
  frame: { focus: Bounds; coverage: Bounds };
};

/** A region map of the whole of Europe, with each country's area in world units² (for the small-country rings). */
export interface ChallengeMapData extends RegionMap {
  /** The start view's frame: every European country whole (`focusBounds`); the map never shows past `coverage`. */
  areas: ReadonlyMap<CountryId, number>;
}

let loading: Promise<ChallengeMapData> | null = null;

/** Loads and projects the challenge's map (once per page). */
export function loadChallengeMap(): Promise<ChallengeMapData> {
  loading ??= import("@/data/geo/europe-challenge.topo.json").then((module) => buildChallengeMap(module.default as unknown as ChallengeTopology));
  return loading;
}

function buildChallengeMap(topology: ChallengeTopology): ChallengeMapData {
  const { rotate, scale, translate } = topology.projection;
  const projection: GeoProjection = geoAzimuthalEqualArea().rotate(rotate).scale(scale).translate(translate);
  const path = geoPath(projection);
  const collection = feature(topology, topology.objects.countries) as FeatureCollection<Polygon | MultiPolygon, { name: string }>;
  const coasts = coastPaths(topology, path);
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
    focusBounds: topology.frame.focus,
    coverage: topology.frame.coverage,
    project: (point) => (projection([point[0], point[1]]) ?? [0, 0]) as [number, number],
    areas: new Map(features.map((f) => [String(f.id), path.area(f)])),
  };
}

/** Each country's coast as SVG paths, as the levels' map draws them (coastPaths in regionMap.ts). */
function coastPaths(topology: ChallengeTopology, path: ReturnType<typeof geoPath>): Map<string, string> {
  const coasts = new Map<string, string>();
  const same = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1];
  for (const g of topology.objects.countries.geometries) {
    if (g.type == null || g.id == null) continue;
    const lines = mesh(topology, topology.objects.countries, (a, b) => a === b && a === g).coordinates;
    coasts.set(
      String(g.id),
      lines.map((line) => (path({ type: "LineString", coordinates: line }) ?? "") + (line.length > 2 && same(line[0], line[line.length - 1]) ? "Z" : "")).join(""),
    );
  }
  return coasts;
}

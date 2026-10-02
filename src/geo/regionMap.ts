import { geoAzimuthalEqualArea, geoPath, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { CountryId, LonLat } from "@/core/content/types";
import type { LessonDefinition } from "@/core/lessons/types";
import topologyJson from "@/data/geo/europe-west.topo.json";

export type Point = readonly [number, number];
export type Bounds = readonly [Point, Point];

export interface CountryShape {
  id: CountryId;
  /** SVG path in projected "world" coordinates. */
  d: string;
  /** Projected bounding box. */
  bounds: Bounds;
}

export interface RegionMap {
  projection: GeoProjection;
  shapes: CountryShape[];
  /** Projected bounds of the active (playable) countries. */
  focusBounds: Bounds;
  /**
   * Projected area guaranteed to be covered by the prepared data (it lies inside
   * MAP_DATA_CLIP). The view can never show anything outside it, so the
   * artificial straight edges of the clipped dataset stay off screen.
   */
  coverage: Bounds;
  project(point: LonLat): Point;
}

type CountryProps = { name: string };
const topology = topologyJson as unknown as Topology<{ countries: GeometryCollection<CountryProps> }>;

// Fixed world size for the projection; screen fitting is done by the zoom transform.
const WORLD = 1000;

/**
 * Lon/lat box the dataset is clipped to (west, south, east, north).
 * Must match BBOX in scripts/prepare-geo.mjs.
 */
export const MAP_DATA_CLIP = [-27, 29.5, 48, 62] as const;

/**
 * Countries the shared projection is fitted to (Level 1's). Every level is drawn
 * in the same projected "world" coordinates, so the painted landscape
 * (scripts/generate-relief.mjs, which uses the same projection) lines up with
 * every level's map.
 */
export const PROJECTION_FIT: readonly CountryId[] = ["FRA", "BEL", "NLD", "LUX", "DEU"];

/**
 * Default half-size of the coverage rectangle around the focus centre, in world
 * units (a level may set its own: `map.coverageHalf`). For Level 1, whose
 * countries are fitted to WORLD, this shows the whole level without cropping
 * on maps from about 1:1.9 (tall) to 2.2:1 (wide); more extreme maps zoom in
 * slightly instead of revealing the data edge.
 */
export const DEFAULT_COVERAGE_HALF: Point = [1.15 * WORLD, 0.9 * WORLD];

/** Pan margin beyond the focus area when zoomed in, as a fraction of its size. */
const PAN_MARGIN = 0.25;

const cache = new Map<string, RegionMap>();

let shared: { projection: GeoProjection; features: Feature<Polygon | MultiPolygon, CountryProps>[] } | null = null;

/** The projection shared by every level: equal-area azimuthal, centred at 8°E 50°N, fitted to PROJECTION_FIT. */
function sharedProjection() {
  if (!shared) {
    const collection = feature(topology, topology.objects.countries) as FeatureCollection<Polygon | MultiPolygon, CountryProps>;
    const features = collection.features.filter((f) => f.geometry);
    const fit: FeatureCollection = { type: "FeatureCollection", features: features.filter((f) => PROJECTION_FIT.includes(String(f.id))) };
    shared = { projection: geoAzimuthalEqualArea().rotate([-8, -50]).fitSize([WORLD, WORLD], fit), features };
  }
  return shared;
}

/**
 * Projects the prepared Natural Earth data for a level. The projection is
 * shared by every level (see PROJECTION_FIT) and by shapes, labels, markers
 * and routes; the level's countries set the focus area and, with
 * `coverageHalf`, the area the map may ever show.
 */
export function getRegionMap(activeIds: readonly CountryId[], coverageHalf: readonly [number, number] = DEFAULT_COVERAGE_HALF): RegionMap {
  const key = `${activeIds.join(",")}|${coverageHalf.join(",")}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const { projection, features } = sharedProjection();
  const active: FeatureCollection = {
    type: "FeatureCollection",
    features: features.filter((f) => activeIds.includes(String(f.id))),
  };
  if (active.features.length !== activeIds.length) {
    throw new Error(`Map data is missing some level countries: ${activeIds.join(", ")}`);
  }

  const path = geoPath(projection);
  const shapes: CountryShape[] = features.map((f: Feature<Polygon | MultiPolygon, CountryProps>) => ({
    id: String(f.id),
    d: path(f) ?? "",
    bounds: path.bounds(f) as unknown as Bounds,
  }));

  const focusBounds = path.bounds(active) as unknown as Bounds;
  const [cx, cy] = centerOf(focusBounds);
  const map: RegionMap = {
    projection,
    shapes,
    focusBounds,
    coverage: [
      [cx - coverageHalf[0], cy - coverageHalf[1]],
      [cx + coverageHalf[0], cy + coverageHalf[1]],
    ],
    project: (point) => (projection([point[0], point[1]]) ?? [0, 0]) as Point,
  };
  cache.set(key, map);
  return map;
}

/** The map of a level: its countries and its coverage. */
export function regionMapFor(lesson: Pick<LessonDefinition, "countries" | "map">): RegionMap {
  return getRegionMap(lesson.countries, lesson.map.coverageHalf);
}

export interface Transform {
  k: number;
  x: number;
  y: number;
}

/** Scale/translate that fits `bounds` into a width×height box with padding. */
export function fitTransform(bounds: Bounds, width: number, height: number, padding: number): Transform {
  const [[x0, y0], [x1, y1]] = bounds;
  const k = Math.min((width - 2 * padding) / (x1 - x0), (height - 2 * padding) / (y1 - y0));
  return { k, x: width / 2 - (k * (x0 + x1)) / 2, y: height / 2 - (k * (y0 + y1)) / 2 };
}

function centerOf([[x0, y0], [x1, y1]]: Bounds): Point {
  return [(x0 + x1) / 2, (y0 + y1) / 2];
}

export interface ViewLimits {
  /** Initial and "show whole map" transform; also the minimum zoom. */
  base: Transform;
  /** World-space area the viewport may be panned within when zoomed in. */
  translateExtent: Bounds;
}

/**
 * Initial view and pan limits for a map viewport. The focus countries are fitted
 * with padding, but never at a zoom where the viewport would be larger than the
 * data coverage. Pan limits are centred on the focus and stay inside coverage.
 */
export function viewLimits(map: RegionMap, width: number, height: number, padding: number): ViewLimits {
  const fit = fitTransform(map.focusBounds, width, height, padding);
  const [[c0x, c0y], [c1x, c1y]] = map.coverage;
  const minK = Math.max(width / (c1x - c0x), height / (c1y - c0y));
  const [cx, cy] = centerOf(map.focusBounds);
  const k = Math.max(fit.k, minK);
  const base = k === fit.k ? fit : { k, x: width / 2 - k * cx, y: height / 2 - k * cy };

  const [[x0, y0], [x1, y1]] = map.focusBounds;
  const mx = (x1 - x0) * PAN_MARGIN;
  const my = (y1 - y0) * PAN_MARGIN;
  return {
    base,
    translateExtent: [
      [Math.max(c0x, x0 - mx), Math.max(c0y, y0 - my)],
      [Math.min(c1x, x1 + mx), Math.min(c1y, y1 + my)],
    ],
  };
}

export function applyTransform(t: Transform, p: Point): Point {
  return [p[0] * t.k + t.x, p[1] * t.k + t.y];
}

export function projectBounds(map: RegionMap, corners: readonly [LonLat, LonLat]): Bounds {
  const [sw, ne] = corners;
  const points = [sw, ne, [sw[0], ne[1]] as LonLat, [ne[0], sw[1]] as LonLat].map(map.project);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ];
}

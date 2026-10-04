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
  /** Initial and "show whole map" transform. */
  base: Transform;
  /**
   * Minimum zoom: the base view's, or the countries' own start view's when keeping
   * a marker whole zooms the base view in, so the whole region stays reachable.
   */
  minScale: number;
  /** World-space area the viewport may be panned within when zoomed in. */
  translateExtent: Bounds;
}

/** Something drawn at a world point at a fixed size on screen (a marker): its extent around that point, in px. */
export interface ScreenMark {
  at: Point;
  extent: { x0: number; y0: number; x1: number; y1: number };
}

/** Clear room the start view keeps between a marker and the map's edge (px). */
export const MARK_EDGE_CLEARANCE = 2;
/**
 * The most the start view zooms in to keep a marker whole, cutting the countries' far side
 * (×1.097 for the traveller in Tallinn on a 320×568 phone). A map that would need more (a
 * shorter map, such as 200% text on a phone) keeps the countries' own start view, so the
 * whole region stays in view there; the player zooms or pans to see the marker whole.
 */
export const MARK_ZOOM_LIMIT = 1.15;

/**
 * Initial view and pan limits for a map viewport. The focus countries are fitted
 * with padding, but never at a zoom where the viewport would be larger than the
 * data coverage. Pan limits are centred on the focus and stay inside coverage.
 * Where that view shows the countries whole, markers drawn on them (`marks`, such
 * as the traveller's pin, which stands 23px above its capital) are kept whole too:
 * see keepMarksWhole.
 */
export function viewLimits(map: RegionMap, width: number, height: number, padding: number, marks: readonly ScreenMark[] = []): ViewLimits {
  const fit = fitTransform(map.focusBounds, width, height, padding);
  const [[c0x, c0y], [c1x, c1y]] = map.coverage;
  const minK = Math.max(width / (c1x - c0x), height / (c1y - c0y));
  const [cx, cy] = centerOf(map.focusBounds);
  const k = Math.max(fit.k, minK);
  const regionBase = k === fit.k ? fit : { k, x: width / 2 - k * cx, y: height / 2 - k * cy };

  const [[x0, y0], [x1, y1]] = map.focusBounds;
  const mx = (x1 - x0) * PAN_MARGIN;
  const my = (y1 - y0) * PAN_MARGIN;
  const translateExtent: Bounds = [
    [Math.max(c0x, x0 - mx), Math.max(c0y, y0 - my)],
    [Math.min(c1x, x1 + mx), Math.min(c1y, y1 + my)],
  ];
  const base = keepMarksWhole(map, regionBase, translateExtent, [width, height], padding, marks);
  return { base, minScale: Math.min(base.k, regionBase.k), translateExtent };
}

/**
 * The widest a map `height` px tall can be shown with its countries whole. The view never extends past
 * the data coverage, so a wider map (an ultra-wide screen) must zoom in to fill its width, cutting the
 * countries at the top and bottom. A little zoom is allowed, as before, while the countries keep at
 * least half their padding (viewLimits', for a map at least as wide as it is tall); at this width they
 * keep exactly that. The map is shown no wider, centred, with the page around it, so maps that never
 * zoomed in that far keep their full width.
 */
export function maxMapWidth(map: RegionMap, height: number): number {
  const [[c0x], [c1x]] = map.coverage;
  const [[, y0], [, y1]] = map.focusBounds;
  const padding = Math.max(10, height * 0.04);
  return ((c1x - c0x) * (height - padding)) / (y1 - y0);
}

/** A bound on the translation along one axis, linear in the zoom k: t ≥ p − k·q (lower) or t ≤ p − k·q (upper). */
type Bound = { p: number; q: number };
interface AxisBounds {
  lower: Bound[];
  upper: Bound[];
}

/** The range of zooms at which, on every axis, each lower bound lies at or below each upper bound; null if none. */
function feasibleScales(axes: AxisBounds[]): [number, number] | null {
  let [lo, hi] = [1e-9, Infinity];
  for (const { lower, upper } of axes)
    for (const a of lower)
      for (const b of upper) {
        // a.p − k·a.q ≤ b.p − k·b.q  ⇔  k·(b.q − a.q) ≤ b.p − a.p
        const [slope, room] = [b.q - a.q, b.p - a.p];
        if (slope > 0) hi = Math.min(hi, room / slope);
        else if (slope < 0) lo = Math.max(lo, room / slope);
        else if (room < -1e-9) return null;
      }
  return lo <= hi ? [lo, hi] : null;
}

/** The translation nearest `target` that meets an axis's bounds at zoom k. */
function placeOnAxis({ lower, upper }: AxisBounds, k: number, target: number): number {
  const lo = Math.max(...lower.map((b) => b.p - k * b.q));
  const hi = Math.min(...upper.map((b) => b.p - k * b.q));
  return Math.min(hi, Math.max(lo, target));
}

/**
 * The start view, adjusted so every mark is drawn whole, MARK_EDGE_CLEARANCE inside
 * the map's edge. Only where `base` shows the countries whole: on shorter maps
 * (phones in landscape) the start view is cropped already and the player pans, as
 * before. A view that already shows every mark whole is kept as it is. Otherwise the
 * view nearest the original zoom is taken, inside the coverage and the pan limits
 * (so the first drag doesn't jump), and centred on the countries as far as the
 * marks allow: first with the countries whole and as much of their padding as
 * possible (zooming out a little, or moving the view); failing that (the
 * traveller in Tallinn, on the coast at the top of a 231px map, where the data
 * ends just north of the view), with the marks whole and the countries' far side
 * cut as little as possible, zooming in by at most MARK_ZOOM_LIMIT.
 */
function keepMarksWhole(
  map: RegionMap,
  base: Transform,
  extent: Bounds,
  size: readonly [number, number],
  padding: number,
  marks: readonly ScreenMark[],
): Transform {
  if (marks.length === 0) return base;
  const at = (t: Transform, d: 0 | 1) => (d === 0 ? t.x : t.y);
  const [f0, f1] = map.focusBounds;
  const whole = [0, 1].every((d) => f0[d] * base.k + at(base, d as 0 | 1) >= -0.5 && f1[d] * base.k + at(base, d as 0 | 1) <= size[d] + 0.5);
  if (!whole) return base;
  const lo = (m: ScreenMark, d: number) => (d === 0 ? m.extent.x0 : m.extent.y0);
  const hi = (m: ScreenMark, d: number) => (d === 0 ? m.extent.x1 : m.extent.y1);
  const fits = (t: Transform) =>
    marks.every((m) =>
      ([0, 1] as const).every((d) => {
        const s = m.at[d] * t.k + at(t, d);
        return s + lo(m, d) >= MARK_EDGE_CLEARANCE - 1e-6 && s + hi(m, d) <= size[d] - MARK_EDGE_CLEARANCE + 1e-6;
      }),
    );
  if (fits(base)) return base;

  const [c0, c1] = map.coverage;
  const centre = centerOf(map.focusBounds);
  // Bounds on each axis; with `pad`, also the countries whole with that padding.
  const axes = (pad: number | null): AxisBounds[] =>
    ([0, 1] as const).map((d) => {
      const S = size[d];
      // Never beyond the coverage.
      const lower: Bound[] = [{ p: S, q: c1[d] }];
      const upper: Bound[] = [{ p: 0, q: c0[d] }];
      // Within the pan limits where the base view fits inside them; where it is larger
      // (a wide map), centred on them, as d3-zoom keeps such a view.
      if (S / base.k <= extent[1][d] - extent[0][d]) {
        lower.push({ p: S, q: extent[1][d] });
        upper.push({ p: 0, q: extent[0][d] });
      } else {
        const middle = { p: S / 2, q: (extent[0][d] + extent[1][d]) / 2 };
        lower.push(middle);
        upper.push(middle);
      }
      for (const m of marks) {
        lower.push({ p: MARK_EDGE_CLEARANCE - lo(m, d), q: m.at[d] });
        upper.push({ p: S - MARK_EDGE_CLEARANCE - hi(m, d), q: m.at[d] });
      }
      if (pad !== null) {
        lower.push({ p: pad, q: f0[d] });
        upper.push({ p: S - pad, q: f1[d] });
      }
      return { lower, upper };
    });
  const solve = (pad: number | null): Transform | null => {
    const bounds = axes(pad);
    const scales = feasibleScales(bounds);
    if (!scales) return null;
    const k = Math.min(scales[1], Math.max(scales[0], base.k));
    return {
      k,
      x: placeOnAxis(bounds[0], k, size[0] / 2 - k * centre[0]),
      y: placeOnAxis(bounds[1], k, size[1] / 2 - k * centre[1]),
    };
  };
  if (!solve(0)) {
    const cut = solve(null);
    return cut && cut.k <= base.k * MARK_ZOOM_LIMIT ? cut : base;
  }
  // The most padding that still leaves room for the marks.
  let [ok, no] = [0, padding];
  if (solve(padding)) ok = padding;
  else
    for (let i = 0; i < 16; i++) {
      const mid = (ok + no) / 2;
      if (solve(mid)) ok = mid;
      else no = mid;
    }
  return solve(ok) as Transform;
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

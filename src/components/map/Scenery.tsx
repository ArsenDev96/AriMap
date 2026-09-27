"use client";

import { memo, useId, useMemo, type CSSProperties } from "react";
import type { CountryId } from "@/core/content/types";
import type { CountryTone } from "@/core/lesson/mapView";
import type { CountryShape, Point, RegionMap, Transform } from "@/geo/regionMap";
import { FORESTS, MOUNTAIN_RANGES, SCENERY_FREE, WAVES, detailLevel, gridPoint, hash01, pointsAlong, worldPerKm, type RangeKind } from "@/geo/terrain";
import { insideShape } from "./insideShape";
import { ART, type ArtId, type ArtLayer } from "./sceneryArt";
import relief from "@/assets/map/alps-relief.json";
import reliefImage from "@/assets/map/alps-relief.webp";
import reliefDetailImage from "@/assets/map/alps-relief-detail.webp";
import reliefTealImage from "@/assets/map/alps-relief-teal.webp";
import reliefTealDetailImage from "@/assets/map/alps-relief-teal-detail.webp";
import styles from "./Scenery.module.css";

/** Screen-space rectangle. */
export interface SceneryBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type Layer = "ridge" | "hills" | "forest";

/** Artwork variants per kind; each placement picks one deterministically. */
const VARIANTS: Record<RangeKind | "broadleaf" | "conifer", readonly ArtId[]> = {
  alpine: ["alpineMassif", "alpineTwin", "alpineLone", "alpineTwin"],
  rocky: ["rockyMassif", "rockyTwin", "rockyLone", "rockyTwin"],
  hills: ["hillsA", "hillsB"],
  broadleaf: ["broadleafA", "broadleafB"],
  conifer: ["coniferA", "coniferB"],
};

/**
 * Spacing on screen, in px (phones sparser), and the coarsest nested spacing in
 * world units. Mountain groups are spaced about a group's width apart along
 * their crest; level of detail halves the spacing as the map zooms in, so the
 * density on screen stays about the same.
 */
const SPACING: Record<Layer, { px: number; compactPx: number; base: number }> = {
  ridge: { px: 32, compactPx: 38, base: 512 },
  hills: { px: 36, compactPx: 38, base: 512 },
  forest: { px: 12, compactPx: 11, base: 256 },
};
/** Tree clumps keep at least this far apart (px), so a forest is a cohesive group, not a pile. */
const TREE_GAP = { px: 12, compactPx: 12 };
/** Extra room (px) trees and hills keep from borders and coasts. */
const BORDER_ROOM = 3;
/** Wave marks keep at least this far apart on screen, so small maps get fewer. */
const WAVE_SPACING = { px: 90, compactPx: 110 };
/**
 * Zoom scale rounded down to quarter octaves. Land checks hold for the rounded
 * scale, which is never larger than the real one, so a symbol that fits there
 * also fits at the real scale (it only gets smaller relative to the land).
 */
const quantizeScale = (k: number) => 2 ** (Math.floor(Math.log2(k) * 4) / 4);

interface Candidate {
  key: string;
  art: ArtId;
  layer: Layer;
  /** World position of the anchor. */
  at: Point;
  /** Country at the anchor. */
  country: CountryId;
  /** Every country the footprint touches (a peak may stand across a border). */
  touches: CountryId[];
  /** Size variation and mirroring. */
  size: number;
  flip: boolean;
  /** Screen-space offset of the anchor in px (small jitter across a ridge). */
  nudge: Point;
}

interface Props {
  map: RegionMap;
  active: readonly CountryId[];
  tones: Partial<Record<CountryId, CountryTone>>;
  transform: Transform;
  viewport: { width: number; height: number };
  /** Screen areas kept clear: names, callouts, leader lines, markers, Luxembourg and map controls. */
  avoid: SceneryBox[];
  compact: boolean;
}

/** Tones with a dark (teal) fill: scenery over them uses its own palette. */
const DARK_TONES: ReadonlySet<CountryTone> = new Set(["selected", "correct", "visited", "current"]);

// Results of land checks, per map; they never change for a given candidate and scale.
const landCache = new WeakMap<RegionMap, Map<string, CountryId[] | null>>();
const gridCache = new Map<string, Point>();
const crestCache = new WeakMap<RegionMap, { range: (typeof MOUNTAIN_RANGES)[number]; line: Point[]; index: number }[]>();

/** The country containing a world point, if any. */
function shapeAt(map: RegionMap, at: Point): CountryShape | undefined {
  for (const shape of map.shapes) {
    const [[x0, y0], [x1, y1]] = shape.bounds;
    if (at[0] < x0 || at[0] > x1 || at[1] < y0 || at[1] > y1) continue;
    if (insideShape(shape, at)) return shape;
  }
  return undefined;
}

/**
 * Countries under a symbol's footprint at zoom scale `scale` (anchor first), or
 * null when it doesn't fit. The footprint must lie on land in allowed countries,
 * so artwork never spills into the sea or the Low Countries. Trees and hills
 * also stay inside one country, with a little room to spare; mountain
 * groups may cross borders, as their crests often are borders.
 */
function footprintCountries(
  map: RegionMap,
  key: string,
  at: Point,
  box: SceneryBox,
  scale: number,
  allowed: (id: CountryId) => boolean,
  acrossBorders: boolean,
): CountryId[] | null {
  let cache = landCache.get(map);
  if (!cache) landCache.set(map, (cache = new Map()));
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const room = acrossBorders ? 0 : BORDER_ROOM;
  const [x0, y0, x1] = [box.x0 - room, box.y0 - room, box.x1 + room];
  const probes: Point[] = [
    [at[0] + x0 / scale, at[1]],
    [at[0] + x1 / scale, at[1]],
    [at[0], at[1] + y0 / scale],
    [at[0], at[1] + room / scale],
    [at[0] + (x0 * 0.6) / scale, at[1] + (y0 * 0.6) / scale],
    [at[0] + (x1 * 0.6) / scale, at[1] + (y0 * 0.6) / scale],
  ];
  let result: CountryId[] | null = null;
  const found = shapeAt(map, at);
  if (found && allowed(found.id)) {
    if (!acrossBorders) {
      result = probes.every((p) => insideShape(found, p)) ? [found.id] : null;
    } else {
      const ids = new Set([found.id]);
      for (const p of probes) {
        const shape = insideShape(found, p) ? found : shapeAt(map, p);
        if (!shape || !allowed(shape.id)) {
          ids.clear();
          break;
        }
        ids.add(shape.id);
      }
      result = ids.size > 0 ? [...ids] : null;
    }
  }
  cache.set(key, result);
  return result;
}

function crests(map: RegionMap) {
  let lines = crestCache.get(map);
  if (!lines) {
    lines = MOUNTAIN_RANGES.flatMap((range) => range.crests.map((crest, index) => ({ range, index, line: crest.map(map.project) })));
    crestCache.set(map, lines);
  }
  return lines;
}

const pick = <T,>(list: readonly T[], h: number) => list[Math.min(list.length - 1, Math.floor(h * list.length))];

/** Every symbol that could show at this zoom within the visible world area, before screen checks. */
function candidates(map: RegionMap, k: number, visible: [Point, Point], compact: boolean): Candidate[] {
  const out: Candidate[] = [];
  const allowed = (id: CountryId) => !SCENERY_FREE.has(id);
  const inView = ([x, y]: Point) => x >= visible[0][0] && x <= visible[1][0] && y >= visible[0][1] && y <= visible[1][1];
  const px = (layer: Layer) => (compact ? SPACING[layer].compactPx : SPACING[layer].px);
  // Land checks are cached per quarter-octave scale.
  const at4 = Math.round(Math.log2(k) * 4);

  // Mountains and hills: composed groups along each crest. On phones only a
  // range's main crest is used, so a range simplifies instead of stacking rows.
  for (const { range, line, index } of crests(map)) {
    // Painted relief ranges have no symbols; phones use each range's main crest only.
    if (range.relief || (compact && index > 0)) continue;
    const layer: Layer = range.kind === "hills" ? "hills" : "ridge";
    const { base } = SPACING[layer];
    const level = detailLevel(k, px(layer), base);
    const spacing = base / 2 ** level;
    // Every crest has a group at its middle (kept at every zoom), so short ranges
    // like the Pyrenees on a phone keep one even when the spacing is wider than
    // the range; nested points too close to it give way.
    const length = line.slice(1).reduce((sum, q, i) => sum + Math.hypot(q[0] - line[i][0], q[1] - line[i][1]), 0);
    const [mid] = pointsAlong(line, length, length / 2);
    const points = [mid, ...pointsAlong(line, spacing, base / 2).filter((p) => Math.abs(p.along - mid.along) >= spacing / 2)];
    for (const p of points) {
      if (!inView(p.at)) continue;
      const key = `m:${range.id}:${index}:${Math.round(p.along)}`;
      const art = pick(VARIANTS[range.kind], hash01(index, p.along, range.id.length, 7));
      const touches = footprintCountries(map, `${key}:${art}:${at4}`, p.at, ART[art].box, k, allowed, layer === "ridge");
      if (!touches) continue;
      // A little jitter across the crest, so groups don't stand in a straight row.
      const across = (hash01(p.along, 3) - 0.5) * 5;
      out.push({
        key,
        art,
        layer,
        at: p.at,
        country: touches[0],
        touches,
        size: 0.86 + 0.24 * hash01(index, p.along, 9),
        flip: hash01(p.along, 5) < 0.35,
        nudge: [-p.dir[1] * across, p.dir[0] * across],
      });
    }
  }

  // Forests: a clump at each forest's centre, then a nested jittered grid within
  // its radius, thinning towards the edge. Forests never spread past their radius.
  const forestLevel = detailLevel(k, px("forest"), SPACING.forest.base);
  const forestCell = SPACING.forest.base / 2 ** forestLevel;
  FORESTS.forEach((f, seed) => {
    const c = map.project(f.center);
    const r = f.radiusKm * worldPerKm(map, f.center);
    const variants = VARIANTS[f.kind];
    const add = (key: string, at: Point, h: number, size: number) => {
      const art = pick(variants, h);
      const touches = footprintCountries(map, `${key}:${art}:${at4}`, at, ART[art].box, k, allowed, false);
      if (touches) out.push({ key, art, layer: "forest", at, country: touches[0], touches, size, flip: hash01(h, 3) < 0.5, nudge: [0, 0] });
    };
    if (inView(c)) add(`f:${f.id}:centre`, c, hash01(seed, 1), 1.05);
    for (let i = Math.floor((c[0] - r) / forestCell); i <= Math.floor((c[0] + r) / forestCell); i++)
      for (let j = Math.floor((c[1] - r) / forestCell); j <= Math.floor((c[1] + r) / forestCell); j++) {
        const at = gridPoint(100 + seed, SPACING.forest.base, forestLevel, i, j, gridCache);
        if (!inView(at)) continue;
        const d = Math.hypot(at[0] - c[0], at[1] - c[1]) / r;
        const h = hash01(at[0], at[1], seed);
        if (d > 1 || h > 0.9 - 0.5 * d * d) continue;
        add(`f:${f.id}:${at[0].toFixed(2)}:${at[1].toFixed(2)}`, at, h, 0.82 + 0.22 * hash01(at[1], at[0]));
      }
  });

  return out;
}

const overlaps = (a: SceneryBox, b: SceneryBox) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inset = (b: SceneryBox, dx: number, top: number): SceneryBox => ({ x0: b.x0 + dx, y0: b.y0 + top, x1: b.x1 - dx, y1: b.y1 });

/** Draws one piece of artwork's layers with the module's classes. */
function ArtLayers({ layers }: { layers: readonly ArtLayer[] }) {
  return (
    <>
      {layers.map((l, i) => {
        const className = styles[l.cls];
        if ("d" in l) return <path key={i} className={className} d={l.d} />;
        if ("circles" in l) return <g key={i}>{l.circles.map(([cx, cy, r], j) => <circle key={j} className={className} cx={cx} cy={cy} r={r} />)}</g>;
        const [cx, cy, rx, ry] = l.ellipse;
        return <ellipse key={i} className={className} cx={cx} cy={cy} rx={rx} ry={ry} />;
      })}
    </>
  );
}

/**
 * Zoom scale from which the detailed relief is drawn over the whole-map one
 * (about 1.6× the whole-map view on a phone). It is fetched only then.
 */
const RELIEF_DETAIL_K = 0.6;

/**
 * The Alps as continuous painted relief: rasters made from real elevation
 * (scripts/generate-alps-relief.mjs), placed in world coordinates so they are
 * anchored like the land. Green foothills fade into the land, then grey slopes
 * and snow on the highest massifs, lit from the north-west. The relief runs
 * across borders; over a selected (teal) country a teal version keeps the
 * shading. Zoomed in, a sharper level with more of the real valleys is drawn
 * over the simplified one (which stays underneath while it loads).
 */
const AlpineRelief = memo(function AlpineRelief({ darkKey, clipId, detail }: { darkKey: string; clipId: string; detail: boolean }) {
  const image = (level: keyof typeof relief.levels, href: string) => {
    const { x, y, width, height } = relief.levels[level];
    return <image href={href} x={x} y={y} width={width} height={height} preserveAspectRatio="none" data-level={level} />;
  };
  return (
    <g data-relief="alps">
      <g clipPath={`url(#${clipId}-light)`}>
        {image("base", reliefImage.src)}
        {detail && image("detail", reliefDetailImage.src)}
      </g>
      {darkKey && (
        <g clipPath={`url(#${clipId}-dark)`} data-pass="dark">
          {image("base", reliefTealImage.src)}
          {detail && image("detail", reliefTealDetailImage.src)}
        </g>
      )}
    </g>
  );
});

/**
 * Illustrated scenery for Discover: forests, mountain groups, hills and
 * wave marks, drawn between the country fills and the borders. Symbols are
 * anchored to real places in world coordinates and keep a constant size on
 * screen. They never cover a name, marker, Luxembourg or a map control (such
 * symbols are simply left out), and never take pointer events. Over a selected
 * (teal) country the same artwork is drawn in a teal palette.
 */
export const Scenery = memo(function Scenery({ map, active, tones, transform, viewport, avoid, compact }: Props) {
  const id = useId().replace(/:/g, "");
  const { k, x, y } = transform;
  const shrink = compact ? 0.84 : 1;

  // Candidates depend only on the zoom level and the visible area, rounded so
  // that panning reuses them.
  const q = (v: number) => Math.round(v / 64) * 64;
  const margin = 40 / k;
  const vx0 = q(-x / k - margin);
  const vy0 = q(-y / k - margin);
  const vx1 = q((viewport.width - x) / k + margin) + 64;
  const vy1 = q((viewport.height - y) / k + margin) + 64;
  const kq = quantizeScale(k);
  const pool = useMemo(
    () => candidates(map, kq, [[vx0 - 256, vy0 - 256], [vx1 + 256, vy1 + 256]], compact),
    [map, kq, vx0, vy0, vx1, vy1, compact],
  );

  // Screen checks, in priority order: mountain groups, hills, forests.
  // Groups never overlap each other; trees keep clear of groups and of each
  // other's anchors.
  const placed: (Candidate & { sx: number; sy: number })[] = [];
  const groups: SceneryBox[] = [];
  const trees: { sx: number; sy: number }[] = [];
  const treeGap = compact ? TREE_GAP.compactPx : TREE_GAP.px;
  const order: Layer[] = ["ridge", "hills", "forest"];
  const sorted = [...pool].sort((a, b) => order.indexOf(a.layer) - order.indexOf(b.layer));
  for (const c of sorted) {
    const sx = c.at[0] * k + x + c.nudge[0];
    const sy = c.at[1] * k + y + c.nudge[1];
    const s = c.size * shrink;
    const f = ART[c.art].box;
    const box = { x0: sx + f.x0 * s, y0: sy + f.y0 * s, x1: sx + f.x1 * s, y1: sy + f.y1 * s };
    if (box.x1 < 0 || box.y1 < 0 || box.x0 > viewport.width || box.y0 > viewport.height) continue;
    if (avoid.some((a) => overlaps(a, box))) continue;
    if (c.layer === "ridge" || c.layer === "hills") {
      // Neighbouring groups overlap at their foothills, forming a chain, but
      // their peaks never stack on each other.
      const core = inset(box, 7, 6);
      if (groups.some((g) => overlaps(g, core))) continue;
      groups.push(core);
    } else {
      if (groups.some((g) => overlaps(g, inset(box, 2, 3)))) continue;
      if (trees.some((t) => Math.hypot(t.sx - sx, t.sy - sy) < treeGap)) continue;
      trees.push({ sx, sy });
    }
    placed.push({ ...c, sx, sy });
  }

  // A few wave marks, in list order, each well apart from the others on screen.
  const waves: { key: string; at: Point; flip: boolean; sx: number; sy: number }[] = [];
  const waveGap = compact ? WAVE_SPACING.compactPx : WAVE_SPACING.px;
  WAVES.forEach((w, i) => {
    const at = map.project(w.at);
    const sx = at[0] * k + x;
    const sy = at[1] * k + y;
    const f = ART.wave.box;
    const box = { x0: sx + f.x0, y0: sy + f.y0, x1: sx + f.x1, y1: sy + f.y1 };
    if (box.x1 < 0 || box.y1 < 0 || box.x0 > viewport.width || box.y0 > viewport.height) return;
    if (avoid.some((a) => overlaps(a, box)) || waves.some((o) => Math.hypot(o.sx - sx, o.sy - sy) < waveGap)) return;
    waves.push({ key: `w:${i}`, at, flip: i % 2 === 1, sx, sy });
  });

  // Paint back to front, from the top of the map down.
  const land = [...placed].sort((a, b) => a.sy - b.sy);

  // Land is split into selected (teal) countries and the rest; a symbol is drawn
  // in each part it touches, in that part's palette, clipped to it.
  const isDark = (country: CountryId) => {
    const tone = tones[country];
    return tone !== undefined && DARK_TONES.has(tone);
  };
  const darkKey = map.shapes
    .filter((s) => isDark(s.id))
    .map((s) => s.id)
    .join(",");
  const { lightLand, darkLand } = useMemo(() => {
    const dark = new Set(darkKey ? darkKey.split(",") : []);
    return {
      lightLand: map.shapes
        .filter((s) => !dark.has(s.id))
        .map((s) => s.d)
        .join(""),
      darkLand: map.shapes
        .filter((s) => dark.has(s.id))
        .map((s) => s.d)
        .join(""),
    };
  }, [map, darkKey]);
  const seaPath = useMemo(() => {
    const [[x0, y0], [x1, y1]] = map.coverage;
    return `M${x0 - 500},${y0 - 500}H${x1 + 500}V${y1 + 500}H${x0 - 500}Z${map.shapes.map((s) => s.d).join("")}`;
  }, [map]);

  const signature = `${darkKey}#${land.map((c) => c.key).join("|")}#${waves.map((w) => w.key).join("|")}`;
  const symbols = useMemo(
    () => {
      const symbol = (c: (typeof land)[number], pass: "light" | "dark") => {
        const s = c.size * shrink;
        return (
          <g
            key={`${pass}:${c.key}`}
            transform={`translate(${c.at[0]},${c.at[1]})`}
            className={pass === "dark" ? styles.onDark : !active.includes(c.country) ? styles.context : undefined}
            data-sym={c.layer}
            data-art={c.art}
            data-pass={pass}
            data-key={c.key}
            data-in={c.country}
          >
            <use
              href={`#${id}-${c.art}`}
              className={styles.symbol}
              style={{ "--sx": (c.flip ? -s : s).toFixed(3), "--sy": s.toFixed(3), "--nx": `${c.nudge[0].toFixed(1)}px`, "--ny": `${c.nudge[1].toFixed(1)}px` } as CSSProperties}
            />
          </g>
        );
      };
      return (
        <>
          <g clipPath={`url(#${id}-sea)`}>
            {waves.map((w) => (
              <g key={w.key} transform={`translate(${w.at[0]},${w.at[1]})`}>
                <use href={`#${id}-wave`} className={styles.symbol} style={{ "--sx": w.flip ? -1 : 1, "--sy": 1 } as CSSProperties} />
              </g>
            ))}
          </g>
          <g clipPath={`url(#${id}-light)`}>{land.filter((c) => c.touches.some((t) => !isDark(t))).map((c) => symbol(c, "light"))}</g>
          {darkKey && <g clipPath={`url(#${id}-dark)`}>{land.filter((c) => c.touches.some(isDark)).map((c) => symbol(c, "dark"))}</g>}
        </>
      );
    },
    // The signature captures everything the elements depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, id, shrink],
  );

  return (
    <g className={styles.scenery} style={{ "--inv": 1 / k } as CSSProperties} aria-hidden="true" data-scenery="">
      <defs>
        <clipPath id={`${id}-light`}>
          <path d={lightLand} />
        </clipPath>
        {darkKey && (
          <clipPath id={`${id}-dark`}>
            <path d={darkLand} />
          </clipPath>
        )}
        <clipPath id={`${id}-sea`}>
          <path d={seaPath} clipRule="evenodd" />
        </clipPath>
        {(Object.keys(ART) as ArtId[]).map((art) => (
          <g key={art} id={`${id}-${art}`}>
            <ArtLayers layers={ART[art].layers} />
          </g>
        ))}
      </defs>
      <AlpineRelief darkKey={darkKey} clipId={id} detail={k >= RELIEF_DETAIL_K} />
      {symbols}
    </g>
  );
});

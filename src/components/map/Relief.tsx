"use client";

import { memo, useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import type { CountryId } from "@/core/content/types";
import type { CountryTone } from "@/core/lesson/mapView";
import type { RegionMap, Transform } from "@/geo/regionMap";
import type { StaticImageData } from "next/image";
import relief from "@/assets/map/relief.json";
import adriaticLand from "@/assets/map/relief/along-the-adriatic-land.webp";
import adriaticTone from "@/assets/map/relief/along-the-adriatic-tone.webp";
import alpsLand from "@/assets/map/relief/around-the-alps-land.webp";
import alpsTone from "@/assets/map/relief/around-the-alps-tone.webp";
import balticJourneyLand from "@/assets/map/relief/baltic-journey-land.webp";
import balticJourneyTone from "@/assets/map/relief/baltic-journey-tone.webp";
import balticJourneyR2Land from "@/assets/map/relief/baltic-journey-r2-land.webp";
import balticJourneyR2Tone from "@/assets/map/relief/baltic-journey-r2-tone.webp";
import centralEuropeLand from "@/assets/map/relief/central-europe-land.webp";
import centralEuropeTone from "@/assets/map/relief/central-europe-tone.webp";
import easternEuropeLand from "@/assets/map/relief/eastern-europe-land.webp";
import easternEuropeTone from "@/assets/map/relief/eastern-europe-tone.webp";
import iberianJourneyLand from "@/assets/map/relief/iberian-journey-land.webp";
import iberianJourneyTone from "@/assets/map/relief/iberian-journey-tone.webp";
import towardsGreeceLand from "@/assets/map/relief/towards-greece-land.webp";
import towardsGreeceTone from "@/assets/map/relief/towards-greece-tone.webp";
import westernEuropeLand from "@/assets/map/relief/western-europe-1-land.webp";
import westernEuropeTone from "@/assets/map/relief/western-europe-1-tone.webp";
import styles from "./RegionMap.module.css";

/**
 * Each level's overview images, by version key (versionKey in src/core/lessons: a level's first
 * version by its id, a later one with "-r2" and so on). Importing them only gives their URLs: a
 * level's images are fetched when its map is drawn, never for the other levels.
 */
const OVERVIEW_IMAGES: Readonly<Record<string, { land: StaticImageData; tone: StaticImageData }>> = {
  "western-europe-1": { land: westernEuropeLand, tone: westernEuropeTone },
  "around-the-alps": { land: alpsLand, tone: alpsTone },
  "central-europe": { land: centralEuropeLand, tone: centralEuropeTone },
  "along-the-adriatic": { land: adriaticLand, tone: adriaticTone },
  "towards-greece": { land: towardsGreeceLand, tone: towardsGreeceTone },
  "baltic-journey": { land: balticJourneyLand, tone: balticJourneyTone },
  "baltic-journey-r2": { land: balticJourneyR2Land, tone: balticJourneyR2Tone },
  "iberian-journey": { land: iberianJourneyLand, tone: iberianJourneyTone },
  "eastern-europe": { land: easternEuropeLand, tone: easternEuropeTone },
};

/**
 * The painted landscape for the whole map: relief from real elevation data and
 * forests from real land-cover data (ESA WorldCover tree cover), made by
 * scripts/generate-relief.mjs (see docs/TERRAIN.md). Forests are painted
 * between the elevation colours and the light and shade, so hills stay
 * readable through them, and get more canopy texture on finer levels. It lies on the country
 * fills, under borders, routes, names and markers, and never takes pointer
 * events, so taps reach the country underneath.
 *
 * - A light overview covers everything the level's map can show; it is loaded
 *   with the level. Each level has its own.
 * - Zoomed in, sharper tiles (one grid shared by every level) for the visible
 *   part only are fetched and drawn over it, chosen by screen density (zoom × devicePixelRatio), so a phone
 *   and a desktop fetch what their screens can show.
 * - Two families: "land" is painted in the atlas palette over countries in
 *   their normal colour; "tone" is a neutral light, shade and snow overlay for
 *   countries in a state colour (selection, Find answers, Travel), so the state
 *   colour stays and the terrain keeps its shading. The relief itself never
 *   depends on the question: only the tones the map already shows choose which
 *   family a country gets.
 */

type Level = (typeof relief.levels)[number];
type Family = "land" | "tone";
interface Tile {
  url: string;
  level: Level;
  col: number;
  row: number;
}

const tileUrl = (level: Level, family: Family, col: number, row: number) => `/relief/${relief.version}/${level.name}/${family}/${col}-${row}.webp`;
const available = new Map(relief.levels.map((level) => [level, { land: new Set(level.land), tone: new Set(level.tone) }]));

/** Tiles that have finished loading (shared by every map on the page), so they show at once when reused. */
const loaded = new Set<string>();

function subscribeDpr(onChange: () => void) {
  const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const getDpr = () => window.devicePixelRatio || 1;
const getServerDpr = () => 1;

/** Tiles of `level` overlapping a world rectangle, if the generator produced them. */
function tilesIn(level: Level, family: Family, [x0, y0, x1, y1]: readonly number[]): Tile[] {
  const out: Tile[] = [];
  const set = available.get(level)![family];
  const c0 = Math.max(0, Math.floor((x0 - level.origin[0]) / level.tileWorld));
  const c1 = Math.min(level.cols - 1, Math.floor((x1 - level.origin[0]) / level.tileWorld));
  const r0 = Math.max(0, Math.floor((y0 - level.origin[1]) / level.tileWorld));
  const r1 = Math.min(level.rows - 1, Math.floor((y1 - level.origin[1]) / level.tileWorld));
  for (let row = r0; row <= r1; row++)
    for (let col = c0; col <= c1; col++) if (set.has(`${col}-${row}`)) out.push({ url: tileUrl(level, family, col, row), level, col, row });
  return out;
}

/**
 * The view once it has stopped changing for a moment. Tiles are chosen from
 * it, so a zoom or pan animation (or the first layout) never fetches tiles
 * for the views it passes through; null until the first view settles.
 */
function useSettled(transform: Transform, viewport: { width: number; height: number }, delay = 150) {
  const key = `${transform.k},${transform.x},${transform.y},${viewport.width},${viewport.height}`;
  const [settled, setSettled] = useState<{ key: string; transform: Transform; viewport: { width: number; height: number } } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettled({ key, transform, viewport }), delay);
    return () => clearTimeout(timer);
    // The key captures the transform and viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, delay]);
  return settled;
}

const overlapsBox = (a: readonly number[], b: readonly number[]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/**
 * The tiles to draw for a family: the finest level the screen density needs.
 * Where a fine tile is still loading, the coarser tile under it stands in if
 * it has already loaded (e.g. when zooming in from that level); otherwise the
 * overview underneath shows, and nothing extra is fetched.
 */
function tilesFor(family: Family, density: number, view: readonly number[], areas: (readonly number[])[]): Tile[] {
  const levels = relief.levels.filter((level) => density >= level.minDensity);
  if (levels.length === 0) return [];
  const wanted = levels[levels.length - 1];
  const inAreas = (t: Tile) => {
    const x = t.level.origin[0] + t.col * t.level.tileWorld;
    const y = t.level.origin[1] + t.row * t.level.tileWorld;
    return areas.some((a) => overlapsBox([x, y, x + t.level.tileWorld, y + t.level.tileWorld], a));
  };
  const fine = tilesIn(wanted, family, view).filter(inAreas);
  const waiting = fine.filter((t) => !loaded.has(t.url));
  const coarser = levels.length > 1 ? levels[levels.length - 2] : null;
  const fallback = coarser
    ? [
        ...new Map(
          waiting.flatMap((t) => {
            const x = t.level.origin[0] + t.col * t.level.tileWorld;
            const y = t.level.origin[1] + t.row * t.level.tileWorld;
            return tilesIn(coarser, family, [x, y, x + t.level.tileWorld - 1e-6, y + t.level.tileWorld - 1e-6])
              .filter((c) => loaded.has(c.url))
              .map((c) => [c.url, c] as const);
          }),
        ).values(),
      ]
    : [];
  return [...fallback, ...fine];
}

interface Props {
  map: RegionMap;
  /** The version of the level whose overview to draw (its versionKey; see relief.overviews). */
  level: string;
  /** Lesson countries' tones; any tone other than "default" gets the "tone" family. */
  tones: Partial<Record<CountryId, CountryTone>>;
  /** The view to fetch sharper tiles for: the last one the player stopped at, not one passed through mid-gesture. */
  transform: Transform;
  viewport: { width: number; height: number };
}

export const Relief = memo(function Relief({ map, level, tones, transform, viewport }: Props) {
  const overviews = (relief.overviews as Record<string, typeof relief.overviews["western-europe-1"] | undefined>)[level];
  const images = OVERVIEW_IMAGES[level];
  const id = useId().replace(/:/g, "");
  const dpr = useSyncExternalStore(subscribeDpr, getDpr, getServerDpr);
  // Re-render when a tile arrives, so its coarser stand-in can go.
  const [, setArrivals] = useState(0);

  const tonedKey = map.shapes
    .filter((s) => (tones[s.id] ?? "default") !== "default")
    .map((s) => s.id)
    .join(",");
  const { plain, toned, tonedBoxes } = useMemo(() => {
    const set = new Set(tonedKey ? tonedKey.split(",") : []);
    const tonedShapes = map.shapes.filter((s) => set.has(s.id));
    return {
      plain: map.shapes
        .filter((s) => !set.has(s.id))
        .map((s) => s.d)
        .join(""),
      toned: tonedShapes.map((s) => s.d).join(""),
      tonedBoxes: tonedShapes.map((s) => [s.bounds[0][0], s.bounds[0][1], s.bounds[1][0], s.bounds[1][1]] as const),
    };
  }, [map, tonedKey]);

  // Tiles for the settled view: the visible world area, with a quarter-screen
  // margin so a short pan finds tiles ready.
  const settled = useSettled(transform, viewport);
  let landTiles: Tile[] = [];
  let toneTiles: Tile[] = [];
  if (settled) {
    const { k, x, y } = settled.transform;
    const { width, height } = settled.viewport;
    const [mx, my] = [width / k / 4, height / k / 4];
    const view = [-x / k - mx, -y / k - my, (width - x) / k + mx, (height - y) / k + my];
    const density = k * dpr;
    landTiles = tilesFor("land", density, view, [[-Infinity, -Infinity, Infinity, Infinity]]);
    toneTiles = tonedKey ? tilesFor("tone", density, view, tonedBoxes) : [];
  }

  const image = (t: Tile) => {
    const size = t.level.tileWorld;
    const ready = loaded.has(t.url);
    return (
      <image
        key={t.url}
        href={t.url}
        x={t.level.origin[0] + t.col * size}
        y={t.level.origin[1] + t.row * size}
        width={size}
        height={size}
        preserveAspectRatio="none"
        className={styles.reliefTile}
        data-level={t.level.name}
        data-loaded={ready || undefined}
        onLoad={
          ready
            ? undefined
            : (e) => {
                loaded.add(t.url);
                e.currentTarget.setAttribute("data-loaded", "");
                setArrivals((n) => n + 1);
              }
        }
      />
    );
  };
  const overview = (o: (typeof relief.overviews)["western-europe-1"]["land"], href: string) => (
    <image href={href} x={o.x} y={o.y} width={o.width} height={o.height} preserveAspectRatio="none" data-level="overview" />
  );

  return (
    <g className={styles.surface} aria-hidden="true" data-relief="">
      <defs>
        <clipPath id={`${id}-plain`}>
          <path d={plain} />
        </clipPath>
        {toned && (
          <clipPath id={`${id}-toned`}>
            <path d={toned} />
          </clipPath>
        )}
      </defs>
      <g clipPath={`url(#${id}-plain)`} data-family="land">
        {overviews && images && overview(overviews.land, images.land.src)}
        {landTiles.map(image)}
      </g>
      {toned && (
        <g clipPath={`url(#${id}-toned)`} data-family="tone">
          {overviews && images && overview(overviews.tone, images.tone.src)}
          {toneTiles.map(image)}
        </g>
      )}
    </g>
  );
});

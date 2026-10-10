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

const FADE_MS = 250;

/** CSS `ease-out` (cubic-bezier(0, 0, 0.58, 1)): the progress at a fraction `t` of the time. */
function easeOut(t: number) {
  // The curve's x is 1.74s² − 0.74s³, increasing on [0, 1]: find the s where it is t, then y there.
  let [lo, hi] = [0, 1];
  for (let i = 0; i < 20; i++) {
    const s = (lo + hi) / 2;
    if (1.74 * s * s - 0.74 * s * s * s < t) lo = s;
    else hi = s;
  }
  const s = (lo + hi) / 2;
  return 3 * s * s - 2 * s * s * s;
}

/**
 * Fades a newly loaded tile in over the overview, its opacity set on each frame. Not a CSS transition: Chrome
 * runs an opacity transition on the compositor, which makes the tile a layer of its own for the fade, so the
 * map round it is split into layers and drawn again (with every clip of the landscape) as the fade starts and
 * again as it ends. Drawn on each frame, only the tile's own area is drawn again (see docs/TERRAIN.md).
 */
function fadeIn(el: SVGImageElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const start = performance.now();
  const frame = (now: number) => {
    const t = (now - start) / FADE_MS;
    if (t >= 1) el.style.removeProperty("opacity");
    else {
      el.style.opacity = String(easeOut(Math.max(0, t)));
      requestAnimationFrame(frame);
    }
  };
  el.style.opacity = "0";
  requestAnimationFrame(frame);
}

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
 * for the views it passes through; null until the first view settles. With no
 * delay (a view where a gesture or zoom ended), just after the frame that shows
 * the view: waiting longer only held its tiles back (150 ms of the 200–270 ms
 * until a zoom's cached tiles showed, with reduced motion), and fetching them for
 * that frame put their decoding into it (the map's response to a zoom from the
 * cache went from about 50 ms to 140 ms).
 */
function useSettled(transform: Transform, viewport: { width: number; height: number }, delay = 150) {
  const key = `${transform.k},${transform.x},${transform.y},${viewport.width},${viewport.height}`;
  const [settled, setSettled] = useState<{ key: string; transform: Transform; viewport: { width: number; height: number } } | null>(null);
  useEffect(() => {
    const settle = () => setSettled({ key, transform, viewport });
    let timer = delay > 0 ? setTimeout(settle, delay) : undefined;
    // After the next frame's main-thread work: its frame shows the view without these tiles.
    const frame = delay > 0 ? 0 : requestAnimationFrame(() => (timer = setTimeout(settle)));
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
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
  /** The view is where a gesture or zoom ended, not a pause in one: its tiles are fetched without waiting (see useSettled). */
  final?: boolean;
  /** Tiles show at once when loaded, without fading in (the gesture copy, which shows each final state). */
  instant?: boolean;
}

export const Relief = memo(function Relief({ map, level, tones, transform, viewport, instant, final }: Props) {
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
  // The "land" family covers every country but those in a state colour. Rather than one outline of all the
  // others, drawn again whenever a colour changes (every country's outline, over 850,000 characters on
  // Level 1, on the map and again on the gesture copy), it is clipped to all the land, which never changes,
  // and then cut out where the toned countries are: a frame round all the land with their outlines in it,
  // even-odd, so their insides are left out. Each clip stays a single path, as browsers draw one clip path
  // of several shapes differently (Firefox and WebKit through a mask, with faint seams between countries).
  const { land, frame } = useMemo(() => {
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const { bounds: [[a, b], [c, d]] } of map.shapes) [x0, y0, x1, y1] = [Math.min(x0, a), Math.min(y0, b), Math.max(x1, c), Math.max(y1, d)];
    return {
      land: map.shapes.map((s) => s.d).join(""),
      frame: `M${x0 - 1},${y0 - 1}H${x1 + 1}V${y1 + 1}H${x0 - 1}Z`,
    };
  }, [map]);
  const { toned, tonedBoxes } = useMemo(() => {
    const set = new Set(tonedKey ? tonedKey.split(",") : []);
    const tonedShapes = map.shapes.filter((s) => set.has(s.id));
    return {
      toned: tonedShapes.map((s) => s.d).join(""),
      tonedBoxes: tonedShapes.map((s) => [s.bounds[0][0], s.bounds[0][1], s.bounds[1][0], s.bounds[1][1]] as const),
    };
  }, [map, tonedKey]);

  // Tiles for the settled view: the visible world area, with a quarter-screen
  // margin so a short pan finds tiles ready.
  const settled = useSettled(transform, viewport, final ? 0 : 150);
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
                if (!instant) fadeIn(e.currentTarget);
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
        <clipPath id={`${id}-land`}>
          <path d={land} />
        </clipPath>
        {toned && (
          <clipPath id={`${id}-cut`}>
            <path d={frame + toned} clipRule="evenodd" />
          </clipPath>
        )}
        {toned && (
          <clipPath id={`${id}-toned`}>
            <path d={toned} />
          </clipPath>
        )}
      </defs>
      <g clipPath={`url(#${id}-land)`} data-family="land">
        {/* Always there, so the images in it stay put when the first country takes a colour. */}
        <g clipPath={toned ? `url(#${id}-cut)` : undefined}>
          {overviews && images && overview(overviews.land, images.land.src)}
          {landTiles.map(image)}
        </g>
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

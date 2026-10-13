"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { RING_COUNTRIES } from "@/core/challenge/europe";
import { RING_RADIUS, ringAt, ringShown, type Ring } from "@/core/challenge/smallCountries";
import { COUNTRIES } from "@/core/content/countries";
import type { CountryId, LonLat } from "@/core/content/types";
import type { CountryTone } from "@/core/lesson/mapView";
import { loadChallengeMap, type ChallengeMapData } from "@/geo/challengeMap";
import { applyTransform, fitTransform, type Bounds, type RegionMap, type Transform } from "@/geo/regionMap";
import europeLand from "@/assets/map/challenge/europe-land.webp";
import europeTone from "@/assets/map/challenge/europe-tone.webp";
import { useI18n } from "../i18n";
import { AboutMap } from "../map/AboutMap";
import { LandTexture, SeaTexture } from "../map/AtlasSurface";
import { placeLayer } from "../map/liveView";
import { Relief, type OwnRelief } from "../map/Relief";
import { useCountryTap } from "../map/useTap";
import lesson from "../map/RegionMap.module.css";
import styles from "./ChallengeMap.module.css";

/**
 * The Quick Challenge's map: the whole of Europe without names, from Iceland to the Urals, drawn as the levels'
 * illustrated map is (the atlas palette, textured turquoise water, the painted relief, the same coasts and
 * borders: RegionMap.module.css, AtlasSurface, Relief), in their projection, from its own data and landscape
 * (src/geo/challengeMap.ts; scripts/generate-challenge-relief.mjs), loaded when it opens. Rendering and input
 * only: what a tap means, and every rule of the round, is the caller's (src/core/challenge/quickChallenge.ts).
 * Pans and zooms (drag, pinch, wheel, the + − and reset buttons); a drag or pinch never answers (useCountryTap).
 * During a gesture the drawn map moves as one layer without being drawn again (liveView.ts's placeLayer), and is
 * drawn again for the new view once the layer no longer covers it and when the gesture ends; sharper relief is
 * fetched only for the view where a gesture or zoom ends, never for one passed through (Relief's endOnly). Europe's
 * smallest countries are marked by rings while too small to tap (smallCountries.ts).
 */

/** Colours a country can show: found, the place of a missed country, and the player's wrong choice. */
export type ChallengeTone = "correct" | "missed" | "chosen";

interface Props {
  /** The countries the player can tap. The rest of the map is context, drawn paler and never an answer. */
  pool: readonly CountryId[];
  tones?: Readonly<Partial<Record<CountryId, ChallengeTone>>>;
  /** Countries named on the map, at their label points (the review). */
  names?: readonly CountryId[];
  /** A country outlined to stand out and zoomed to (the review's selection). */
  focus?: CountryId | null;
  /** Called with a pool country tapped; without it, taps do nothing (the map still pans and zooms). */
  onTap?: (country: CountryId) => void;
  /** Called once, when the map is first drawn at its size and its painted relief has loaded. */
  onReady?: () => void;
  /** A new value (a new round) brings the start view back at once, whatever the player or the review left. */
  viewKey?: unknown;
  /** A new value (the round starting or ending) closes "About the map" if it is open (AboutMap's closeKey). */
  aboutKey?: unknown;
}

const MAX_ZOOM = 6;
/** The layer extends this share of the map's size past each edge, so a drag reveals map already drawn. */
const OVERSCAN = 0.3;
const ZOOM_STEP = 1.6;

/**
 * Label points for the pool's countries that have no content in countries.ts (no label there), inside each
 * country's main land; a ring country's is its ring's point.
 */
const EXTRA_LABELS: Readonly<Record<CountryId, LonLat>> = {
  GBR: [-1.6, 52.8],
  IRL: [-8.0, 53.2],
  DNK: [9.1, 56.0],
  ALB: [20.05, 41.2],
  // North Macedonia's middle, between Skopje and Prilep.
  MKD: [21.6, 41.6],
  KOS: [20.9, 42.6],
  ISL: [-18.6, 64.9],
  NOR: [9.0, 61.6],
  SWE: [15.2, 62.4],
  FIN: [26.0, 62.8],
  // European Russia's middle, east of Moscow.
  RUS: [44.0, 57.0],
  ...RING_COUNTRIES,
};

/**
 * The credit the challenge's relief needs beyond the levels' (AboutMap's): Natural Resources Canada's elevation data,
 * for the sliver of Ellesmere Island in the map's top-left corner (docs/TERRAIN.md, "Quick Challenge"), verbatim
 * from Tilezen's attribution list.
 */
const CHALLENGE_CREDITS = ["Canada terrain data contains information licensed under the Open Government Licence – Canada."];

const labelPoint = (id: CountryId): LonLat | null => COUNTRIES[id]?.label.coordinates ?? EXTRA_LABELS[id] ?? null;

/** A challenge tone as the levels' relief knows tones: any but "default" shades the country with the "tone" family. */
const RELIEF_TONE: Record<ChallengeTone, CountryTone> = { correct: "correct", missed: "destination", chosen: "wrong" };

const TONE_CLASS: Record<ChallengeTone | "default", string> = {
  default: lesson.toneDefault,
  correct: styles.correct,
  missed: styles.missed,
  chosen: styles.chosen,
};

function endMouseDrag() {
  window.dispatchEvent(new MouseEvent("mouseup", { view: window }));
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The view at scale `k` centred on the world point (cx, cy), moved as little as it takes to show nothing past `coverage`. */
function viewAt(coverage: Bounds, k: number, cx: number, cy: number, width: number, height: number): Transform {
  const [[c0x, c0y], [c1x, c1y]] = coverage;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return { k, x: clamp(width / 2 - k * cx, width - k * c1x, -k * c0x), y: clamp(height / 2 - k * cy, height - k * c1y, -k * c0y) };
}

/** Fetches and decodes images, so they draw at once when the map needs them. */
function preload(urls: readonly string[]): Promise<void> {
  return Promise.all(
    urls.map((src) => {
      const image = new Image();
      image.src = src;
      return image.decode().catch(() => {});
    }),
  ).then(() => {});
}

/** The map's data and landscape, loaded once per page with the map (not with the home screen or the levels). */
let loading: Promise<{ map: ChallengeMapData; own: OwnRelief }> | null = null;
function loadMap() {
  loading ??= Promise.all([loadChallengeMap(), import("@/assets/map/challenge-relief.json")]).then(([map, { default: manifest }]) => {
    const own: OwnRelief = {
      overview: { land: { ...manifest.overview.land, src: europeLand.src }, tone: { ...manifest.overview.tone, src: europeTone.src } },
      tiles: manifest.tiles,
      l2: manifest.l2,
      folder: `/relief-challenge/${manifest.version}`,
      l2Folder: `/relief-challenge-l2/${manifest.l2.version}`,
    };
    // The overview, land and tone, before the map shows: the relief is there from the start, and the first answer's
    // colours are shaded at once, never fetched in the middle of the round.
    return preload([europeLand.src, europeTone.src]).then(() => ({ map, own }));
  });
  return loading;
}

export function ChallengeMap(props: Props) {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState<{ map: ChallengeMapData; own: OwnRelief } | null>(null);
  useEffect(() => {
    let live = true;
    void loadMap().then((data) => {
      if (live) setLoaded(data);
    });
    return () => {
      live = false;
    };
  }, []);
  if (loaded) return <LoadedMap {...props} map={loaded.map} own={loaded.own} />;
  // The frame, empty, while the map loads (the panel says it is being prepared).
  return (
    <div className={styles.root} data-testid="challenge-map">
      <div className={`${lesson.wrapper} ${lesson.atlas} ${styles.frame}`} data-map-style="atlas" role="img" aria-label={t("challengeGame.mapLabel")} />
    </div>
  );
}

function LoadedMap({ pool, tones, names, focus, onTap, onReady, viewKey, aboutKey, map, own }: Props & { map: ChallengeMapData; own: OwnRelief }) {
  const { t, name } = useI18n();
  const coverage = map.coverage;
  // The water's texture covers what the map can show.
  const surface = useMemo<RegionMap>(() => ({ ...map, coverage }), [map, coverage]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // The view the map is drawn for; during a gesture the live view runs ahead of it (see placeLayer).
  const [drawn, setDrawn] = useState<Transform | null>(null);
  const drawnRef = useRef<Transform | null>(null);
  const liveRef = useRef<Transform | null>(null);
  // Whether the view drawn is where a gesture ended (Relief then fetches its sharper tiles at once).
  const [final, setFinal] = useState(true);
  const margin = useMemo(() => ({ x: Math.round(size.width * OVERSCAN), y: Math.round(size.height * OVERSCAN) }), [size]);

  // The small-country rings of the view drawn: every ring country of the pool drawn smaller than a ring, at its
  // point, in a fixed order (RING_COUNTRIES'), whatever is asked.
  const rings = useMemo<Ring[]>(() => {
    if (!drawn) return [];
    return Object.entries(RING_COUNTRIES).flatMap(([id, point]) => {
      if (!pool.includes(id) || !ringShown((map.areas.get(id) ?? 0) * drawn.k * drawn.k)) return [];
      const [x, y] = applyTransform(drawn, map.project(point));
      return [{ id, x, y }];
    });
  }, [drawn, pool, map]);
  const ringsRef = useRef(rings);
  useEffect(() => {
    ringsRef.current = rings;
  }, [rings]);

  const tapCountry = useMemo(() => (onTap ? (id: string) => pool.includes(id) && onTap(id) : undefined), [onTap, pool]);
  // A press answers with a small country's ring if it is in one (where rings overlap, the nearest centre's:
  // ringAt), and otherwise with the pool country whose shape is at its own position (useCountryTap's countryAtPoint),
  // as drawn now (the layer's CTM includes a gesture's placement): its fill only, never its outline, so a press by a
  // border goes to the side it is on, by touch or mouse alike. Sea and the context countries answer nothing.
  const shapeBounds = useMemo(() => new Map(map.shapes.map((s) => [s.id, s.bounds])), [map]);
  const countryAtPoint = (x: number, y: number): string | null => {
    const layer = layerRef.current;
    const ringCtm = layer?.querySelector<SVGCircleElement>("circle[data-ring]")?.getScreenCTM();
    if (ringCtm) {
      const p = new DOMPoint(x, y).matrixTransform(ringCtm.inverse());
      const ring = ringAt(ringsRef.current, p.x, p.y);
      if (ring) return ring;
    }
    const paths = layer?.querySelectorAll<SVGPathElement>("path[data-country]");
    const ctm = paths?.[0]?.getScreenCTM();
    if (!paths || !ctm) return null;
    const p = new DOMPoint(x, y).matrixTransform(ctm.inverse());
    let found: string | null = null;
    for (const path of paths) {
      const id = path.dataset.country!;
      const [[x0, y0], [x1, y1]] = shapeBounds.get(id) ?? [[0, 0], [-1, -1]];
      // The last one containing the point is the one drawn on top.
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && path.isPointInFill(p)) found = id;
    }
    return found;
  };
  const tap = useCountryTap(tapCountry, endMouseDrag, countryAtPoint);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (Math.abs(s.width - width) < 1 && Math.abs(s.height - height) < 1 ? s : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const padding = Math.max(8, Math.min(size.width, size.height) * 0.03);
  const [[c0x, c0y], [c1x, c1y]] = coverage;
  const [[f0x, f0y], [f1x, f1y]] = map.focusBounds;
  // Wider than Europe can be shown whole within the coverage (an ultra-wide desktop): narrower, centred.
  const maxWidth = size.height > 0 ? Math.floor(((c1x - c0x) * (size.height - 2 * padding)) / (f1y - f0y)) : undefined;

  // The start view: the whole of Europe, fitted with room around it, but never showing past the coverage (zooming in
  // a little instead, then moved inside it). The player may zoom in MAX_ZOOM times and pan within the coverage.
  const base = useMemo<Transform | null>(() => {
    if (size.width < 1 || size.height < 1) return null;
    const fit = fitTransform(map.focusBounds, size.width, size.height, padding);
    const k = Math.max(fit.k, size.width / (c1x - c0x), size.height / (c1y - c0y));
    return viewAt(coverage, k, (f0x + f1x) / 2, (f0y + f1y) / 2, size.width, size.height);
  }, [map, coverage, size, padding, c0x, c0y, c1x, c1y, f0x, f0y, f1x, f1y]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !base) return;
    const commit = (view: Transform, ended: boolean) => {
      drawnRef.current = view;
      setDrawn(view);
      setFinal(ended);
    };
    const behavior = d3zoom<HTMLDivElement, unknown>()
      .extent([
        [0, 0],
        [size.width, size.height],
      ])
      .scaleExtent([base.k, base.k * MAX_ZOOM])
      .translateExtent(coverage as [[number, number], [number, number]])
      .on("zoom", (event) => {
        const { k, x, y } = event.transform;
        const view = { k, x, y };
        liveRef.current = view;
        // The player is moving the map: a layer from now on, and no hover highlight until it stops (see CSS).
        if (event.sourceEvent && !stage.hasAttribute("data-moving")) {
          stage.setAttribute("data-moving", "");
          stage.setAttribute("data-gesture", "");
        }
        // Moved as a layer while that still covers the view; drawn again for it once it doesn't.
        if (!drawnRef.current || !placeLayer(layerRef.current, drawnRef.current, view, size, margin)) commit(view, false);
      })
      .on("end", () => {
        stage.removeAttribute("data-moving");
        stage.removeAttribute("data-gesture");
        if (liveRef.current) commit(liveRef.current, true);
      });
    zoomRef.current = behavior;
    const selection = select(stage);
    // A double tap answers (at most) once and never zooms: the round takes one answer per question.
    selection.call(behavior).on("dblclick.zoom", null);
    drawnRef.current = base;
    liveRef.current = base;
    setDrawn(base);
    selection.call(behavior.transform, zoomIdentity.translate(base.x, base.y).scale(base.k));
    return () => {
      selection.on(".zoom", null);
      stage.removeAttribute("data-moving");
      stage.removeAttribute("data-gesture");
    };
  }, [base, size, margin, coverage]);

  // The review's selected country, brought to the middle and zoomed until its whole shape fills about two thirds of
  // the map (no further than MAX_ZOOM, and never past the coverage); back to the start view when the review ends.
  // Only the review sets `focus`, so a timed round's view is the player's own. After the effect above, which a new
  // size or start view resets to the start view.
  const focusedRef = useRef(false);
  useEffect(() => {
    const stage = stageRef.current;
    const behavior = zoomRef.current;
    if (!stage || !behavior || !base) return;
    const shape = focus ? map.shapes.find((s) => s.id === focus) : undefined;
    let view: Transform;
    if (shape) {
      const [[x0, y0], [x1, y1]] = shape.bounds;
      const fit = fitTransform(shape.bounds, size.width, size.height, Math.min(size.width, size.height) * 0.18);
      view = viewAt(coverage, Math.min(base.k * MAX_ZOOM, Math.max(base.k, fit.k)), (x0 + x1) / 2, (y0 + y1) / 2, size.width, size.height);
      focusedRef.current = true;
    } else if (focusedRef.current) {
      view = base;
      focusedRef.current = false;
    } else return;
    select(stage)
      .transition()
      .duration(prefersReducedMotion() ? 0 : 400)
      .call(behavior.transform, zoomIdentity.translate(view.x, view.y).scale(view.k));
  }, [focus, base, size, map, coverage]);

  // A new round starts at the start view, at once (any zoom still animating stopped); within a round the view is
  // the player's. Without a start view yet (a phone hides the map with the results) the effect above sets it.
  const viewKeyRef = useRef(viewKey);
  useEffect(() => {
    if (viewKeyRef.current === viewKey) return;
    viewKeyRef.current = viewKey;
    focusedRef.current = false;
    const stage = stageRef.current;
    const behavior = zoomRef.current;
    if (!stage || !behavior || !base) return;
    select(stage).interrupt().call(behavior.transform, zoomIdentity.translate(base.x, base.y).scale(base.k));
  }, [viewKey, base]);

  // Once drawn for a view, the layer sits where it belongs for the live view (in place, unless a gesture moved on).
  useLayoutEffect(() => {
    if (drawn) placeLayer(layerRef.current, drawn, liveRef.current ?? drawn, size, margin);
  }, [drawn, size, margin]);

  // Ready once drawn (the overview, land and tone, loaded with the data: loadMap).
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);
  const announced = useRef(false);
  const shown = drawn !== null;
  useEffect(() => {
    if (!shown || announced.current) return;
    // After the browser has painted the drawn map.
    const frame = requestAnimationFrame(() => {
      announced.current = true;
      readyRef.current?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [shown]);

  const animateTo = (move: (zoom: ZoomBehavior<HTMLDivElement, unknown>, stage: HTMLDivElement) => void) => {
    const stage = stageRef.current;
    if (stage && zoomRef.current) move(zoomRef.current, stage);
  };
  const zoomBy = (factor: number) => animateTo((zoom, stage) => select(stage).transition().duration(250).call(zoom.scaleBy, factor));
  const reset = () =>
    animateTo((zoom, stage) => base && select(stage).transition().duration(250).call(zoom.transform, zoomIdentity.translate(base.x, base.y).scale(base.k)));

  const tonedKey = useMemo(() => Object.keys(tones ?? {}).sort().join(","), [tones]);
  const reliefTones = useMemo(() => {
    const out: Partial<Record<CountryId, CountryTone>> = {};
    for (const [id, tone] of Object.entries(tones ?? {})) if (tone) out[id] = RELIEF_TONE[tone];
    return out;
  }, [tones]);

  const labels = useMemo(() => {
    if (!drawn || !names) return [];
    return names.flatMap((id) => {
      const point = labelPoint(id);
      if (!point) return [];
      const [x, y] = applyTransform(drawn, map.project(point));
      // Beside a ring, not over it.
      const ringed = rings.some((r) => r.id === id);
      return [{ id, x, y: ringed ? y - RING_RADIUS - 10 : y, text: name(id) }];
    });
  }, [drawn, names, map, name, rings]);

  return (
    // The map, and its zoom controls: over its corner on a wide screen, in a toolbar under it on a phone,
    // where they would cover countries (ChallengeMap.module.css).
    <div className={styles.root} style={{ maxWidth }} data-testid="challenge-map">
      <div ref={wrapperRef} className={`${lesson.wrapper} ${lesson.atlas} ${styles.frame}`} data-map-style="atlas">
        {/* The map is answered by pointer; its countries are deliberately unnamed, so they are not listed for
            assistive technology (the panel says what to find, and Skip moves on). */}
        <div ref={stageRef} className={`${lesson.stage} ${styles.stage}`} {...tap} role="img" aria-label={t("challengeGame.mapLabel")}>
          {drawn && (
            <svg
              ref={layerRef}
              className={lesson.world}
              width={size.width + 2 * margin.x}
              height={size.height + 2 * margin.y}
              viewBox={`${-margin.x} ${-margin.y} ${size.width + 2 * margin.x} ${size.height + 2 * margin.y}`}
              style={{ left: -margin.x, top: -margin.y, transformOrigin: `${margin.x}px ${margin.y}px` }}
              aria-hidden="true"
              focusable="false"
            >
              <g transform={`translate(${drawn.x},${drawn.y}) scale(${drawn.k})`}>
                <SeaTexture map={surface} />
                <Countries map={map} pool={pool} tones={tones} interactive={!!onTap} />
                <LandTexture map={map} darkKey={tonedKey} />
                <Relief map={map} level={[]} own={own} tones={reliefTones} transform={drawn} viewport={size} final={final} endOnly />
                <ContextVeil map={map} pool={pool} />
                <Borders map={map} pool={pool} />
                {focus && <path className={styles.focus} d={map.shapes.find((s) => s.id === focus)?.d} />}
              </g>
              {rings.map((ring) => (
                <g key={ring.id}>
                  <circle cx={ring.x} cy={ring.y} r={RING_RADIUS} className={styles.ringHalo} />
                  <circle
                    cx={ring.x}
                    cy={ring.y}
                    r={RING_RADIUS}
                    className={styles.ring}
                    data-ring={ring.id}
                    data-tone={tones?.[ring.id]}
                    data-focus={ring.id === focus ? "" : undefined}
                  />
                </g>
              ))}
              {labels.map((label) => (
                <text key={label.id} className={styles.name} x={label.x} y={label.y} data-focus={label.id === focus ? "" : undefined}>
                  {label.text}
                </text>
              ))}
            </svg>
          )}
        </div>
        {/* The sources and credits, as on the levels' maps: the round button in the top-right corner, which the zoom
            controls never take (they are under the map on a phone, at its bottom-right corner on a wide screen). */}
        <AboutMap notes={[t("challengeMap.aboutKosovo")]} credits={CHALLENGE_CREDITS} openAtTop closeKey={aboutKey} />
      </div>
      <div className={`${lesson.controls} ${styles.controls}`}>
        <button type="button" className={`${lesson.control} ${styles.control}`} onClick={() => zoomBy(ZOOM_STEP)} aria-label={t("map.zoomIn")} title={t("map.zoomIn")}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" className={`${lesson.control} ${styles.control}`} onClick={() => zoomBy(1 / ZOOM_STEP)} aria-label={t("map.zoomOut")} title={t("map.zoomOut")}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" className={`${lesson.control} ${styles.control}`} onClick={reset} aria-label={t("map.reset")} title={t("map.reset")}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * The land as on the levels' map (RegionMap's CountryLayer): the coasts' light shallow-water band under it,
 * the context countries, then each pool country, named by id for taps. No names, capitals or landmarks.
 * Drawn again only when the colours or the pool change, not for a new view.
 */
const Countries = memo(function Countries({
  map,
  pool,
  tones,
  interactive,
}: {
  map: RegionMap;
  pool: readonly CountryId[];
  tones?: Readonly<Partial<Record<CountryId, ChallengeTone>>>;
  interactive: boolean;
}) {
  return (
    <>
      <g className={lesson.coast} aria-hidden="true">
        {map.shapes.map((s) => s.coast && <path key={s.id} d={s.coast} />)}
      </g>
      <g className={lesson.context}>
        {map.shapes
          .filter((s) => !pool.includes(s.id))
          .map((s) => (
            <path key={s.id} d={s.d} className={lesson.contextShape} />
          ))}
      </g>
      <g>
        {map.shapes
          .filter((s) => pool.includes(s.id))
          .map((s) => {
            const tone = tones?.[s.id];
            return (
              <path
                key={s.id}
                d={s.d}
                className={`${lesson.country} ${TONE_CLASS[tone ?? "default"]} ${interactive ? lesson.interactive : ""}`}
                data-country={interactive ? s.id : undefined}
                data-tone={tone}
              />
            );
          })}
      </g>
    </>
  );
});

/**
 * The countries outside the pool, under a pale veil over their relief, so the ones that can be answered stand
 * out. The same for the whole round (it never shows which 15 were drawn), and never a tap's target.
 */
const ContextVeil = memo(function ContextVeil({ map, pool }: { map: RegionMap; pool: readonly CountryId[] }) {
  const d = useMemo(
    () =>
      map.shapes
        .filter((s) => !pool.includes(s.id))
        .map((s) => s.d)
        .join(""),
    [map, pool],
  );
  return <path className={styles.veil} d={d} aria-hidden="true" />;
});

/** Borders over the relief, so each stays crisp (RegionMap's BorderLayer): the context's first, the pool's over them. */
const Borders = memo(function Borders({ map, pool }: { map: RegionMap; pool: readonly CountryId[] }) {
  return (
    <g className={lesson.borders} aria-hidden="true">
      {map.shapes
        .filter((s) => !pool.includes(s.id))
        .map((s) => (
          <path key={s.id} d={s.d} className={lesson.borderContext} />
        ))}
      {map.shapes
        .filter((s) => pool.includes(s.id))
        .map((s) => (
          <path key={s.id} d={s.d} className={lesson.borderActive} />
        ))}
    </g>
  );
});

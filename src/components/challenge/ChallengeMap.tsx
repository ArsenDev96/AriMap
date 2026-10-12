"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { COUNTRIES } from "@/core/content/countries";
import type { CountryId, LonLat } from "@/core/content/types";
import type { CountryTone } from "@/core/lesson/mapView";
import { applyTransform, fitTransform, getRegionMap, type Bounds, type RegionMap, type Transform } from "@/geo/regionMap";
import { useI18n } from "../i18n";
import { LandTexture, SeaTexture } from "../map/AtlasSurface";
import { placeLayer } from "../map/liveView";
import { overviewUrls, Relief } from "../map/Relief";
import { useCountryTap } from "../map/useTap";
import lesson from "../map/RegionMap.module.css";
import styles from "./ChallengeMap.module.css";

/**
 * The Quick Challenge's map: Europe without names, drawn as the levels' illustrated map is (the atlas palette,
 * textured turquoise water, the painted relief, the same coasts and borders: RegionMap.module.css, AtlasSurface,
 * Relief), in their projection and data (src/geo/regionMap.ts). Rendering and input only: what a tap means,
 * and every rule of the round, is the caller's (src/core/challenge/quickChallenge.ts). Pans and zooms (drag,
 * pinch, wheel, the + − and reset buttons); a drag or pinch never answers (useCountryTap). During a gesture
 * the drawn map moves as one layer without being drawn again (liveView.ts's placeLayer), and is drawn again
 * for the new view once it settles; sharper relief is fetched for that view only (Relief).
 */

/** Colours a country can show: found, the place of a missed country, and the player's wrong choice. */
export type ChallengeTone = "correct" | "missed" | "chosen";

interface Props {
  /** The countries the player can tap. The rest of the map is context, drawn paler and never an answer. */
  pool: readonly CountryId[];
  tones?: Readonly<Partial<Record<CountryId, ChallengeTone>>>;
  /** Countries named on the map, at their label points (the review). */
  names?: readonly CountryId[];
  /** A country outlined to stand out (the review's selection). */
  focus?: CountryId | null;
  /** Called with a pool country tapped; without it, taps do nothing (the map still pans and zooms). */
  onTap?: (country: CountryId) => void;
  /** Called once, when the map is first drawn at its size and its painted relief has loaded. */
  onReady?: () => void;
}

const MAX_ZOOM = 6;
/** The layer extends this share of the map's size past each edge, so a drag reveals map already drawn. */
const OVERSCAN = 0.3;
const ZOOM_STEP = 1.6;

/**
 * The most the map ever shows, in world units (the levels' projection): every pool country with room
 * around it, and wholly inside the map data (MAP_DATA_CLIP: lon −27…48, lat 29.5…62), so the straight
 * edges where the data cuts through land (Scandinavia and Russia at 62°N, Russia at 48°E, North Africa at
 * 29.5°N) are never in view. Its corners lie just inside the data: (−650, −500) at about 57.6°N 26.9°W,
 * (2190, −500) about 0.1° west of 48°E, (2190, 1600) about 0.2° north of 29.5°N. The view is fitted to the
 * pool inside it, zooming in rather than looking past it; the map is shown narrower where a screen is too
 * wide for it (as the levels' map is: maxMapWidth in regionMap.ts).
 */
const COVERAGE: Bounds = [
  [-650, -500],
  [2190, 1600],
];

/**
 * The levels' painted overviews that together cover COVERAGE's land (each level has its own, all in the
 * same projection and at one pixel per world unit): Western Europe 1 (the west, the British Isles and
 * Iberia), the Baltic (the north), Towards Greece (the south-east), Eastern Europe (Ukraine's east) and the
 * Iberian journey (Portugal's colours, and North Africa's coast). Drawn side by side (Relief's partition).
 */
const OVERVIEWS = ["western-europe-1", "baltic-journey", "towards-greece", "eastern-europe", "iberian-journey"] as const;

/**
 * Label points for the pool's countries that have no content in countries.ts (no label there), inside each
 * country's main land: the English Midlands, central Ireland, Jutland and central Albania.
 */
const EXTRA_LABELS: Readonly<Record<CountryId, LonLat>> = {
  GBR: [-1.6, 52.8],
  IRL: [-8.0, 53.2],
  DNK: [9.1, 56.0],
  ALB: [20.05, 41.2],
};

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

export function ChallengeMap({ pool, tones, names, focus, onTap, onReady }: Props) {
  const { t, name } = useI18n();
  const map = useMemo(() => getRegionMap(pool), [pool]);
  // The water's texture covers what the map can show.
  const surface = useMemo<RegionMap>(() => ({ ...map, coverage: COVERAGE }), [map]);
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

  const tapCountry = useMemo(() => (onTap ? (id: string) => pool.includes(id) && onTap(id) : undefined), [onTap, pool]);
  const tap = useCountryTap(tapCountry, endMouseDrag);

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
  const [[c0x, c0y], [c1x, c1y]] = COVERAGE;
  const [[f0x, f0y], [f1x, f1y]] = map.focusBounds;
  // Wider than the pool can be shown whole within COVERAGE (an ultra-wide desktop): narrower, centred.
  const maxWidth = size.height > 0 ? Math.floor(((c1x - c0x) * (size.height - 2 * padding)) / (f1y - f0y)) : undefined;

  // The start view: the whole pool, fitted with room around it, but never showing past COVERAGE (zooming in
  // a little instead, then moved inside it). The player may zoom in MAX_ZOOM times and pan within COVERAGE.
  const base = useMemo<Transform | null>(() => {
    if (size.width < 1 || size.height < 1) return null;
    const fit = fitTransform(map.focusBounds, size.width, size.height, padding);
    const k = Math.max(fit.k, size.width / (c1x - c0x), size.height / (c1y - c0y));
    const centred = k === fit.k ? fit : { k, x: size.width / 2 - (k * (f0x + f1x)) / 2, y: size.height / 2 - (k * (f0y + f1y)) / 2 };
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    return { k, x: clamp(centred.x, size.width - k * c1x, -k * c0x), y: clamp(centred.y, size.height - k * c1y, -k * c0y) };
  }, [map, size, padding, c0x, c0y, c1x, c1y, f0x, f0y, f1x, f1y]);

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
      .translateExtent(COVERAGE as [[number, number], [number, number]])
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
  }, [base, size, margin]);

  // Once drawn for a view, the layer sits where it belongs for the live view (in place, unless a gesture moved on).
  useLayoutEffect(() => {
    if (drawn) placeLayer(layerRef.current, drawn, liveRef.current ?? drawn, size, margin);
  }, [drawn, size, margin]);

  // Ready once drawn and its overviews (land and tone) have loaded: the relief shows from the start, and
  // the first answer's colours are shaded at once, never fetched in the middle of the round.
  const [reliefLoaded, setReliefLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    void preload(overviewUrls(OVERVIEWS)).then(() => {
      if (live) setReliefLoaded(true);
    });
    return () => {
      live = false;
    };
  }, []);
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);
  const announced = useRef(false);
  const shown = drawn !== null;
  useEffect(() => {
    if (!shown || !reliefLoaded || announced.current) return;
    // After the browser has painted the drawn map.
    const frame = requestAnimationFrame(() => {
      announced.current = true;
      readyRef.current?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [shown, reliefLoaded]);

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
      return [{ id, x, y, text: name(id) }];
    });
  }, [drawn, names, map, name]);

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
                <Relief map={map} level={OVERVIEWS} tones={reliefTones} transform={drawn} viewport={size} final={final} />
                <ContextVeil map={map} pool={pool} />
                <Borders map={map} pool={pool} />
                {focus && <path className={styles.focus} d={map.shapes.find((s) => s.id === focus)?.d} />}
              </g>
              {labels.map((label) => (
                <text key={label.id} className={styles.name} x={label.x} y={label.y} data-focus={label.id === focus ? "" : undefined}>
                  {label.text}
                </text>
              ))}
            </svg>
          )}
        </div>
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
 * The countries outside the pool, under a pale veil over their relief, so the 30 that can be answered stand
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

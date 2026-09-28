"use client";

import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { getCountry } from "@/core/content/countries";
import type { CountryId } from "@/core/content/types";
import type { LocalizedText } from "@/core/i18n/locales";
import type { CountryTone, MapMarker, MapView } from "@/core/lesson/mapView";
import type { LessonDefinition } from "@/core/lessons/types";
import {
  applyTransform,
  fitTransform,
  getRegionMap,
  projectBounds,
  viewLimits,
  type Bounds,
  type CountryShape,
  type Point,
  type RegionMap as RegionMapData,
  type Transform,
} from "@/geo/regionMap";
import { routeLine } from "@/geo/route";
import { useI18n } from "../i18n";
import { LandTexture, SeaTexture } from "./AtlasSurface";
import { AboutMap, ABOUT_BUTTON_EXTENT } from "./AboutMap";
import { insideShape } from "./insideShape";
import { createLiveView, placeLayer, type LiveView } from "./liveView";
import { Relief } from "./Relief";
import { Scenery } from "./Scenery";
import { useCountryTap } from "./useTap";
import styles from "./RegionMap.module.css";

const MAX_ZOOM = 8;
/** On smaller maps the inset would cover playable countries, so it starts collapsed. */
const INSET_AUTO_OPEN = { width: 600, height: 420 };
/** Inset layout (see CSS): 8px from the corner, 44px toggle and 6px gap (above it on wide maps), 2px frame, caption strip. */
const INSET_CHROME_HEIGHT = 8 + 44 + 6 + 4 + 20 + 8;
const INSET_MIN_WIDTH = 88;
/** Area the collapsed close-up toggle covers in the top-left corner: 8px margin, 44px button, 4px clearance. */
const INSET_TOGGLE_EXTENT = 8 + 44 + 4;
/** Inset width before it shrinks to fit: at least 112px, 100px on narrow maps so it clears the Low Countries' names. */
const INSET_WIDTH = { min: 112, compactMin: 100, max: 208 };
/**
 * Dragging and zooming move the drawn map as one layer, which the browser
 * shifts and scales without drawing it again (see liveView.ts). The map is drawn
 * again for the new view once it settles: when the gesture ends, after this
 * pause (ms) in it, or at once if the layer would no longer cover the view.
 */
const SETTLE_MS = 150;
/** The layer extends this share of the map's width and height past each edge, so a drag reveals map already drawn. */
const OVERSCAN = 0.3;
/**
 * The drawn layer and the names stay composited layers this long (ms) after a
 * gesture ends, so gestures in quick succession (or a wheel that pauses) reuse
 * them. Then the map is drawn with the page again, exactly as at rest.
 */
const RELEASE_MS = 400;

interface Props {
  lesson: LessonDefinition;
  view: MapView;
  /** Current lesson stage; a close-up opened automatically stays open for that stage only. */
  stage: string;
  onCountryTap?: (country: CountryId) => void;
}

/** Screen-space rectangle. */
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function RegionMap({ lesson, view, stage, onCountryTap }: Props) {
  const { t, l, name, countryParams } = useI18n();
  const map = useMemo(() => getRegionMap(lesson.countries), [lesson.countries]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<SVGSVGElement>(null);
  const insetRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // The view the map is drawn for. During a gesture the live view runs ahead of
  // it: the drawn layer and the names follow the live view until it settles.
  const [transform, setTransform] = useState<Transform>({ k: 1, x: 0, y: 0 });
  const [live] = useState(() => createLiveView({ k: 1, x: 0, y: 0 }));
  const drawnRef = useRef(transform);
  // The last view the player stopped at (not one the map was only redrawn for
  // mid-gesture): the landscape fetches sharper tiles for this view only.
  const [settledView, setSettledView] = useState<Transform>(transform);
  const [insetBox, setInsetBox] = useState<Box | null>(null);
  const [controlsBox, setControlsBox] = useState<Box | null>(null);
  // The player's open/closed choice, kept for the stage it was made in. Without
  // one the close-up is automatic: open on wide maps, and in Discover also when
  // Luxembourg's name has no room on the main map.
  const [choice, setChoice] = useState<{ stage: string; open: boolean } | null>(null);
  const insetChoice = choice?.stage === stage ? choice.open : null;
  // Stage in which the close-up opened automatically; it stays open for that stage.
  const [autoInsetStage, setAutoInsetStage] = useState<string | null>(null);
  const motion = useRouteMotion(view);
  const flash = useAnswerFlash(view);

  const tapHandler = view.interactive ? onCountryTap : undefined;
  const tap = useCountryTap(tapHandler);

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

  const padding = Math.max(10, Math.min(size.width, size.height) * 0.04);
  const limits = useMemo(
    () => (size.width > 0 ? viewLimits(map, size.width, size.height, padding) : null),
    [map, size, padding],
  );
  const base = limits?.base ?? null;
  const margin = useMemo(() => ({ x: Math.round(size.width * OVERSCAN), y: Math.round(size.height * OVERSCAN) }), [size]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !limits) return;
    let latest = live.get();
    let frame = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;
    let release: ReturnType<typeof setTimeout> | undefined;
    // Draw the map for the live view; `stopped` when the player has stopped there (the gesture ended or paused).
    const settle = (stopped: boolean) => {
      cancelAnimationFrame(frame);
      frame = 0;
      clearTimeout(idle);
      live.set(latest);
      setTransform(latest);
      if (stopped) setSettledView(latest);
    };
    const behavior = d3zoom<HTMLDivElement, unknown>()
      .extent([
        [0, 0],
        [size.width, size.height],
      ])
      // The base view is also the minimum zoom, so the view never extends past the data coverage.
      .scaleExtent([limits.base.k, limits.base.k * MAX_ZOOM])
      .translateExtent(limits.translateExtent as [[number, number], [number, number]])
      // During a gesture (drag, pinch, wheel or zoom animation) and shortly
      // after, the drawn layer and the names are composited layers (see CSS).
      .on("start", () => {
        clearTimeout(release);
        stage.setAttribute("data-gesture", "");
      })
      .on("zoom", (event) => {
        const { k, x, y } = event.transform;
        latest = { k, x, y };
        // The player is moving the map: no hover highlight until the gesture ends (see CSS).
        if (event.sourceEvent && !stage.hasAttribute("data-moving")) stage.setAttribute("data-moving", "");
        clearTimeout(idle);
        idle = setTimeout(() => settle(true), SETTLE_MS);
        // At most once per frame: move the drawn layer and the names, without drawing the map again.
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          live.set(latest);
          if (!placeLayer(worldRef.current, drawnRef.current, latest, size, margin)) settle(false);
        });
      })
      .on("end", () => {
        stage.removeAttribute("data-moving");
        settle(true);
        clearTimeout(release);
        release = setTimeout(() => stage.removeAttribute("data-gesture"), RELEASE_MS);
      });
    const selection = select(stage);
    selection.call(behavior).on("dblclick.zoom", null);
    selection.call(behavior.transform, zoomIdentity.translate(limits.base.x, limits.base.y).scale(limits.base.k));
    zoomRef.current = behavior;
    return () => {
      selection.on(".zoom", null);
      cancelAnimationFrame(frame);
      clearTimeout(idle);
      clearTimeout(release);
      stage.removeAttribute("data-moving");
      stage.removeAttribute("data-gesture");
    };
  }, [limits, size, margin, live]);

  // Once the map is drawn for a view, place the layer for the live view (usually the same).
  useLayoutEffect(() => {
    drawnRef.current = transform;
    placeLayer(worldRef.current, transform, live.get(), size, margin);
  }, [transform, live, size, margin]);

  const zoomBy = (factor: number) => {
    const stage = stageRef.current;
    if (!stage || !zoomRef.current) return;
    select(stage).transition().duration(prefersReducedMotion() ? 0 : 250).call(zoomRef.current.scaleBy, factor);
  };
  const resetZoom = () => {
    const stage = stageRef.current;
    if (!stage || !zoomRef.current || !base) return;
    select(stage)
      .transition()
      .duration(prefersReducedMotion() ? 0 : 300)
      .call(zoomRef.current.transform, zoomIdentity.translate(base.x, base.y).scale(base.k));
  };

  // Route line in projected world coordinates, shared by the main map and the inset.
  const route = useMemo(
    () => routeLine(view.route, lesson.map.routeCrossings ?? {}).map(map.project),
    [view.route, lesson.map.routeCrossings, map],
  );

  const inset = lesson.map.inset;
  const insetBounds = useMemo(() => (inset ? projectBounds(map, inset.bounds) : null), [map, inset]);
  const insetSize = useMemo(() => {
    if (!insetBounds || size.width === 0) return null;
    const [[x0, y0], [x1, y1]] = insetBounds;
    const aspect = (y1 - y0) / (x1 - x0);
    const min = size.width < COMPACT_MAP_WIDTH ? INSET_WIDTH.compactMin : INSET_WIDTH.min;
    let width = Math.round(Math.min(INSET_WIDTH.max, Math.max(min, size.width * 0.3)));
    // On short maps the panel shrinks so it always fits below its toggle.
    const room = size.height - INSET_CHROME_HEIGHT;
    if (width * aspect > room) width = Math.max(INSET_MIN_WIDTH, Math.floor(room / aspect));
    return { width, height: Math.round(width * aspect) };
  }, [insetBounds, size.width, size.height]);
  const insetTransform = useMemo(
    () => (insetBounds && insetSize ? fitTransform(insetBounds, insetSize.width, insetSize.height, 0) : null),
    [insetBounds, insetSize],
  );

  const ready = base !== null;
  const wideMap = size.width >= INSET_AUTO_OPEN.width && size.height >= INSET_AUTO_OPEN.height;

  // Track the inset panel's footprint so map labels can avoid it.
  useEffect(() => {
    const el = insetRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const box = { x0: el.offsetLeft, y0: el.offsetTop, x1: el.offsetLeft + el.offsetWidth, y1: el.offsetTop + el.offsetHeight };
      setInsetBox((b) => (b && b.y0 === box.y0 && b.x1 === box.x1 && b.y1 === box.y1 ? b : box));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  // Same for the zoom controls.
  useEffect(() => {
    const el = controlsRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const box = { x0: el.offsetLeft, y0: el.offsetTop, x1: el.offsetLeft + el.offsetWidth, y1: el.offsetTop + el.offsetHeight };
      setControlsBox((b) => (b && b.x0 === box.x0 && b.y0 === box.y0 && b.x1 === box.x1 && b.y1 === box.y1 ? b : box));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The inset only names its country while that name is already visible on the map,
  // so it never gives away a Find answer or a hidden Travel country.
  const insetNamed = inset ? view.namesPublic || view.labels.includes(inset.country) : false;
  const insetTitle = inset && insetNamed ? t("map.insetTitle", countryParams(inset.country)) : t("map.insetTitleUnnamed");

  const obstacles = useMemo(() => {
    const boxes: Box[] = [];
    if (controlsBox) boxes.push({ x0: controlsBox.x0 - 4, y0: controlsBox.y0 - 4, x1: size.width, y1: size.height });
    // "About the map", in the top-right corner.
    boxes.push({ x0: size.width - ABOUT_BUTTON_EXTENT - 4, y0: 0, x1: size.width, y1: ABOUT_BUTTON_EXTENT + 4 });
    // The inset sits in a left-hand corner (top on wide maps, bottom otherwise);
    // its area runs to the map edges it touches.
    if (insetBox) {
      const top = wideMap;
      boxes.push({ x0: 0, y0: top ? 0 : insetBox.y0 - 4, x1: insetBox.x1 + 4, y1: top ? insetBox.y1 + 4 : size.height });
    }
    return boxes;
  }, [size, insetBox, controlsBox, wideMap]);

  // Would Luxembourg's name (or another small country's) fit on the main map at
  // the whole-map view, in a nearby callout clear of names, markers and controls?
  // Asked with the close-up closed (only its toggle in the corner) on small maps.
  // Only names the view already shows count, so this never reveals an answer.
  const crowded = useMemo(() => {
    if (!base || size.width === 0 || !lesson.map.inset) return false;
    const toggle: Box = { x0: 0, y0: size.height - INSET_TOGGLE_EXTENT, x1: INSET_TOGGLE_EXTENT, y1: size.height };
    const closedObstacles = [...obstacles.filter((o) => o.x0 !== 0), toggle];
    const layout = layoutOverlay({
      map,
      active: lesson.countries,
      view,
      route,
      transform: base,
      viewport: size,
      textMode: "all",
      obstacles: wideMap ? obstacles : closedObstacles,
      insetArea: null,
      l,
      name,
    });
    return layout.crowded.length > 0;
  }, [base, size, lesson.map.inset, lesson.countries, obstacles, wideMap, map, view, route, l, name]);

  // No clear nearby spot in Discover: the close-up opens, with the name inside it.
  // It stays open for the rest of Discover, and never reopens once the player
  // closes it. Find answers and Travel moves never open it: there the name takes
  // the best clear spot on the main map, or is left out rather than overprinted.
  if (crowded && stage === "discover" && insetChoice === null && autoInsetStage !== stage) setAutoInsetStage(stage);
  const insetOpen = insetChoice ?? (wideMap || autoInsetStage === stage);
  // While the close-up is open on a small map (or the main map has no room), small
  // countries' names are drawn only in the close-up, where they are large.
  const calloutsInInset = insetOpen && (!wideMap || crowded);

  // Main-map overlay layout, shared with the scenery so it can keep clear of names and markers.
  const mainLayout = ready
    ? layoutOverlay({
        map,
        active: lesson.countries,
        view,
        route,
        transform,
        viewport: size,
        textMode: calloutsInInset ? "noCallouts" : "all",
        obstacles,
        insetArea: insetOpen ? insetBounds : null,
        l,
        name,
      })
    : null;
  // Wave marks: Discover only, on the main map only.
  const scenery = stage === "discover" && mainLayout !== null;
  // Lesson countries in a state colour (selection, Find answers, Travel): the
  // land texture is lighter over them, and the relief uses its neutral overlay.
  const tonedKey = lesson.countries.filter((id) => (view.tones[id] ?? "default") !== "default").join(",");
  // Scenery also keeps 8px of room around the zoom controls and the close-up.
  const sceneryAvoid = scenery
    ? [...sceneryClearance(map, mainLayout, transform), ...obstacles.map((o) => ({ x0: o.x0 - 8, y0: o.y0 - 8, x1: o.x1 + 8, y1: o.y1 + 8 }))]
    : [];

  return (
    // data-crowded: a small country's name has no nearby clear spot on the whole-map view.
    // The same illustrated landscape (atlas surface and relief) in every stage.
    <div className={`${styles.wrapper} ${styles.atlas}`} ref={wrapperRef} data-crowded={crowded || undefined} data-map-style="atlas">
      {/* The stage takes the gestures and taps; taps reach the countries in the drawn layer. */}
      <div
        ref={stageRef}
        data-testid="map-main"
        className={styles.stage}
        role="group"
        aria-label={t("map.label", { region: l(lesson.regionName) })}
        aria-describedby="map-gestures"
        {...tap}
      >
        {ready && mainLayout && (
          <>
            {/* The drawn map, larger than the view by `margin` on each side (its
                user space still starts at the view's corner), moved as one layer
                during a gesture. */}
            <svg
              ref={worldRef}
              className={styles.world}
              width={size.width + 2 * margin.x}
              height={size.height + 2 * margin.y}
              viewBox={`${-margin.x} ${-margin.y} ${size.width + 2 * margin.x} ${size.height + 2 * margin.y}`}
              style={{ left: -margin.x, top: -margin.y, transformOrigin: `${margin.x}px ${margin.y}px` }}
              role="none"
            >
              <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
                <SeaTexture map={map} />
                <CountryLayer map={map} active={lesson.countries} view={view} focusable onKeyTap={tapHandler} />
                <LandTexture map={map} darkKey={tonedKey} />
                <Relief map={map} tones={view.tones} transform={settledView} viewport={size} />
                {scenery && (
                  <Scenery
                    map={map}
                    transform={transform}
                    viewport={size}
                    avoid={sceneryAvoid}
                    compact={size.width < COMPACT_MAP_WIDTH}
                  />
                )}
                <BorderLayer map={map} active={lesson.countries} />
                <FlashLayer map={map} flash={flash} />
              </g>
            </svg>
            {/* Names, markers and the route, in screen space, over the drawn map. */}
            <svg className={styles.overlayLayer} width={size.width} height={size.height} aria-hidden="true" data-overlay="">
              <LiveOverlay
                live={live}
                map={map}
                active={lesson.countries}
                view={view}
                route={route}
                transform={transform}
                viewport={size}
                textMode={calloutsInInset ? "noCallouts" : "all"}
                obstacles={obstacles}
                insetArea={insetOpen ? insetBounds : null}
                motion={motion}
                layout={mainLayout}
              />
            </svg>
          </>
        )}
      </div>
      <p id="map-gestures" className="visually-hidden">
        {t("map.gestures")}
      </p>

      {ready && insetBounds && insetSize && insetTransform && (
        // Wide maps: top-left, over sea and neighbours. Smaller (phone) maps:
        // bottom-left, opposite the zoom controls, opening upwards over western
        // France, which leaves the crowded Low Countries and their names clear.
        <div className={`${styles.inset} ${wideMap ? "" : styles.insetBottom}`} ref={insetRef}>
          <button
            type="button"
            className={styles.insetToggle}
            aria-expanded={insetOpen}
            aria-label={insetOpen ? t("map.insetHide") : t("map.insetShow")}
            title={insetOpen ? t("map.insetHide") : t("map.insetShow")}
            data-testid="inset-toggle"
            onClick={() => setChoice({ stage, open: !insetOpen })}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
              <path d="M15 15l5.5 5.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              <path d={insetOpen ? "M7 10h6" : "M7 10h6M10 7v6"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          {insetOpen && (
            <figure className={styles.insetPanel} style={{ width: insetSize.width }}>
              {/* Visible caption is just "Close-up"; the dashed key ties it to the outlined area on the map. */}
              <figcaption className={styles.insetCaption} data-testid="inset-title">
                <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true" className={styles.insetKey}>
                  <rect x="1.5" y="1.5" width="11" height="11" rx="2" />
                </svg>
                <span>{t("map.insetCaption")}</span>
              </figcaption>
              <svg
                data-testid="map-inset"
                className={styles.insetSvg}
                width={insetSize.width}
                height={insetSize.height}
                role="group"
                aria-label={insetTitle}
                {...tap}
              >
                <rect className={styles.sea} width={insetSize.width} height={insetSize.height} />
                <g transform={`translate(${insetTransform.x},${insetTransform.y}) scale(${insetTransform.k})`}>
                  <SeaTexture map={map} />
                  <CountryLayer map={map} active={lesson.countries} view={view} focusable={false} />
                  <LandTexture map={map} darkKey={tonedKey} />
                  <Relief map={map} tones={view.tones} transform={insetTransform} viewport={insetSize} />
                  <BorderLayer map={map} active={lesson.countries} />
                  <FlashLayer map={map} flash={flash} />
                </g>
                <Overlay
                  map={map}
                  active={lesson.countries}
                  view={view}
                  route={route}
                  transform={insetTransform}
                  viewport={insetSize}
                  textMode={calloutsInInset ? "callouts" : "none"}
                  obstacles={[]}
                  insetArea={null}
                />
              </svg>
            </figure>
          )}
        </div>
      )}

      <AboutMap />

      <div className={styles.controls} ref={controlsRef} data-testid="map-controls">
        <button type="button" className={styles.control} onClick={() => zoomBy(1.6)} aria-label={t("map.zoomIn")} title={t("map.zoomIn")}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" className={styles.control} onClick={() => zoomBy(1 / 1.6)} aria-label={t("map.zoomOut")} title={t("map.zoomOut")}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" className={styles.control} onClick={resetZoom} aria-label={t("map.reset")} title={t("map.reset")}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// --- Country shapes ----------------------------------------------------------

const TONE_CLASS: Record<CountryTone, string> = {
  default: styles.toneDefault,
  selected: styles.toneSelected,
  correct: styles.toneCorrect,
  wrong: styles.toneWrong,
  reveal: styles.toneReveal,
  visited: styles.toneVisited,
  current: styles.toneCurrent,
  destination: styles.toneDestination,
};

interface LayerProps {
  map: RegionMapData;
  active: readonly CountryId[];
  view: MapView;
  focusable: boolean;
  onKeyTap?: (country: CountryId) => void;
}

/** Memoised so that zooming only updates the parent transform, not every path. */
const CountryLayer = memo(function CountryLayer({ map, active, view, focusable, onKeyTap }: LayerProps) {
  const { t, name } = useI18n();
  const explored = new Set(view.explored);
  const context = map.shapes.filter((s) => !active.includes(s.id));
  const playable = map.shapes.filter((s) => active.includes(s.id));
  const labels = new Set(view.labels);

  const onKeyDown = (e: KeyboardEvent, id: CountryId) => {
    if (onKeyTap && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onKeyTap(id);
    }
  };

  return (
    <>
      {/* Coastline: a soft line under all land. Fills cover it wherever land meets land, so it shows only along the sea. */}
      <g className={styles.coast} aria-hidden="true">
        {map.shapes.map((s) => (
          <path key={s.id} d={s.d} />
        ))}
      </g>
      <g className={styles.context}>
        {context.map((s) => (
          <path key={s.id} d={s.d} data-country={s.id} className={styles.contextShape} aria-hidden="true" />
        ))}
      </g>
      <g>
        {playable.map((s) => {
          const tone = view.tones[s.id] ?? "default";
          const named = view.namesPublic || labels.has(s.id);
          const interactive = view.interactive && focusable;
          return (
            <path
              key={s.id}
              d={s.d}
              data-country={s.id}
              data-tone={tone}
              className={`${styles.country} ${TONE_CLASS[tone]} ${view.interactive ? styles.interactive : ""}`}
              role={interactive ? "button" : "img"}
              tabIndex={interactive ? 0 : undefined}
              aria-label={
                focusable ? (named ? (explored.has(s.id) ? t("map.exploredCountry", { country: name(s.id) }) : name(s.id)) : t("map.unnamedCountry")) : undefined
              }
              aria-hidden={focusable ? undefined : true}
              onKeyDown={interactive ? (e) => onKeyDown(e, s.id) : undefined}
            />
          );
        })}
      </g>
    </>
  );
});

/** A brief outline on the country just answered in Find, over the relief and borders; it fades out. */
function FlashLayer({ map, flash }: { map: RegionMapData; flash: AnswerFlash | null }) {
  const shape = flash ? map.shapes.find((s) => s.id === flash.country) : undefined;
  if (!flash || !shape) return null;
  return (
    <path
      key={flash.key}
      d={shape.d}
      className={flash.kind === "correct" ? styles.flashCorrect : styles.flashWrong}
      aria-hidden="true"
      data-flash={flash.kind}
    />
  );
}

/**
 * Borders redrawn over the relief and scenery (which lie on the fills), so
 * every border stays crisp. Purely visual: no country ids, no pointer events.
 */
const BorderLayer = memo(function BorderLayer({ map, active }: { map: RegionMapData; active: readonly CountryId[] }) {
  return (
    // Faded neighbours first, so a lesson country's border wins where they meet (as in CountryLayer).
    <g className={styles.borders} aria-hidden="true">
      {map.shapes
        .filter((s) => !active.includes(s.id))
        .map((s) => (
          <path key={s.id} d={s.d} className={styles.borderContext} />
        ))}
      {map.shapes
        .filter((s) => active.includes(s.id))
        .map((s) => (
          <path key={s.id} d={s.d} className={styles.borderActive} />
        ))}
    </g>
  );
});

type AnswerFlash = NonNullable<MapView["feedback"]>;

/**
 * The latest Find answer, only if it happened while this map was on screen:
 * feedback restored after a refresh (or unchanged by a language switch) is not
 * emphasised again.
 */
function useAnswerFlash(view: MapView): AnswerFlash | null {
  const key = view.feedback?.key ?? null;
  const [state, setState] = useState<{ key: string | null; flash: AnswerFlash | null }>({ key, flash: null });
  if (state.key !== key) {
    const next = { key, flash: view.feedback };
    setState(next);
    return next.flash;
  }
  return state.flash;
}

/** Tracks route changes while this map is on screen (see RouteMotion). */
function useRouteMotion(view: MapView): RouteMotion {
  const routeKey = view.route.join(",");
  const [state, setState] = useState({ routeKey, arrived: view.arrived, motion: { grewFrom: null, seq: 0, arrivedSeq: null } as RouteMotion });
  if (state.routeKey === routeKey && state.arrived === view.arrived) return state.motion;
  const prev = state.routeKey ? state.routeKey.split(",") : [];
  const grew = view.route.length === prev.length + 1 && prev.length > 0 && prev.every((c, i) => view.route[i] === c);
  const seq = state.routeKey === routeKey ? state.motion.seq : state.motion.seq + 1;
  const motion: RouteMotion = {
    grewFrom: grew ? prev.length - 1 : state.routeKey === routeKey ? state.motion.grewFrom : null,
    seq,
    arrivedSeq: view.arrived && !state.arrived ? seq : view.arrived ? state.motion.arrivedSeq : null,
  };
  setState({ routeKey, arrived: view.arrived, motion });
  return motion;
}

// --- Label geometry ------------------------------------------------------------

const LABEL_FONT_PX = 14;
/** Capital and landmark names are a step smaller than country names. */
const MARKER_FONT_PX = 12;
/** Font weights used by the map text (see RegionMap.module.css), for measuring. */
const LABEL_WEIGHT = 700;
const MARKER_WEIGHT = 650;
const CALLOUT_PAD_X = 8;
const CALLOUT_HEIGHT = 24;
/** Narrow maps use slightly smaller labels so the names fit between the countries and controls. */
const COMPACT_MAP_WIDTH = 420;
const COMPACT_LABEL_FONT_PX = 13;
const COMPACT_MARKER_FONT_PX = 11.5;
const COMPACT_CALLOUT_HEIGHT = 22;
/** Callouts drawn inside the small inset. */
const INSET_LABEL_FONT_PX = 10.5;
const INSET_CALLOUT_PAD_X = 4;
const INSET_CALLOUT_HEIGHT = 18;
/** Tones with a dark fill, where map text is white. */
const DARK_TONES: ReadonlySet<CountryTone> = new Set(["selected", "correct", "visited", "current"]);
/**
 * Callout scoring, in px² of overlap with country names (each weighted by
 * CALLOUT_OVERLAP_WEIGHT): each step further out, and each name its leader line
 * crosses, costs this much. Covering or crossing a name is far costlier than
 * moving out, so the callout only does so when there is no clear spot.
 */
const CALLOUT_STEP_COST = 150;
const CALLOUT_OVERLAP_WEIGHT = 20;
const LEADER_CROSSING_COST = 4000;
/** Cost of a callout lying entirely over another lesson country (scaled by the share that does). */
const CALLOUT_DEPTH_COST = 2500;

let measureContext: CanvasRenderingContext2D | null | undefined;
const widthCache = new Map<string, number>();

/** Approximate rendered width of map text, with a small safety margin. */
function textWidth(text: string, sizePx: number, weight = LABEL_WEIGHT): number {
  const key = `${weight}|${sizePx}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  if (measureContext === undefined) measureContext = document.createElement("canvas").getContext("2d");
  let width = text.length * sizePx * 0.62;
  if (measureContext) {
    measureContext.font = `${weight} ${sizePx}px ${getComputedStyle(document.body).fontFamily}`;
    width = measureContext.measureText(text).width;
  }
  width = Math.ceil(width * 1.06);
  widthCache.set(key, width);
  return width;
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inBox = ([x, y]: Point, b: Box) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/** Nearest point of a box to `p`: where a leader line from `p` meets it. */
const nearestOn = (b: Box, [x, y]: Point): Point => [clamp(x, b.x0, b.x1), clamp(y, b.y0, b.y1)];

/** Whether the segment a→b passes through the box (sampled every 2px). */
function segmentHits(a: Point, b: Point, box: Box): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
  for (let i = 0; i <= steps; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / steps;
    const y = a[1] + ((b[1] - a[1]) * i) / steps;
    if (x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1) return true;
  }
  return false;
}

/**
 * Places a callout label beside a small country. Positions around the anchor
 * are tried nearest first (east first, away from the large neighbours' labels
 * and capitals). `hard` areas (map controls, inset, capitals, landmarks and
 * their names, e.g. Paris) are never covered or crossed by the leader line.
 * The rest are returned best first by score: overlap with `soft` country
 * labels, leader lines crossing them, and distance all count. The caller picks
 * the first whose overlapped names can be moved aside.
 */
function calloutCandidates(
  anchor: Point,
  reach: number,
  width: number,
  h: number,
  viewport: { width: number; height: number },
  hard: Box[],
  soft: Box[],
  /** Share (0–1) of a box lying over another lesson country; callouts prefer sea or faded neighbours. */
  depth: (b: Box) => number = () => 0,
  /**
   * Map chrome (controls, the close-up with its caption and toggle): never
   * covered or crossed, even as a last resort. Unlike `hard` boxes, one
   * containing the anchor still blocks the leader line.
   */
  chrome: Box[] = [],
): Box[] {
  const [ax, ay] = anchor;
  const candidates: { box: Box; step: number }[] = [];
  [0, 14, 28, 42, 56].forEach((extra, step) => {
    const d = Math.max(16, reach + 10) + extra;
    const corners: [number, number][] = [
      [ax + d, ay - h / 2 + 10], // east
      [ax + d * 0.6, ay + d], // south-east
      [ax - width / 2, ay + d + 2], // south
      [ax - d * 0.6 - width, ay + d], // south-west
      [ax + d * 0.6, ay - d - h], // north-east
      [ax - d - width, ay - h / 2 + 10], // west
      [ax - width / 2, ay - d - h], // north
      [ax - d * 0.6 - width, ay - d - h], // north-west
      // Level with the dot, so the leader runs straight across (the gap between
      // names just above and markers just below is often only a few pixels).
      [ax - d - width, ay - h],
      [ax - d - width, ay],
      [ax + d, ay - h],
      [ax + d, ay],
      // North and south, shifted sideways, for crowded maps.
      [ax - width * 0.15, ay - d - h],
      [ax - width * 0.85, ay - d - h],
      [ax - width * 0.15, ay + d + 2],
      [ax - width * 0.85, ay + d + 2],
    ];
    for (const [x, y] of corners) candidates.push({ box: { x0: x, y0: y, x1: x + width, y1: y + h }, step });
  });
  // Distance from the view edge: tighter in small views such as the inset.
  const m = viewport.width < 160 ? 2 : 4;
  // Last resort, for small views such as the inset: along the top or bottom edge, above or below the anchor.
  const edgeX = clamp(ax - width / 2, m, viewport.width - m - width);
  for (const y of [viewport.height - m - h, m]) candidates.push({ box: { x0: edgeX, y0: y, x1: edgeX + width, y1: y + h }, step: 5 });
  const onScreen = (b: Box) => b.x0 >= m && b.y0 >= m && b.x1 <= viewport.width - m && b.y1 <= viewport.height - m;
  // The anchor's own marker (e.g. Luxembourg City) is where the leader starts, so it can't block it.
  const blockers = [...hard.filter((o) => !inBox(anchor, o)), ...chrome];
  const usable = candidates.filter(
    ({ box }) =>
      onScreen(box) && ![...hard, ...chrome].some((o) => overlaps(box, o)) && !blockers.some((o) => segmentHits(anchor, nearestOn(box, anchor), o)),
  );
  const score = ({ box, step }: { box: Box; step: number }) => {
    const end = nearestOn(box, anchor);
    return soft.reduce(
      (sum, o) => sum + overlapArea(box, o) * CALLOUT_OVERLAP_WEIGHT + (segmentHits(anchor, end, o) ? LEADER_CROSSING_COST : 0),
      step * CALLOUT_STEP_COST + depth(box) * CALLOUT_DEPTH_COST,
    );
  };
  const ranked = usable
    .map((c) => ({ box: c.box, cost: score(c) }))
    .sort((a, b) => a.cost - b.cost)
    .map((c) => c.box);
  if (ranked.length === 0) {
    // Last resort (tiny views such as the inset): any on-screen position, but
    // never over map chrome or with a leader through it.
    const fallback = candidates.find(
      (c) => onScreen(c.box) && !chrome.some((o) => overlaps(c.box, o) || segmentHits(anchor, nearestOn(c.box, anchor), o)),
    );
    if (fallback) ranked.push(fallback.box);
    else if (chrome.length === 0) ranked.push(candidates[0].box);
  }
  return ranked.map((b) => {
    const x0 = clamp(b.x0, m, Math.max(m, viewport.width - m - width));
    const y0 = clamp(b.y0, m, Math.max(m, viewport.height - m - h));
    return { x0, y0, x1: x0 + width, y1: y0 + h };
  });
}

// --- Screen-space overlay: labels, markers, route, hint area ----------------

/**
 * How far past its country's edge a callout may sit and still count as
 * "nearby" (px, leader length minus the country's half-size). Further out, on
 * a small map a label reads as belonging to whatever it sits on.
 */
const NEAR_BEYOND = 18;
/** Explored badge: a check in a small circle after the name (smaller in the inset's callouts). */
const BADGE = { r: 6, gap: 3 };
const COMPACT_BADGE = { r: 5, gap: 2 };
const INSET_BADGE = { r: 4.5, gap: 2 };
/** Traveller pin: tip at the capital, head above it. */
const PIN_BOX = { x0: -8, y0: -23, x1: 8, y1: 2 };

type TextMode = "all" | "noCallouts" | "callouts" | "none";

type MarkerText = { key: string; at: Point; below: boolean; text: string; x: number; y: number; anchor: "start" | "end"; dark: boolean; hidden?: boolean };

type Label = {
  id: CountryId;
  anchor: Point;
  text: string;
  /** Width of the text alone; `box` also includes the explored badge. */
  textWidth: number;
  explored: boolean;
  callout: Box | null;
  inline: boolean;
  box: Box | null;
  dx: number;
  dy: number;
  /** The traveller pin stands where the leader dot would be: the leader starts at its tip instead. */
  pinAnchored: boolean;
};

interface LayoutInput {
  map: RegionMapData;
  /** The lesson's countries (the rest are faded context). */
  active: readonly CountryId[];
  view: MapView;
  /** Route line in projected world coordinates. */
  route: Point[];
  transform: Transform;
  viewport: { width: number; height: number };
  /**
   * Which names to draw: "all"; "noCallouts" (all but small countries, whose
   * names the open inset shows instead); "callouts" (only those, in the inset);
   * or "none".
   */
  textMode: TextMode;
  /** Screen areas labels must stay clear of (map controls, inset). */
  obstacles: Box[];
  /** Projected area shown in the magnified inset, outlined on the main map. */
  insetArea: Bounds | null;
  l: (text: LocalizedText) => string;
  name: (id: CountryId) => string;
}

interface OverlayLayout {
  route: Point[];
  /** Hint circle: `fit` is the radius that suits the country at this zoom, before the limits (34px, `cap`). */
  area: { cx: number; cy: number; r: number; fit: number; cap: number } | null;
  insetRect: Box | null;
  markers: { kind: MapMarker["kind"]; country: CountryId; x: number; y: number }[];
  markerTexts: MarkerText[];
  labels: Label[];
  labelFont: number;
  markerFont: number;
  calloutHeight: number;
  badge: { r: number; gap: number };
  /** Small countries whose callout found no nearby, clear position. */
  crowded: CountryId[];
}

/**
 * Places everything drawn over the map in screen space. Pure apart from text
 * measuring, so the map can also ask how the base view would look (see
 * RegionMap: a crowded Luxembourg label moves into the close-up).
 */
function layoutOverlay({ map, active, view, route: routeWorld, transform, viewport, textMode, obstacles, insetArea, l, name }: LayoutInput): OverlayLayout {
  const showText = textMode === "all" || textMode === "noCallouts";
  const toScreen = (p: Point) => applyTransform(transform, p);
  const toWorld = ([x, y]: Point): Point => [(x - transform.x) / transform.k, (y - transform.y) / transform.k];
  const shapeById = (id: CountryId) => map.shapes.find((s) => s.id === id) as CountryShape;
  /** Whether the screen point lies on a dark (teal) country, where text is white. */
  const onDark = (p: Point) =>
    Object.entries(view.tones).some(([id, tone]) => tone !== undefined && DARK_TONES.has(tone) && insideShape(shapeById(id as CountryId), toWorld(p)));

  const route = routeWorld.map(toScreen);

  // Hint circle around the country's interior label point, sized from its area and
  // capped so large countries (France incl. Corsica) still get a helpful, local circle.
  let area: OverlayLayout["area"] = null;
  if (view.areaHint) {
    const [[x0, y0], [x1, y1]] = shapeById(view.areaHint).bounds as Bounds;
    const [cx, cy] = toScreen(map.project(getCountry(view.areaHint).label.coordinates));
    const size = Math.sqrt((x1 - x0) * (y1 - y0)) * transform.k;
    const cap = Math.max(34, Math.min(viewport.width, viewport.height) * 0.3);
    area = { cx, cy, r: Math.min(Math.max(34, size * 0.55), cap), fit: size * 0.55, cap };
  }

  let insetRect: Box | null = null;
  if (insetArea) {
    const [a, b] = [toScreen(insetArea[0]), toScreen(insetArea[1])];
    insetRect = { x0: a[0], y0: a[1], x1: b[0], y1: b[1] };
  }

  const capitalMarker = view.markers.find((m) => m.kind === "capital");
  const capitalPoint = capitalMarker ? toScreen(map.project(capitalMarker.coordinates)) : null;

  // Layout order: country labels, then marker names beside them, then small-country callouts.
  const markerTexts: MarkerText[] = [];
  const markerPoints: Box[] = [];
  const markers: OverlayLayout["markers"] = [];
  for (const m of view.markers) {
    const [x, y] = toScreen(map.project(m.coordinates));
    const country = getCountry(m.country);
    // Keep the landmark pin only when it doesn't sit on top of the capital marker.
    if (m.kind === "landmark" && capitalPoint && Math.hypot(capitalPoint[0] - x, capitalPoint[1] - y) < 16) continue;
    markers.push({ kind: m.kind, country: m.country, x, y });
    // The traveller pin stands above its capital; names keep clear of all of it.
    // Head and tip are separate boxes, so a leader line starting beside the tip
    // (Luxembourg's) may leave it but never cross the head.
    if (m.kind === "current") {
      markerPoints.push({ x0: x + PIN_BOX.x0, y0: y + PIN_BOX.y0, x1: x + PIN_BOX.x1, y1: y - 7 });
      markerPoints.push({ x0: x - 4, y0: y - 7, x1: x + 4, y1: y + PIN_BOX.y1 });
    } else {
      markerPoints.push({ x0: x - 9, y0: y - 9, x1: x + 9, y1: y + 9 });
    }
    if (!showText) continue;
    if (m.kind === "capital")
      markerTexts.push({ key: `capital-text-${m.country}`, at: [x, y], below: false, text: l(country.capital.name), x, y, anchor: "start", dark: false });
    if (m.kind === "landmark" && country.landmark)
      markerTexts.push({ key: `landmark-text-${m.country}`, at: [x, y], below: true, text: l(country.landmark.name), x, y, anchor: "start", dark: false });
  }

  const taken: Box[] = [];
  const compact = viewport.width < COMPACT_MAP_WIDTH;
  const labelFont = textMode === "callouts" ? INSET_LABEL_FONT_PX : compact ? COMPACT_LABEL_FONT_PX : LABEL_FONT_PX;
  const markerFont = compact ? COMPACT_MARKER_FONT_PX : MARKER_FONT_PX;
  const calloutHeight = textMode === "callouts" ? INSET_CALLOUT_HEIGHT : compact ? COMPACT_CALLOUT_HEIGHT : CALLOUT_HEIGHT;
  // Half the height of a name's box: the glyphs plus room for Armenian's taller ascenders and descenders.
  const labelHalf = labelFont / 2 + 4;
  const badge = textMode === "callouts" ? INSET_BADGE : compact ? COMPACT_BADGE : BADGE;
  // +1: the badge's white outline reaches just past its circle.
  const badgeExtra = badge.gap + 2 * badge.r + 1;

  const explored = new Set(view.explored);
  const labels: Label[] = (textMode === "none" ? [] : view.labels)
    .filter((id) => (textMode === "callouts" ? getCountry(id).label.small : textMode === "noCallouts" ? !getCountry(id).label.small : true))
    .map((id) => {
      const c = getCountry(id);
      const text = name(id);
      return {
        id,
        anchor: toScreen(map.project(c.label.coordinates)),
        text,
        textWidth: textWidth(text, labelFont),
        explored: explored.has(id),
        callout: null,
        inline: true,
        box: null,
        dx: 0,
        dy: 0,
        pinAnchored: false,
      };
    });
  /** Name plus its explored badge: collisions always include the badge. */
  const fullWidth = (label: Label) => label.textWidth + (label.explored ? badgeExtra : 0);
  const onScreen = (b: Box) => b.x0 >= 2 && b.y0 >= 2 && b.x1 <= viewport.width - 2 && b.y1 <= viewport.height - 2;
  const labelBox = (label: Label, dx: number, dy: number): Box => {
    const w = fullWidth(label);
    const [ax, ay] = label.anchor;
    return { x0: ax + dx - w / 2, y0: ay + dy - labelHalf, x1: ax + dx + w / 2, y1: ay + dy + labelHalf };
  };
  /**
   * Nearest position for a country name that satisfies `ok`, trying small moves
   * first. Moved names stay inside their own country, so a name never drifts
   * onto a neighbour. With `wide`, when nothing near the label point fits (it
   * may be hidden under the close-up or the controls, or panned off screen), the
   * whole visible part of the country is searched, nearest to the label point
   * first. Null when nothing fits.
   */
  const labelSpot = (label: Label, ok: (b: Box) => boolean, wide = false): Point | null => {
    const w = fullWidth(label);
    const step = labelHalf * 2;
    const shape = shapeById(label.id);
    const [ax, ay] = label.anchor;
    const offsets: Point[] = [];
    // Quarter-width and half-height steps, up to one width sideways and four heights up or down.
    for (let i = -8; i <= 8; i++) for (let j = -4; j <= 4; j++) offsets.push([(j * w) / 4, (i * step) / 2]);
    offsets.sort((a, b) => Math.hypot(a[0], a[1] * 1.5) - Math.hypot(b[0], b[1] * 1.5));
    const near = offsets.find(
      ([dx, dy]) => ok(labelBox(label, dx, dy)) && ((dx === 0 && dy === 0) || insideShape(shape, toWorld([ax + dx, ay + dy]))),
    );
    if (near || !wide) return near ?? null;
    // The visible part of the country, on a grid of half-line steps. The whole
    // name (both ends and its middle) must lie inside the country.
    const [c0, c1] = [toScreen(shape.bounds[0]), toScreen(shape.bounds[1])];
    const x0 = Math.max(c0[0], w / 2 + 2);
    const x1 = Math.min(c1[0], viewport.width - w / 2 - 2);
    const y0 = Math.max(c0[1], labelHalf + 2);
    const y1 = Math.min(c1[1], viewport.height - labelHalf - 2);
    const spots: Point[] = [];
    for (let x = x0; x <= x1; x += step / 2) for (let y = y0; y <= y1; y += step / 2) spots.push([x - ax, y - ay]);
    spots.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
    const inside = ([dx, dy]: Point) =>
      [-w / 2 + 2, 0, w / 2 - 2].every((ex) => insideShape(shape, toWorld([ax + dx + ex, ay + dy])));
    return spots.find((d) => ok(labelBox(label, d[0], d[1])) && inside(d)) ?? null;
  };

  // Country names sit at their label point. One that would be hidden by the map
  // controls or the inset, or would run into a marker or an earlier name, moves
  // to the nearest free spot inside its own country.
  const labelAvoid = [...obstacles, ...markerPoints];
  const leaderZones: Box[] = [];
  for (const label of labels) {
    if (!getCountry(label.id).label.small) continue;
    const [[x0, y0], [x1, y1]] = shapeById(label.id).bounds;
    const sw = (x1 - x0) * transform.k;
    const sh = (y1 - y0) * transform.k;
    // Once zoom makes the country wide enough, its name fits inside it.
    label.inline = sw >= fullWidth(label) + 16 && sh >= 28;
    // Otherwise it gets a callout, and other names keep clear of its leader dot
    // so the leader line can leave in any direction.
    if (!label.inline) {
      const [ax, ay] = label.anchor;
      leaderZones.push({ x0: ax - 12, y0: ay - 12, x1: ax + 12, y1: ay + 12 });
    }
  }
  labelAvoid.push(...leaderZones);
  // Smallest countries first: their names have the least room to move, so larger
  // countries' names make way for them rather than the other way round.
  const screenArea = (id: CountryId) => {
    const [[x0, y0], [x1, y1]] = shapeById(id).bounds;
    return (x1 - x0) * (y1 - y0);
  };
  for (const label of [...labels].sort((a, b) => screenArea(a.id) - screenArea(b.id))) {
    if (!label.inline) continue;
    const spot = labelSpot(label, (b) => onScreen(b) && ![...labelAvoid, ...taken].some((o) => overlaps(b, o)), true);
    const [ax, ay] = label.anchor;
    if (!spot && ax >= 0 && ay >= 0 && ax <= viewport.width && ay <= viewport.height) {
      // No room inside its own country (e.g. Belgium, next to Brussels, on a
      // 320px map): the name goes in a callout beside it, like Luxembourg's.
      label.inline = false;
      continue;
    }
    if (!spot && obstacles.some((o) => overlaps(labelBox(label, 0, 0), o))) {
      // Its label point is off screen, nothing in its visible part fits, and at
      // the label point it would sit under the map controls: left out until the
      // view changes (no callout either, as it would point off screen).
      label.inline = false;
      continue;
    }
    if (spot) [label.dx, label.dy] = spot;
    label.box = labelBox(label, label.dx, label.dy);
    taken.push(label.box);
  }

  // Callouts: country names that need one (small countries, or names with no
  // room inside their country). They go before capital and landmark names, which
  // then fit around them. Markers (capitals, landmarks, the traveller) and the
  // map controls are never covered or crossed; country labels are avoided when
  // there is room.
  const hard: Box[] = [...obstacles, ...markerPoints];
  const visible = ([x, y]: Point) => x >= 0 && y >= 0 && x <= viewport.width && y <= viewport.height;
  const leaders: [Point, Point][] = [];
  const crowded: CountryId[] = [];
  // Smallest countries first, as for inline names: Luxembourg has fewest options.
  for (const label of [...labels].sort((a, b) => screenArea(a.id) - screenArea(b.id))) {
    if (label.inline) continue;
    // A callout for a country panned out of view, or whose dot is hidden under
    // the close-up or the map controls, would point at nothing.
    if (!visible(label.anchor) || obstacles.some((o) => inBox(label.anchor, o))) continue;
    // The traveller's pin would cover this callout's dot (Luxembourg while the
    // traveller is there): the leader starts at the pin's tip, at the real capital.
    const pin = markers.find((m) => m.kind === "current" && m.country === label.id);
    if (pin) {
      const [ax, ay] = label.anchor;
      if (ax >= pin.x + PIN_BOX.x0 - 3 && ax <= pin.x + PIN_BOX.x1 + 3 && ay >= pin.y + PIN_BOX.y0 - 3 && ay <= pin.y + PIN_BOX.y1 + 3) {
        label.anchor = [pin.x, pin.y];
        label.pinAnchored = true;
      }
    }
    const [[x0, y0], [x1, y1]] = shapeById(label.id).bounds;
    const reach = (Math.max(x1 - x0, y1 - y0) * transform.k) / 2;
    const width = fullWidth(label) + 2 * (textMode === "callouts" ? INSET_CALLOUT_PAD_X : CALLOUT_PAD_X);
    // In the inset the country is large, and its name must not hide it.
    const own: Box[] = [];
    if (textMode === "callouts") {
      const [p0, p1] = [toScreen([x0, y0]), toScreen([x1, y1])];
      own.push({ x0: p0[0] + 4, y0: p0[1] + 4, x1: p1[0] - 4, y1: p1[1] - 4 });
    }
    // Try the callout positions best first: nearby ones (short leader) before
    // distant ones. Country names that a position covers, or that its leader
    // line crosses, move to the nearest free spot inside their own country. The
    // first position that leaves every name clear wins; failing that, the one
    // that leaves the fewest names in the way.
    // Share of a callout over other lesson countries, sampled on a 5×3 grid.
    const others = map.shapes.filter((sh) => sh.id !== label.id && active.includes(sh.id));
    const depth = (b: Box) => {
      let over = 0;
      for (let i = 0; i < 5; i++)
        for (let j = 0; j < 3; j++) {
          const pt = toWorld([b.x0 + ((b.x1 - b.x0) * (i + 0.5)) / 5, b.y0 + ((b.y1 - b.y0) * (j + 0.5)) / 3]);
          if (others.some((sh) => insideShape(sh, pt))) over++;
        }
      return over / 15;
    };
    const [ax0, ay0] = label.anchor;
    const otherDots = leaderZones.filter((z) => !(ax0 >= z.x0 && ax0 <= z.x1 && ay0 >= z.y0 && ay0 <= z.y1));
    const candidates = calloutCandidates(label.anchor, reach, width, calloutHeight, viewport, [...hard, ...own, ...otherDots], taken, depth, obstacles);
    // Nowhere clear of the map controls and the close-up: no callout.
    if (candidates.length === 0) {
      crowded.push(label.id);
      continue;
    }
    const leaderOf = (b: Box) => Math.hypot(...(nearestOn(b, label.anchor).map((v, i) => v - label.anchor[i]) as [number, number]));
    const isNear = (b: Box) => leaderOf(b) <= reach + NEAR_BEYOND;
    const near = candidates.filter(isNear);
    const far = candidates.filter((b) => !isNear(b));
    let best: { callout: Box; moves: Map<Label, Point>; left: number; near: boolean } | null = null;
    for (const callout of [...near, ...far]) {
      const lines = [...leaders, [label.anchor, nearestOn(callout, label.anchor)] as [Point, Point]];
      const crossed = (b: Box) => lines.some(([a, e]) => segmentHits(a, e, b));
      const boxes = new Map(labels.filter((o) => o.box).map((o) => [o, o.box as Box]));
      const moves = new Map<Label, Point>();
      let left = 0;
      for (const [other, box] of boxes) {
        if (!(overlaps(box, callout) || crossed(box))) continue;
        const others = [...hard, callout, ...[...boxes].filter(([o]) => o !== other).map(([, b]) => b)];
        const spot = labelSpot(other, (b) => onScreen(b) && !crossed(b) && !others.some((o) => overlaps(b, o)));
        if (spot) {
          moves.set(other, spot);
          boxes.set(other, labelBox(other, spot[0], spot[1]));
        } else left++;
      }
      if (!best || left < best.left) best = { callout, moves, left, near: isNear(callout) };
      if (left === 0) break;
    }
    if (!best) continue;
    if (!best.near || best.left > 0) crowded.push(label.id);
    // No clear position anywhere (e.g. the close-up closed on a crowded 320px map):
    // leave the name out rather than print it over another. Opening the close-up
    // or zooming in brings it back.
    if (best.left > 0) continue;
    label.callout = best.callout;
    hard.push(best.callout);
    leaders.push([label.anchor, nearestOn(best.callout, label.anchor)]);
    for (const [other, [dx, dy]] of best.moves) {
      [other.dx, other.dy] = [dx, dy];
      other.box = labelBox(other, dx, dy);
    }
  }

  // Marker names go beside their marker (preferred side first), on the first side
  // that stays on screen and clear of country names, callouts, leader lines and
  // other marker names.
  const markerTextBoxes: Box[] = [];
  const callouts = labels.flatMap((o) => (o.callout ? [o.callout] : []));
  const crossesLeader = (b: Box) => leaders.some(([a, e]) => segmentHits(a, e, b));
  for (const m of markerTexts) {
    const [x, y] = m.at;
    const w = textWidth(m.text, markerFont, MARKER_WEIGHT);
    const up = y - 8;
    const down = y + 18;
    const sides: [number, number, "start" | "end"][] = [
      [x + 9, m.below ? down : up, "start"],
      [x + 9, m.below ? up : down, "start"],
      [x - 9, m.below ? down : up, "end"],
      [x - 9, m.below ? up : down, "end"],
      // A little further from the marker, when every close side is taken.
      [x + 9, up - 6, "start"],
      [x - 9, up - 6, "end"],
      [x + 9, down + 6, "start"],
      [x - 9, down + 6, "end"],
      [x + 16, up - 6, "start"],
      [x - 16, up - 6, "end"],
      [x + 16, down + 6, "start"],
      [x - 16, down + 6, "end"],
    ];
    const boxOf = ([tx, ty, anchor]: [number, number, "start" | "end"]): Box => {
      const x0 = anchor === "start" ? tx : tx - w;
      return { x0, y0: ty - markerFont - 2, x1: x0 + w, y1: ty + 5 };
    };
    const fits = (b: Box) => b.x0 >= 0 && b.x1 <= viewport.width && b.y0 >= 0 && b.y1 <= viewport.height;
    // Marker names also keep clear of small countries' leader dots (see above).
    const free = (b: Box) =>
      fits(b) && !crossesLeader(b) && ![...taken, ...callouts, ...markerTextBoxes, ...obstacles, ...leaderZones].some((o) => overlaps(b, o));
    let side = sides.find((c) => free(boxOf(c)));
    if (!side) {
      // No free side (e.g. Amsterdam or Luxembourg City on a small map): take the
      // first side whose covered country names can all move to a free spot inside
      // their own country, and move them.
      for (const c of sides) {
        const b = boxOf(c);
        if (!fits(b) || crossesLeader(b) || [...callouts, ...markerTextBoxes, ...obstacles, ...leaderZones].some((o) => overlaps(b, o))) continue;
        const moves = new Map<Label, Point>();
        const placed = (o: Label) => (moves.has(o) ? labelBox(o, ...(moves.get(o) as Point)) : (o.box as Box));
        const movable = labels.every((label) => {
          if (!label.box || !overlaps(label.box, b)) return true;
          const others = [...labelAvoid, ...callouts, ...markerTextBoxes, b, ...labels.filter((o) => o !== label && o.box).map(placed)];
          const spot = labelSpot(label, (lb) => onScreen(lb) && !crossesLeader(lb) && !others.some((o) => overlaps(lb, o)));
          if (spot) moves.set(label, spot);
          return spot !== null;
        });
        if (!movable) continue;
        for (const [label, [dx, dy]] of moves) {
          const old = label.box as Box;
          [label.dx, label.dy] = [dx, dy];
          label.box = labelBox(label, dx, dy);
          taken.splice(taken.indexOf(old), 1, label.box);
        }
        side = c;
        break;
      }
    }
    // Still no room (e.g. Brussels on a 320px map): leave the name out rather than
    // print it over a country name. The marker stays, and zooming in brings it back.
    if (!side) {
      m.hidden = true;
      continue;
    }
    [m.x, m.y, m.anchor] = side;
    const b = boxOf(side);
    markerTextBoxes.push(b);
    m.dark = onDark([(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]);
  }

  return { route, area, insetRect, markers, markerTexts, labels, labelFont, markerFont, calloutHeight, badge, crowded };
}

/** Open space kept around names and callouts, and around Luxembourg, free of scenery. */
const SCENERY_CLEARANCE = { text: 6, marker: 4, small: 12 };

/**
 * Screen areas the scenery keeps clear of: every name (with its badge), callout,
 * leader line and marker, and small countries (Luxembourg) with a margin.
 * Scenery gives way; names never move for it.
 */
function sceneryClearance(map: RegionMapData, layout: OverlayLayout, transform: Transform): Box[] {
  const pad = (b: Box, p: number): Box => ({ x0: b.x0 - p, y0: b.y0 - p, x1: b.x1 + p, y1: b.y1 + p });
  const boxes: Box[] = [];
  for (const label of layout.labels) {
    if (label.box) boxes.push(pad(label.box, SCENERY_CLEARANCE.text));
    if (label.callout) {
      boxes.push(pad(label.callout, SCENERY_CLEARANCE.text));
      const [ax, ay] = label.anchor;
      const [ex, ey] = nearestOn(label.callout, label.anchor);
      boxes.push(pad({ x0: Math.min(ax, ex), y0: Math.min(ay, ey), x1: Math.max(ax, ex), y1: Math.max(ay, ey) }, SCENERY_CLEARANCE.marker + 2));
    }
    if (getCountry(label.id).label.small) {
      const [[x0, y0], [x1, y1]] = map.shapes.find((s) => s.id === label.id)!.bounds;
      boxes.push(pad({ x0: x0 * transform.k + transform.x, y0: y0 * transform.k + transform.y, x1: x1 * transform.k + transform.x, y1: y1 * transform.k + transform.y }, SCENERY_CLEARANCE.small));
    }
  }
  for (const m of layout.markers) {
    const b = m.kind === "current" ? { x0: m.x + PIN_BOX.x0, y0: m.y + PIN_BOX.y0, x1: m.x + PIN_BOX.x1, y1: m.y + PIN_BOX.y1 } : { x0: m.x - 7, y0: m.y - 7, x1: m.x + 7, y1: m.y + 7 };
    boxes.push(pad(b, SCENERY_CLEARANCE.marker));
  }
  for (const m of layout.markerTexts) {
    if (m.hidden) continue;
    const w = textWidth(m.text, layout.markerFont, MARKER_WEIGHT);
    const x0 = m.anchor === "start" ? m.x : m.x - w;
    boxes.push(pad({ x0, y0: m.y - layout.markerFont, x1: x0 + w, y1: m.y + layout.markerFont * 0.35 }, SCENERY_CLEARANCE.marker));
  }
  if (layout.insetRect) boxes.push(pad(layout.insetRect, 2));
  return boxes;
}

/** Explored badge: a check mark in a circle, drawn after a country's name. */
function ExploredBadge({ cx, cy, r, onDark }: { cx: number; cy: number; r: number; onDark: boolean }) {
  return (
    <g className={`${styles.badge} ${onDark ? styles.badgeOnDark : ""}`} transform={`translate(${cx},${cy}) scale(${r / BADGE.r})`} data-explored-badge="">
      <circle r={BADGE.r} />
      <path d="M-2.8 0.2l1.9 1.9 3.8-4" />
    </g>
  );
}

/**
 * Motion for the latest change only: set when the route grows by one move
 * (the new segment draws itself, then the traveller lands), and when the
 * journey arrives (the whole route glows once). Nothing replays after a
 * refresh or a language switch, because those don't change the route.
 */
interface RouteMotion {
  /** Index in the route of the country the newest segment starts from, or null. */
  grewFrom: number | null;
  /** Changes with every route change, restarting the traveller's landing. */
  seq: number;
  /** Set to `seq` when the journey just arrived. */
  arrivedSeq: number | null;
}

interface OverlayProps extends Omit<LayoutInput, "l" | "name"> {
  motion?: RouteMotion;
  /** Layout already computed by the caller for these same inputs. */
  layout?: OverlayLayout;
}

/**
 * A layout moved from the view it was made for to another view, without placing
 * anything again: every route point, marker and name anchor goes to its new
 * screen position, and names, callouts and marker names keep their offset from
 * their anchor and their size. Used during a gesture, so names stay on their
 * countries; the layout is made again once the view settles.
 */
function followView(layout: OverlayLayout, from: Transform, to: Transform): OverlayLayout {
  if (from.k === to.k && from.x === to.x && from.y === to.y) return layout;
  const s = to.k / from.k;
  const at = ([x, y]: Point): Point => [(x - from.x) * s + to.x, (y - from.y) * s + to.y];
  const shift = (b: Box, [dx, dy]: Point): Box => ({ x0: b.x0 + dx, y0: b.y0 + dy, x1: b.x1 + dx, y1: b.y1 + dy });
  const moved = (p: Point, q: Point): Point => [q[0] - p[0], q[1] - p[1]];
  let area = layout.area;
  if (area) {
    const [cx, cy] = at([area.cx, area.cy]);
    area = { ...area, cx, cy, r: Math.min(Math.max(34, area.fit * s), area.cap), fit: area.fit * s };
  }
  let insetRect = layout.insetRect;
  if (insetRect) {
    const [[x0, y0], [x1, y1]] = [at([insetRect.x0, insetRect.y0]), at([insetRect.x1, insetRect.y1])];
    insetRect = { x0, y0, x1, y1 };
  }
  return {
    ...layout,
    route: layout.route.map(at),
    area,
    insetRect,
    markers: layout.markers.map((m) => {
      const [x, y] = at([m.x, m.y]);
      return { ...m, x, y };
    }),
    markerTexts: layout.markerTexts.map((m) => {
      const a = at(m.at);
      const [dx, dy] = moved(m.at, a);
      return { ...m, at: a, x: m.x + dx, y: m.y + dy };
    }),
    labels: layout.labels.map((label) => {
      const a = at(label.anchor);
      const d = moved(label.anchor, a);
      return { ...label, anchor: a, box: label.box && shift(label.box, d), callout: label.callout && shift(label.callout, d) };
    }),
  };
}

/** The main map's overlay, following the live view during a gesture (see followView). */
function LiveOverlay({ live, layout, ...props }: OverlayProps & { live: LiveView; layout: OverlayLayout }) {
  const view = useSyncExternalStore(live.subscribe, live.get, live.get);
  const followed = useMemo(() => followView(layout, props.transform, view), [layout, props.transform, view]);
  return <Overlay {...props} layout={followed} />;
}

function Overlay({ motion, layout: given, ...input }: OverlayProps) {
  const { l, name } = useI18n();
  const maskId = useId();
  const layout = given ?? layoutOverlay({ ...input, l, name });
  const { view } = input;
  const { route, labels, labelFont, markerFont, calloutHeight, badge } = layout;

  // The newest move (capital → border crossing → capital) is drawn separately and revealed along its path.
  const growing = motion?.grewFrom != null && route.length >= 2 * motion.grewFrom + 3;
  const split = growing ? 2 * (motion?.grewFrom as number) : route.length - 1;
  const settled = route.slice(0, split + 1);
  const fresh = growing ? route.slice(split, split + 3) : [];
  const points = (pts: Point[]) => pts.map((p) => p.join(",")).join(" ");

  return (
    <g className={styles.overlay} aria-hidden="true">
      {layout.insetRect && (
        <rect
          className={styles.insetArea}
          data-testid="inset-area"
          x={layout.insetRect.x0}
          y={layout.insetRect.y0}
          width={layout.insetRect.x1 - layout.insetRect.x0}
          height={layout.insetRect.y1 - layout.insetRect.y0}
          rx={3}
        />
      )}

      {layout.area && <circle className={styles.areaHint} cx={layout.area.cx} cy={layout.area.cy} r={layout.area.r} />}

      {route.length > 1 && (
        <g data-testid="route-line" data-route={view.route.join(",")} data-points={route.length}>
          {motion?.arrivedSeq != null && (
            <polyline key={`glow-${motion.arrivedSeq}`} className={styles.routeGlow} points={points(route)} data-route-glow="" />
          )}
          {settled.length > 1 && <polyline className={styles.route} points={points(settled)} />}
          {fresh.length > 1 && (
            <>
              <mask id={maskId} maskUnits="userSpaceOnUse">
                <polyline key={`reveal-${motion?.seq}`} className={styles.routeReveal} points={points(fresh)} pathLength={1} />
              </mask>
              <polyline className={styles.route} points={points(fresh)} mask={`url(#${maskId})`} data-route-new="" />
            </>
          )}
        </g>
      )}

      {layout.markers.map((m) => {
        if (m.kind === "capital")
          return (
            <g key={`capital-${m.country}`} transform={`translate(${m.x},${m.y})`}>
              <circle className={styles.capital} r={5.5} />
              <circle className={styles.capitalDot} r={2.8} />
            </g>
          );
        if (m.kind === "landmark")
          return (
            <g key={`landmark-${m.country}`} transform={`translate(${m.x},${m.y})`}>
              <rect className={styles.landmark} x={-4.5} y={-4.5} width={9} height={9} rx={1.5} transform="rotate(45)" />
            </g>
          );
        // The traveller: a navy pin standing on the capital, unlike the round capital marker.
        return (
          <g key={`traveller-${motion?.seq ?? 0}`} transform={`translate(${m.x},${m.y})`} data-traveller={m.country}>
            <g className={growing ? styles.pinLanding : undefined}>
              <ellipse className={styles.pinShadow} rx={4.5} ry={1.8} />
              <path className={styles.pin} d="M0 0C-1.6-4.6-7.5-8.5-7.5-14.5a7.5 7.5 0 1 1 15 0C7.5-8.5 1.6-4.6 0 0z" />
              <circle className={styles.pinDot} cy={-14.5} r={2.9} />
            </g>
          </g>
        );
      })}

      {layout.markerTexts
        .filter((m) => !m.hidden)
        .map((m) => (
          <text
            key={m.key}
            className={`${styles.markerText} ${m.dark ? styles.labelOnDark : ""}`}
            x={m.x}
            y={m.y}
            fontSize={markerFont}
            textAnchor={m.anchor}
            data-marker-text=""
          >
            {m.text}
          </text>
        ))}

      {labels.map((label) => {
        const { id, anchor, text, callout, inline, dx, dy, explored } = label;
        const [ax, ay] = anchor;
        const tone = view.tones[id];
        const dark = tone !== undefined && DARK_TONES.has(tone);
        const toneClass = tone === "destination" ? styles.labelDestination : "";
        if (!inline && !callout) return null;
        // With a badge, the name shifts left so name and badge together stay centred.
        const shift = explored ? (badge.gap + 2 * badge.r) / 2 : 0;
        if (!callout) {
          const cx = ax + dx;
          return (
            <g key={`label-${id}`} data-label={id}>
              <text
                className={`${styles.label} ${toneClass} ${dark ? styles.labelOnDark : ""}`}
                x={cx - shift}
                y={ay + dy}
                fontSize={labelFont}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {text}
              </text>
              {explored && <ExploredBadge cx={cx - shift + label.textWidth / 2 + badge.gap + badge.r} cy={ay + dy} r={badge.r} onDark={dark} />}
            </g>
          );
        }
        const ex = clamp(ax, callout.x0, callout.x1);
        const ey = clamp(ay, callout.y0, callout.y1);
        const mid = (callout.x0 + callout.x1) / 2 - shift;
        return (
          <g key={`label-${id}`} data-callout={id} data-label={id}>
            <line className={styles.leader} x1={ax} y1={ay} x2={ex} y2={ey} />
            {/* With the traveller on it, the pin replaces the dot. While the pin is
                still landing, the dot shows until it arrives. */}
            {!label.pinAnchored ? (
              <circle className={styles.leaderDot} cx={ax} cy={ay} r={3.2} data-leader-dot="" />
            ) : (
              growing && <circle key={`handoff-${motion?.seq}`} className={`${styles.leaderDot} ${styles.leaderDotHandoff}`} cx={ax} cy={ay} r={3.2} />
            )}
            <rect
              className={styles.callout}
              x={callout.x0}
              y={callout.y0}
              width={callout.x1 - callout.x0}
              height={callout.y1 - callout.y0}
              rx={calloutHeight / 2}
            />
            <text className={`${styles.calloutText} ${toneClass}`} fontSize={labelFont} x={mid} y={(callout.y0 + callout.y1) / 2} textAnchor="middle" dominantBaseline="central">
              {text}
            </text>
            {explored && <ExploredBadge cx={mid + label.textWidth / 2 + badge.gap + badge.r} cy={(callout.y0 + callout.y1) / 2} r={badge.r} onDark={false} />}
          </g>
        );
      })}
    </g>
  );
}

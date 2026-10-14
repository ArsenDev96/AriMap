"use client";

import { Fragment, memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type RefObject } from "react";
import { flushSync } from "react-dom";
import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { getCountry } from "@/core/content/countries";
import type { CountryId } from "@/core/content/types";
import type { LocalizedText } from "@/core/i18n/locales";
import type { CountryTone, MapMarker, MapView } from "@/core/lesson/mapView";
import { versionKey } from "@/core/lessons";
import type { LessonDefinition } from "@/core/lessons/types";
import {
  applyTransform,
  fitTransform,
  maxMapWidth,
  projectBounds,
  regionMapFor,
  viewLimits,
  type Bounds,
  type CountryShape,
  type Point,
  type RegionMap as RegionMapData,
  type Transform,
} from "@/geo/regionMap";
import { routePoints, routeSettings } from "@/geo/route";
import { diagnostics, timed } from "../diagnostics";
import { useI18n } from "../i18n";
import { LandTexture, SeaTexture } from "./AtlasSurface";
import { AboutMap, ABOUT_BUTTON_EXTENT } from "./AboutMap";
import { insideShape } from "./insideShape";
import { textWidth } from "./textWidth";
import { createLiveView, gestureModeFor, placeLayer, type LiveView } from "./liveView";
import { Relief } from "./Relief";
import { Scenery } from "./Scenery";
import { useCountryTap } from "./useTap";
import styles from "./RegionMap.module.css";

const MAX_ZOOM = 8;
/** On smaller maps the inset would cover playable countries, so it starts collapsed. */
const INSET_AUTO_OPEN = { width: 600, height: 420 };
/**
 * The shortest map that is shown narrower rather than cropped (see maxMapWidth). A shorter one (a phone with
 * enlarged text, 112–150 px tall) would become too small to use: 163 px wide for Level 7 in Armenian at 200%
 * on a 320px phone, under its open close-up. It keeps its width, and its start view crops north and south.
 */
const MIN_CAPPED_HEIGHT = 300;
/** Inset layout (see CSS): 8px from the corner, 44px toggle and 6px gap (above it on wide maps), 2px frame; then the caption strip. */
const INSET_CHROME_HEIGHT = 8 + 44 + 6 + 4 + 8;
/** The caption strip's height at the usual text size; it is measured once shown (enlarged text makes it taller). */
const INSET_CAPTION_HEIGHT = 20;
const INSET_MIN_WIDTH = 88;
/** Area the collapsed close-up toggle covers in the top-left corner: 8px margin, 44px button, 4px clearance. */
const INSET_TOGGLE_EXTENT = 8 + 44 + 4;
/** Inset width before it shrinks to fit: at least 112px, 100px on narrow maps so it clears the Low Countries' names. */
const INSET_WIDTH = { min: 112, compactMin: 100, max: 208 };
/**
 * Dragging and zooming move a copy of the drawn landscape as one layer, which
 * the browser shifts and scales without drawing it again (see liveView.ts and
 * "The gesture copy" below). The map is drawn again for the new view once it
 * settles: when the gesture ends, after this pause (ms) in it, or at once if the
 * copy would no longer cover the view.
 */
const SETTLE_MS = 150;
/** The layer extends this share of the map's width and height past each edge, so a drag reveals map already drawn. */
const OVERSCAN = 0.3;
/**
 * The gesture copy stays in front this long (ms) after a gesture ends, so
 * gestures in quick succession (or a wheel that pauses) keep using it. Then the
 * map as drawn with the page shows again, exactly as at rest.
 */
const RELEASE_MS = 400;
/**
 * During a zoom the borders are drawn again for the live view once its scale
 * differs from theirs by more than this share, so they keep their width on
 * screen (within this share) instead of growing with the landscape. Not during an
 * animated zoom (the zoom buttons, reset): there they grow or thin with the
 * landscape for its 250 ms and are drawn again once, when it ends (or sooner if
 * their layer no longer covers the view). Drawing them again was most of the
 * GPU's work in that animation, nearly every frame, enough to stall it on slower
 * GPUs.
 */
const BORDER_RESCALE = 0.06;

/**
 * Runs `task` once the browser is idle, at least `after` ms from now (or after a
 * short delay where it can't tell); returns a cancel function.
 */
function whenIdle(task: () => void, after = 0): () => void {
  const canTell = typeof window.requestIdleCallback === "function";
  let idle = 0;
  const timer = setTimeout(
    () => {
      if (canTell) idle = window.requestIdleCallback(task, { timeout: 1000 });
      else task();
    },
    canTell ? after : Math.max(after, 200),
  );
  return () => {
    clearTimeout(timer);
    if (idle) window.cancelIdleCallback(idle);
  };
}
/** How long new colours wait before reaching the gesture copy, so the change itself is drawn first. */
const COPY_TONES_DELAY_MS = 300;

/** Whether two views are the same, to within half a pixel. */
const sameView = (a: Transform, b: Transform) => Math.abs(a.k / b.k - 1) < 1e-6 && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;

const svgTransform = ({ k, x, y }: Transform) => `translate(${x},${y}) scale(${k})`;
/** Draws the live borders for a view, strokes at their on-screen width for it (see .gestureLayer in the CSS). */
function drawBordersFor(group: SVGGElement, view: Transform) {
  group.setAttribute("transform", svgTransform(view));
  group.style.setProperty("--inv", String(1 / view.k));
}

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

/**
 * Ends the player's mouse drag of the map, if one is under way, as its release would have: d3-zoom ends
 * a mouse gesture on a mouseup at the window (the event table in its README). For a release the page
 * never saw (see useCountryTap); without one, d3-zoom would go on moving the map with the mouse.
 */
function endMouseDrag() {
  window.dispatchEvent(new MouseEvent("mouseup", { view: window }));
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function RegionMap({ lesson, view, stage, onCountryTap }: Props) {
  const { t, l, name, countryParams } = useI18n();
  const map = useMemo(() => regionMapFor(lesson), [lesson]);
  // Countries named in a callout until zoomed in (Level 1's Luxembourg, Level 7's Andorra); none in most levels.
  const small = useMemo(() => new Set(lesson.map.smallCountries ?? []), [lesson]);
  const twoLine = useMemo(() => new Set(lesson.map.twoLineCallouts ?? []), [lesson]);
  const clearRoute = lesson.map.calloutsClearRoute === true;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<SVGSVGElement>(null);
  const copyRef = useRef<SVGSVGElement>(null);
  const bordersRef = useRef<SVGSVGElement>(null);
  const bordersGroupRef = useRef<SVGGElement>(null);
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
  // Names, callouts and marker names are placed for this view too (see layoutOverlay);
  // during a gesture they follow the live view from it (see LiveOverlay).
  const [settledView, setSettledView] = useState<Transform>(transform);
  // Whether a gesture or zoom ended at the settled view, rather than pausing there (see Relief's useSettled).
  const [settledFinal, setSettledFinal] = useState(false);
  // The view the gesture copy is drawn for, and the live borders' (see "The gesture copy").
  // How the map moves in this browser (see gestureModeFor): with the gesture copy, or as itself.
  const [gestureMode] = useState(() => gestureModeFor(navigator.userAgent));
  const copyMode = gestureMode !== "layer";
  const [copyView, setCopyView] = useState<Transform>(transform);
  const copyViewRef = useRef(copyView);
  const bordersViewRef = useRef(transform);
  const syncCopyTonesRef = useRef(() => {});
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
  const tap = useCountryTap(tapHandler, endMouseDrag);
  // TEMPORARY phone-lag diagnostics (see diagnostics.ts): ?relief=off, ?labels=off. Both on without them.
  const { relief: showRelief, labels: showLabels } = diagnostics();

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

  // On a screen wider than the map can be shown with its countries whole (an ultra-wide desktop), the map
  // stops at that width, centred, with the page around it, rather than cropping the countries to fill it.
  // A map under MIN_CAPPED_HEIGHT keeps its full width (see maxMapWidth).
  const maxWidth = size.height >= MIN_CAPPED_HEIGHT ? Math.floor(maxMapWidth(map, size.height)) : undefined;
  const padding = Math.max(10, Math.min(size.width, size.height) * 0.04);
  // The pan limits, and the start view for the countries alone. The map is set up
  // (and set to its start view) again only when these change: with the map's size.
  const limits = useMemo(
    () => (size.width > 0 ? viewLimits(map, size.width, size.height, padding) : null),
    [map, size, padding],
  );
  // The start view ("Show the whole map"), with the markers drawn now kept whole: the
  // traveller's pin stands 23px above its capital, and Tallinn is on the coast at the
  // top of the map. Elsewhere the same as the countries' own.
  const marks = useMemo(() => view.markers.map((m) => ({ at: map.project(m.coordinates), extent: markerExtent(m.kind) })), [view.markers, map]);
  const start = useMemo(
    () => (size.width > 0 ? viewLimits(map, size.width, size.height, padding, marks) : null),
    [map, size, padding, marks],
  );
  const base = start?.base ?? null;
  // Read when the map is set up; changes after that are followed by the effect below it.
  const startRef = useRef(start);
  useLayoutEffect(() => {
    startRef.current = start;
  }, [start]);
  // The start view the camera was last set to, and whether the player is moving the map.
  const shownBaseRef = useRef<Transform | null>(null);
  const gestureRef = useRef(false);
  // A change of start view that waits for the player's gesture to end.
  const pendingRef = useRef<(() => void) | null>(null);
  const margin = useMemo(() => ({ x: Math.round(size.width * OVERSCAN), y: Math.round(size.height * OVERSCAN) }), [size]);
  // The map's size and data the camera was last set up for (see below).
  const setupRef = useRef<{ map: RegionMapData; width: number; height: number } | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const wrapper = wrapperRef.current;
    if (!stage || !wrapper || !limits) return;
    let latest = live.get();
    let frame = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;
    let release: ReturnType<typeof setTimeout> | undefined;
    let cancelRefresh = () => {};
    // True while the map is set to its first view: that is no gesture, and needs no copy in front.
    let quiet = false;
    // True during an animated zoom (the zoom buttons, reset, a new start view), as opposed to the player's gesture.
    let animated = false;
    // The live borders: moved with the view, and drawn again for it once its scale differs (see BORDER_RESCALE).
    const placeBorders = (view: Transform) => {
      const layer = bordersRef.current;
      const group = bordersGroupRef.current;
      if (!layer || !group) return;
      const drawn = bordersViewRef.current;
      if ((animated || Math.abs(view.k / drawn.k - 1) <= BORDER_RESCALE) && placeLayer(layer, drawn, view, size, margin)) return;
      bordersViewRef.current = view;
      drawBordersFor(group, view);
      layer.style.transform = "";
    };
    // Moves everything drawn to the live view without drawing it again; false when what shows (the copy, or
    // the map itself in "layer" mode) no longer covers it.
    const follow = (view: Transform) => {
      // With the copy, the map as drawn with the page is hidden during a gesture, but moves too, so taps find the country shown there.
      const mapCovers = placeLayer(worldRef.current, drawnRef.current, view, size, margin);
      if (!copyMode) return mapCovers;
      placeBorders(view);
      return placeLayer(copyRef.current, copyViewRef.current, view, size, margin);
    };
    // Draw the map for the live view; `stopped` when the player has stopped there (the gesture ended or paused),
    // `ended` when it ended. The copy is drawn again only when it must be (see "The gesture copy").
    const settle = (stopped: boolean, redrawCopy = false, ended = false) => {
      cancelAnimationFrame(frame);
      frame = 0;
      clearTimeout(idle);
      live.set(latest);
      const covers = follow(latest);
      setTransform(latest);
      if (stopped) {
        setSettledView(latest);
        setSettledFinal(ended);
      }
      if (copyMode && (redrawCopy || !covers)) setCopyView(latest);
    };
    // After a gesture: the map drawn with the page shows again, and once the
    // browser is idle the copy is drawn again for this view, ready for the next.
    const rest = () => {
      wrapper.removeAttribute("data-gesture");
      cancelRefresh();
      if (!copyMode) return;
      cancelRefresh = whenIdle(() => {
        const view = drawnRef.current;
        setCopyView((v) => (v.k === view.k && v.x === view.x && v.y === view.y ? v : view));
      });
    };
    const behavior = d3zoom<HTMLDivElement, unknown>()
      .extent([
        [0, 0],
        [size.width, size.height],
      ])
      // The base view is also the minimum zoom, so the view never extends past the data coverage.
      .scaleExtent([startRef.current?.minScale ?? limits.base.k, limits.base.k * MAX_ZOOM])
      .translateExtent(limits.translateExtent as [[number, number], [number, number]])
      .on("start", (event) => {
        if (event.sourceEvent) gestureRef.current = true;
        animated = !event.sourceEvent;
        clearTimeout(release);
        cancelRefresh();
        // Without the copy, the map becomes a layer from the press, so it is ready when it starts moving.
        if (!copyMode && !quiet) wrapper.setAttribute("data-gesture", "");
      })
      .on("zoom", (event) => {
        const { k, x, y } = event.transform;
        latest = { k, x, y };
        // The map starts moving (not on a press alone, so a tap still reaches the
        // country): the gesture copy (a layer now, if it wasn't kept as one) comes to the front (see CSS).
        if (copyMode && !quiet && !wrapper.hasAttribute("data-gesture")) {
          // New colours that haven't reached the copy yet (a tap just before) are
          // drawn into it now, before it shows: never a frame of the old ones.
          flushSync(() => syncCopyTonesRef.current());
          wrapper.setAttribute("data-gesture", "");
        }
        // The player is moving the map: no hover highlight until the gesture ends (see CSS).
        if (event.sourceEvent && !stage.hasAttribute("data-moving")) stage.setAttribute("data-moving", "");
        clearTimeout(idle);
        idle = setTimeout(() => settle(true), SETTLE_MS);
        // At most once per frame: move the copy and the names, without drawing the map again.
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          live.set(latest);
          if (!follow(latest)) settle(false, true);
        });
      })
      .on("end", () => {
        stage.removeAttribute("data-moving");
        // The borders are drawn for the view it ended at, if their scale differs from it (see BORDER_RESCALE).
        animated = false;
        // Not the first view: it keeps the landscape's wait, as the map's size may still change as the page lays out.
        settle(true, quiet, !quiet);
        clearTimeout(release);
        release = setTimeout(rest, RELEASE_MS);
        gestureRef.current = false;
        const pending = pendingRef.current;
        pendingRef.current = null;
        pending?.();
      });
    const selection = select(stage);
    selection.call(behavior).on("dblclick.zoom", null);
    // The first view: the start view; or, when the map is set up again for a new size (the phone turned, the
    // browser's bars shown or hidden, the window resized), the view the player chose, if they moved away from
    // the start view: the same place in its middle, zoomed as far past the start view as before.
    const startView = startRef.current?.base ?? limits.base;
    let first = startView;
    const before = setupRef.current;
    const shown = shownBaseRef.current;
    const was = live.get();
    if (before && before.map === map && shown && !sameView(was, shown)) {
      const k = Math.min(limits.base.k * MAX_ZOOM, Math.max(startRef.current?.minScale ?? limits.base.k, (startView.k * was.k) / shown.k));
      const [cx, cy] = [(before.width / 2 - was.x) / was.k, (before.height / 2 - was.y) / was.k];
      const kept = behavior.constrain()(
        zoomIdentity.translate(size.width / 2 - k * cx, size.height / 2 - k * cy).scale(k),
        [
          [0, 0],
          [size.width, size.height],
        ],
        limits.translateExtent as [[number, number], [number, number]],
      );
      first = { k: kept.k, x: kept.x, y: kept.y };
    }
    setupRef.current = { map, width: size.width, height: size.height };
    quiet = true;
    selection.call(behavior.transform, zoomIdentity.translate(first.x, first.y).scale(first.k));
    quiet = false;
    shownBaseRef.current = startView;
    zoomRef.current = behavior;
    return () => {
      gestureRef.current = false;
      pendingRef.current = null;
      selection.on(".zoom", null);
      cancelAnimationFrame(frame);
      clearTimeout(idle);
      clearTimeout(release);
      cancelRefresh();
      stage.removeAttribute("data-moving");
      wrapper.removeAttribute("data-gesture");
    };
  }, [limits, size, margin, live, copyMode, map]);

  // The start view changed with the markers (the traveller arrived in Tallinn, or
  // left it), not with the map's size. The minimum zoom follows. The camera moves to
  // the new start view only if it is still at the old one: never while the player
  // moves the map (the change waits for the gesture to end, and the map then stays
  // where they left it), nor away from a view they chose.
  const [baseK, baseX, baseY, minScale] = [base?.k, base?.x, base?.y, start?.minScale];
  useEffect(() => {
    const stage = stageRef.current;
    const behavior = zoomRef.current;
    if (!stage || !behavior || !limits || baseK === undefined || baseX === undefined || baseY === undefined || minScale === undefined) return;
    const next = { k: baseK, x: baseX, y: baseY };
    const apply = () => {
      const shown = shownBaseRef.current;
      behavior.scaleExtent([minScale, limits.base.k * MAX_ZOOM]);
      if (!shown || sameView(shown, next)) return;
      shownBaseRef.current = next;
      if (!sameView(live.get(), shown)) return;
      select(stage)
        .transition()
        .duration(prefersReducedMotion() ? 0 : 300)
        .call(behavior.transform, zoomIdentity.translate(next.x, next.y).scale(next.k));
    };
    if (gestureRef.current) pendingRef.current = apply;
    else apply();
  }, [baseK, baseX, baseY, minScale, limits, live]);

  // Once the map (or its copy) is drawn for a view, place it for the live view (usually the same).
  useLayoutEffect(() => {
    drawnRef.current = transform;
    placeLayer(worldRef.current, transform, live.get(), size, margin);
  }, [transform, live, size, margin, limits]);
  useLayoutEffect(() => {
    copyViewRef.current = copyView;
    placeLayer(copyRef.current, copyView, live.get(), size, margin);
  }, [copyView, live, size, margin, limits]);
  // The live borders start out drawn for the live view.
  useLayoutEffect(() => {
    const view = live.get();
    bordersViewRef.current = view;
    if (bordersGroupRef.current) drawBordersFor(bordersGroupRef.current, view);
    if (bordersRef.current) bordersRef.current.style.transform = "";
  }, [live, size, margin, limits]);

  const zoomBy = (factor: number) => {
    const stage = stageRef.current;
    if (!stage || !zoomRef.current) return;
    select(stage).transition().duration(prefersReducedMotion() ? 0 : 250).call(zoomRef.current.scaleBy, factor);
  };
  const resetZoom = () => {
    const stage = stageRef.current;
    if (!stage || !zoomRef.current || !base) return;
    shownBaseRef.current = base;
    select(stage)
      .transition()
      .duration(prefersReducedMotion() ? 0 : 300)
      .call(zoomRef.current.transform, zoomIdentity.translate(base.x, base.y).scale(base.k));
  };

  // Route line in projected world coordinates, shared by the main map and the inset.
  const { route, routeStops } = useMemo(() => {
    const { points, stops } = routePoints(view.route, routeSettings(lesson));
    return { route: points.map(map.project), routeStops: stops };
  }, [view.route, lesson, map]);

  const inset = lesson.map.inset;
  const insetBounds = useMemo(() => (inset ? projectBounds(map, inset.bounds) : null), [map, inset]);
  // The caption strip's height as drawn: taller with enlarged text, where its word may wrap. The tallest
  // seen for this map size, text size and language counts, so the panel's width (which the wrapping
  // follows) can't flip the layout back and forth.
  const [caption, setCaption] = useState<HTMLElement | null>(null);
  const [captionFit, setCaptionFit] = useState({ key: "", height: INSET_CAPTION_HEIGHT });
  useEffect(() => {
    if (!caption) return;
    const observer = new ResizeObserver(() => {
      const root = document.documentElement;
      const key = `${size.width}x${size.height}|${getComputedStyle(root).fontSize}|${root.lang}`;
      const height = Math.ceil(caption.offsetHeight);
      setCaptionFit((c) => (c.key !== key ? { key, height } : height > c.height ? { key, height } : c));
    });
    observer.observe(caption);
    return () => observer.disconnect();
  }, [caption, size.width, size.height]);
  const captionHeight = Math.max(INSET_CAPTION_HEIGHT, captionFit.height);
  const insetSize = useMemo(() => {
    if (!insetBounds || size.width === 0) return null;
    const [[x0, y0], [x1, y1]] = insetBounds;
    const aspect = (y1 - y0) / (x1 - x0);
    const min = size.width < COMPACT_MAP_WIDTH ? INSET_WIDTH.compactMin : INSET_WIDTH.min;
    let width = Math.round(Math.min(INSET_WIDTH.max, Math.max(min, size.width * 0.3)));
    // On short maps the panel shrinks so it always fits below its toggle.
    const room = size.height - INSET_CHROME_HEIGHT - captionHeight;
    if (width * aspect <= room) return { width, height: Math.round(width * aspect), beside: false };
    if (Math.floor(room / aspect) >= INSET_MIN_WIDTH) {
      width = Math.floor(room / aspect);
      return { width, height: Math.round(width * aspect), beside: false };
    }
    // Too short even at its smallest (enlarged text on a phone, which shortens the map and
    // makes the caption taller): the panel opens beside its toggle instead, using the map's
    // whole height. Before, it ran off the map's edge, under the panel below the map.
    const beside = size.height - 8 - 4 - captionHeight - 8;
    width = Math.max(INSET_MIN_WIDTH, Math.min(width, Math.floor(beside / aspect)));
    return { width, height: Math.round(width * aspect), beside: true };
  }, [insetBounds, size.width, size.height, captionHeight]);
  const insetTransform = useMemo(
    () => (insetBounds && insetSize ? fitTransform(insetBounds, insetSize.width, insetSize.height, 0) : null),
    [insetBounds, insetSize],
  );

  const ready = base !== null;
  const wideMap = size.width >= INSET_AUTO_OPEN.width && size.height >= INSET_AUTO_OPEN.height;
  // The close-up's corner: top-left on wide maps; on smaller ones bottom-left, opening
  // upwards, unless the level puts it top-left there too (Level 7, whose bottom-left
  // corner is Portugal).
  const insetTop = wideMap || inset?.smallMapCorner === "top-left";

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
    // The inset sits in a left-hand corner (see insetTop); its area runs to the map
    // edges it touches.
    if (insetBox) {
      const top = insetTop;
      boxes.push({ x0: 0, y0: top ? 0 : insetBox.y0 - 4, x1: insetBox.x1 + 4, y1: top ? insetBox.y1 + 4 : size.height });
    }
    return boxes;
  }, [size, insetBox, controlsBox, insetTop]);

  // Would Luxembourg's name (or another small country's) fit on the main map at
  // the whole-map view, in a nearby callout clear of names, markers and controls?
  // Asked with the close-up closed (only its toggle in the corner) on small maps.
  // Only names the view already shows count, so this never reveals an answer.
  const crowded = useMemo(() => {
    if (!base || size.width === 0 || !lesson.map.inset || !showLabels) return false;
    const toggle: Box = insetTop
      ? { x0: 0, y0: 0, x1: INSET_TOGGLE_EXTENT, y1: INSET_TOGGLE_EXTENT }
      : { x0: 0, y0: size.height - INSET_TOGGLE_EXTENT, x1: INSET_TOGGLE_EXTENT, y1: size.height };
    const closedObstacles = [...obstacles.filter((o) => o.x0 !== 0), toggle];
    const layout = layoutOverlay({
      map,
      active: lesson.countries,
      view,
      route,
      routeStops,
      small,
      twoLine,
      clearRoute,
      transform: base,
      viewport: size,
      textMode: "all",
      obstacles: wideMap ? obstacles : closedObstacles,
      insetArea: null,
      l,
      name,
    });
    return layout.crowded.length > 0;
  }, [base, size, lesson.map.inset, showLabels, lesson.countries, obstacles, wideMap, insetTop, map, view, route, routeStops, small, twoLine, clearRoute, l, name]);

  // No clear nearby spot in Discover: the close-up opens, with the name inside it.
  // It stays open for the rest of Discover, and never reopens once the player
  // closes it. Find answers and Travel moves never open it: there the name takes
  // the best clear spot on the main map, or is left out rather than overprinted.
  if (crowded && stage === "discover" && insetChoice === null && autoInsetStage !== stage) setAutoInsetStage(stage);
  const insetOpen = insetChoice ?? (wideMap || autoInsetStage === stage);
  // While the close-up is open on a small map (or the main map has no room), small
  // countries' names are drawn only in the close-up, where they are large.
  const calloutsInInset = insetOpen && (!wideMap || crowded);

  // Main-map overlay layout, shared with the scenery so it can keep clear of names
  // and markers. Made for the view the player stopped at: never mid-gesture, where
  // the names follow it instead (see LiveOverlay).
  const textMode: TextMode = !showLabels ? "none" : calloutsInInset ? "noCallouts" : "all";
  const mainInsetArea = insetOpen ? insetBounds : null;
  const mainLayout = useMemo(
    () =>
      ready
        ? layoutOverlay({ map, active: lesson.countries, view, route, routeStops, small, twoLine, clearRoute, transform: settledView, viewport: size, textMode, obstacles, insetArea: mainInsetArea, l, name })
        : null,
    [ready, map, lesson.countries, view, route, routeStops, small, twoLine, clearRoute, settledView, size, textMode, obstacles, mainInsetArea, l, name],
  );
  // Wave marks: Discover only, on the main map only.
  const scenery = stage === "discover" && mainLayout !== null;
  // Lesson countries in a state colour (selection, Find answers, Travel): the
  // land texture is lighter over them, and the relief uses its neutral overlay.
  const tonedKey = lesson.countries.filter((id) => (view.tones[id] ?? "default") !== "default").join(",");
  // The gesture copy's colours: brought up to date once the browser is idle, or
  // as soon as the map starts moving (see "The gesture copy").
  const [copyTones, setCopyTones] = useState({ tones: view.tones, key: tonedKey });
  useEffect(() => {
    const next = { tones: view.tones, key: tonedKey };
    const sync = () => setCopyTones((c) => (c.tones === next.tones && c.key === next.key ? c : next));
    syncCopyTonesRef.current = sync;
    return copyMode ? whenIdle(sync, COPY_TONES_DELAY_MS) : undefined;
  }, [view.tones, tonedKey, copyMode]);
  // Scenery keeps clear of the names where they are for the view it is drawn
  // for, and 8px of room around the zoom controls and the close-up.
  const sceneryAvoid = (at: Transform) =>
    scenery && mainLayout
      ? [
          ...sceneryClearance(map, small, followView(mainLayout, settledView, at), at),
          ...obstacles.map((o) => ({ x0: o.x0 - 8, y0: o.y0 - 8, x1: o.x1 + 8, y1: o.y1 + 8 })),
        ]
      : [];

  return (
    // data-crowded: a small country's name has no nearby clear spot on the whole-map view.
    // The same illustrated landscape (atlas surface and relief) in every stage.
    <div className={`${styles.wrapper} ${styles.atlas}`} ref={wrapperRef} style={{ maxWidth }} data-crowded={crowded || undefined} data-map-style="atlas" data-gesture-mode={gestureMode}>
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
                {showRelief && <Relief map={map} level={versionKey(lesson)} tones={view.tones} transform={settledView} viewport={size} final={settledFinal} />}
                {scenery && (
                  <Scenery
                    map={map}
                    transform={transform}
                    viewport={size}
                    avoid={sceneryAvoid(transform)}
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
                routeStops={routeStops}
                small={small}
                twoLine={twoLine}
                clearRoute={clearRoute}
                transform={settledView}
                viewport={size}
                textMode={textMode}
                obstacles={obstacles}
                insetArea={mainInsetArea}
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
        // bottom-left, opposite the zoom controls, opening upwards (in Level 1 over
        // western France, which leaves the crowded Low Countries and their names
        // clear), or top-left where the level says so (Level 7: over the Bay of
        // Biscay, clear of Portugal).
        <div
          className={`${styles.inset} ${insetTop ? "" : styles.insetBottom} ${insetSize.beside ? styles.insetBeside : ""}`}
          ref={insetRef}
          data-corner={insetTop ? "top-left" : "bottom-left"}
          data-beside={insetSize.beside || undefined}
        >
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
              <figcaption className={styles.insetCaption} data-testid="inset-title" ref={setCaption}>
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
                  {showRelief && <Relief map={map} level={versionKey(lesson)} tones={view.tones} transform={insetTransform} viewport={insetSize} />}
                  <BorderLayer map={map} active={lesson.countries} />
                  <FlashLayer map={map} flash={flash} />
                </g>
                <Overlay
                  map={map}
                  active={lesson.countries}
                  view={view}
                  route={route}
                  routeStops={routeStops}
                  small={small}
                  transform={insetTransform}
                  viewport={insetSize}
                  textMode={showLabels && calloutsInInset ? "callouts" : "none"}
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

      {ready && copyMode && (
        // The gesture copy (see below): at rest nearly transparent and kept drawn
        // (Blink) or fully transparent and not drawn (Firefox); a layer behind the
        // names and map controls, in place of the map, while the map moves (see CSS).
        // No language of its own (lang=""): it has no text, and following the page's would draw the whole
        // copy again (and the borders' layer) on every language switch, though nothing in it changes.
        <div className={styles.gesture} aria-hidden="true" inert lang="">
          <svg
            ref={copyRef}
            className={styles.gestureLayer}
            width={size.width + 2 * margin.x}
            height={size.height + 2 * margin.y}
            viewBox={`${-margin.x} ${-margin.y} ${size.width + 2 * margin.x} ${size.height + 2 * margin.y}`}
            style={{ left: -margin.x, top: -margin.y, transformOrigin: `${margin.x}px ${margin.y}px` }}
            data-gesture-copy=""
          >
            <g transform={svgTransform(copyView)} style={{ "--inv": 1 / copyView.k } as CSSProperties}>
              <SeaTexture map={map} />
              <CountryFills map={map} active={lesson.countries} tones={copyTones.tones} />
              <LandTexture map={map} darkKey={copyTones.key} />
              {showRelief && <Relief map={map} level={versionKey(lesson)} tones={copyTones.tones} transform={settledView} viewport={size} final={settledFinal} instant />}
              {scenery && (
                <Scenery map={map} transform={copyView} viewport={size} avoid={sceneryAvoid(copyView)} compact={size.width < COMPACT_MAP_WIDTH} copy />
              )}
              {gestureMode === "copyWithBorders" && <BorderLayer map={map} active={lesson.countries} />}
            </g>
          </svg>
          {gestureMode === "copy" && (
            <svg
              ref={bordersRef}
              className={styles.gestureLayer}
              width={size.width + 2 * margin.x}
              height={size.height + 2 * margin.y}
              viewBox={`${-margin.x} ${-margin.y} ${size.width + 2 * margin.x} ${size.height + 2 * margin.y}`}
              style={{ left: -margin.x, top: -margin.y, transformOrigin: `${margin.x}px ${margin.y}px` }}
              data-live-borders=""
            >
              <LiveBorders map={map} active={lesson.countries} groupRef={bordersGroupRef} />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}

/*
 * The gesture copy.
 *
 * At rest the map is drawn with the page, so the names over it get the
 * browser's sharpest text rendering. Moving it as a layer would need that layer
 * drawn first, which takes a long pause on the first move (and the names over a
 * separate layer are drawn less sharply). A copy of the landscape is moved
 * instead. In Blink it is kept drawn as its own layer, in front of everything
 * but nearly transparent (0.4%: fully transparent layers are not kept drawn),
 * where it changes nothing visible and nothing under it stops being drawn with
 * the page; Blink would otherwise draw the whole copy when it first shows, a
 * pause at the start of every drag. In Firefox it is fully transparent and not
 * drawn at rest (keeping it drawn slowed the frames after every selection and
 * language switch there, and showing it costs no pause), so new colours or a new
 * view cost nothing until the map moves. When the map starts moving, the copy
 * becomes a layer (if it isn't one), moves behind the names and map controls and
 * shows, in place of the map, which is hidden but moves along for taps.
 *
 * The copy has no borders: they are a separate light layer, drawn again during
 * a zoom so they keep their width (the soft coastline stays in the copy). The
 * copy is drawn again for a new view when it would no longer cover the view,
 * and otherwise once the browser is idle after a gesture. New colours (a
 * selection, an answer) reach it once the browser is idle too, so a tap's
 * response is drawn first, or at once if the map starts moving before that.
 * Its tiles and scenery always come from the same state as the map's.
 *
 * This depends on the browser engine (see gestureModeFor): in Firefox the
 * borders are drawn in the copy (they then grow with it during a zoom), and in
 * WebKit (every browser on iOS) there is no copy: the map itself becomes a
 * layer from the press, as it did before.
 */

/** Coastline and country fills for the gesture copy: without fill strokes, ids or interaction. */
const CountryFills = memo(function CountryFills({
  map,
  active,
  tones,
}: {
  map: RegionMapData;
  active: readonly CountryId[];
  tones: MapView["tones"];
}) {
  return (
    <>
      <g className={styles.coast}>
        {map.shapes.map((s) => s.coast && <path key={s.id} d={s.coast} />)}
      </g>
      <g className={styles.context}>
        {map.shapes
          .filter((s) => !active.includes(s.id))
          .map((s) => (
            <path key={s.id} d={s.d} className={styles.contextShape} />
          ))}
      </g>
      {/* data-tone (colour only, no country) lets tests check the copy never shows stale colours. */}
      <g data-copy-fills="">
        {map.shapes
          .filter((s) => active.includes(s.id))
          .map((s) => (
            <path key={s.id} d={s.d} className={`${styles.country} ${TONE_CLASS[tones[s.id] ?? "default"]}`} data-tone={tones[s.id] ?? "default"} />
          ))}
      </g>
    </>
  );
});

/**
 * Borders over the gesture copy, light to draw again. Its group's transform is
 * set directly, frame by frame (see placeBorders).
 */
const LiveBorders = memo(function LiveBorders({
  map,
  active,
  groupRef,
}: {
  map: RegionMapData;
  active: readonly CountryId[];
  groupRef: RefObject<SVGGElement | null>;
}) {
  return (
    <g ref={groupRef}>
      <BorderLayer map={map} active={active} />
    </g>
  );
});

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
      {/* Coastline: a soft line under the land, along each country's coast only (its land borders would lie
          under the land anyway, and stroking them is most of the cost of drawing the map). */}
      <g className={styles.coast} aria-hidden="true">
        {map.shapes.map((s) => s.coast && <path key={s.id} d={s.coast} />)}
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
/** Markers closer than this (on screen) put their names on the sides facing away from each other. */
const NEAR_MARKER_PX = 60;
/** Room kept between a capital's or landmark's name and any other name (px). */
const MARKER_TEXT_GAP = 3;
/** Points checked along a country name's middle (see fitsInside), the end ones this far in from its ends (px). */
const FIT_SAMPLES = 7;
const FIT_INSET = 3;
/** The samples in the order they are checked: the ends first (most often off the country), the middle one already was. */
const FIT_ORDER = [0, 6, 1, 5, 2, 4];
/** Where a callout's dot may go, nearest first, when its country's label point is taken: up to 28px from it in eight directions. */
const DOT_OFFSETS: Point[] = [
  [0, 0],
  ...[8, 14, 20, 28].flatMap((r) =>
    [0, 1, 2, 3, 4, 5, 6, 7].map((i): Point => [Math.round(r * Math.cos((i * Math.PI) / 4)), Math.round(r * Math.sin((i * Math.PI) / 4))]),
  ),
];
/** Where a larger country's callout dot may move when no position from its label point is clear: 14 and 28 px from it in eight directions. */
const DOT_MOVES: Point[] = DOT_OFFSETS.filter(([dx, dy]) => [14, 28].includes(Math.round(Math.hypot(dx, dy))));
/**
 * At most this many of those points are tried, nearest first; at most this many more callout positions once one is
 * clear, and this many in all, best ranked first (see placeCallout).
 */
const DOT_TRIES = 8;
const CALLOUT_RETRIES = 6;
const CALLOUT_ASSESSED = 12;
/** Font weights used by the map text (see RegionMap.module.css), for measuring. */
const LABEL_WEIGHT = 700;
const MARKER_WEIGHT = 650;
const CALLOUT_PAD_X = 8;
const CALLOUT_HEIGHT = 24;
/** Room kept between a callout and another callout, another's leader or a country name (px). */
const CALLOUT_GAP = 2;
/**
 * Where a layout leaves a country's name out and is tried again (see placeLayout), a callout wider than this share of
 * the main map is drawn on two lines, broken between words where the longer line is shortest (Bosnia and
 * Herzegovina's, in either language, on a 320px map, unless it is selected): narrower, it leaves room for the other
 * names. Text keeps its size; the second line sits this many times the font size below the first.
 */
const CALLOUT_WRAP_SHARE = 0.6;
const CALLOUT_LINE_STEP = 1.2;
/** A leader crossing another, as a last resort (see placeCallout), meets it at this angle or more, this far or more from the ends of both. */
const CLEAR_CROSSING_ANGLE = Math.PI / 6;
const CLEAR_CROSSING_GAP = 10;
/** Narrow maps use slightly smaller labels so the names fit between the countries and controls. */
const COMPACT_MAP_WIDTH = 420;
const COMPACT_LABEL_FONT_PX = 13;
const COMPACT_MARKER_FONT_PX = 11.5;
const COMPACT_CALLOUT_HEIGHT = 22;
/**
 * The narrowest maps (320px phones) draw country names 10% smaller again, with their callouts' padding and height
 * and their explored badges to match, so five long names fit beside the controls (Level 4 in Armenian). Capitals'
 * and landmarks' names keep the compact size.
 */
const NARROW_MAP_WIDTH = 340;
const NARROW_SCALE = 0.9;
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
/** Cost of a callout's leader crossing another callout's: worse than covering a name that can move aside. */
const LEADERS_CROSSING_COST = 6000;
/** Cost of a callout lying entirely over another lesson country (scaled by the share that does). */
const CALLOUT_DEPTH_COST = 2500;

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inBox = ([x, y]: Point, b: Box) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/** Nearest point of a box to `p`: where a leader line from `p` meets it. */
const nearestOn = (b: Box, [x, y]: Point): Point => [clamp(x, b.x0, b.x1), clamp(y, b.y0, b.y1)];

/** The box with `d` more room on every side. */
const grow = (b: Box, d: number): Box => ({ x0: b.x0 - d, y0: b.y0 - d, x1: b.x1 + d, y1: b.y1 + d });

/** Whether segments a→b and c→d cross (touching at an end doesn't count). */
function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
  if (Math.abs(den) < 1e-9) return false;
  const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den;
  const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
  return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
}

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
 * the first whose overlapped names can be moved aside. `between`: positions west
 * and east whose leader leaves at 30° or 45°, between the level and the diagonal
 * ones, ranked the same way; the caller tries them only when no usual nearby
 * position works. `between` and `edge` are ranked only when asked for: each
 * score samples the countries under the box, and most callouts never need them.
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
  /** Callouts already placed: never covered, even as a last resort (two neighbours' callouts, Level 4's Balkans on a 320px map). */
  placed: Box[] = [],
  /**
   * Leader lines already drawn: a position never covers one, and its own leader never grazes another
   * callout. Crossing one costs LEADERS_CROSSING_COST, so a leader crosses another only where nothing else
   * is clear (Latvia's and Estonia's in Armenian on a 320px map); the caller never takes such a position
   * for a name too long for its country (Croatia's and Bosnia and Herzegovina's on a phone).
   */
  lines: [Point, Point][] = [],
): { ranked: Box[]; between: () => Box[]; edge: () => Box[]; lastResort: boolean } {
  const [ax, ay] = anchor;
  const candidates: { box: Box; step: number }[] = [];
  const between: { box: Box; step: number }[] = [];
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
    // The leader ends at the corner nearest the dot, d away: below or above the dot's
    // level, so it clears a marker just beside the dot (Tallinn's, beside Estonia's on
    // a 320px map), which a level leader would cross.
    for (const [c, s] of [
      [0.87, 0.5],
      [0.71, 0.71],
    ])
      for (const [x, y] of [
        [ax - c * d - width, ay + s * d], // west, lower
        [ax - c * d - width, ay - s * d - h], // west, higher
        [ax + c * d, ay + s * d], // east, lower
        [ax + c * d, ay - s * d - h], // east, higher
      ])
        between.push({ box: { x0: x, y0: y, x1: x + width, y1: y + h }, step });
  });
  // Distance from the view edge: tighter in small views such as the inset.
  const m = viewport.width < 160 ? 2 : 4;
  // Last resort, for small views such as the inset: along the top or bottom edge, above or below the anchor.
  const edgeX = clamp(ax - width / 2, m, viewport.width - m - width);
  for (const y of [viewport.height - m - h, m]) candidates.push({ box: { x0: edgeX, y0: y, x1: edgeX + width, y1: y + h }, step: 5 });
  const onScreen = (b: Box) => b.x0 >= m && b.y0 >= m && b.x1 <= viewport.width - m && b.y1 <= viewport.height - m;
  const slide = (b: Box): Box => {
    const x0 = clamp(b.x0, m, Math.max(m, viewport.width - m - width));
    const y0 = clamp(b.y0, m, Math.max(m, viewport.height - m - h));
    return { x0, y0, x1: x0 + width, y1: y0 + h };
  };
  // The anchor's own marker (e.g. Luxembourg City) is where the leader starts, so it can't block it; but a leader
  // from a dot beside the marker's middle never runs across it (the Netherlands', across Amsterdam's on a 320px map).
  const besideMiddle = hard.filter((o) => inBox(anchor, o)).map((o) => grow(o, -4)).filter((o) => o.x1 > o.x0 && o.y1 > o.y0 && !inBox(anchor, o));
  const blockers = [...hard.filter((o) => !inBox(anchor, o)), ...besideMiddle, ...chrome, ...placed.map((b) => grow(b, CALLOUT_GAP)).filter((o) => !inBox(anchor, o))];
  const clear = ({ box }: { box: Box }) => {
    if (!onScreen(box) || [...hard, ...chrome].some((o) => overlaps(box, o)) || placed.some((o) => overlaps(grow(box, CALLOUT_GAP), o))) return false;
    const end = nearestOn(box, anchor);
    return (
      !blockers.some((o) => segmentHits(anchor, end, o)) &&
      !lines.some(([a, e]) => segmentHits(a, e, grow(box, CALLOUT_GAP)))
    );
  };
  const score = ({ box, step }: { box: Box; step: number }) => {
    const end = nearestOn(box, anchor);
    return soft.reduce(
      (sum, o) => sum + overlapArea(box, o) * CALLOUT_OVERLAP_WEIGHT + (segmentHits(anchor, end, o) ? LEADER_CROSSING_COST : 0),
      step * CALLOUT_STEP_COST + depth(box) * CALLOUT_DEPTH_COST + (lines.some(([a, e]) => segmentsCross(anchor, end, a, e)) ? LEADERS_CROSSING_COST : 0),
    );
  };
  const rank = (list: { box: Box; step: number }[]) =>
    list
      .map((c) => ({ box: c.box, cost: score(c) }))
      .sort((a, b) => a.cost - b.cost)
      .map((c) => c.box);
  // Positions that run past the map's edge, slid back into the view, a step further out (main map only):
  // a fallback for a country at the edge whose usual positions all lie across its neighbours (see
  // layoutOverlay). Never over the country's dot itself.
  const edge: { box: Box; step: number }[] = [];
  if (viewport.width >= 160) {
    const dot: Box = { x0: ax - 6, y0: ay - 6, x1: ax + 6, y1: ay + 6 };
    for (const c of candidates) {
      if (c.step === 5 || onScreen(c.box)) continue;
      const box = slide(c.box);
      if (overlaps(box, dot) || [...candidates, ...edge].some((o) => Math.abs(o.box.x0 - box.x0) < 1 && Math.abs(o.box.y0 - box.y0) < 1)) continue;
      edge.push({ box, step: c.step + 1 });
    }
  }
  const ranked = rank(candidates.filter(clear));
  if (ranked.length === 0) {
    // Nothing clear: the same positions slid sideways or up and down into the view, for a
    // long name near the map's edge (Bosnia and Herzegovina on a 320px map), under the
    // same rules. Only when no position is clear as it is, so layouts that fit don't change.
    ranked.push(...rank(candidates.map((c) => ({ box: slide(c.box), step: c.step + 1 })).filter(clear)));
  }
  const lastResort = ranked.length === 0;
  if (lastResort) {
    // Last resort (tiny views such as the inset): any on-screen position, but
    // never over map chrome or another callout or leader, or with a leader through
    // them (its leader may cross another: the selected Croatia's and Slovenia's, in
    // Armenian on a 320px map, rather than no name). On the main map, never over a
    // marker or a capital's or landmark's name either (Sarajevo's, under Croatia's
    // callout on a 320px map in Armenian), or with its leader through one.
    const never = [...chrome, ...placed, ...(viewport.width >= 160 ? hard.filter((o) => !inBox(anchor, o)) : [])];
    const fallback = candidates.find(
      (c) =>
        onScreen(c.box) &&
        !never.some((o) => overlaps(c.box, o) || segmentHits(anchor, nearestOn(c.box, anchor), o)) &&
        !lines.some(([a, e]) => segmentHits(a, e, c.box)),
    );
    if (fallback) ranked.push(fallback.box);
    else if (never.length === 0) ranked.push(candidates[0].box);
  }
  return {
    ranked: ranked.map((b) => {
      const x0 = clamp(b.x0, m, Math.max(m, viewport.width - m - width));
      const y0 = clamp(b.y0, m, Math.max(m, viewport.height - m - h));
      return { x0, y0, x1: x0 + width, y1: y0 + h };
    }),
    between: () => rank(between.filter(clear)),
    edge: () => rank(edge.filter(clear)),
    lastResort,
  };
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
/**
 * A callout's dot this close to its own capital marker (px) lies on the marker's centre and would hide it: the
 * marker stands for the dot (Andorra la Vella, 1.1 px from Andorra's dot on a 320px phone). Dots further off
 * (Luxembourg's, about 3 px from Luxembourg City; Estonia's, 2 px from Tallinn) are drawn as before.
 */
const CAPITAL_ON_DOT = 1.5;
/** The capital marker's outer edge (its ring and white outline), where a leader starting at it begins. */
const CAPITAL_EDGE = 6.5;

/** The point `r` from `from` towards `to`; `to` itself when it is nearer. */
function edgeToward(from: Point, to: Point, r: number): Point {
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (d <= r) return to;
  return [from[0] + ((to[0] - from[0]) * r) / d, from[1] + ((to[1] - from[1]) * r) / d];
}

/** Traveller pin: tip at the capital, head above it. */
const PIN_BOX = { x0: -8, y0: -23, x1: 8, y1: 2 };
/** How far each marker reaches from its point on screen: the pin, or the round capital marker and the landmark's diamond. */
function markerExtent(kind: MapMarker["kind"]) {
  return kind === "current" ? PIN_BOX : { x0: -7, y0: -7, x1: 7, y1: 7 };
}

type TextMode = "all" | "noCallouts" | "callouts" | "none";

/** Where a marker's name starts (beside it), ends (beside it, on its left) or is centred (above or below it). */
type TextAnchor = "start" | "end" | "middle";

type MarkerText = { key: string; at: Point; below: boolean; text: string; x: number; y: number; anchor: TextAnchor; dark: boolean; hidden?: boolean };

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
  /** Placed inside its country (see fitsInside); a name that is keeps to it when moved aside, where it can. */
  fits: boolean;
  /**
   * Too long to lie inside its country, but with a clear spot over it, which it takes as names always did.
   * Once the other callouts are placed (and the capital's name, unless it is the selected country's) it
   * moves to a nearby callout, if one is clear (see toCallout): its callout never costs another name its
   * place, and it never takes a distant one.
   */
  overhang: boolean;
  /** A callout's name on two lines (see CALLOUT_WRAP_SHARE); null on one. */
  lines: [string, string] | null;
};

interface LayoutInput {
  map: RegionMapData;
  /** The lesson's countries (the rest are faded context). */
  active: readonly CountryId[];
  view: MapView;
  /** Route line in projected world coordinates. */
  route: Point[];
  /** Index in `route` of each country's capital (see routePoints). */
  routeStops: number[];
  /** Countries named in a callout until zooming makes them large enough (the level's `smallCountries`). */
  small: ReadonlySet<CountryId>;
  /** Countries whose callout goes on two lines where one line finds no room (the level's `twoLineCallouts`). */
  twoLine?: ReadonlySet<CountryId>;
  /** Callouts keep clear of the route line where they can (the level's `calloutsClearRoute`). */
  clearRoute?: boolean;
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
  /** Whether a callout was moved off its neighbours to a position slid in from the map's edge (see placeOverlay). */
  fellBack?: boolean;
  /** Small countries whose callout found no nearby, clear position. */
  crowded: CountryId[];
}

/**
 * Places everything drawn over the map in screen space. Pure apart from text
 * measuring, so the map can also ask how the base view would look (see
 * RegionMap: a crowded Luxembourg label moves into the close-up).
 */
function layoutOverlay(input: LayoutInput): OverlayLayout {
  return timed("placement", () => placeLayout(input));
}

function placeLayout(input: LayoutInput): OverlayLayout {
  const named = (o: OverlayLayout) => o.labels.filter((x) => x.callout || x.box).length + o.markerTexts.filter((m) => !m.hidden).length;
  let layout = placeOverlay(input, true, true, true);
  if (layout.fellBack) {
    // A callout moved off its neighbours to the map's edge (see placeOverlay) must not cost another name
    // its place (Level 4's Slovenia at the top edge of a 740×360 map would take Croatia's only spot): the
    // layout without that move wins wherever it names more.
    const plain = placeOverlay(input, false, true, true);
    if (named(plain) > named(layout)) layout = plain;
  }
  // Names kept inside their countries, and the room kept between callouts and names, must not cost another
  // country its name, or the capital its name (on a crowded 320px map, a name moved to fit inside its country,
  // or a callout kept clear of a name, can take the room another's callout needs). Only when this layout
  // leaves one of those out: the layout without either, as names were always placed, wins if it names more
  // of them. Once, as many crowded small maps leave a name out either way.
  const { width, height } = input.viewport;
  const inView = ([x, y]: Point) => x >= 0 && y >= 0 && x <= width && y <= height;
  const left = (o: OverlayLayout) => [
    ...o.labels.filter(({ callout, box, anchor }) => !callout && !box && inView(anchor)).map((x) => x.id as string),
    ...(o.markerTexts.some(({ hidden, key, at }) => hidden && key.startsWith("capital-") && inView(at)) ? ["capital"] : []),
  ];
  const missing = (o: OverlayLayout) => left(o).reduce((n, id) => n + (id === "capital" ? 1 : 2), 0);
  // Leaders crossing another (see placeCallout's crossesClearly).
  const crossings = (o: OverlayLayout) => {
    const lines = o.labels.flatMap(({ callout, anchor }) => (callout ? [[anchor, nearestOn(callout, anchor)] as [Point, Point]] : []));
    return lines.reduce((n, [a, b], i) => n + lines.slice(i + 1).filter(([c, d]) => segmentsCross(a, b, c, d)).length, 0);
  };
  if (missing(layout) === 0) return layout;
  // Names are placed one at a time, so an earlier callout can take the only room a later name had (Slovenia's
  // and Croatia's on a 320px map in Armenian, or Sarajevo's). Up to twice, the layout again: with the names left
  // out placed first; then with every callout placed widest first (Bosnia and Herzegovina's, which fits only
  // along the top of a 320px map), after the capital's name if that was left out. Longest names first in each.
  // Where a country's name was left out, the two tries differ (see wrapLong).
  const widest = (ids: string[]) =>
    ids.sort((a, b) => (a === "capital" ? -1 : b === "capital" ? 1 : nameWidth(b) - nameWidth(a)));
  const nameWidth = (id: string) => {
    const label = layout.labels.find((x) => x.id === id);
    return label ? label.textWidth : 0;
  };
  const callouts = layout.labels.filter((x) => x.callout || !x.box).map((x) => x.id as string);
  // Only a country's name left out is worth two-line callouts (see CALLOUT_WRAP_SHARE), not the capital's alone. Then
  // the layout is tried again in the same order with them first, as the narrower callouts may leave room in place
  // (with Croatia selected on a 320px map in Armenian, Bosnia and Herzegovina's placed first would take the only room
  // left for Slovenia's); then with the names left out placed first.
  const wrapLong = left(layout).some((id) => id !== "capital");
  const orders = wrapLong
    ? [[], widest(left(layout))]
    : [widest(left(layout)), widest([...new Set([...left(layout).filter((id) => id === "capital"), ...callouts])])];
  let last = layout;
  for (const first of orders) {
    if (first.length === 0 && !wrapLong) continue;
    last = placeOverlay(input, true, true, true, first, wrapLong);
    // A layout tried again wins only if it names more, and has no more leaders crossing another than the first
    // beyond one for each country's name it brings back (see crossesClearly).
    const restored = left(layout).filter((id) => id !== "capital" && !left(last).includes(id)).length;
    if (missing(last) < missing(layout) && crossings(last) <= crossings(layout) + restored) layout = last;
    if (missing(layout) === 0) return layout;
    // Names still left out though placed first have no room at all: no other order helps them (Riga's, on a
    // zoomed 320px map in Armenian), and a capital's name no other layout either.
    if (left(last).every((id) => first.includes(id))) {
      if (left(layout).every((id) => id === "capital")) return layout;
      break;
    }
  }
  const loose = placeOverlay(input, true, false, false);
  return missing(loose) < missing(layout) ? loose : layout;
}

/**
 * Whether a country name at a given spot lies inside its country (see fitsInside), by the input it was placed for:
 * the layouts placeLayout tries for one view ask the same many times.
 */
const fitMemo = new WeakMap<LayoutInput, Map<string, boolean>>();

function placeOverlay(
  input: LayoutInput,
  edgeFallback: boolean,
  /** Country names lie inside their country, or move to a callout (see fitsInside); otherwise as they always did. */
  fit: boolean,
  /** Callouts keep CALLOUT_GAP clear of country names where they can (see placeLayout). */
  gaps: boolean,
  /** Names placed before the rest, in this order (country ids, and "capital" for the capital's name; see placeLayout). */
  first: readonly string[] = [],
  /** Long names in callouts go on two lines (see CALLOUT_WRAP_SHARE): in a layout tried again for a country's name. */
  wrap = false,
): OverlayLayout {
  const { map, active, view, route: routeWorld, small, twoLine, clearRoute, transform, viewport, textMode, obstacles, insetArea, l, name } = input;
  const showText = textMode === "all" || textMode === "noCallouts";
  const toScreen = (p: Point) => applyTransform(transform, p);
  const toWorld = ([x, y]: Point): Point => [(x - transform.x) / transform.k, (y - transform.y) / transform.k];
  const shapeById = (id: CountryId) => map.shapes.find((s) => s.id === id) as CountryShape;
  const [[vx0, vy0], [vx1, vy1]] = [toWorld([0, 0]), toWorld([viewport.width, viewport.height])];
  const shapesInView = map.shapes.filter(({ bounds: [[x0, y0], [x1, y1]] }) => x0 <= vx1 && x1 >= vx0 && y0 <= vy1 && y1 >= vy0);
  /** Whether a projected point lies on a country other than `id` (a lesson country or a faded neighbour), rather than the sea. */
  const onOtherLand = (id: CountryId, p: Point) =>
    shapesInView.some((s) => s.id !== id && insideShape(s, p));
  /** Whether the screen point lies on a dark (teal) country, where text is white. */
  const onDark = (p: Point) =>
    Object.entries(view.tones).some(([id, tone]) => tone !== undefined && DARK_TONES.has(tone) && insideShape(shapeById(id as CountryId), toWorld(p)));

  const route = routeWorld.map(toScreen);
  // The route's segments, which callouts keep clear of as of leader lines where the level asks (see calloutsClearRoute).
  const routeLines: [Point, Point][] = clearRoute ? route.slice(1).map((p, i) => [route[i], p]) : [];

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
  // Country names on the narrowest maps (see NARROW_SCALE); the inset's callouts keep their own sizes.
  const narrow = textMode !== "callouts" && viewport.width < NARROW_MAP_WIDTH ? NARROW_SCALE : 1;
  const labelFont = textMode === "callouts" ? INSET_LABEL_FONT_PX : (compact ? COMPACT_LABEL_FONT_PX : LABEL_FONT_PX) * narrow;
  const markerFont = compact ? COMPACT_MARKER_FONT_PX : MARKER_FONT_PX;
  const calloutHeight = textMode === "callouts" ? INSET_CALLOUT_HEIGHT : (compact ? COMPACT_CALLOUT_HEIGHT : CALLOUT_HEIGHT) * narrow;
  // Half the height of a name's box: the glyphs plus room for Armenian's taller ascenders and descenders.
  const labelHalf = labelFont / 2 + 4;
  const badgeSize = textMode === "callouts" ? INSET_BADGE : compact ? COMPACT_BADGE : BADGE;
  const badge = { r: badgeSize.r * narrow, gap: badgeSize.gap * narrow };
  // +1: the badge's white outline reaches just past its circle.
  const badgeExtra = badge.gap + 2 * badge.r + 1;

  const explored = new Set(view.explored);
  const labels: Label[] = (textMode === "none" ? [] : view.labels)
    .filter((id) => (textMode === "callouts" ? small.has(id) : textMode === "noCallouts" ? !small.has(id) : true))
    .map((id) => {
      const c = getCountry(id);
      const text = name(id);
      return {
        id,
        anchor: toScreen(map.project(c.label.coordinates)),
        text,
        textWidth: textWidth(text, labelFont, LABEL_WEIGHT),
        explored: explored.has(id),
        callout: null,
        inline: true,
        box: null,
        dx: 0,
        dy: 0,
        pinAnchored: false,
        fits: false,
        overhang: false,
        lines: null,
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
   * Whether the name at this offset reads as its country's: points along its middle, from end to end
   * (FIT_INSET in from each), lie on the country or the sea, and its middle on the country. A name running
   * onto a neighbour reads as the neighbour's (Bosnia and Herzegovina's, over Croatia and Serbia, on a
   * phone); one running onto the sea beside its country (Italy's, across the boot) doesn't. The explored
   * badge after it may reach past the border (Germany's, onto Poland, on a 320px map): it reads as the name's.
   */
  let fitKnown = fitMemo.get(input);
  if (!fitKnown) fitMemo.set(input, (fitKnown = new Map()));
  const fitsInside = (label: Label, dx: number, dy: number) => {
    const w = label.textWidth;
    // The name starts where its box does, and the badge follows it (see labelBox and Overlay).
    const [x0, cy] = [label.anchor[0] + dx - fullWidth(label) / 2, label.anchor[1] + dy];
    const key = `${label.id} ${x0.toFixed(2)} ${cy.toFixed(2)}`;
    let fits = fitKnown.get(key);
    if (fits === undefined) {
      const shape = shapeById(label.id);
      fits = insideShape(shape, toWorld([x0 + w / 2, cy])) && FIT_ORDER.every((i) => {
        const p = toWorld([x0 + FIT_INSET + ((w - 2 * FIT_INSET) * i) / (FIT_SAMPLES - 1), cy]);
        return insideShape(shape, p) || !onOtherLand(label.id, p);
      });
      fitKnown.set(key, fits);
    }
    return fits;
  };
  /**
   * Nearest position for a country name that satisfies `ok`, trying small moves
   * first. Moved names stay inside their own country, so a name never drifts
   * onto a neighbour: with `whole`, the whole name (see fitsInside); otherwise
   * only its middle, and none at all at the label point. With `wide`, when
   * nothing near the label point fits (it may be hidden under the close-up or
   * the controls, or panned off screen), the whole visible part of the country
   * is searched, nearest to the label point first. Null when nothing fits.
   */
  const offsetsByWidth = new Map<number, Point[]>();
  const labelSpot = (label: Label, ok: (b: Box) => boolean, wide = false, whole = true): Point | null => {
    const w = fullWidth(label);
    const step = labelHalf * 2;
    const shape = shapeById(label.id);
    const [ax, ay] = label.anchor;
    // Quarter-width and half-height steps, up to one width sideways and four heights up or down: the same
    // for every search for this name, so made once (callouts search for many names many times).
    let offsets = offsetsByWidth.get(w);
    if (!offsets) {
      offsets = [];
      for (let i = -8; i <= 8; i++) for (let j = -4; j <= 4; j++) offsets.push([(j * w) / 4, (i * step) / 2]);
      offsets.sort((a, b) => Math.hypot(a[0], a[1] * 1.5) - Math.hypot(b[0], b[1] * 1.5));
      offsetsByWidth.set(w, offsets);
    }
    const near = offsets.find(
      ([dx, dy]) =>
        ok(labelBox(label, dx, dy)) &&
        (whole ? fitsInside(label, dx, dy) : (dx === 0 && dy === 0) || insideShape(shape, toWorld([ax + dx, ay + dy]))),
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
      whole ? fitsInside(label, dx, dy) : [-w / 2 + 2, 0, w / 2 - 2].every((ex) => insideShape(shape, toWorld([ax + dx + ex, ay + dy])));
    return spots.find((d) => ok(labelBox(label, d[0], d[1])) && inside(d)) ?? null;
  };

  /**
   * Where a country name moves to make way for a callout or a capital's name: inside its country, if it
   * lay there; otherwise, or failing that, over it, as names always could (see labelSpot).
   */
  const asideSpot = (label: Label, ok: (b: Box) => boolean) => (label.fits ? labelSpot(label, ok) : null) ?? labelSpot(label, ok, false, false);
  /** Moves a country name by (dx, dy); it still lies inside its country only if the new spot does. */
  const moveName = (label: Label, dx: number, dy: number): Box => {
    label.fits = label.fits && fitsInside(label, dx, dy);
    [label.dx, label.dy] = [dx, dy];
    return (label.box = labelBox(label, dx, dy));
  };

  // Country names sit at their label point. One that would be hidden by the map
  // controls or the inset, or would run into a marker or an earlier name, moves
  // to the nearest free spot inside its own country.
  const labelAvoid = [...obstacles, ...markerPoints];
  const leaderZones: Box[] = [];
  const leaderZoneOf = new Map<Box, Label>();
  for (const label of labels) {
    if (!small.has(label.id)) continue;
    const [[x0, y0], [x1, y1]] = shapeById(label.id).bounds;
    const sw = (x1 - x0) * transform.k;
    const sh = (y1 - y0) * transform.k;
    // Once zoom makes the country wide enough, its name fits inside it.
    label.inline = sw >= fullWidth(label) + 16 && sh >= 28;
    // Otherwise it gets a callout, and other names keep clear of its leader dot
    // so the leader line can leave in any direction.
    if (!label.inline) {
      const [ax, ay] = label.anchor;
      const zone = { x0: ax - 12, y0: ay - 12, x1: ax + 12, y1: ay + 12 };
      leaderZones.push(zone);
      leaderZoneOf.set(zone, label);
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
    const avoid = [...labelAvoid, ...taken];
    const clearSpot = (b: Box) => onScreen(b) && !avoid.some((o) => overlaps(b, o));
    const [ax, ay] = label.anchor;
    const inView = ax >= 0 && ay >= 0 && ax <= viewport.width && ay <= viewport.height;
    // Near its label point while that is in view: a name too long for its country there moves to a
    // callout rather than across the country.
    const whole = fit ? labelSpot(label, clearSpot, !inView) : null;
    const spot = whole ?? labelSpot(label, clearSpot, true, false);
    label.fits = whole !== null;
    // Too long to lie inside its country (Bosnia and Herzegovina on a phone): for now the spot over it
    // that it always took, until it can move to a nearby callout (see Label.overhang).
    label.overhang = fit && !whole && spot !== null && inView;
    if (!spot && inView) {
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

  // A larger country whose name found no room inside it also needs a callout: other callouts keep clear of its
  // dot as of a small country's, so their leaders don't run across it (Belgium's, across the selected
  // Netherlands' on a 320px map).
  for (const label of labels) {
    const [ax, ay] = label.anchor;
    if (label.inline || small.has(label.id) || ax < 0 || ay < 0 || ax > viewport.width || ay > viewport.height) continue;
    const zone = { x0: ax - 12, y0: ay - 12, x1: ax + 12, y1: ay + 12 };
    leaderZones.push(zone);
    leaderZoneOf.set(zone, label);
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
  let fellBack = false;
  /** The selected country (or the traveller's): its name is drawn white, readable only on its own country. */
  const white = (label: Label) => DARK_TONES.has(view.tones[label.id] ?? "default");
  /** Until the capital's name is placed, callouts prefer to leave it a free side (see placeCallout). */
  let capitalPending = markerTexts.some((m) => m.key.startsWith("capital-") && visible(m.at));
  const placeCallout = (label: Label) => {
    // A callout for a country panned out of view, or whose dot is hidden under
    // the close-up or the map controls, would point at nothing.
    if (!visible(label.anchor) || obstacles.some((o) => inBox(label.anchor, o))) return;
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
    const pad = textMode === "callouts" ? INSET_CALLOUT_PAD_X : CALLOUT_PAD_X * narrow;
    // In a layout tried again because the first left a country's name out (see placeLayout), a long name with a
    // space in it, in a callout wider than CALLOUT_WRAP_SHARE of the main map, goes on two lines: the break where the
    // longer line (the second, with the badge after it) is shortest. Not the selected country's (white, see
    // placeCallout's order): it is placed first, and takes the widest room on one line.
    let lines: [string, string] | null = null;
    let width = fullWidth(label) + 2 * pad;
    const words = label.text.split(" ");
    /** The name on two lines: the break where the longer line is shortest, if narrower than on one. */
    const twoLines = () => {
      let best: [[string, string], number] | null = null;
      const extra = label.explored ? badgeExtra : 0;
      for (let i = 1; i < words.length; i++) {
        const split: [string, string] = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
        const w = Math.max(textWidth(split[0], labelFont, LABEL_WEIGHT), textWidth(split[1], labelFont, LABEL_WEIGHT) + extra) + 2 * pad;
        if (w < (best?.[1] ?? width)) best = [split, w];
      }
      return best;
    };
    if (wrap && textMode !== "callouts" && !white(label) && words.length > 1 && width > viewport.width * CALLOUT_WRAP_SHARE) {
      const split = twoLines();
      if (split) [lines, width] = split;
    }
    const lineHeight = (two: boolean) => (two ? calloutHeight + Math.round(labelFont * CALLOUT_LINE_STEP) : calloutHeight);
    let h = lineHeight(lines !== null);
    // Whether positions keep clear of the route line (see calloutsClearRoute and searchClear below).
    let avoidRoute = true;
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
    const placed = labels.flatMap((o) => (o.callout ? [o.callout] : []));
    // Whether the capital's name still has a free side as things are: if not, no callout position can leave it
    // one, and it plays no part in choosing (Riga's, on a 320px map in Armenian).
    const capitalOpen =
      capitalPending &&
      markerTexts.some((m) => {
        if (!m.key.startsWith("capital-")) return false;
        const w = textWidth(m.text, markerFont, MARKER_WEIGHT);
        const blocked = [...taken, ...placed, ...obstacles, ...leaderZones.filter((z) => leaderZoneOf.get(z) !== label)];
        return markerNameSides(m.at[0], m.at[1], m.below).some((side) => {
          const b = markerNameBox(side, w, markerFont);
          return b.x0 >= 0 && b.x1 <= viewport.width && b.y0 >= 0 && b.y1 <= viewport.height && !crossesLeader(b) && !blocked.some((o) => overlaps(b, o));
        });
      });
    type Choice = { callout: Box; moves: Map<Label, Point>; left: number; near: boolean; evicted: Label[]; cost: number; anchor: Point; fellBack: boolean };
    // The best callout for a leader from `anchor`, the country's dot.
    const bestAt = (anchor: Point): Choice | null => {
      const [ax0, ay0] = anchor;
      const otherDots = leaderZones.filter((z) => leaderZoneOf.get(z) !== label && !(ax0 >= z.x0 && ax0 <= z.x1 && ay0 >= z.y0 && ay0 <= z.y1));
      // A larger country's callout (a name too long for it) starts beside its dot, over the country itself, rather
      // than past its far edge: a leader as short as the room around the dot allows (Serbia's, on a phone).
      const { ranked, between, edge, lastResort } = calloutCandidates(anchor, small.has(label.id) ? reach : 0, width, h, viewport, [...hard, ...own, ...otherDots], taken, depth, obstacles, placed, avoidRoute ? [...leaders, ...routeLines] : leaders);
      // A name too long for its country never takes a last-resort position (over a marker, or crossing a leader).
      const candidates = label.overhang && lastResort ? [] : ranked;
      // Nowhere clear of the map controls and the close-up: no callout.
      if (candidates.length === 0) return null;
      const leaderOf = (b: Box) => Math.hypot(...(nearestOn(b, anchor).map((v, i) => v - anchor[i]) as [number, number]));
      const isNear = (b: Box) => leaderOf(b) <= reach + NEAR_BEYOND;
      // A name too long for its country moves to a callout only if its leader crosses no other.
      const crossesLeaders = (b: Box) => leaders.some(([a, e]) => segmentsCross(anchor, nearestOn(b, anchor), a, e));
      // A leader that crosses just one other, at CLEAR_CROSSING_ANGLE or more and CLEAR_CROSSING_GAP or more from
      // either end of both (their dots and callouts), so each still reads as its own country's.
      const crossesClearly = (b: Box) => {
        const end = nearestOn(b, anchor);
        const crossed = leaders.filter(([a, e]) => segmentsCross(anchor, end, a, e));
        if (crossed.length !== 1) return false;
        const [[cx, cy], [ex, ey]] = crossed[0];
        const [ux, uy, vx, vy] = [end[0] - anchor[0], end[1] - anchor[1], ex - cx, ey - cy];
        const den = ux * vy - uy * vx;
        const t = ((cx - anchor[0]) * vy - (cy - anchor[1]) * vx) / den;
        const at: Point = [anchor[0] + ux * t, anchor[1] + uy * t];
        const angle = Math.asin(Math.min(1, Math.abs(den) / (Math.hypot(ux, uy) * Math.hypot(vx, vy))));
        return angle >= CLEAR_CROSSING_ANGLE && [anchor, end, [cx, cy], [ex, ey]].every(([px, py]) => Math.hypot(at[0] - px, at[1] - py) >= CLEAR_CROSSING_GAP);
      };
      const near = candidates.filter(isNear);
      const far = candidates.filter((b) => !isNear(b));
      // A dot right beside a marker (Estonia's, 2px from Tallinn's on a 320px map): a
      // level leader would cross the marker. When no usual nearby position leaves every
      // name clear, the nearby positions between them (a leader at 30° or 45°, west or
      // east) then come before the distant ones, if every capital and landmark name
      // still has a free side beside its marker. Layouts that found a usual nearby
      // position are unchanged, and so are small countries' names (Luxembourg's), whose
      // fallback is the close-up.
      const [dotX, dotY] = anchor;
      const besideMarker = markerPoints.some((b) => Math.hypot(Math.max(b.x0 - dotX, 0, dotX - b.x1), Math.max(b.y0 - dotY, 0, dotY - b.y1)) <= labelHalf);
      const nearBetween = new Set(besideMarker && !small.has(label.id) ? between().filter(isNear) : []);
      // Country names a callout position covers or comes within `gap` of, or that its leader line (with those
      // already drawn) crosses, each moved to the nearest free spot inside its own country; `left` counts those
      // that can't move. A name too long for its country that can't move aside (see Label.overhang) is `evicted`
      // instead: it gives up its spot, and moves to a callout of its own in its turn (see toCallout), rather than
      // hold a spot that two others' callouts need (Slovenia's, on a 320px map, above Croatia and the selected
      // Bosnia and Herzegovina). Never the selected country's, drawn first.
      const assess = (callout: Box, gap = gaps ? CALLOUT_GAP : 0) => {
        const lines = [...leaders, [anchor, nearestOn(callout, anchor)] as [Point, Point]];
        const crossed = (b: Box) => lines.some(([a, e]) => segmentHits(a, e, b));
        const boxes = new Map(labels.filter((o) => o.box).map((o) => [o, o.box as Box]));
        const moves = new Map<Label, Point>();
        const evicted: Label[] = [];
        const room = grow(callout, gap);
        let left = 0;
        for (const [other, box] of boxes) {
          if (!(overlaps(box, room) || crossed(box))) continue;
          const others = [...hard, room, ...[...boxes].filter(([o]) => o !== other).map(([, b]) => b)];
          const spot = asideSpot(other, (b) => onScreen(b) && !others.some((o) => overlaps(b, o)) && !crossed(b));
          if (spot) {
            moves.set(other, spot);
            boxes.set(other, labelBox(other, spot[0], spot[1]));
          } else if (other.overhang && !white(other)) {
            evicted.push(other);
            boxes.delete(other);
          } else left++;
        }
        return { crossed, boxes, moves, left, evicted };
      };
      const choose = (gap: number) => {
        let found: Choice | null = null;
        // Once a position leaves every name clear, a few more are tried for a better one, and no more than
        // CALLOUT_ASSESSED in all (each moves names aside in turn, the costliest step): placing stays quick on
        // crowded maps, where every position may leave a name in the way.
        let tries = CALLOUT_RETRIES;
        let assessed = CALLOUT_ASSESSED;
        for (const callout of [...near, ...nearBetween, ...far]) {
          const crossing = crossesLeaders(callout);
          // A leader crosses another only as a last resort: in a layout tried again for a name the first left out
          // (see placeLayout), and only clearly (see crossesClearly). The first layout crosses none.
          if (crossing && ((first.length === 0 && !wrap) || !crossesClearly(callout))) continue;
          const close = isNear(callout);
          if (found && (crossing ? 11 : 0) + (close ? 0 : 2) >= found.cost) continue;
          if ((found && found.left === 0 && tries-- === 0) || assessed-- === 0) break;
          const { crossed, boxes, moves, left, evicted } = assess(callout, gap);
          // Whether a capital's or landmark's name still has a free side beside its marker.
          const roomFor = (m: MarkerText) => {
            const [ax, ay] = anchor;
            const dot = { x0: ax - 5, y0: ay - 5, x1: ax + 5, y1: ay + 5 };
            const blocked = [...boxes.values(), ...placed, callout, dot, ...obstacles, ...leaderZones.filter((z) => leaderZoneOf.get(z) !== label)];
            const w = textWidth(m.text, markerFont, MARKER_WEIGHT);
            return markerNameSides(m.at[0], m.at[1], m.below).some((side) => {
              const b = markerNameBox(side, w, markerFont);
              return b.x0 >= 0 && b.x1 <= viewport.width && b.y0 >= 0 && b.y1 <= viewport.height && !crossed(b) && !blocked.some((o) => overlaps(b, o));
            });
          };
          if (nearBetween.has(callout) && (left > 0 || !markerTexts.every(roomFor))) continue;
          // The selected country's callout, placed before its capital's name (see toCallout), leaves it room.
          const capitalRoom = () => markerTexts.every((m) => !m.key.startsWith("capital-") || roomFor(m));
          if (label.overhang && white(label) && !capitalRoom()) continue;
          // Best first: fewest names left in the way; then a leader crossing no other (Belgium's and the
          // Netherlands', on a 320px map); then leaving the capital's name (placed next) a free side beside its
          // marker (Tallinn's, beside Estonia's and Latvia's callouts on a 320px map); then near; then moving no
          // other name to a callout.
          const cost = left * 32 + (crossing ? 11 : 0) + (close ? 0 : 2) + (evicted.length > 0 ? 1 : 0);
          if (found && cost >= found.cost) continue;
          const full = cost + (capitalOpen && !capitalRoom() ? 7 : 0);
          if (!found || full < found.cost) found = { callout, moves, left, near: close, evicted, cost: full, anchor, fellBack: false };
          if (full === 0) break;
        }
        return found;
      };
      let best = choose(gaps ? CALLOUT_GAP : 0);
      // Right up against a country name only where there is no other clear, nearby position (Luxembourg's, on a
      // 320px map, beside France's or Germany's name).
      if (gaps && (!best || best.cost >= 2)) {
        const tight = choose(0);
        if (tight && (!best || tight.cost < best.cost)) best = tight;
      }
      // A country at the map's edge whose chosen callout reads as a neighbour's: its leader ends on another of
      // the level's countries (Portugal at the left edge of a phone's map, its name over Spain, while the sea
      // below it runs past the map's bottom edge). A position slid back into the view instead, if it is as near
      // (its leader no longer), its leader ends off the level's other countries, it lies less over them (and
      // mostly off them), and it leaves every name clear. Every other callout keeps its position.
      const endsOnNeighbour = (b: Box) => others.some((sh) => insideShape(sh, toWorld(nearestOn(b, anchor))));
      if (edgeFallback && best && best.left === 0 && endsOnNeighbour(best.callout)) {
        const over = depth(best.callout);
        const longest = leaderOf(best.callout) + 1;
        for (const callout of edge().filter((b) => leaderOf(b) <= longest && !endsOnNeighbour(b) && depth(b) < Math.min(0.5, over) && !(label.overhang && crossesLeaders(b)))) {
          const { moves, left, evicted } = assess(callout);
          if (left > 0 || evicted.length > 0) continue;
          best = { callout, moves, left, near: true, evicted, cost: 0, anchor, fellBack: true };
          break;
        }
      }
      // A name over its country keeps its spot there rather than take a distant callout (a long leader reads
      // as pointing at whatever it crosses).
      if (label.overhang && best && (!best.near || best.left > 0)) return null;
      if (best && lastResort) best.cost += 3;
      return best;
    };
    // A larger country's dot is its label point, or, when no position from there is clear, nearby, leaves the
    // capital's name room and moves no other name to a callout, the nearest point of the country from which
    // one is: up to 28 px away, clear of every name, callout, marker and leader (Croatia's, in Dalmatia rather
    // than beside Sarajevo's name, and Latvia's, west of Lithuania's, on a 320px map in Armenian).
    // A label point under another callout or a capital's name is no place for a dot (Bosnia and Herzegovina's,
    // under Montenegro's callout on a 320px map in Armenian): its leader would start beneath it.
    const covered = [...placed, ...markerTextBoxes].some((b) => inBox(label.anchor, b));
    const search = () => {
      let best = covered ? null : bestAt(label.anchor);
      if ((!best || best.cost > 0) && !small.has(label.id) && !label.pinAnchored) {
        const shape = shapeById(label.id);
        const [ax, ay] = label.anchor;
        const busy = [...taken, ...placed, ...markerTextBoxes, ...markerPoints, ...leaderZones.filter((z) => leaderZoneOf.get(z) !== label), ...obstacles];
        let dots = DOT_TRIES;
        for (const [dx, dy] of DOT_MOVES) {
          const dot: Point = [ax + dx, ay + dy];
          const zone = { x0: dot[0] - 5, y0: dot[1] - 5, x1: dot[0] + 5, y1: dot[1] + 5 };
          if (!visible(dot) || busy.some((b) => overlaps(zone, b)) || crossesLeader(zone) || !insideShape(shape, toWorld(dot))) continue;
          if (dots-- === 0) break;
          const there = bestAt(dot);
          if (there && (!best || there.cost < best.cost)) best = there;
          if (best?.cost === 0) break;
        }
      }
      return best;
    };
    // Clear of the route only where that leaves the name a place: otherwise placed as without it (see calloutsClearRoute).
    const searchClear = () => {
      let best = search();
      if ((!best || best.left > 0) && routeLines.length > 0) {
        avoidRoute = false;
        const any = search();
        avoidRoute = true;
        if (any && (!best || any.left < best.left)) best = any;
      }
      return best;
    };
    let best = searchClear();
    // No room on one line anywhere: the name on two lines, where the level asks while the country is
    // highlighted (selected, or on the journey; see twoLineCallouts).
    const highlighted = (view.tones[label.id] ?? "default") !== "default";
    if ((!best || best.left > 0) && lines === null && highlighted && twoLine?.has(label.id) && textMode !== "callouts") {
      const split = twoLines();
      if (split) {
        [lines, width] = split;
        h = lineHeight(true);
        const two = searchClear();
        if (two && (!best || two.left < best.left)) best = two;
        else [lines, width, h] = [null, fullWidth(label) + 2 * pad, lineHeight(false)];
      }
    }
    if (!best) {
      if (!label.overhang) crowded.push(label.id);
      return;
    }
    if (best.fellBack) fellBack = true;
    label.anchor = best.anchor;
    if (!best.near || best.left > 0) crowded.push(label.id);
    // No clear position anywhere (e.g. the close-up closed on a crowded 320px map):
    // leave the name out rather than print it over another. Opening the close-up
    // or zooming in brings it back.
    if (best.left > 0) return;
    label.callout = best.callout;
    label.lines = lines;
    hard.push(best.callout);
    leaders.push([label.anchor, nearestOn(best.callout, label.anchor)]);
    for (const [other, [dx, dy]] of best.moves) {
      const old = other.box as Box;
      const box = moveName(other, dx, dy);
      // Capital and landmark names, placed next, keep clear of the name where it is now.
      const at = taken.indexOf(old);
      if (at >= 0) taken.splice(at, 1, box);
      else taken.push(box);
    }
    for (const other of best.evicted) {
      taken.splice(taken.indexOf(other.box as Box), 1);
      [other.inline, other.box] = [false, null];
    }
  };

  // Marker names go beside their marker (preferred side first), on the first side
  // that stays on screen and clear of country names, callouts, leader lines and
  // other marker names.
  const markerTextBoxes: Box[] = [];
  const crossesLeader = (b: Box) => leaders.some(([a, e]) => segmentHits(a, e, b));
  // Room kept around small countries' leader dots. Once a callout is placed its leader is drawn and
  // checked as a line (crossesLeader), so only its dot is kept clear: a capital beside the dot
  // (Andorra la Vella, beside Andorra's) can then name itself right beside its marker. Larger countries'
  // callouts (names too long for their country) keep their dots clear too.
  const dotZones = () => [
    ...leaderZones.map((zone) => {
      const label = leaderZoneOf.get(zone) as Label;
      if (!label.callout) return zone;
      const [ax, ay] = label.anchor;
      return { x0: ax - 5, y0: ay - 5, x1: ax + 5, y1: ay + 5 };
    }),
    ...labels.flatMap(({ callout, anchor: [ax, ay], id }) => (callout && !small.has(id) ? [{ x0: ax - 5, y0: ay - 5, x1: ax + 5, y1: ay + 5 }] : [])),
  ];
  // A capital's or landmark's name keeps `gap` clear of other names, so two never read as one ("Mostar
  // Bridge" running into "Montenegro" in Armenian on a phone).
  const placeMarkerText = (m: MarkerText, gap: number) => {
    const spaced = (b: Box) => grow(b, gap);
    const callouts = labels.flatMap((o) => (o.callout ? [o.callout] : []));
    const dots = dotZones();
    const [x, y] = m.at;
    const w = textWidth(m.text, markerFont, MARKER_WEIGHT);
    const sides = markerNameSides(x, y, m.below);
    // With another marker close beside this one (Belgrade and Golubac Fortress on a phone,
    // about 20px apart), the sides facing away from it come first, so each name reads as
    // its own marker's rather than sitting right beside the other one.
    const near = markers
      .filter((o) => Math.hypot(o.x - x, o.y - y) > 1 && Math.hypot(o.x - x, o.y - y) < NEAR_MARKER_PX && Math.abs(o.x - x) >= 4)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    const away = (c: [number, number, TextAnchor]) => near !== undefined && (c[2] === "start") === near.x < x;
    const boxOf = (side: [number, number, TextAnchor]) => markerNameBox(side, w, markerFont);
    const fits = (b: Box) => b.x0 >= 0 && b.x1 <= viewport.width && b.y0 >= 0 && b.y1 <= viewport.height;
    // Marker names also keep clear of small countries' leader dots (see above), and never cover another marker
    // (Chapel Bridge's name, over Bern's, on desktop).
    const otherMarkers = markers.filter((o) => Math.hypot(o.x - x, o.y - y) > 1).map((o) => {
      const e = markerExtent(o.kind);
      return { x0: o.x + e.x0, y0: o.y + e.y0, x1: o.x + e.x1, y1: o.y + e.y1 };
    });
    const free = (b: Box) =>
      fits(b) &&
      !crossesLeader(b) &&
      ![...taken, ...callouts, ...markerTextBoxes].some((o) => overlaps(spaced(b), o)) &&
      ![...obstacles, ...dots, ...otherMarkers].some((o) => overlaps(b, o));
    // The sides are tried in groups: the four right beside the marker, then the ones a little further
    // out, then centred above or below it (with a marker close beside, the sides facing away from it,
    // then the rest). In each group, a free side, or else one whose covered country names can all move
    // aside (below). So a name sits right beside its marker wherever a country name can make way for it,
    // rather than further out, where it reads as belonging to the land around it.
    const groups = near
      ? [sides.slice(0, 12).filter(away), sides.slice(0, 12).filter((c) => !away(c)), sides.slice(12)]
      : [sides.slice(0, 4), sides.slice(4, 12), sides.slice(12)];
    // A name above or below its marker spans it: it keeps 8 px clear of every other marker, so it never
    // covers one or sits nearer it than its own (Sagrada Família's Armenian name below Barcelona would reach
    // Madrid's marker on a 320px map).
    const others = markers
      .filter((o) => Math.hypot(o.x - x, o.y - y) > 1)
      .map((o) => {
        const e = markerExtent(o.kind);
        return { x0: o.x + e.x0 - 8, y0: o.y + e.y0 - 8, x1: o.x + e.x1 + 8, y1: o.y + e.y1 + 8 };
      });
    const spanning = sides.slice(12);
    const ownSide = (c: [number, number, TextAnchor]) => !spanning.includes(c) || !others.some((o) => overlaps(boxOf(c), o));
    // No free side (e.g. Amsterdam or Luxembourg City on a small map): take the
    // first side whose covered country names can all move to a free spot inside
    // their own country, and move them.
    const makeRoom = (group: [number, number, TextAnchor][]) => {
      for (const c of group) {
        const b = boxOf(c);
        if (
          !ownSide(c) ||
          !fits(b) ||
          crossesLeader(b) ||
          [...callouts, ...markerTextBoxes].some((o) => overlaps(spaced(b), o)) ||
          [...obstacles, ...dots, ...otherMarkers].some((o) => overlaps(b, o))
        )
          continue;
        const moves = new Map<Label, Point>();
        const placed = (o: Label) => (moves.has(o) ? labelBox(o, ...(moves.get(o) as Point)) : (o.box as Box));
        const movable = labels.every((label) => {
          if (!label.box || !overlaps(label.box, spaced(b))) return true;
          const others = [...labelAvoid.filter((o) => !leaderZones.includes(o)), ...dots, ...callouts, ...markerTextBoxes, spaced(b), ...labels.filter((o) => o !== label && o.box).map(placed)];
          const spot = asideSpot(label, (lb) => onScreen(lb) && !others.some((o) => overlaps(lb, o)) && !crossesLeader(lb));
          if (spot) moves.set(label, spot);
          return spot !== null;
        });
        if (!movable) continue;
        for (const [label, [dx, dy]] of moves) {
          const old = label.box as Box;
          taken.splice(taken.indexOf(old), 1, moveName(label, dx, dy));
        }
        return c;
      }
      return undefined;
    };
    // A landmark's name takes only a free side: country names never move for it. Where none is free, only its
    // marker is drawn, and its name is in the country card below the map (Mostar Bridge, beside Sarajevo and
    // Montenegro on a phone).
    const landmark = m.key.startsWith("landmark-");
    let side: [number, number, TextAnchor] | undefined;
    for (const group of groups) {
      side = group.find((c) => ownSide(c) && free(boxOf(c))) ?? (landmark ? undefined : makeRoom(group));
      if (side) break;
    }
    // Still no room (e.g. Brussels on a 320px map): leave the name out rather than
    // print it over a country name. The marker stays, and zooming in brings it back.
    if (!side) {
      m.hidden = true;
      return;
    }
    [m.x, m.y, m.anchor] = side;
    const b = boxOf(side);
    markerTextBoxes.push(b);
    m.dark = onDark([(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]);
  };

  // A name too long for its country (see Label.overhang) moves to a nearby callout if one is clear of
  // everything placed so far. Its dot at its label point, or where that is taken (by the selected country's
  // own capital or landmark, as with Montenegro's on a phone) the nearest point of the country clear of every
  // other name and of the markers.
  const toCallout = (label: Label) => {
    if (!label.overhang || label.callout || (label.inline && !label.box)) return;
    const [ax, ay] = label.anchor;
    // Null for a name another callout took the spot of (see placeCallout).
    const own = label.box;
    const otherNames = [...taken.filter((b) => b !== own), ...labels.flatMap((o) => (o.callout ? [o.callout] : [])), ...markerTextBoxes];
    const shape = shapeById(label.id);
    const at = DOT_OFFSETS.map(([dx, dy]): Point => [ax + dx, ay + dy]).find(
      ([x, y]) =>
        ![...otherNames, ...markerPoints].some((b) => overlaps({ x0: x - 5, y0: y - 5, x1: x + 5, y1: y + 5 }, b)) &&
        insideShape(shape, toWorld([x, y])),
    );
    if (at) {
      if (own) taken.splice(taken.indexOf(own), 1);
      [label.inline, label.box, label.anchor] = [false, null, at];
      placeCallout(label);
      if (label.callout) return;
      [label.anchor, label.pinAnchored] = [[ax, ay], false];
    }
    // No nearby callout: back over its country, where nothing has moved since; or, if a callout took that
    // spot, any spot over its country still clear of everything placed.
    label.overhang = false;
    if (own) {
      if (!label.inline) taken.push(own);
      [label.inline, label.box] = [true, own];
      return;
    }
    const avoid = [...hard, ...taken, ...markerTextBoxes, ...dotZones()];
    const spot = labelSpot(label, (b) => onScreen(b) && !crossesLeader(b) && !avoid.some((o) => overlaps(b, o)), true, false);
    if (!spot) return;
    label.inline = true;
    taken.push(moveName(label, spot[0], spot[1]));
  };

  // Smallest countries first, as for inline names: Luxembourg has fewest options. Callouts, as always; then
  // the selected country's name (and the traveller's country's) to a callout if it is too long for its
  // country: drawn white, it is unreadable off it (the selected Croatia's, over Serbia and Hungary, in
  // Armenian on a phone); then the capital's name; then the other names too long for their country; then the
  // landmark's name, in whatever room is left.
  const bySize = [...labels].sort((a, b) => screenArea(a.id) - screenArea(b.id));
  const placeCapital = () => {
    for (const m of markerTexts) {
      if (!m.key.startsWith("capital-")) continue;
      // Right up against another name only if there is no other room for it.
      placeMarkerText(m, MARKER_TEXT_GAP);
      if (m.hidden) {
        m.hidden = false;
        placeMarkerText(m, 0);
      }
      if (!m.hidden) hard.push(markerTextBoxes[markerTextBoxes.length - 1]);
    }
    capitalPending = false;
  };
  // Names an earlier layout left out go first (see placeLayout): the capital's, then country names.
  if (first.includes("capital")) placeCapital();
  for (const id of first) {
    const label = labels.find((x) => x.id === id);
    if (label) (label.overhang ? toCallout : placeCallout)(label);
  }
  for (const label of bySize) if (!label.inline && !label.overhang && !first.includes(label.id)) placeCallout(label);
  for (const label of bySize) if (white(label)) toCallout(label);
  if (capitalPending) placeCapital();
  for (const label of bySize) if (!white(label)) toCallout(label);
  for (const m of markerTexts) if (!m.key.startsWith("capital-")) placeMarkerText(m, MARKER_TEXT_GAP);

  return { route, area, insetRect, markers, markerTexts, labels, labelFont, markerFont, calloutHeight, badge, crowded, fellBack };
}

/** Where a capital's or landmark's name may go beside its marker at (x, y), preferred side first. */
function markerNameSides(x: number, y: number, below: boolean): [number, number, TextAnchor][] {
  const up = y - 8;
  const down = y + 18;
  return [
    [x + 9, below ? down : up, "start"],
    [x + 9, below ? up : down, "start"],
    [x - 9, below ? down : up, "end"],
    [x - 9, below ? up : down, "end"],
    // A little further from the marker, when every close side is taken.
    [x + 9, up - 6, "start"],
    [x - 9, up - 6, "end"],
    [x + 9, down + 6, "start"],
    [x - 9, down + 6, "end"],
    [x + 16, up - 6, "start"],
    [x - 16, up - 6, "end"],
    [x + 16, down + 6, "start"],
    [x - 16, down + 6, "end"],
    // Above or below it, spanning it: centred, or starting (or ending) just past it, for a name too long for
    // either side (Andorra la Vella in Armenian on a 320px map, between the map's left edge, or the open
    // close-up, and its controls).
    [x, y - 13, "middle"],
    [x, y + 22, "middle"],
    [x - 4, y - 13, "start"],
    [x + 4, y - 13, "end"],
    [x - 4, y + 22, "start"],
    [x + 4, y + 22, "end"],
  ];
}

/** The box of a capital's or landmark's name, `w` wide, on one side of its marker. */
function markerNameBox([tx, ty, anchor]: [number, number, TextAnchor], w: number, font: number): Box {
  const x0 = anchor === "start" ? tx : anchor === "middle" ? tx - w / 2 : tx - w;
  return { x0, y0: ty - font - 2, x1: x0 + w, y1: ty + 5 };
}

/** Open space kept around names and callouts, and around Luxembourg, free of scenery. */
const SCENERY_CLEARANCE = { text: 6, marker: 4, small: 12 };

/**
 * Screen areas the scenery keeps clear of: every name (with its badge), callout,
 * leader line and marker, and small countries (Luxembourg) with a margin.
 * Scenery gives way; names never move for it.
 */
function sceneryClearance(map: RegionMapData, small: ReadonlySet<CountryId>, layout: OverlayLayout, transform: Transform): Box[] {
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
    if (small.has(label.id)) {
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
 * screen position. Country names stay on the same spot of their country;
 * callouts and marker names keep their offset from their anchor. Everything
 * keeps its size. Used during a gesture, so names stay on their countries; the
 * layout is made again once the view settles.
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
      if (label.callout) return { ...label, anchor: a, callout: shift(label.callout, moved(label.anchor, a)) };
      // A name moved inside its country (dx, dy) stays on that spot of the country.
      const [dx, dy] = [label.dx * s, label.dy * s];
      const d: Point = [a[0] + dx - label.anchor[0] - label.dx, a[1] + dy - label.anchor[1] - label.dy];
      return { ...label, anchor: a, dx, dy, box: label.box && shift(label.box, d) };
    }),
  };
}

/**
 * Inexpensive checks on a layout followed during a gesture (see followView),
 * instead of placing everything again on every frame. A country name pushed past
 * the edge of the view moves back in, if only a little and still over its own
 * country; a callout slides back along the edge while its country's dot is in
 * view; a capital or landmark name tries the other side of its marker. Anything
 * still off screen, under the map controls or the close-up, or over a name kept
 * before it is left out until the view settles and the full layout runs again.
 * Only ever leaves names out: never shows one the layout left out.
 */
function keepInView(layout: OverlayLayout, map: RegionMapData, view: Transform, viewport: { width: number; height: number }, obstacles: Box[]): OverlayLayout {
  const { width, height } = viewport;
  const kept: Box[] = [];
  const clear = (b: Box, m: number) =>
    b.x0 >= m && b.y0 >= m && b.x1 <= width - m && b.y1 <= height - m && !obstacles.some((o) => overlaps(b, o)) && !kept.some((o) => overlaps(b, o));
  const inView = ([x, y]: Point) => x >= 0 && y >= 0 && x <= width && y <= height;
  const omitted = (label: Label): Label => ({ ...label, inline: false, callout: null, box: null });

  const labels = [...layout.labels];
  // Callouts first (small countries have the least room), then names on their countries.
  labels.forEach((label, i) => {
    const c = label.callout;
    if (!c) return;
    if (!inView(label.anchor) || obstacles.some((o) => inBox(label.anchor, o))) {
      labels[i] = omitted(label);
      return;
    }
    const [w, h] = [c.x1 - c.x0, c.y1 - c.y0];
    const x0 = clamp(c.x0, 4, width - 4 - w);
    const y0 = clamp(c.y0, 4, height - 4 - h);
    const callout = { x0, y0, x1: x0 + w, y1: y0 + h };
    if (!clear(callout, 2)) {
      labels[i] = omitted(label);
      return;
    }
    kept.push(callout);
    labels[i] = { ...label, callout };
  });
  labels.forEach((label, i) => {
    const b = label.box;
    if (label.callout || !label.inline || !b) return;
    const m = 2;
    const ox = b.x0 < m ? m - b.x0 : b.x1 > width - m ? width - m - b.x1 : 0;
    const oy = b.y0 < m ? m - b.y0 : b.y1 > height - m ? height - m - b.y1 : 0;
    if (ox !== 0 || oy !== 0) {
      const [cx, cy] = [label.anchor[0] + label.dx + ox, label.anchor[1] + label.dy + oy];
      const shape = map.shapes.find((s) => s.id === label.id);
      const onCountry = shape && insideShape(shape, [(cx - view.x) / view.k, (cy - view.y) / view.k]);
      if (Math.abs(ox) > (b.x1 - b.x0) / 2 || Math.abs(oy) > b.y1 - b.y0 || !onCountry) {
        labels[i] = omitted(label);
        return;
      }
    }
    const box = { x0: b.x0 + ox, y0: b.y0 + oy, x1: b.x1 + ox, y1: b.y1 + oy };
    if (!clear(box, m)) {
      labels[i] = omitted(label);
      return;
    }
    kept.push(box);
    labels[i] = { ...label, dx: label.dx + ox, dy: label.dy + oy, box };
  });

  const markerTexts = layout.markerTexts.map((m) => {
    if (m.hidden) return m;
    const w = textWidth(m.text, layout.markerFont, MARKER_WEIGHT);
    const boxOf = (x: number, anchor: TextAnchor): Box => {
      const x0 = anchor === "start" ? x : anchor === "middle" ? x - w / 2 : x - w;
      return { x0, y0: m.y - layout.markerFont - 2, x1: x0 + w, y1: m.y + 5 };
    };
    // The other side; a centred name (above or below its marker) has only its own place.
    const other: TextAnchor = m.anchor === "start" ? "end" : m.anchor === "end" ? "start" : "middle";
    for (const [x, anchor] of [
      [m.x, m.anchor],
      [2 * m.at[0] - m.x, other],
    ] as const) {
      const b = boxOf(x, anchor);
      if (clear(b, 0)) {
        kept.push(b);
        return { ...m, x, anchor };
      }
    }
    return { ...m, hidden: true };
  });

  return { ...layout, labels, markerTexts };
}

/** The main map's overlay, following the live view during a gesture (see followView and keepInView). */
function LiveOverlay({ live, layout, ...props }: OverlayProps & { live: LiveView; layout: OverlayLayout }) {
  const view = useSyncExternalStore(live.subscribe, live.get, live.get);
  const { map, viewport, obstacles, transform } = props;
  const followed = useMemo(() => {
    const moved = followView(layout, transform, view);
    return moved === layout ? layout : timed("follow", () => keepInView(moved, map, view, viewport, obstacles));
  }, [layout, transform, view, map, viewport, obstacles]);
  return <Overlay {...props} layout={followed} />;
}

function Overlay({ motion, layout: given, ...input }: OverlayProps) {
  const { l, name } = useI18n();
  const maskId = useId();
  const layout = given ?? layoutOverlay({ ...input, l, name });
  const { view } = input;
  const { route, labels, labelFont, markerFont, calloutHeight, badge } = layout;

  // The newest move (capital → border crossing → capital, with any turning points) is drawn separately and revealed along its path.
  const { routeStops } = input;
  const from = motion?.grewFrom;
  const growing = from != null && routeStops[from + 1] !== undefined && route.length > routeStops[from + 1];
  const split = growing ? routeStops[from] : route.length - 1;
  const settled = route.slice(0, split + 1);
  const fresh = growing ? route.slice(split, routeStops[from + 1] + 1) : [];
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
            <g key={`capital-${m.country}`} transform={`translate(${m.x},${m.y})`} data-marker="capital">
              <circle className={styles.capital} r={5.5} />
              <circle className={styles.capitalDot} r={2.8} />
            </g>
          );
        if (m.kind === "landmark")
          return (
            <g key={`landmark-${m.country}`} transform={`translate(${m.x},${m.y})`} data-marker="landmark">
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
        // The country's own capital marker on the dot (Andorra la Vella's on Andorra's, when it is selected on a
        // phone): the marker stands for the dot, as the traveller's pin does, so the capital stays in view; the
        // leader starts at the marker's edge.
        const capital = label.pinAnchored ? undefined : layout.markers.find((m) => m.kind === "capital" && m.country === id && Math.hypot(m.x - ax, m.y - ay) <= CAPITAL_ON_DOT);
        const [sx, sy] = capital ? edgeToward([capital.x, capital.y], [ex, ey], CAPITAL_EDGE) : [ax, ay];
        return (
          <g key={`label-${id}`} data-callout={id} data-label={id} data-leader-from={capital ? "capital" : undefined}>
            {Math.hypot(ex - sx, ey - sy) > 0.5 && <line className={styles.leader} x1={sx} y1={sy} x2={ex} y2={ey} />}
            {/* With the traveller on it, the pin replaces the dot. While the pin is
                still landing, the dot shows until it arrives. */}
            {capital ? null : !label.pinAnchored ? (
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
            {label.lines ? (
              // Two lines, each centred; the badge follows the second.
              label.lines.map((line, i) => {
                const step = Math.round(labelFont * CALLOUT_LINE_STEP);
                const y = (callout.y0 + callout.y1) / 2 + (i === 0 ? -step / 2 : step / 2);
                const x = (callout.x0 + callout.x1) / 2 - (i === 1 ? shift : 0);
                return (
                  <Fragment key={i}>
                    <text className={`${styles.calloutText} ${toneClass}`} fontSize={labelFont} x={x} y={y} textAnchor="middle" dominantBaseline="central">
                      {line}
                    </text>
                    {i === 1 && explored && <ExploredBadge cx={x + textWidth(line, labelFont, LABEL_WEIGHT) / 2 + badge.gap + badge.r} cy={y} r={badge.r} onDark={false} />}
                  </Fragment>
                );
              })
            ) : (
              <>
                <text className={`${styles.calloutText} ${toneClass}`} fontSize={labelFont} x={mid} y={(callout.y0 + callout.y1) / 2} textAnchor="middle" dominantBaseline="central">
                  {text}
                </text>
                {explored && <ExploredBadge cx={mid + label.textWidth / 2 + badge.gap + badge.r} cy={(callout.y0 + callout.y1) / 2} r={badge.r} onDark={false} />}
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, PixelRatio, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { getCountry } from "@/core/content/countries";
import type { CountryId } from "@/core/content/types";
import type { CountryTone, MapView } from "@/core/lesson/mapView";
import type { LessonStage } from "@/core/lesson/progress";
import type { LessonDefinition } from "@/core/lessons/types";
import { insideOutlineOf } from "@/geo/hitTest";
import { viewLimits, type RegionMap, type ScreenMark, type Transform } from "@/geo/regionMap";
import { routeLine, routeSettings } from "@/geo/route";
import { RING_RADIUS, type Ring } from "@/core/challenge/smallCountries";
import { useI18n } from "../i18n/i18n";
import { colors, mapColors, radius, space, TAP, type } from "../theme/tokens";
import { isBase, mapPadding, toScreen, toWorld, zoomTo, type CameraLimits } from "./camera";
import { BADGE_SIZE, LABEL_FONT, placeLabels, textWidth, type Box, type LabelRequest } from "./labels";
import { controlsBox, MapControls } from "./MapControls";
import { countryAt, ringsFor } from "./pick";
import { useMapGesture } from "./useMapGesture";

interface Props {
  lesson: LessonDefinition;
  /** The level's map (useRegionMap); null while it is being prepared. */
  map: RegionMap | null;
  /** What the game shows on the map now (buildMapView, shared with the website). */
  view: MapView;
  stage: LessonStage;
  /** A tap on a country, while the view takes answers (view.interactive). */
  onCountryTap: (country: CountryId) => void;
  reducedMotion: boolean;
}

const TONE_FILL: Record<CountryTone, string> = {
  default: mapColors.land,
  selected: mapColors.teal,
  correct: mapColors.teal,
  visited: mapColors.teal,
  current: mapColors.tealDark,
  wrong: mapColors.wrong,
  reveal: mapColors.amber,
  destination: mapColors.amber,
};
const DARK_TONES: ReadonlySet<CountryTone> = new Set(["selected", "correct", "visited", "current"]);

/** Markers' extent around their point (px), as the website's: the traveller's pin stands 23px above its capital. */
const PIN_BOX = { x0: -8, y0: -23, x1: 8, y1: 2 };
const MARK_BOX = { x0: -7, y0: -7, x1: 7, y1: 7 };
const FLASH_MS = 900;
/** Room each side of a callout's name within its pill, past its box. */
const PILL_PAD = 4;
/** A ring's dashes and gaps, evenly round it (the Quick Challenge's twelve). */
const RING_DASH = (2 * Math.PI * RING_RADIUS) / 24;

/**
 * A level's map in play: the website's shapes (src/geo/regionMap.ts) drawn with react-native-svg, marked as the game
 * says (buildMapView: each country's tone, names, capital and landmark markers, the traveller, the route, Find's hint
 * circle and the latest answer's outline). Pinch and drag to zoom and pan, within the website's limits (camera.ts);
 * a tap answers only when it is a tap (gesture.ts), on the country under the finger (pick.ts), or in Discover and Find
 * inside the ring of a country too small to tap (the Quick Challenge's small-country rings). Zoom buttons do the
 * same without gestures. For screen readers each of the level's countries is a target where it is on the map, named
 * as the website names it (unnamed in Find, where naming it would give the answer away).
 */
export function LessonMap({ lesson, map, view, stage, onCountryTap, reducedMotion }: Props) {
  const { t, name } = useI18n();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.width - width) > 0.5 || Math.abs(size.height - height) > 0.5) setSize({ width, height });
  };

  const travelling = stage === "travel" || stage === "results";
  // In Travel and its Results, countries Travel can also enter are drawn as the level's own (LessonDefinition.travelOnly).
  const active = useMemo(() => (travelling ? [...lesson.countries, ...(lesson.travelOnly ?? [])] : lesson.countries), [lesson, travelling]);

  // The zoom buttons, top right (MapControls). Names keep clear of them, and so does the traveller in the start view
  // (the website's clearOf).
  const placed = useMemo(() => (size ? controlsBox(size) : null), [size]);
  const controls = placed?.box ?? null;

  const markers = view.markers;
  const marks = useMemo<ScreenMark[]>(
    () =>
      map
        ? markers.map((m) => ({
            at: map.project(m.coordinates),
            extent: m.kind === "current" ? PIN_BOX : MARK_BOX,
            keep: m.kind === "current" && (lesson.travelOnly ?? []).includes(m.country),
            clearOf: m.kind === "current" && controls ? [controls] : undefined,
          }))
        : [],
    [map, markers, lesson, controls],
  );
  const limits = useMemo<CameraLimits | null>(
    () => (map && size ? viewLimits(map, size.width, size.height, mapPadding(size.width, size.height), marks, travelling) : null),
    [map, size, marks, travelling],
  );

  const [camera, setCamera] = useState<Transform | null>(null);
  // The start view the camera last followed: a new one (another size, the traveller moved) is followed only while
  // the player hasn't moved the map away from the last; otherwise their view is kept, within the new limits.
  const followed = useRef<Transform | null>(null);
  // Each stage starts at the whole map.
  const shownStage = useRef(stage);
  useEffect(() => {
    if (!limits || !size) return;
    const newStage = shownStage.current !== stage;
    shownStage.current = stage;
    setCamera((current) => {
      const wasBase = newStage || !current || !followed.current || isBase(current, followed.current);
      followed.current = limits.base;
      if (wasBase) return limits.base;
      return zoomTo(current, current.k, [size.width / 2, size.height / 2], size.width, size.height, limits);
    });
  }, [limits, size, stage]);

  const responder = useMapGesture({
    camera,
    size,
    limits,
    onCamera: setCamera,
    onTap: (start, end) => {
      if (!camera || !map || !view.interactive) return;
      // The same country where the press began and ended (the website's rule).
      const country = countryAt(map.shapes, active, camera, end, rings);
      if (country && country === countryAt(map.shapes, active, camera, start, rings)) onCountryTap(country);
    },
  });

  // Small-country rings while the map takes countries (Discover, Find), each while its country is drawn too small.
  const rings = map && camera && (stage === "discover" || stage === "find") ? ringsFor(map.shapes, lesson.countries, camera, map.project) : [];

  const ready = map && size && camera && limits;
  return (
    <View style={styles.frame} onLayout={onLayout}>
      {ready ? (
        <>
          <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" {...responder}>
            <MapDrawing lesson={lesson} map={map} view={view} active={active} camera={camera} size={size} rings={rings} keepClear={controls ? [controls] : []} reducedMotion={reducedMotion} />
          </View>
          <CountryTargets map={map} view={view} active={active} camera={camera} size={size} onCountryTap={onCountryTap} name={name} t={t} />
          <MapControls camera={camera} limits={limits} size={size} inRow={!!placed?.inRow} onCamera={setCamera} />
        </>
      ) : (
        <Text style={styles.loading}>{t("app.loading")}</Text>
      )}
    </View>
  );
}

interface DrawingProps {
  lesson: LessonDefinition;
  map: RegionMap;
  view: MapView;
  active: readonly CountryId[];
  camera: Transform;
  size: { width: number; height: number };
  rings: readonly Ring[];
  /** Areas on the map names keep clear of (the zoom buttons). */
  keepClear: readonly Box[];
  reducedMotion: boolean;
}

function MapDrawing({ lesson, map, view, active, camera, size, rings, keepClear, reducedMotion }: DrawingProps) {
  const { name } = useI18n();
  const flash = useAnswerFlash(view);
  const fontSize = LABEL_FONT * Math.min(1.35, Math.max(1, PixelRatio.getFontScale()));
  const project = (p: readonly [number, number]) => toScreen(camera, map.project(p));
  const labelPoint = (id: CountryId) => project(map.labels[id] ?? getCountry(id).label.coordinates);
  const shapeOf = (id: CountryId) => map.shapes.find((s) => s.id === id);

  const markers = view.markers.map((m) => ({ ...m, at: project(m.coordinates) }));
  const markerBoxes: Box[] = markers.map(({ kind, at: [x, y] }) => {
    const e = kind === "current" ? PIN_BOX : MARK_BOX;
    return { x0: x + e.x0, y0: y + e.y0, x1: x + e.x1, y1: y + e.y1 };
  });

  const explored = new Set(view.explored);
  const requests: LabelRequest[] = view.labels.map((id) => {
    const shape = shapeOf(id);
    const bounds = shape?.bounds;
    return {
      id,
      text: name(id),
      anchor: labelPoint(id),
      width: bounds ? (bounds[1][0] - bounds[0][0]) * camera.k : 0,
      small: (lesson.map.smallCountries ?? []).includes(id),
      badge: explored.has(id),
      covers: (p) => !shape || insideOutlineOf(shape, toWorld(camera, p)) !== false,
    };
  });
  const ringBoxes: Box[] = rings.map(({ x, y }) => ({ x0: x - RING_RADIUS, y0: y - RING_RADIUS, x1: x + RING_RADIUS, y1: y + RING_RADIUS }));
  const labels = placeLabels(requests, [...markerBoxes, ...ringBoxes, ...keepClear], size, fontSize);

  // Find's hint: a circle around the country's label point, sized from its area, capped (the website's).
  let area: { cx: number; cy: number; r: number } | null = null;
  const hinted = view.areaHint ? shapeOf(view.areaHint) : undefined;
  if (view.areaHint && hinted) {
    const [[x0, y0], [x1, y1]] = hinted.bounds;
    const [cx, cy] = labelPoint(view.areaHint);
    const extent = Math.sqrt((x1 - x0) * (y1 - y0)) * camera.k;
    const cap = Math.max(34, Math.min(size.width, size.height) * 0.3);
    area = { cx, cy, r: Math.min(Math.max(34, extent * 0.55), cap) };
  }

  const route = view.route.length > 1 ? routeLine(view.route, routeSettings(lesson)).map(project) : [];
  const flashShape = flash ? shapeOf(flash.country) : undefined;

  return (
    <Svg width={size.width} height={size.height}>
      <Rect width={size.width} height={size.height} fill={mapColors.sea} />
      <G transform={`translate(${camera.x} ${camera.y}) scale(${camera.k})`}>
        <CountryLayer map={map} active={active} tones={view.tones} />
        {flash && flashShape && <AnswerFlash key={flash.key} d={flashShape.d} kind={flash.kind} reducedMotion={reducedMotion} />}
      </G>
      {rings.map((ring) => {
        const tone = view.tones[ring.id];
        return (
          <G key={`ring-${ring.id}`}>
            <Circle cx={ring.x} cy={ring.y} r={RING_RADIUS} fill="none" stroke={mapColors.ringHalo} strokeWidth={3.5} />
            <Circle
              cx={ring.x}
              cy={ring.y}
              r={RING_RADIUS}
              fill={tone && tone !== "default" ? TONE_FILL[tone] : mapColors.ringFill}
              fillOpacity={tone && tone !== "default" ? 0.6 : 1}
              stroke={colors.ink}
              strokeWidth={1.25}
              strokeDasharray={`${RING_DASH} ${RING_DASH}`}
            />
          </G>
        );
      })}
      {area && <Circle cx={area.cx} cy={area.cy} r={area.r} fill={mapColors.hintFill} stroke={mapColors.amberDark} strokeWidth={2.5} strokeDasharray="8 6" />}
      {route.length > 1 && (
        <Polyline
          points={route.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke={mapColors.route}
          strokeWidth={3}
          strokeDasharray="2 6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {markers.map((m) => (
        <G key={`${m.kind}-${m.country}`} transform={`translate(${m.at[0]} ${m.at[1]})`}>
          {m.kind === "capital" && (
            <>
              <Circle r={5.5} fill={colors.white} stroke={mapColors.markerRing} strokeWidth={1} />
              <Circle r={2.6} fill={mapColors.coral} />
            </>
          )}
          {m.kind === "landmark" && <Rect x={-4.5} y={-4.5} width={9} height={9} rx={1.5} transform="rotate(45)" fill={mapColors.amber} stroke={colors.white} strokeWidth={1.5} />}
          {m.kind === "current" && (
            <>
              <Ellipse rx={4.5} ry={1.8} fill={mapColors.pinShadow} />
              <Path d="M0 0C-1.6-4.6-7.5-8.5-7.5-14.5a7.5 7.5 0 1 1 15 0C7.5-8.5 1.6-4.6 0 0z" fill={colors.ink} stroke={colors.white} strokeWidth={1.6} strokeLinejoin="round" />
              <Circle cy={-14.5} r={2.9} fill={colors.white} />
            </>
          )}
        </G>
      ))}
      {labels.map((label) => {
        const tone = view.tones[label.id] ?? "default";
        const onDark = !label.callout && DARK_TONES.has(tone);
        const destination = !label.callout && tone === "destination";
        const fill = onDark ? mapColors.labelOnDark : destination ? mapColors.labelDestination : mapColors.label;
        const halo = onDark ? mapColors.labelOnDarkHalo : destination ? mapColors.labelDestinationHalo : mapColors.labelHalo;
        const badge = explored.has(label.id);
        const textW = textWidth(name(label.id), fontSize);
        // The name's centre, left of the box's when the explored check follows it.
        const cx = label.at[0] - (badge ? (BADGE_SIZE + 4) / 2 : 0);
        const baseline = label.at[1] + fontSize * 0.36;
        const text = name(label.id);
        return (
          <G key={label.id}>
            {label.callout && (
              <>
                <Line x1={label.callout.anchor[0]} y1={label.callout.anchor[1]} x2={label.at[0]} y2={label.at[1]} stroke={mapColors.label} strokeWidth={1.5} strokeLinecap="round" />
                <Circle cx={label.callout.anchor[0]} cy={label.callout.anchor[1]} r={3} fill={mapColors.label} stroke={colors.white} strokeWidth={1.5} />
                <Rect
                  x={label.box.x0 - PILL_PAD}
                  y={label.box.y0}
                  width={label.box.x1 - label.box.x0 + 2 * PILL_PAD}
                  height={label.box.y1 - label.box.y0}
                  rx={(label.box.y1 - label.box.y0) / 2}
                  fill={colors.white}
                  stroke="rgba(31, 58, 95, 0.55)"
                  strokeWidth={1.2}
                />
              </>
            )}
            {!label.callout && (
              <SvgText x={cx} y={baseline} fontSize={fontSize} fontWeight="700" textAnchor="middle" fill={halo} stroke={halo} strokeWidth={3} strokeLinejoin="round">
                {text}
              </SvgText>
            )}
            <SvgText x={cx} y={baseline} fontSize={fontSize} fontWeight="700" textAnchor="middle" fill={fill}>
              {text}
            </SvgText>
            {badge && (
              <G transform={`translate(${cx + textW / 2 + 4 + BADGE_SIZE / 2} ${label.at[1]})`}>
                <Circle r={BADGE_SIZE / 2} fill={onDark ? colors.white : mapColors.tealDark} stroke={onDark ? "none" : colors.white} strokeWidth={1.2} />
                <Path d="M-3 0.2l2 2 4-4.2" fill="none" stroke={onDark ? mapColors.tealDark : colors.white} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </G>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

/** The countries, memoised so that moving the map only changes the group's transform, not every path. */
const CountryLayer = memo(function CountryLayer({ map, active, tones }: { map: RegionMap; active: readonly CountryId[]; tones: MapView["tones"] }) {
  const own = map.shapes.filter((s) => active.includes(s.id));
  const context = map.shapes.filter((s) => !active.includes(s.id));
  return (
    <>
      {/* A soft line along every coast, under the land. */}
      {map.shapes.map((s) => s.coast && <Path key={`coast-${s.id}`} d={s.coast} fill="none" stroke={mapColors.coast} strokeWidth={3.5} vectorEffect="non-scaling-stroke" />)}
      {context.map((s) => (
        <Path key={s.id} d={s.d} fill={mapColors.context} stroke={mapColors.contextBorder} strokeWidth={0.7} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      ))}
      {own.map((s) => (
        <Path key={s.id} d={s.d} fill={TONE_FILL[tones[s.id] ?? "default"]} stroke={mapColors.landBorder} strokeWidth={1.2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      ))}
    </>
  );
});

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The latest answer's outline (Find; a non-neighbour chosen in Travel), fading out once; held still with reduced motion. */
function AnswerFlash({ d, kind, reducedMotion }: { d: string; kind: "correct" | "wrong"; reducedMotion: boolean }) {
  const [opacity] = useState(() => new Animated.Value(1));
  const [shown, setShown] = useState(true);
  useEffect(() => {
    if (reducedMotion) {
      const timer = setTimeout(() => setShown(false), FLASH_MS);
      return () => clearTimeout(timer);
    }
    const animation = Animated.timing(opacity, { toValue: 0, duration: FLASH_MS, delay: 300, useNativeDriver: false });
    animation.start(({ finished }) => finished && setShown(false));
    return () => animation.stop();
  }, [opacity, reducedMotion]);
  if (!shown) return null;
  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={kind === "correct" ? mapColors.tealDark : mapColors.coral}
      strokeWidth={kind === "correct" ? 4 : 3}
      strokeLinejoin="round"
      strokeOpacity={opacity}
      vectorEffect="non-scaling-stroke"
    />
  );
}

/**
 * The latest answer, only if it happened while this map was on screen (the website's useAnswerFlash): feedback
 * restored from the save, or unchanged by a language switch, is not emphasised again.
 */
function useAnswerFlash(view: MapView) {
  const key = view.feedback?.key ?? null;
  const [state, setState] = useState<{ key: string | null; flash: MapView["feedback"] }>({ key, flash: null });
  if (state.key !== key) {
    const next = { key, flash: view.feedback };
    setState(next);
    return next.flash;
  }
  return state.flash;
}

/**
 * The level's countries for screen readers (TalkBack): a target on each where its name is drawn, read as the website
 * reads its map (named in Discover and where the game names it; "Country on the map" otherwise), activated to answer
 * while the map takes answers. Fingers pass through them to the map.
 */
function CountryTargets({
  map,
  view,
  active,
  camera,
  size,
  onCountryTap,
  name,
  t,
}: {
  map: RegionMap;
  view: MapView;
  active: readonly CountryId[];
  camera: Transform;
  size: { width: number; height: number };
  onCountryTap: (id: CountryId) => void;
  name: (id: CountryId) => string;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const labels = new Set(view.labels);
  const explored = new Set(view.explored);
  return (
    <>
      {active.map((id) => {
        const [x, y] = toScreen(camera, map.project(map.labels[id] ?? getCountry(id).label.coordinates));
        if (x < 0 || y < 0 || x > size.width || y > size.height) return null;
        const named = view.namesPublic || labels.has(id);
        const label = named ? (explored.has(id) ? t("map.exploredCountry", { country: name(id) }) : name(id)) : t("map.unnamedCountry");
        return (
          <View
            key={id}
            pointerEvents="none"
            accessible
            accessibilityRole={view.interactive ? "button" : "text"}
            accessibilityLabel={label}
            accessibilityActions={view.interactive ? [{ name: "activate" }] : undefined}
            onAccessibilityAction={view.interactive ? () => onCountryTap(id) : undefined}
            style={[styles.target, { left: x - TAP / 2, top: y - TAP / 2 }]}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, borderRadius: radius.md, overflow: "hidden", backgroundColor: mapColors.sea },
  loading: { ...type.body, color: colors.ink, textAlign: "center", marginTop: space.xl },
  target: { position: "absolute", width: TAP, height: TAP },
});

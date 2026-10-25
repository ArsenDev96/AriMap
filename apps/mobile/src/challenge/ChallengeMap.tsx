import { memo, useEffect, useMemo, useState } from "react";
import { PixelRatio, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { RING_COUNTRIES } from "@/core/challenge/europe";
import { RING_RADIUS, type Ring } from "@/core/challenge/smallCountries";
import { COUNTRIES } from "@/core/content/countries";
import type { CountryId, LonLat } from "@/core/content/types";
import { fitWithRings, viewAt } from "@/geo/challengeCamera";
import type { ChallengeMapData } from "@/geo/challengeMap";
import { insideOutlineOf } from "@/geo/hitTest";
import type { Point, Transform } from "@/geo/regionMap";
import { useI18n } from "../i18n/i18n";
import { toScreen, toWorld, type CameraLimits } from "../map/camera";
import { LABEL_FONT, placeLabels, type Box, type LabelRequest } from "../map/labels";
import { controlsBox, MapControls } from "../map/MapControls";
import { countryAt, ringsFor } from "../map/pick";
import { useMapGesture } from "../map/useMapGesture";
import { colors, mapColors, radius, space, type } from "../theme/tokens";

/** Colours a country can show (the website's ChallengeMap): found, where a missed one was, the player's wrong choice. */
export type ChallengeTone = "correct" | "missed" | "chosen";

const TONE_FILL: Record<ChallengeTone, string> = {
  correct: mapColors.teal,
  missed: mapColors.amber,
  chosen: mapColors.coral,
};

/** As far in as the website's challenge map zooms, relative to the start view. */
const MAX_ZOOM = 6;
/** A ring's dashes and gaps, evenly round it (the website's twelve). */
const RING_DASH = (2 * Math.PI * RING_RADIUS) / 24;

interface Props {
  map: ChallengeMapData | null;
  /** The countries that can be answered (the round's pool); the rest is context, paler, never an answer. */
  pool: readonly CountryId[];
  tones: Readonly<Partial<Record<CountryId, ChallengeTone>>>;
  /** Countries named on the map (Results and the review), most important first; none during a round. */
  names: readonly CountryId[];
  /** A country outlined and zoomed to (the review's selection); null shows the map as the player left it. */
  focus: CountryId | null;
  /** A pool country tapped (while the round asks); without it taps answer nothing, the map still pans and zooms. */
  onTap?: (country: CountryId) => void;
  /** A new value (a new round) brings the start view back. */
  viewKey: unknown;
  /** Called with whether the map is drawn and can take answers (the round may then start). */
  onReady?: (ready: boolean) => void;
}

/** A country's label point: its content's, or a small country's ring point (the website's labelPoint). */
const labelPoint = (id: CountryId): LonLat | null => COUNTRIES[id]?.label.coordinates ?? RING_COUNTRIES[id] ?? null;

/**
 * The Quick Challenge's map in the app: the whole of Europe without names (src/geo/challengeMap.ts, the website's
 * data and projection), drawn as the lesson map is (react-native-svg, the flat palette), from the website's start
 * view (challengeCamera.ts: the frame with every small-country ring whole) to six times it. Pinch and drag move it; a
 * tap answers only when it is one (useMapGesture), on the pool country under the finger where the press began and
 * ended, or inside a small country's ring (pick.ts, the shared ring rules). For screen readers it is one image, named
 * as the website names it: answering needs the map, as on the website; Skip, the feedback, Results and the review are
 * all words.
 */
export function ChallengeMap({ map, pool, tones, names, focus, onTap, viewKey, onReady }: Props) {
  const { t } = useI18n();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.width - width) > 0.5 || Math.abs(size.height - height) > 0.5) setSize({ width, height });
  };
  const placed = useMemo(() => (size ? controlsBox(size) : null), [size]);

  // The start view: the frame (Iceland to the Urals, Cape Nordkinn to Crete) with every ring whole, never past the
  // coverage (the website's, challengeCamera.ts).
  const limits = useMemo<CameraLimits | null>(() => {
    if (!map || !size) return null;
    const [[c0x, c0y], [c1x, c1y]] = map.coverage;
    const padding = Math.max(8, Math.min(size.width, size.height) * 0.03);
    const rings = Object.values(RING_COUNTRIES).map((p) => map.project(p));
    const fit = fitWithRings(map.focusBounds, rings, size.width, size.height, padding);
    const k = Math.max(fit.k, size.width / (c1x - c0x), size.height / (c1y - c0y));
    const base = viewAt(map.coverage, k, fit.cx, fit.cy, size.width, size.height);
    return { base, minScale: base.k, translateExtent: map.coverage, maxZoom: MAX_ZOOM };
  }, [map, size]);

  // The view each moment starts from: a new round (viewKey) or another size, the start view; the review's selection,
  // zoomed to it (its whole shape in about two thirds of the map, as the website does), and the start view again when
  // it ends. The player's pinches and drags hold until that moment changes.
  const start = useMemo(() => {
    if (!map || !limits || !size) return null;
    const shape = focus ? map.shapes.find((s) => s.id === focus) : undefined;
    if (!shape) return { view: limits.base, key: viewKey };
    const [[x0, y0], [x1, y1]] = shape.bounds;
    const k = Math.min((size.width * 2) / 3 / Math.max(1e-6, x1 - x0), (size.height * 2) / 3 / Math.max(1e-6, y1 - y0));
    const zoom = Math.min(limits.base.k * MAX_ZOOM, Math.max(limits.base.k, k));
    return { view: viewAt(map.coverage, zoom, (x0 + x1) / 2, (y0 + y1) / 2, size.width, size.height), key: viewKey };
  }, [map, limits, size, viewKey, focus]);
  const [moved, setMoved] = useState<{ from: object; view: Transform } | null>(null);
  const camera = start ? (moved?.from === start ? moved.view : start.view) : null;
  const setCamera = (view: Transform) => start && setMoved({ from: start, view });

  const ready = !!(map && size && camera && limits);
  useEffect(() => onReady?.(ready), [ready, onReady]);

  const rings = map && camera ? ringsFor(map.shapes, pool, camera, map.project) : [];
  const responder = useMapGesture({
    camera,
    size,
    limits,
    onCamera: setCamera,
    onTap: (start, end) => {
      if (!map || !camera || !onTap) return;
      // The same pool country where the press began and ended; a context country answers nothing.
      const country = countryAt(map.shapes, pool, camera, end, rings);
      if (country && pool.includes(country) && country === countryAt(map.shapes, pool, camera, start, rings)) onTap(country);
    },
  });

  return (
    <View style={styles.frame} onLayout={onLayout}>
      {ready ? (
        <>
          <View style={StyleSheet.absoluteFill} accessible accessibilityRole="image" accessibilityLabel={t("challengeGame.mapLabel")} {...responder}>
            <Drawing map={map} pool={pool} tones={tones} names={names} focus={focus} camera={camera} size={size} rings={rings} keepClear={placed ? [placed.box] : []} />
          </View>
          <MapControls camera={camera} limits={limits} size={size} inRow={!!placed?.inRow} onCamera={setCamera} />
        </>
      ) : (
        <Text style={styles.loading}>{t("challengeGame.loading")}</Text>
      )}
    </View>
  );
}

interface DrawingProps {
  map: ChallengeMapData;
  pool: readonly CountryId[];
  tones: Props["tones"];
  names: readonly CountryId[];
  focus: CountryId | null;
  camera: Transform;
  size: { width: number; height: number };
  rings: readonly Ring[];
  keepClear: readonly Box[];
}

function Drawing({ map, pool, tones, names, focus, camera, size, rings, keepClear }: DrawingProps) {
  const { name } = useI18n();
  const fontSize = LABEL_FONT * Math.min(1.35, Math.max(1, PixelRatio.getFontScale()));
  const project = (p: readonly [number, number]): Point => toScreen(camera, map.project(p));

  // Names (Results and the review): the focus first, then the round's countries, each at its label point, the nearest
  // clear place or a callout (labels.ts), clear of the rings, the buttons and each other; one with no clear place is
  // left out until zooming makes room, as on the website.
  const ordered = focus ? [focus, ...names.filter((id) => id !== focus)] : names;
  const requests: LabelRequest[] = ordered.flatMap((id) => {
    const point = labelPoint(id);
    const shape = map.shapes.find((s) => s.id === id);
    if (!point || !shape) return [];
    const [[x0], [x1]] = shape.bounds;
    return [
      {
        id,
        text: name(id),
        anchor: project(point),
        width: (x1 - x0) * camera.k,
        small: id in RING_COUNTRIES,
        badge: false,
        covers: (p: Point) => insideOutlineOf(shape, toWorld(camera, p)) !== false,
      },
    ];
  });
  const ringBoxes: Box[] = rings.map(({ x, y }) => ({ x0: x - RING_RADIUS, y0: y - RING_RADIUS, x1: x + RING_RADIUS, y1: y + RING_RADIUS }));
  const labels = placeLabels(requests, [...ringBoxes, ...keepClear], size, fontSize, true);
  const outline = focus ? map.outlines.get(focus) : undefined;

  return (
    <Svg width={size.width} height={size.height}>
      <Rect width={size.width} height={size.height} fill={mapColors.sea} />
      <G transform={`translate(${camera.x} ${camera.y}) scale(${camera.k})`}>
        <CountryLayer map={map} pool={pool} tones={tones} />
        {outline && <Path d={outline} fill="none" stroke={colors.ink} strokeWidth={3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
      </G>
      {rings.map((ring) => {
        const tone = tones[ring.id];
        return (
          <G key={`ring-${ring.id}`}>
            <Circle cx={ring.x} cy={ring.y} r={RING_RADIUS} fill="none" stroke={mapColors.ringHalo} strokeWidth={3.5} />
            <Circle
              cx={ring.x}
              cy={ring.y}
              r={RING_RADIUS}
              fill={tone ? TONE_FILL[tone] : mapColors.ringFill}
              fillOpacity={tone ? 0.6 : 1}
              stroke={colors.ink}
              strokeWidth={ring.id === focus ? 2.5 : 1.25}
              strokeDasharray={`${RING_DASH} ${RING_DASH}`}
            />
          </G>
        );
      })}
      {labels.map((label) => {
        const text = name(label.id);
        const baseline = label.at[1] + fontSize * 0.36;
        const strong = label.id === focus;
        return (
          <G key={label.id}>
            {label.callout && (
              <>
                <Line x1={label.callout.anchor[0]} y1={label.callout.anchor[1]} x2={label.at[0]} y2={label.at[1]} stroke={mapColors.label} strokeWidth={1.5} strokeLinecap="round" />
                <Circle cx={label.callout.anchor[0]} cy={label.callout.anchor[1]} r={3} fill={mapColors.label} stroke={colors.white} strokeWidth={1.5} />
                <Rect
                  x={label.box.x0 - 4}
                  y={label.box.y0}
                  width={label.box.x1 - label.box.x0 + 8}
                  height={label.box.y1 - label.box.y0}
                  rx={(label.box.y1 - label.box.y0) / 2}
                  fill={colors.white}
                  stroke={strong ? colors.ink : "rgba(31, 58, 95, 0.55)"}
                  strokeWidth={strong ? 2 : 1.2}
                />
              </>
            )}
            {!label.callout && (
              <SvgText x={label.at[0]} y={baseline} fontSize={fontSize} fontWeight="700" textAnchor="middle" fill={mapColors.labelHalo} stroke={mapColors.labelHalo} strokeWidth={3} strokeLinejoin="round">
                {text}
              </SvgText>
            )}
            <SvgText x={label.at[0]} y={baseline} fontSize={fontSize} fontWeight={strong ? "900" : "700"} textAnchor="middle" fill={mapColors.label}>
              {text}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/** The countries, memoised so that moving the map only changes the group's transform, not every path. */
const CountryLayer = memo(function CountryLayer({ map, pool, tones }: { map: ChallengeMapData; pool: readonly CountryId[]; tones: Props["tones"] }) {
  const own = map.shapes.filter((s) => pool.includes(s.id));
  const context = map.shapes.filter((s) => !pool.includes(s.id));
  return (
    <>
      {map.shapes.map((s) => s.coast && <Path key={`coast-${s.id}`} d={s.coast} fill="none" stroke={mapColors.coast} strokeWidth={3.5} vectorEffect="non-scaling-stroke" />)}
      {context.map((s) => (
        <Path key={s.id} d={s.d} fill={mapColors.context} stroke={mapColors.contextBorder} strokeWidth={0.7} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      ))}
      {own.map((s) => {
        const tone = tones[s.id];
        return (
          <Path key={s.id} d={s.d} fill={tone ? TONE_FILL[tone] : mapColors.land} stroke={mapColors.landBorder} strokeWidth={1} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        );
      })}
    </>
  );
});

const styles = StyleSheet.create({
  frame: { flex: 1, borderRadius: radius.md, overflow: "hidden", backgroundColor: mapColors.sea },
  loading: { ...type.body, color: colors.ink, textAlign: "center", marginTop: space.xl },
});

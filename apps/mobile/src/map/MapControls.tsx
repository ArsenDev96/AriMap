import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { Transform } from "@/geo/regionMap";
import { useI18n } from "../i18n/i18n";
import { colors, mapColors, space } from "../theme/tokens";
import { isBase, maxScale, zoomTo, ZOOM_STEP, type CameraLimits } from "./camera";
import type { Box } from "./labels";

/** A zoom button's size (dp): a 44dp target, with 2dp of hit slop round it. */
export const CONTROL = 44;

/**
 * Where the zoom buttons sit on a map of `size`: top right, in a column, or in a row on a map too short for one.
 * Names, rings and the traveller keep clear of this box.
 */
export function controlsBox(size: { width: number; height: number }): { box: Box; inRow: boolean } {
  const inRow = size.height < 3 * CONTROL + 4 * space.xs;
  const length = 3 * CONTROL + 2 * space.xs;
  const box = inRow
    ? { x0: size.width - space.sm - length, y0: space.sm, x1: size.width - space.sm, y1: space.sm + CONTROL }
    : { x0: size.width - space.sm - CONTROL, y0: space.sm, x1: size.width - space.sm, y1: space.sm + length };
  return { box, inRow };
}

/** The map's +, − and "Show the whole map" buttons, as the website's: they do what pinching and dragging do. */
export function MapControls({
  camera,
  limits,
  size,
  inRow,
  onCamera,
}: {
  camera: Transform;
  limits: CameraLimits;
  size: { width: number; height: number };
  inRow: boolean;
  onCamera: (t: Transform) => void;
}) {
  const { t } = useI18n();
  const zoomBy = (factor: number) => onCamera(zoomTo(camera, camera.k * factor, [size.width / 2, size.height / 2], size.width, size.height, limits));
  return (
    <View style={[styles.controls, inRow && styles.controlsRow]}>
      <MapButton icon="in" accessibilityLabel={t("map.zoomIn")} onPress={() => zoomBy(ZOOM_STEP)} disabled={camera.k >= maxScale(limits) - 1e-9} />
      <MapButton icon="out" accessibilityLabel={t("map.zoomOut")} onPress={() => zoomBy(1 / ZOOM_STEP)} disabled={camera.k <= limits.minScale + 1e-9} />
      <MapButton icon="whole" accessibilityLabel={t("map.reset")} onPress={() => onCamera(limits.base)} disabled={isBase(camera, limits.base)} />
    </View>
  );
}

const CONTROL_ICONS = {
  in: "M12 5v14M5 12h14",
  out: "M5 12h14",
  // Four corners: the whole map.
  whole: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
} as const;

function MapButton({ icon, accessibilityLabel, onPress, disabled }: { icon: keyof typeof CONTROL_ICONS; accessibilityLabel: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={2}
      style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path d={CONTROL_ICONS[icon]} fill="none" stroke={disabled ? "rgba(31, 58, 95, 0.3)" : colors.ink} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  controls: { position: "absolute", top: space.sm, right: space.sm, gap: space.xs },
  controlsRow: { flexDirection: "row" },
  control: {
    width: CONTROL,
    height: CONTROL,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mapColors.control,
    borderWidth: 1,
    borderColor: mapColors.controlBorder,
  },
  controlPressed: { backgroundColor: "#f6eee1" },
});

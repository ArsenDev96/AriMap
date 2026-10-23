import { useState } from "react";
import { ActivityIndicator, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";
import type { CountryId } from "@/core/content/types";
import { fitTransform, type RegionMap } from "@/geo/regionMap";
import { colors, radius } from "../theme/tokens";

interface Props {
  /** The level's map (useRegionMap); null while it is being prepared. */
  map: RegionMap | null;
  /** The countries drawn as the level's own: the rest is pale context. */
  active: readonly CountryId[];
  /** Width ÷ height of the map's box. */
  aspectRatio?: number;
}

/** Room around the level's countries, in pixels. */
const PADDING = 12;

/**
 * A level's map in react-native-svg: the same projected shapes the website draws (src/geo/regionMap.ts), fitted to the
 * box with the same fit (fitTransform). It is the base the lesson map will build on (labels, markers, the route,
 * taps, zoom); for now it is a still picture, decorative for screen readers, since its countries are listed in text
 * beside it.
 */
export function RegionMapView({ map, active, aspectRatio = 4 / 3 }: Props) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.width !== width || size.height !== height) setSize({ width, height });
  };

  const t = map && size ? fitTransform(map.focusBounds, size.width, size.height, PADDING) : null;
  return (
    <View style={[styles.frame, { aspectRatio }]} onLayout={onLayout} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {map && size && t ? (
        <Svg width={size.width} height={size.height}>
          <Rect width={size.width} height={size.height} fill={colors.sea} />
          <G transform={`translate(${t.x} ${t.y}) scale(${t.k})`}>
            {map.shapes.map((shape) => {
              const own = active.includes(shape.id);
              return (
                <Path
                  key={shape.id}
                  d={shape.d}
                  fill={own ? colors.land : colors.context}
                  stroke={own ? colors.landBorder : colors.contextBorder}
                  // Strokes keep their width on screen at any scale.
                  strokeWidth={(own ? 1.2 : 0.8) / t.k}
                  strokeLinejoin="round"
                />
              );
            })}
          </G>
        </Svg>
      ) : (
        <ActivityIndicator color={colors.ink} style={StyleSheet.absoluteFill} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.sea,
  },
});

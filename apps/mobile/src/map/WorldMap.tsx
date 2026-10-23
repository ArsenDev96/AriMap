import { StyleSheet, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { WORLD_GRATICULE, WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH, WORLD_REGIONS } from "@/data/geo/world-map";
import { colors, radius, worldColors } from "../theme/tokens";

type Region = keyof typeof WORLD_REGIONS;

interface Props {
  /** Europe's land opens its levels, as on the website; its button in the list is the accessible way there. */
  onPressEurope?: () => void;
}

/**
 * The home screen's world map, from the website's own data (src/data/geo/world-map.ts: SVG paths, equirectangular,
 * 1000 × 500): each continent in its colour, the water with its graticule, whole at any width. Decorative for
 * screen readers: the continents are listed beside it, with their state in words.
 */
export function WorldMap({ onPressEurope }: Props) {
  return (
    <View style={styles.frame} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 ${WORLD_MAP_WIDTH} ${WORLD_MAP_HEIGHT}`}>
        <Rect width={WORLD_MAP_WIDTH} height={WORLD_MAP_HEIGHT} fill={worldColors.water} />
        <Path d={WORLD_GRATICULE} stroke={colors.white} strokeOpacity={0.35} strokeWidth={0.8} fill="none" />
        {(Object.keys(WORLD_REGIONS) as Region[]).map((region) => {
          const europe = region === "europe";
          return (
            <Path
              key={region}
              d={WORLD_REGIONS[region]}
              fill={worldColors[region]}
              stroke={europe ? worldColors.europeInk : colors.white}
              strokeWidth={europe ? 1.2 : 0.6}
              strokeOpacity={europe ? 1 : 0.6}
              onPress={europe ? onPressEurope : undefined}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    aspectRatio: WORLD_MAP_WIDTH / WORLD_MAP_HEIGHT,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: worldColors.water,
  },
});

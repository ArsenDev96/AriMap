import { StyleSheet, Text, View } from "react-native";
import { useI18n } from "../i18n/i18n";
import { colors, type } from "../theme/tokens";

/**
 * A continent's stars (continentStars), as on the website: one gold star and "17/36" for the eye, read as one
 * sentence ("17 of 36 stars earned in Europe"). `continentOf` is the continent's name as the sentence needs it
 * (ContinentInfo.nameOf).
 */
export function StarTotal({ earned, max, continentOf }: { earned: number; max: number; continentOf: string }) {
  const { t } = useI18n();
  return (
    <View accessible accessibilityLabel={t("continents.stars", { earned, max, continent: continentOf })} style={styles.row}>
      <Text style={styles.star}>★</Text>
      <Text style={styles.count}>{`${earned}/${max}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  star: { ...type.bodyStrong, color: colors.amberDark },
  count: { ...type.bodyStrong, color: colors.ink },
});

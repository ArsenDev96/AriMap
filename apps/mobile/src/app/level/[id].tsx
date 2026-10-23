import { Redirect, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { getLevel } from "@/core/lessons";
import { canPlay, versionOf } from "@/core/progress/appState";
import { Screen } from "../../components/Screen";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useGame } from "../../game/GameProvider";
import { useI18n } from "../../i18n/i18n";
import { RegionMapView } from "../../map/RegionMapView";
import { useRegionMap } from "../../map/useRegionMap";
import { colors, radius, space, type } from "../../theme/tokens";

/**
 * A level: where the lesson (Discover, Find, Travel, Results) will be played. Until then it shows the level's map,
 * drawn from the website's map data, and its countries. Opening it starts nothing and changes no progress: the
 * level's place, records and unlocks stay as saved.
 */
export default function Level() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useGame();
  const { t, l, name, app } = useI18n();
  const level = typeof id === "string" ? getLevel(id) : undefined;
  // The version the level's attempt is on (an attempt from before its countries changed keeps its own).
  const lesson = level && versionOf(state, level)?.lesson;
  const map = useRegionMap(lesson);

  // Only a playable, unlocked level opens, as on the website.
  if (!level || !lesson || !canPlay(state, level.id)) return <Redirect href="/" />;

  return (
    <Screen header={<ScreenHeader back={{ label: t("results.backToLevels") }} />}>
      <View style={styles.heading}>
        <Text style={styles.number}>{t("level.number", { number: level.number })}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {l(level.title)}
        </Text>
      </View>
      <RegionMapView map={map} active={lesson.countries} />
      <Text style={styles.countries} accessibilityLabel={`${t("level.countries")} ${lesson.countries.map(name).join(", ")}`}>
        {lesson.countries.map(name).join(" · ")}
      </Text>
      <Text style={styles.note}>{app("levelPreviewNote")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: space.xs },
  number: { ...type.bodyStrong, color: colors.inkSoft },
  title: { ...type.title, color: colors.ink },
  countries: { ...type.bodyStrong, color: colors.ink },
  note: {
    ...type.body,
    color: colors.travelInk,
    backgroundColor: colors.travelSoft,
    padding: space.md,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
});

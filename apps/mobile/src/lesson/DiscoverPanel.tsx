import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";
import { countryHint, getCountry } from "@/core/content/countries";
import type { Landmark } from "@/core/content/types";
import { startFindingAction } from "@/core/progress/appState";
import { Button } from "../components/Button";
import { LANDMARK_IMAGES } from "../components/landmarkImages";
import { useI18n } from "../i18n/i18n";
import { colors, mapColors, radius, space, type } from "../theme/tokens";
import { Panel, type PanelProps } from "./Panel";

/**
 * Discover (the website's DiscoverPanel): tap a country on the map to see its name, capital, landmark and a clue,
 * explored ones counted; then Start finding (a new random order, startFindingAction, as on the website).
 */
export function DiscoverPanel({ lesson, progress, act }: PanelProps) {
  const { t, l } = useI18n();
  const { selected, explored } = progress.discover;
  const country = selected ? getCountry(selected) : null;
  const total = lesson.countries.length;
  const allExplored = explored.length === total;

  return (
    <Panel
      top={`discover:${selected}`}
      footer={<Button variant="primary" grow label={t("discover.startFinding")} onPress={() => act(startFindingAction(lesson))} />}
    >
      <View style={styles.heading}>
        <Text style={[styles.eyebrow, allExplored && styles.celebrate]} accessibilityLiveRegion="polite">
          {`${t("discover.title")} · ${allExplored ? `★ ${t("discover.exploredAll", { total })}` : t("discover.explored", { count: explored.length, total })}`}
        </Text>
        {/* Once a country is chosen its card takes the room (as on the website's phones). */}
        {!country && (
          <Text accessibilityRole="header" style={styles.title}>
            {t("discover.prompt")}
          </Text>
        )}
      </View>

      <View accessibilityLiveRegion="polite">
        {country ? (
          <View key={country.id} style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              {l(country.name)}
            </Text>
            <View style={styles.fact} accessible accessibilityLabel={`${t("discover.capital")}: ${l(country.capital.name)}`}>
              {/* The map's capital marker: a light ring with a coral centre. */}
              <Svg width={16} height={16} viewBox="0 0 16 16">
                <Circle cx={8} cy={8} r={6.5} fill={colors.white} stroke="rgba(31, 58, 95, 0.55)" strokeWidth={1.5} />
                <Circle cx={8} cy={8} r={3} fill={mapColors.coral} />
              </Svg>
              <Text style={styles.factLabel}>{t("discover.capital")}</Text>
              <Text style={styles.factValue}>{l(country.capital.name)}</Text>
            </View>
            {country.landmark && <LandmarkCard landmark={country.landmark} />}
            <Text style={styles.muted}>{l(countryHint(lesson, country.id))}</Text>
          </View>
        ) : (
          <Text style={styles.placeholder}>{t("discover.empty")}</Text>
        )}
      </View>

      <Text style={styles.note}>{t("discover.region")}</Text>
    </Panel>
  );
}

/** The tallest a landmark's picture is drawn (dp). */
const ART_HEIGHT = 200;

/** The landmark's picture, name and fact (the website's LandmarkCard); a landmark without a picture is text only. */
function LandmarkCard({ landmark }: { landmark: Landmark }) {
  const { t, l } = useI18n();
  const image = landmark.illustration ? LANDMARK_IMAGES[landmark.illustration] : undefined;
  const source = image ? Image.resolveAssetSource(image) : null;
  // The picture's own proportions, known from the bundled asset before it loads (so nothing moves when it does),
  // fitted to the card's width and at most ART_HEIGHT tall.
  const aspect = source?.width && source.height ? source.width / source.height : 1;
  const [width, setWidth] = useState(0);
  const artWidth = Math.min(width, ART_HEIGHT * aspect);
  return (
    <View style={styles.landmark} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {image && width > 0 && (
        <Image
          source={image}
          accessibilityLabel={t("discover.landmarkAlt", { landmark: l(landmark.nameInText) })}
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          style={[styles.art, { width: artWidth, height: artWidth / aspect }]}
        />
      )}
      <View style={styles.landmarkLabel}>
        {/* The map's landmark marker: an amber diamond. */}
        <Svg width={12} height={12} viewBox="0 0 12 12">
          <Rect x={2.6} y={2.6} width={6.8} height={6.8} rx={1.2} transform="rotate(45 6 6)" fill={mapColors.amber} stroke={colors.ink} strokeWidth={1.2} />
        </Svg>
        <Text style={styles.factLabel}>{t("discover.landmark")}</Text>
      </View>
      <Text style={styles.landmarkName}>{l(landmark.name)}</Text>
      <Text style={styles.body}>{l(landmark.fact)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { gap: space.xs },
  eyebrow: { ...type.small, fontWeight: "800", color: colors.discoverInk, textTransform: "uppercase" },
  celebrate: { color: colors.discoverInk },
  title: { ...type.heading, color: colors.ink },
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  cardTitle: { ...type.title, color: colors.ink },
  fact: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  factLabel: { ...type.small, fontWeight: "800", color: colors.inkSoft, textTransform: "uppercase" },
  factValue: { ...type.bodyStrong, color: colors.ink },
  landmark: { gap: space.xs, paddingTop: space.xs },
  art: { alignSelf: "center", borderRadius: radius.sm },
  landmarkLabel: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: space.xs },
  landmarkName: { ...type.bodyStrong, color: colors.ink },
  body: { ...type.body, color: colors.ink },
  muted: { ...type.body, color: colors.inkSoft },
  placeholder: { ...type.body, color: colors.inkSoft, padding: space.lg, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.line },
  note: { ...type.small, color: colors.discoverInk, backgroundColor: colors.discoverSoft, padding: space.md, borderRadius: radius.sm, overflow: "hidden" },
});

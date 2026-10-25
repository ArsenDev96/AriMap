import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import { crossingsLeft, currentCountry, isAssisted, travelChoices, travelStop, type TravelStop } from "@/core/game/travel";
import { Button } from "../components/Button";
import { useI18n } from "../i18n/i18n";
import { longestWordWidth } from "../theme/textWidth";
import { colors, mapColors, radius, space, TAP, type } from "../theme/tokens";
import { Panel, type PanelProps } from "./Panel";

/**
 * Travel (the website's TravelPanel): from the start to the destination by the shortest route, one border at a time,
 * choosing among the neighbour cards (src/core/game/travel.ts: the moves, and a non-neighbour option where the level
 * has one, never told apart before it is chosen). The map shows the route; moving it never moves the traveller.
 */
export function TravelPanel({ lesson, progress, act, hintVisible, onHint }: PanelProps & { hintVisible: boolean; onHint: () => void }) {
  const { t, tp, l, name, countryParams } = useI18n();
  const { fontScale } = useWindowDimensions();
  const [cardsWidth, setCardsWidth] = useState(0);
  const attempt = progress.travel;
  if (!attempt) return null;

  const left = crossingsLeft(attempt);
  const here = currentCountry(attempt);
  const moves = travelChoices(attempt, lesson.borders, lesson.travel.nonNeighbourOptions).map((c) => c.country);
  // Two cards a row, unless a name's longest word wouldn't fit one (large text, a narrow phone, Armenian): then one,
  // so no word is broken.
  const longestWord = longestWordWidth(moves.map(name), type.bodyStrong.fontSize * fontScale);
  const halfText = (cardsWidth - space.sm) / 2 - 2 * space.lg - 2 * CARD_BORDER - ARROW - space.sm;
  const oneColumn = cardsWidth > 0 && longestWord > halfText;
  const notice = progress.travelNotice;
  const stop = travelStop(attempt, lesson.borders);
  const stuck = !!stop;
  const hasMoved = attempt.path.length > 1;
  const stopMessage = (why: TravelStop) =>
    why === "deadEnd"
      ? t("travel.deadEnd", countryParams(here))
      : why === "offCourse"
        ? t("travel.offCourse", { there: countryParams(attempt.to).country })
        : t("travel.outOfCrossings");

  return (
    <Panel top={`travel:${progress.journeyReplay}`}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>{t("travel.title")}</Text>
        <View style={styles.mission} accessible accessibilityRole="header" accessibilityLabel={`${t("travel.from")}: ${name(attempt.from)}. ${t("travel.to")}: ${name(attempt.to)}`}>
          <Text style={[styles.chip, styles.chipStart]}>{name(attempt.from)}</Text>
          <Text style={styles.arrow}>→</Text>
          <View style={[styles.chip, styles.chipEnd]}>
            {/* A destination flag: the map shows the destination in the same gold. */}
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path d="M6 21V4M6 4h11l-2.5 4L17 12H6" fill="none" stroke={colors.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.chipText}>{name(attempt.to)}</Text>
          </View>
        </View>
        <Text style={styles.lead}>{tp("travel.mission", attempt.budget)}</Text>
      </View>

      <View style={styles.crossings}>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: attempt.budget }, (_, i) => (
            <View key={i} style={[styles.dot, i < left && styles.dotFull]} />
          ))}
        </View>
        <Text style={styles.crossingsText}>{tp("travel.crossingsLeft", left)}</Text>
      </View>

      <View accessibilityLiveRegion="polite">
        {!stuck && notice && (
          <Text key={notice.seq} style={[styles.status, styles.statusWrong]}>
            {t("travel.notNeighbour", { here: countryParams(notice.from).country, there: countryParams(notice.country).country })}
          </Text>
        )}
        {!stuck && !notice && <Text style={[styles.status, hasMoved ? styles.statusMoved : styles.statusInfo]}>{hasMoved ? t("travel.moved", countryParams(here)) : t("travel.current", countryParams(here))}</Text>}
        {hintVisible && <Text style={styles.muted}>{t("travel.hintShown")}</Text>}
      </View>

      {stop ? (
        // Each stop says why: a dead end (no neighbour is new) or off course (the destination out of reach) has
        // crossings left; out of crossings has none (travelStop).
        <View style={[styles.stuck]} accessibilityLiveRegion="polite" testID={`travel-stop-${stop}`}>
          <Text style={styles.stuckText}>{stopMessage(stop)}</Text>
          <View style={styles.row}>
            <Button variant="primary" grow label={t("travel.undo")} onPress={() => act({ type: "travelUndo" })} />
            <Button grow label={t("travel.retry")} onPress={() => act({ type: "travelRestart" })} />
          </View>
        </View>
      ) : (
        <View style={styles.choose}>
          <Text style={styles.chooseLabel} accessibilityRole="header">
            {t("travel.choose")}
          </Text>
          <View style={[styles.neighbors, oneColumn && styles.neighborsColumn]} onLayout={(e: LayoutChangeEvent) => setCardsWidth(e.nativeEvent.layout.width)}>
            {moves.map((id) => (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={name(id)}
                onPress={() => act({ type: "travelMove", country: id })}
                style={({ pressed }) => [styles.neighbor, oneColumn && styles.neighborWide, pressed && styles.neighborPressed]}
              >
                <Text style={styles.neighborLabel}>{name(id)}</Text>
                <Svg width={ARROW} height={ARROW} viewBox="0 0 24 24">
                  <Path d="M5 12h13M13 6.5 18.5 12 13 17.5" fill="none" stroke={colors.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {isAssisted(attempt) && <Text style={styles.helpUsed}>{t("travel.helpUsed")}</Text>}

      <View style={styles.row}>
        <Button grow label={t("travel.hint")} onPress={onHint} disabled={stuck} />
        <Button grow label={t("travel.undo")} onPress={() => act({ type: "travelUndo" })} disabled={!hasMoved} />
        <Button grow label={t("travel.restart")} onPress={() => act({ type: "travelRestart" })} disabled={!hasMoved} />
      </View>
      <Text style={styles.note}>{lesson.travel.note ? l(lesson.travel.note) : t(lesson.travelOnly?.length ? "travel.regionNeighbours" : "travel.region")}</Text>
    </Panel>
  );
}

const CARD_BORDER = 2;
const ARROW = 20;

const styles = StyleSheet.create({
  heading: { gap: space.xs },
  eyebrow: { ...type.small, fontWeight: "800", color: colors.travelInk, textTransform: "uppercase" },
  mission: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, overflow: "hidden" },
  chipStart: { ...type.heading, color: colors.white, backgroundColor: mapColors.tealDark },
  chipEnd: { backgroundColor: mapColors.amber, flexShrink: 1 },
  chipText: { ...type.heading, color: colors.ink, flexShrink: 1 },
  arrow: { ...type.heading, color: colors.ink },
  lead: { ...type.body, color: colors.inkSoft },
  crossings: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.travelInk },
  dotFull: { backgroundColor: colors.travel },
  crossingsText: { ...type.bodyStrong, color: colors.ink },
  status: { ...type.bodyStrong, padding: space.md, borderRadius: radius.sm, overflow: "hidden", color: colors.ink },
  statusInfo: { backgroundColor: colors.travelSoft },
  statusMoved: { backgroundColor: colors.discoverSoft },
  statusWrong: { backgroundColor: colors.coralSoft },
  muted: { ...type.small, color: colors.inkSoft, marginTop: space.xs },
  stuck: { gap: space.md, padding: space.md, borderRadius: radius.sm, backgroundColor: colors.coralSoft },
  stuckText: { ...type.bodyStrong, color: colors.ink },
  choose: { gap: space.sm },
  chooseLabel: { ...type.small, fontWeight: "800", color: colors.inkSoft, textTransform: "uppercase" },
  neighbors: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  neighbor: {
    flexGrow: 1,
    flexBasis: "40%",
    minHeight: TAP + 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderWidth: CARD_BORDER,
    borderColor: colors.ink,
    backgroundColor: mapColors.land,
  },
  neighborsColumn: { flexDirection: "column" },
  neighborWide: { flexBasis: "auto" },
  neighborPressed: { backgroundColor: colors.mintSoft },
  neighborLabel: { ...type.bodyStrong, color: colors.ink, flexShrink: 1 },
  helpUsed: { ...type.small, fontWeight: "700", color: colors.findInk },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  note: { ...type.small, color: colors.travelInk, backgroundColor: colors.travelSoft, padding: space.md, borderRadius: radius.sm, overflow: "hidden" },
});

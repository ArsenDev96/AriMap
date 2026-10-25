import { StyleSheet, Text, View } from "react-native";
import type { MessageKey } from "@/core/i18n/translate";
import { attemptRating, nextStar } from "@/core/lesson/rating";
import { getContinent, getLevel, type LevelInfo } from "@/core/lessons";
import { Button } from "../components/Button";
import { useI18n } from "../i18n/i18n";
import { colors, mapColors, radius, space, type } from "../theme/tokens";
import { Panel, type PanelProps } from "./Panel";
import { Stars } from "./parts";

interface Props extends PanelProps {
  /** The level Results offers next (nextLevel), or null after the last playable one. */
  next: LevelInfo | null;
  /** This attempt has just beaten the level's earlier best rating (AppState.newBest). */
  newBest: boolean;
  onNext: (level: LevelInfo) => void;
  onBackToLevels: () => void;
  /** Play again: asks first, then restartLevel. */
  onPlayAgain: () => void;
}

/**
 * A finished journey (the website's ResultsPanel): this attempt's stars and the best (src/core/lesson/rating.ts),
 * the route, the Find score, and what to do next. Nothing here clears a result; Play again asks first.
 */
export function ResultsPanel({ lesson, progress, act, next, newBest, onNext, onBackToLevels, onPlayAgain }: Props) {
  const { t, l, name } = useI18n();
  const level = getLevel(lesson.id)!;
  const result = progress.lastTravelResult;
  if (!result) return null;
  const used = result.route.length - 1;
  const help = [result.hintUsed && t("results.helpHint"), result.undoUsed && t("results.helpUndo")].filter(Boolean);
  const findScore = progress.records.lastFindScore;
  const findAnswers = progress.find?.status === "complete" ? progress.find.results : [];
  const rating = attemptRating(progress);
  const best = progress.records.bestRating;
  const need = rating !== null ? nextStar(findAnswers, result) : null;
  const total = findAnswers.length;
  const stars = (count: number) => t("stars.count", { count });

  return (
    <Panel
      top={`results:${progress.journeyReplay}`}
      footer={
        next ? (
          <Button
            variant="primary"
            grow
            label={`${t("results.nextLevel")} · ${t("level.number", { number: next.number })}`}
            accessibilityLabel={t("results.nextLevelLabel", { level: t("level.number", { number: next.number }), title: l(next.title) })}
            onPress={() => onNext(next)}
          />
        ) : (
          <Button
            variant="primary"
            grow
            label={t("results.backToLevels")}
            accessibilityLabel={t("results.backToLevelsLabel", { continent: l(getContinent(level.continent).nameOf) })}
            onPress={onBackToLevels}
          />
        )
      }
    >
      <View style={styles.celebration} accessibilityLiveRegion="polite">
        <Text style={styles.celebrationStar} accessibilityElementsHidden importantForAccessibility="no">
          ★
        </Text>
        <Text accessibilityRole="header" style={styles.title}>
          {t("results.title")}
        </Text>
      </View>

      {(rating !== null || best !== null || progress.journeyReplay) && (
        <View style={styles.card}>
          {rating !== null && (
            <View style={styles.ratingRow} accessible accessibilityLabel={`${t("stars.thisAttempt")}: ${stars(rating)}`}>
              <Text style={styles.ratingLabel}>{t("stars.thisAttempt")}</Text>
              <Stars count={rating} size={26} />
              <Text style={styles.ratingCount}>{stars(rating)}</Text>
            </View>
          )}
          {best !== null && best !== rating && (
            <View style={styles.ratingRow} accessible accessibilityLabel={`${t("stars.best")}: ${stars(best)}`}>
              <Text style={styles.ratingLabel}>{t("stars.best")}</Text>
              <Stars count={best} />
              <Text style={styles.ratingCount}>{stars(best)}</Text>
            </View>
          )}
          {newBest && <Text style={styles.newBest}>{t("stars.newBest")}</Text>}
          {need && <Text style={styles.body}>{t(`stars.next.${need}` as MessageKey, { most: total - 1, total })}</Text>}
          {rating === null && <Text style={styles.body}>{t(best !== null ? "stars.journeyReplay" : "stars.journeyReplayNone")}</Text>}
        </View>
      )}

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {t("results.route")}
        </Text>
        {result.route.map((id, i) => {
          const role = i === 0 ? "start" : i === used ? "end" : "stop";
          return (
            <View key={`${id}-${i}`} style={styles.stop} accessible accessibilityLabel={`${name(id)}, ${t(role === "start" ? "travel.from" : role === "end" ? "travel.to" : "results.stop")}`}>
              <View style={[styles.stopMarker, role === "start" ? styles.stopStart : role === "end" ? styles.stopEnd : null]} />
              <Text style={styles.stopName}>{name(id)}</Text>
              <Text style={styles.stopRole}>{t(role === "start" ? "travel.from" : role === "end" ? "travel.to" : "results.stop")}</Text>
            </View>
          );
        })}
        <Text style={styles.stat}>{`${t("results.crossingsLabel")}: ${t("results.crossings", { used, budget: result.budget })}`}</Text>
        <Text style={styles.stat}>{`${t("results.help")}: ${help.length > 0 ? help.join(", ") : t("results.helpNone")}`}</Text>
        {result.independent ? (
          <View style={styles.badge}>
            <Text style={styles.badgeIcon} accessibilityElementsHidden importantForAccessibility="no">
              ★
            </Text>
            <View style={styles.badgeWords}>
              <Text style={styles.badgeTitle}>{t("results.badge")}</Text>
              <Text style={styles.small}>{t("results.badgeText")}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.note}>{t("results.noBadge")}</Text>
        )}
      </View>

      {findScore && (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {t("results.findTitle")}
          </Text>
          <View style={styles.findScore} accessible>
            <Text style={styles.findScoreValue}>{`${findScore.independent}/${findScore.total}`}</Text>
            <Text style={[styles.body, styles.flex]}>{t("results.find", { count: findScore.independent, total: findScore.total })}</Text>
          </View>
          {findAnswers.map((a) => (
            <View key={a.target} style={styles.answer} accessible>
              <Text style={[styles.body, styles.flex]}>{name(a.target)}</Text>
              <Text style={[styles.tag, a.independent ? styles.tagGood : styles.tagHelp]}>{t(a.independent ? "find.resultIndependent" : "find.resultAssisted")}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.row}>
        <Button grow label={t("results.replay")} accessibilityLabel={t("level.forLevel", { action: t("results.replay"), level: l(level.title) })} onPress={() => act({ type: "replayTravel" })} />
        <Button grow label={t("welcome.playAgain")} accessibilityLabel={t("level.forLevel", { action: t("welcome.playAgain"), level: l(level.title) })} onPress={onPlayAgain} />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  celebration: { alignItems: "center", gap: space.xs },
  celebrationStar: { fontSize: 52, lineHeight: 60, color: colors.amber, textShadowColor: colors.amberDark, textShadowRadius: 1, textShadowOffset: { width: 0, height: 1 } },
  title: { ...type.title, color: colors.ink, textAlign: "center" },
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  ratingRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  ratingLabel: { ...type.bodyStrong, color: colors.ink },
  ratingCount: { ...type.small, color: colors.inkSoft },
  newBest: { ...type.bodyStrong, color: colors.coralStrong },
  sectionTitle: { ...type.heading, color: colors.ink },
  stop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  stopMarker: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.ink, backgroundColor: mapColors.teal },
  stopStart: { backgroundColor: mapColors.tealDark },
  stopEnd: { backgroundColor: mapColors.amber },
  stopName: { ...type.bodyStrong, color: colors.ink },
  stopRole: { ...type.small, color: colors.inkSoft },
  stat: { ...type.body, color: colors.ink },
  badge: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.sm, backgroundColor: colors.findSoft },
  badgeIcon: { fontSize: 32, lineHeight: 38, color: colors.amberDark },
  badgeWords: { flex: 1 },
  badgeTitle: { ...type.bodyStrong, color: colors.ink },
  small: { ...type.small, color: colors.inkSoft },
  note: { ...type.small, color: colors.ink, backgroundColor: colors.skySoft, padding: space.md, borderRadius: radius.sm, overflow: "hidden" },
  findScore: { flexDirection: "row", alignItems: "center", gap: space.md },
  findScoreValue: { ...type.title, color: colors.ink },
  answer: { flexDirection: "row", alignItems: "center", gap: space.sm },
  tag: { ...type.small, fontWeight: "700", paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  tagGood: { color: colors.discoverInk, backgroundColor: colors.discoverSoft },
  tagHelp: { color: colors.findInk, backgroundColor: colors.findSoft },
  body: { ...type.body, color: colors.ink },
  flex: { flex: 1 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});

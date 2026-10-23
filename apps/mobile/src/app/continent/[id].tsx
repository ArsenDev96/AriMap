import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getContinent, hasPlayableLevels, isContinentId, levelsOf, type LevelInfo } from "@/core/lessons";
import { allLevelsComplete, continentStars, hasSavedResults, hasUnfinishedAttempt, levelStatus, mainAction, versionOf, type LevelStatus } from "@/core/progress/appState";
import { MAX_STARS } from "@/core/lesson/rating";
import { Button } from "../../components/Button";
import { Screen } from "../../components/Screen";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StarTotal } from "../../components/StarTotal";
import { useGame } from "../../game/GameProvider";
import { STEPS, stepOf } from "../../game/steps";
import { useI18n } from "../../i18n/i18n";
import { colors, radius, space, type } from "../../theme/tokens";

/**
 * A continent's level selection (the website's WelcomeScreen): its levels in order, each with its status in words,
 * and the main action (continue the attempt under way, or start the next level) in its own area below.
 */
export default function ContinentLevels() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useGame();
  const { t, l } = useI18n();
  const openLevel = useOpenLevel();
  const continentId = isContinentId(id) && hasPlayableLevels(id) ? id : null;

  // The saved screen and continent follow what shows (the website's "openContinent").
  useFocusEffect(
    useCallback(() => {
      if (continentId) dispatch({ type: "openContinent", continent: continentId });
    }, [continentId, dispatch]),
  );

  // A continent with nothing to play (or a malformed link) has no level selection.
  if (!continentId) return <Redirect href="/" />;

  const continent = getContinent(continentId);
  const levels = levelsOf(continentId);
  const main = mainAction(state, continentId);
  const stars = continentStars(state, continentId);

  return (
    <Screen
      header={<ScreenHeader back={{ label: t("continents.back") }} />}
      action={
        main && (
          <Button
            variant="primary"
            label={`${t(main.kind === "continue" ? "welcome.continue" : "welcome.start")} · ${t("level.number", { number: main.level.number })}`}
            accessibilityLabel={t("level.forLevel", { action: t(main.kind === "continue" ? "welcome.continue" : "welcome.start"), level: l(main.level.title) })}
            onPress={() => openLevel(main.level)}
          />
        )
      }
    >
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {l(continent.name)}
        </Text>
        {stars.max > 0 && <StarTotal earned={stars.earned} max={stars.max} continentOf={l(continent.nameOf)} />}
      </View>
      {!main && <Text style={styles.allDone}>{`✓ ${allLevelsComplete(state, continentId) ? t("welcome.allComplete", { count: levels.length }) : t("welcome.allDone")}`}</Text>}
      {levels.map((level) => (
        <LevelCard key={level.id} level={level} status={levelStatus(state, level)} upNext={main?.level.id === level.id} />
      ))}
    </Screen>
  );
}

/**
 * Opens a level. Navigation goes through useRouter(), bound to this screen's own navigator, never Expo Router's
 * global `router`: when Android recreates the activity (a font size change), the old tree's unmount resets that
 * global after the new tree has bound it, and every later router.push would throw.
 */
function useOpenLevel() {
  const router = useRouter();
  return (level: LevelInfo) => router.push({ pathname: "/level/[id]", params: { id: level.id } });
}

function LevelCard({ level, status, upNext }: { level: LevelInfo; status: LevelStatus; upNext: boolean }) {
  const openLevel = useOpenLevel();
  const { state } = useGame();
  const { t, l, name } = useI18n();
  const playable = status.kind !== "comingSoon" && status.kind !== "locked";
  const completed = status.kind === "completed";
  const progress = state.levels[level.id];
  // The version of the level its attempt is on: an attempt from before its countries changed is shown as it is.
  const version = versionOf(state, level);
  const started = progress?.started === true;
  const records = progress?.records;
  const done = [records?.discoverDone, records?.findDone, records?.travelDone].map(Boolean);
  const best = completed ? (records?.bestRating ?? null) : null;
  const title = l(level.title);

  // The card's action, as on the website: Continue an attempt under way, View results of a finished one, Play again
  // a completed level, otherwise Start.
  const action = t(
    hasUnfinishedAttempt(state, level.id) ? "welcome.continue" : completed && hasSavedResults(state, level.id) ? "welcome.viewResults" : completed ? "welcome.playAgain" : "welcome.start",
  );

  let statusText: string;
  let detail: string | null = null;
  switch (status.kind) {
    case "comingSoon":
      statusText = t("level.comingSoon");
      detail = t("level.comingSoonHint");
      break;
    case "locked":
      statusText = t("level.locked");
      detail = t("level.lockedHint", { level: l(status.after.title) });
      break;
    case "ready":
      statusText = t("level.ready");
      break;
    case "inProgress":
      statusText = t("level.inProgress", { step: t(stepOf(status.stage).key) });
      break;
    case "completed":
      statusText = t("level.completed");
      break;
  }
  const icon = { comingSoon: "⌛", locked: "🔒", ready: "▶", inProgress: "◐", completed: "✓" }[status.kind];
  // The best stars earned, once there are any, as on the website's card; a level never rated shows none.
  const starsLabel = best !== null ? t("stars.bestLabel", { stars: t("stars.count", { count: best }) }) : null;

  return (
    <View style={[styles.card, !playable && styles.cardInactive, upNext && styles.cardUpNext]}>
      {upNext && <Text style={styles.upNext}>{t("welcome.upNext")}</Text>}
      <View style={styles.cardHead}>
        <Text style={styles.badge} accessibilityLabel={t("level.number", { number: level.number })}>
          {level.number}
        </Text>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          {title}
        </Text>
      </View>
      <Text style={styles.description}>{l(version?.description ?? level.description)}</Text>
      <Text style={styles.countries} accessibilityLabel={`${t("level.countries")} ${(version?.lesson.countries ?? level.countries).map(name).join(", ")}`}>
        {(version?.lesson.countries ?? level.countries).map(name).join(" · ")}
      </Text>

      <View accessible accessibilityLabel={[starsLabel, statusText, detail].filter(Boolean).join(". ")} style={styles.status}>
        <Text style={best !== null ? styles.stars : styles.statusIcon}>{best !== null ? "★".repeat(best) + "☆".repeat(MAX_STARS - best) : icon}</Text>
        <View style={styles.statusWords}>
          <Text style={styles.statusText}>{statusText}</Text>
          {detail && <Text style={styles.statusDetail}>{detail}</Text>}
        </View>
      </View>

      {/* Each step with a check when done or its number: colour is never the only cue. */}
      {playable && started && (
        <View style={styles.steps}>
          {STEPS.map((step, i) => (
            <View key={step.key} accessible accessibilityLabel={t(done[i] ? "welcome.stepDone" : "welcome.stepTodo", { step: t(step.key) })} style={[styles.step, { backgroundColor: step.soft }]}>
              <Text style={[styles.stepText, { color: step.accent }]}>{`${done[i] ? "✓" : i + 1} ${t(step.key)}`}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Locked and coming-soon levels have no action. */}
      {playable && <Button label={action} accessibilityLabel={t("level.forLevel", { action, level: title })} onPress={() => openLevel(level)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  title: { ...type.title, color: colors.ink },
  allDone: { ...type.bodyStrong, color: colors.discoverInk },
  card: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  cardInactive: { backgroundColor: colors.bg },
  cardUpNext: { borderColor: colors.coral, borderWidth: 3 },
  upNext: { ...type.small, fontWeight: "800", color: colors.coralStrong, textTransform: "uppercase" },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  badge: {
    ...type.bodyStrong,
    minWidth: 32,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: "hidden",
    textAlign: "center",
    color: colors.white,
    backgroundColor: colors.ink,
  },
  cardTitle: { ...type.heading, color: colors.ink, flex: 1 },
  description: { ...type.body, color: colors.ink },
  countries: { ...type.small, color: colors.inkSoft },
  status: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  statusIcon: { ...type.bodyStrong, color: colors.ink },
  stars: { ...type.heading, color: colors.amberDark, letterSpacing: 2 },
  statusWords: { flex: 1 },
  statusText: { ...type.bodyStrong, color: colors.ink },
  statusDetail: { ...type.small, color: colors.inkSoft },
  steps: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  step: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill },
  stepText: { ...type.small, fontWeight: "700" },
});

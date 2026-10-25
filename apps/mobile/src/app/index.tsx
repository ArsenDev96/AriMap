import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CHALLENGE_RULES } from "@/core/challenge/quickChallenge";
import { CONTINENTS, getContinent, hasPlayableLevels, type ContinentInfo } from "@/core/lessons";
import { continentProgress, continentStars, levelToContinue } from "@/core/progress/appState";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { StarTotal } from "../components/StarTotal";
import { useGame } from "../game/GameProvider";
import { useI18n } from "../i18n/i18n";
import { WorldMap } from "../map/WorldMap";
import { colors, radius, space, TAP, type, worldColors } from "../theme/tokens";

/**
 * Home: the Quick Challenge and the continents, as on the website's home screen. Europe opens its levels; the others
 * say "Coming soon" and do nothing. The main action continues the attempt under way, or explores Europe.
 */
export default function Home() {
  const router = useRouter();
  const { state, dispatch } = useGame();
  const { t, l } = useI18n();
  const resume = levelToContinue(state);
  const playable = CONTINENTS.filter((c) => hasPlayableLevels(c.id));

  // Home is the saved screen whenever it shows (the website's "goHome": progress is kept).
  useFocusEffect(useCallback(() => dispatch({ type: "goHome" }), [dispatch]));

  const openContinent = (continent: ContinentInfo) => router.push({ pathname: "/continent/[id]", params: { id: continent.id } });

  return (
    <Screen
      header={
        <ScreenHeader>
          <Text accessibilityRole="header" style={styles.brand}>
            {t("app.name")}
          </Text>
          <Text style={styles.tagline}>{t("app.tagline")}</Text>
        </ScreenHeader>
      }
      action={
        resume ? (
          <Button
            variant="primary"
            label={`${t("welcome.continue")} · ${l(getContinent(resume.continent).name)} · ${t("level.number", { number: resume.number })}`}
            accessibilityLabel={t("continents.continueLabel", {
              action: t("welcome.continue"),
              continent: l(getContinent(resume.continent).name),
              level: t("level.number", { number: resume.number }),
              title: l(resume.title),
            })}
            onPress={() => {
              dispatch({ type: "openLevel", levelId: resume.id });
              router.push({ pathname: "/level/[id]", params: { id: resume.id } });
            }}
          />
        ) : (
          playable[0] && <Button variant="primary" label={t("continents.explore", { continent: l(playable[0].nameInText) })} onPress={() => openContinent(playable[0])} />
        )
      }
    >
      <QuickChallengeCard onPlay={() => router.push("/challenge")} />

      <View style={styles.intro}>
        <Text accessibilityRole="header" style={styles.title}>
          {t("continents.title")}
        </Text>
        <Text style={styles.subtitle}>{t("continents.subtitle")}</Text>
      </View>

      <WorldMap onPressEurope={() => openContinent(getContinent("europe"))} />

      <View style={styles.list}>
        {CONTINENTS.map((continent) =>
          hasPlayableLevels(continent.id) ? (
            <OpenContinent key={continent.id} continent={continent} onPress={() => openContinent(continent)} />
          ) : (
            // Read as its name and "Coming soon": the hourglass is decoration, which a screen reader would name aloud.
            <View
              key={continent.id}
              accessible
              accessibilityLabel={`${l(continent.name)}, ${t("continents.comingSoon")}`}
              style={[styles.card, styles.soon, { borderStartColor: worldColors[continent.id] }]}
            >
              <Text style={styles.cardName}>{l(continent.name)}</Text>
              <Text style={styles.soonLabel}>{`⌛ ${t("continents.comingSoon")}`}</Text>
            </View>
          ),
        )}
      </View>
    </Screen>
  );
}

/** The Quick Challenge (the website's home card): its rules, from the shared ones, and Play. */
function QuickChallengeCard({ onPlay }: { onPlay: () => void }) {
  const { t, tp } = useI18n();
  return (
    <View style={styles.challenge}>
      <Text style={styles.challengeLabel}>{`⚡ ${t("challenge.label")}`}</Text>
      <Text accessibilityRole="header" style={styles.challengeTitle}>
        {t("challenge.title", { count: CHALLENGE_RULES.questions })}
      </Text>
      <Text style={styles.subtitle}>{t("challenge.time", { time: tp("challenge.seconds", CHALLENGE_RULES.durationMs / 1000) })}</Text>
      <Button variant="primary" label={t("challenge.play")} onPress={onPlay} testID="home-challenge" />
    </View>
  );
}

/** A continent with levels to play: its name (the button), how many levels are completed, and its stars. */
function OpenContinent({ continent, onPress }: { continent: ContinentInfo; onPress: () => void }) {
  const { state } = useGame();
  const { t, tp, l } = useI18n();
  const { total, completed } = continentProgress(state, continent.id);
  const stars = continentStars(state, continent.id);
  return (
    <View style={[styles.card, { borderStartColor: worldColors[continent.id] }]}>
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.open, pressed && styles.openPressed]}>
        <Text style={styles.cardName}>{l(continent.name)}</Text>
        <Text style={styles.arrow} aria-hidden>
          →
        </Text>
      </Pressable>
      <View accessible accessibilityLabel={tp("continents.completed", total, { completed, continent: l(continent.nameOf) })} style={styles.progress}>
        <Text style={styles.progressText}>{`✓ ${t("continents.completedShort")} ${completed}/${total}`}</Text>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${(100 * completed) / Math.max(total, 1)}%` }]} />
        </View>
      </View>
      {stars.max > 0 && <StarTotal earned={stars.earned} max={stars.max} continentOf={l(continent.nameOf)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { ...type.heading, color: colors.ink },
  tagline: { ...type.small, color: colors.inkSoft },
  intro: { gap: space.xs },
  challenge: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.peach,
  },
  challengeLabel: { ...type.small, fontWeight: "800", color: colors.coralStrong, textTransform: "uppercase" },
  challengeTitle: { ...type.heading, color: colors.ink },
  title: { ...type.title, color: colors.ink },
  subtitle: { ...type.body, color: colors.inkSoft },
  list: { gap: space.md },
  card: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderStartWidth: 6,
    backgroundColor: colors.surface,
  },
  soon: { backgroundColor: colors.bg },
  cardName: { ...type.heading, color: colors.ink, flexShrink: 1 },
  soonLabel: { ...type.body, color: colors.inkSoft },
  open: {
    minHeight: TAP,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: worldColors.europeInk,
    backgroundColor: colors.white,
  },
  openPressed: { backgroundColor: colors.mintSoft },
  arrow: { ...type.heading, color: worldColors.europeInk },
  progress: { gap: space.xs },
  progressText: { ...type.bodyStrong, color: colors.ink },
  bar: { height: 8, borderRadius: radius.pill, backgroundColor: colors.line, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: worldColors.europe },
});

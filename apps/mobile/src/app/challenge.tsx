import { usePreventRemove, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CHALLENGE_POOL } from "@/core/challenge/europe";
import type { AnswerRecord, ChallengeResult, ChallengeRound, MissedQuestion } from "@/core/challenge/quickChallenge";
import { roundSeconds } from "@/core/challenge/share";
import type { CountryId } from "@/core/content/types";
import type { LevelInfo } from "@/core/lessons";
import { canPlay } from "@/core/progress/appState";
import { ChallengeMap } from "../challenge/ChallengeMap";
import { levelOf, mapTones, roundNames } from "../challenge/results";
import { ShareResult } from "../challenge/ShareResult";
import { useChallenge } from "../challenge/useChallenge";
import { useChallengeMap } from "../challenge/useChallengeMap";
import { Button } from "../components/Button";
import { ScreenHeader } from "../components/ScreenHeader";
import { useGame } from "../game/GameProvider";
import { useI18n } from "../i18n/i18n";
import { nativeStorage } from "../storage/nativeStorage";
import { longestWordWidth } from "../theme/textWidth";
import { colors, radius, space, type } from "../theme/tokens";

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * The Quick Challenge (the website's QuickChallengeScreen), as practice rounds on the phone: find 15 countries on the
 * map of Europe against one timer, by the shared rules (src/core/challenge/quickChallenge.ts: its pool, 15 questions,
 * 60 seconds, its scoring and results). The ready screen, the round, Results and the review on the map share one map.
 * A round under way carries on whatever happens to the screen (useChallenge); Back during one asks first.
 */
export default function ChallengeScreen() {
  const router = useRouter();
  const { state, dispatch } = useGame();
  const i18n = useI18n();
  const { t, tp, app } = i18n;
  const { width, height, fontScale } = useWindowDimensions();
  const map = useChallengeMap();
  const [mapReady, setMapReady] = useState(false);
  const [storage] = useState(nativeStorage);
  const game = useChallenge({ storage, random: Math.random, newId });
  const { round, question, feedback, result } = game;
  const [reviewing, setReviewing] = useState(false);
  const [selected, setSelected] = useState<CountryId | null>(null);
  const [sharing, setSharing] = useState(false);
  const status = round.status;

  // Leaving (Back, or "Back to home"): during a round, asked first (the timer keeps running either way, and the round
  // carries on when the challenge opens again); an ended round is cleared, so the next opening draws a new one.
  const [leaving, setLeaving] = useState(false);
  usePreventRemove(!leaving && status !== "ready", ({ repeat }) => {
    if (status === "finished") {
      game.discard();
      setLeaving(true);
      repeat();
      return;
    }
    Alert.alert(t("challengeLeave.title"), app("leaveText"), [
      { text: t("challengeLeave.stay"), style: "cancel" },
      {
        text: t("challengeLeave.leave"),
        style: "destructive",
        onPress: () => {
          setLeaving(true);
          repeat();
        },
      },
    ]);
  });

  const onReady = useCallback((ready: boolean) => setMapReady(ready), []);
  const home = () => router.dismissTo("/");
  const lessons = () => router.push({ pathname: "/continent/[id]", params: { id: "europe" } });
  const openLevel = (level: LevelInfo) => {
    if (canPlay(state, level.id)) {
      dispatch({ type: "openLevel", levelId: level.id });
      router.push({ pathname: "/level/[id]", params: { id: level.id } });
    } else lessons();
  };

  const tones = mapTones(round, result, feedback);
  const names = result ? roundNames(result) : [];
  const wide = width > height && width >= 600;
  const mapHeight = Math.max(200, height * (fontScale > 1.3 ? 0.38 : 0.46));

  let panel: React.ReactNode;
  if (status === "ready") {
    const time = tp("challenge.seconds", round.rules.durationMs / 1000);
    panel = (
      <>
        <Text style={styles.eyebrow}>{t("challenge.label")}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {t("challenge.title", { count: round.rules.questions })}
        </Text>
        <Text style={styles.body}>{t("challenge.time", { time })}</Text>
        <Text style={styles.body}>{t("challengeGame.intro", { time })}</Text>
        <Text style={styles.note}>{app("practiceNote")}</Text>
        <Button variant="primary" label={mapReady ? t("welcome.start") : t("challengeGame.loading")} onPress={() => game.start(mapReady)} disabled={!mapReady} testID="challenge-start" />
      </>
    );
  } else if (status === "playing") {
    panel = <Playing target={question?.target ?? null} feedback={feedback} onSkip={() => game.choose(null)} />;
  } else if (result && reviewing) {
    panel = (
      <Review
        result={result}
        selected={selected}
        onSelect={setSelected}
        onBack={() => {
          setReviewing(false);
          setSelected(null);
        }}
      />
    );
  } else if (result) {
    panel = (
      <Results
        result={result}
        onShare={() => setSharing(true)}
        onRetry={() => {
          setSelected(null);
          game.retry();
        }}
        onReview={() => setReviewing(true)}
        onLessons={lessons}
        onLevel={openLevel}
        onHome={home}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScreenHeader back={{ label: t("challengeGame.backLabel"), onPress: home }} />
      <View style={[styles.body0, wide && styles.bodyWide]}>
        <View style={wide ? styles.mapWide : [styles.map, { height: mapHeight }]}>
          <ChallengeMap
            map={map}
            pool={round.pool ?? CHALLENGE_POOL}
            tones={tones}
            names={names}
            focus={reviewing ? selected : null}
            onTap={status === "playing" && question ? (country) => game.choose(country) : reviewing && result ? (country) => result.questions.some((q) => q.target === country) && setSelected(country) : undefined}
            viewKey={round.questions.join()}
            onReady={onReady}
          />
        </View>
        <View style={styles.panel}>
          {status === "playing" && <RoundStatus round={round} remainingMs={game.remainingMs} />}
          {/* Each stage starts at the top of the panel. */}
          <ScrollView key={`${round.questions.join()}:${status}:${reviewing}`} contentContainerStyle={styles.panelContent}>
            {panel}
          </ScrollView>
        </View>
      </View>
      {result && <ShareResult result={result} open={sharing} onClose={() => setSharing(false)} />}
    </SafeAreaView>
  );
}

const FEEDBACK_ICON: Record<AnswerRecord["outcome"], string> = { correct: "✓", wrong: "✗", skipped: "↷" };

function Playing({
  target,
  feedback,
  onSkip,
}: {
  target: CountryId | null;
  feedback: AnswerRecord | null;
  onSkip: () => void;
}) {
  const { t, name } = useI18n();
  return (
    <>
      {/* What to find, and how the last answer went: announced as they change (the timer is not). */}
      <View accessibilityLiveRegion="polite">
        <Text style={styles.find}>{t("challengeGame.find")}</Text>
        <Text style={styles.target} testID="challenge-target">
          {target ? name(target) : feedback ? name(feedback.target) : ""}
        </Text>
        <Text style={[styles.feedback, feedback && styles[`feedback_${feedback.outcome}`]]}>
          {feedback ? `${FEEDBACK_ICON[feedback.outcome]} ${t(feedback.outcome === "correct" ? "challengeGame.correct" : feedback.outcome === "wrong" ? "challengeGame.wrong" : "challengeGame.skipped")}` : t("find.instructions")}
        </Text>
      </View>
      <Button label={t("challengeGame.skip")} onPress={onSkip} disabled={!target} testID="challenge-skip" />
    </>
  );
}

/** The round's question, score and time left, with its time bar: kept in view above the panel while it plays. */
function RoundStatus({ round, remainingMs }: { round: ChallengeRound; remainingMs: number }) {
  const { t } = useI18n();
  const seconds = Math.ceil(remainingMs / 1000);
  const score = round.answers.filter((a) => a.outcome === "correct").length;
  const low = seconds <= 10;
  return (
    <View style={styles.statusBlock}>
      <View style={styles.status}>
        <Text style={styles.statusText}>{t("find.question", { current: Math.min(round.index + 1, round.questions.length), total: round.questions.length })}</Text>
        <Text style={styles.statusText}>{t("challengeGame.score", { score })}</Text>
        <Text accessibilityRole="timer" accessibilityLabel={t("challengeGame.timeLeft", { seconds })} style={[styles.clock, low && styles.clockLow]}>
          {`⏱ ${seconds}`}
        </Text>
      </View>
      <View style={styles.bar} importantForAccessibility="no-hide-descendants">
        <View style={[styles.barFill, low && styles.barLow, { width: `${(100 * remainingMs) / round.rules.durationMs}%` }]} />
      </View>
    </View>
  );
}

function missedDetail(q: MissedQuestion, t: ReturnType<typeof useI18n>["t"], name: (id: CountryId) => string): string {
  if (q.outcome === "wrong") return t("challengeResults.chose", { name: name(q.chosen!) });
  return t(q.outcome === "skipped" ? "challengeResults.wasSkipped" : "challengeResults.notReached");
}

function Results({
  result,
  onShare,
  onRetry,
  onReview,
  onLessons,
  onLevel,
  onHome,
}: {
  result: ChallengeResult;
  onShare: () => void;
  onRetry: () => void;
  onReview: () => void;
  onLessons: () => void;
  onLevel: (level: LevelInfo) => void;
  onHome: () => void;
}) {
  const { t, tp, name, l, app } = useI18n();
  const { fontScale } = useWindowDimensions();
  const counts = [
    { key: "correct", label: t("challengeResults.correct"), value: result.correct, icon: "✓" },
    { key: "incorrect", label: t("challengeResults.incorrect"), value: result.incorrect, icon: "✗" },
    { key: "skipped", label: t("challengeResults.skipped"), value: result.skipped, icon: "↷" },
    { key: "unanswered", label: t("challengeResults.unanswered"), value: result.unanswered, icon: "…" },
  ];
  // Two tiles a row, unless a label's longest word wouldn't fit one (large text): then one, never clipped.
  const tileWidth = longestWordWidth(counts.map((c) => c.label), type.small.fontSize * fontScale) + 2 * space.md + 4;
  return (
    <>
      <Text accessibilityRole="header" style={styles.title}>
        {t(result.endReason === "timeUp" ? "challengeResults.timeUp" : "challengeResults.complete")}
      </Text>
      <Text accessible accessibilityLabel={t("challengeResults.scoreLabel", { score: result.score, total: result.total })} style={styles.score} testID="challenge-score">
        <Text style={styles.scoreBig}>{result.score}</Text>
        {` / ${result.total}`}
      </Text>
      {result.endReason === "completed" && <Text style={styles.body}>{t("challengeResults.time", { time: tp("challenge.seconds", roundSeconds(result.elapsedMs)) })}</Text>}
      <View style={styles.counts}>
        {counts.map((c) => (
          <View key={c.key} accessible accessibilityLabel={`${c.label}: ${c.value}`} style={[styles.count, { minWidth: tileWidth }]}>
            <Text style={styles.countValue}>{`${c.icon} ${c.value}`}</Text>
            <Text style={styles.countLabel}>{c.label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>{app("practiceNote")}</Text>
      <Button variant="primary" label={t("challengeShare.button")} onPress={onShare} testID="challenge-share" />
      <Button label={t("welcome.playAgain")} onPress={onRetry} testID="challenge-retry" />
      <Button label={t("challengeResults.review")} onPress={onReview} />
      <Button label={t("challengeResults.lessons")} onPress={onLessons} />

      <Text accessibilityRole="header" style={styles.subtitle}>
        {t("challengeResults.missedTitle")}
      </Text>
      {result.missed.length === 0 ? (
        <Text style={styles.body}>{t("challengeResults.missedNone")}</Text>
      ) : (
        result.missed.map((q) => {
          const level = levelOf(q.target);
          return (
            <View key={q.index} style={styles.missed} testID="challenge-missed">
              <Text style={styles.missedName}>{name(q.target)}</Text>
              <Text style={styles.missedDetail}>{missedDetail(q, t, name)}</Text>
              {level && (
                <Pressable accessibilityRole="link" onPress={() => onLevel(level)} style={({ pressed }) => [styles.levelLink, pressed && styles.levelLinkPressed]}>
                  <Text style={styles.levelLinkText}>{`${t("level.number", { number: level.number })} · ${l(level.title)} →`}</Text>
                </Pressable>
              )}
            </View>
          );
        })
      )}
      <Button label={t("challengeResults.home")} onPress={onHome} />
    </>
  );
}

function Review({ result, selected, onSelect, onBack }: { result: ChallengeResult; selected: CountryId | null; onSelect: (id: CountryId) => void; onBack: () => void }) {
  const { t, name } = useI18n();
  const current = result.questions.find((q) => q.target === selected);
  return (
    <>
      <Text accessibilityRole="header" style={styles.title}>
        {t("challengeReview.title")}
      </Text>
      <Text style={styles.body}>{t("challengeReview.text")}</Text>
      <View style={styles.legend} importantForAccessibility="no-hide-descendants">
        <Text style={[styles.legendItem, styles.legendCorrect]}>{`✓ ${t("challengeReview.found")}`}</Text>
        <Text style={[styles.legendItem, styles.legendMissed]}>{`✗ ${t("challengeReview.missed")}`}</Text>
        <Text style={[styles.legendItem, styles.legendChosen]}>{`● ${t("challengeReview.chosen")}`}</Text>
      </View>
      <View style={styles.chips}>
        {result.questions.map((q) => {
          const found = q.outcome === "correct";
          const on = q.target === selected;
          return (
            <Pressable
              key={q.index}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${name(q.target)}, ${t(found ? "challengeReview.found" : "challengeReview.missed")}`}
              onPress={() => onSelect(q.target)}
              style={[styles.chip, found ? styles.chipFound : styles.chipMissed, on && styles.chipOn]}
            >
              <Text style={styles.chipText}>{`${found ? "✓" : "✗"} ${name(q.target)}`}</Text>
            </Pressable>
          );
        })}
      </View>
      {current && current.outcome !== "correct" && <Text style={styles.body}>{missedDetail(current as MissedQuestion, t, name)}</Text>}
      <Button variant="primary" label={t("challengeReview.back")} onPress={onBack} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body0: { flex: 1 },
  bodyWide: { flexDirection: "row" },
  map: { paddingHorizontal: space.lg },
  mapWide: { flex: 1.2, paddingLeft: space.lg, paddingBottom: space.lg },
  panel: { flex: 1 },
  panelContent: { padding: space.lg, gap: space.md },
  eyebrow: { ...type.small, fontWeight: "800", color: colors.coralStrong, textTransform: "uppercase" },
  title: { ...type.title, color: colors.ink },
  subtitle: { ...type.heading, color: colors.ink, marginTop: space.sm },
  body: { ...type.body, color: colors.ink },
  note: { ...type.small, color: colors.inkSoft },
  statusBlock: { gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  status: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: space.md, rowGap: space.xs },
  statusText: { ...type.bodyStrong, color: colors.inkSoft },
  clock: { ...type.heading, color: colors.ink, fontVariant: ["tabular-nums"] },
  clockLow: { color: colors.coralStrong },
  bar: { height: 8, borderRadius: radius.pill, backgroundColor: colors.line, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.ink },
  barLow: { backgroundColor: colors.coralStrong },
  find: { ...type.small, fontWeight: "800", color: colors.inkSoft, textTransform: "uppercase" },
  target: { ...type.title, color: colors.coralStrong, minHeight: type.title.lineHeight },
  feedback: { ...type.bodyStrong, color: colors.inkSoft, minHeight: type.bodyStrong.lineHeight },
  feedback_correct: { color: colors.discoverInk },
  feedback_wrong: { color: colors.coralStrong },
  feedback_skipped: { color: colors.inkSoft },
  score: { ...type.title, color: colors.inkSoft },
  scoreBig: { fontSize: 48, lineHeight: 56, fontWeight: "900", color: colors.ink },
  counts: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  count: { flexGrow: 1, flexBasis: "40%", padding: space.md, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  countValue: { ...type.heading, color: colors.ink },
  countLabel: { ...type.small, color: colors.inkSoft },
  missed: { gap: space.xs, padding: space.md, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  missedName: { ...type.bodyStrong, color: colors.ink },
  missedDetail: { ...type.body, color: colors.inkSoft },
  levelLink: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", paddingVertical: space.xs },
  levelLinkPressed: { opacity: 0.6 },
  levelLinkText: { ...type.bodyStrong, color: colors.travelInk, textDecorationLine: "underline" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  legendItem: { ...type.small, fontWeight: "800", paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  legendCorrect: { backgroundColor: colors.mintSoft, color: colors.discoverInk },
  legendMissed: { backgroundColor: colors.findSoft, color: colors.ink },
  legendChosen: { backgroundColor: colors.coralSoft, color: colors.coralStrong },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 2 },
  chipFound: { backgroundColor: colors.mintSoft, borderColor: colors.mintSoft },
  chipMissed: { backgroundColor: colors.findSoft, borderColor: colors.findSoft },
  chipOn: { borderColor: colors.ink },
  chipText: { ...type.bodyStrong, color: colors.ink },
});

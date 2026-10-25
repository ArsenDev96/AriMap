import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CountryId } from "@/core/content/types";
import { buildMapView } from "@/core/lesson/mapView";
import type { LessonAction } from "@/core/lesson/progress";
import { getLevel, type LevelInfo } from "@/core/lessons";
import { activeLesson, activeProgress, nextLevel } from "@/core/progress/appState";
import { ScreenHeader } from "../components/ScreenHeader";
import { useGame } from "../game/GameProvider";
import { acceptPress } from "../game/pressGuard";
import { useI18n } from "../i18n/i18n";
import { LessonMap } from "../map/LessonMap";
import { useRegionMap } from "../map/useRegionMap";
import { useReducedMotion } from "../theme/motion";
import { colors, space } from "../theme/tokens";
import { confirmRestart } from "./confirmRestart";
import { DiscoverPanel } from "./DiscoverPanel";
import { FindPanel } from "./FindPanel";
import { StepsBar } from "./parts";
import { ResultsPanel } from "./ResultsPanel";
import { TravelPanel } from "./TravelPanel";

/** How long Travel's hint names the neighbours on the map (the website's). */
const TRAVEL_HINT_MS = 6000;

/**
 * A level in play (the website's LessonScreen): the map, and beside it the stage's panel, Discover → Find → Travel →
 * Results. Every gameplay action goes through the shared reducer (appReducer's "lesson" action) and is saved as it is
 * made, so leaving at any point (Back, Home, the app closed) keeps the player's place, and Continue resumes it, as on
 * the website. Only the screen's own passing state lives here: the travel hint's few seconds and the press guard.
 */
export function LessonScreen({ levelId }: { levelId: string }) {
  const router = useRouter();
  const { state, dispatch } = useGame();
  const i18n = useI18n();
  const { t } = i18n;
  const reducedMotion = useReducedMotion();
  const { width, height, fontScale } = useWindowDimensions();

  // Opening the screen opens the level where the player left it (the website's openLevel; Discover the first time).
  useFocusEffect(useCallback(() => dispatch({ type: "openLevel", levelId }), [dispatch, levelId]));
  const opened = state.levelId === levelId;

  const lesson = activeLesson(state);
  const progress = activeProgress(state);
  const map = useRegionMap(opened ? lesson : undefined);

  // A gameplay press, unless one went through a moment ago (pressGuard.ts), and only for this level.
  const lastPress = useRef<number | null>(null);
  const act = useCallback(
    (action: LessonAction) => {
      const now = Date.now();
      if (!opened || !acceptPress(lastPress.current, now)) return;
      lastPress.current = now;
      dispatch({ type: "lesson", action });
    },
    [dispatch, opened],
  );

  // Travel's hint: neighbour names on the map for a few seconds, for the position where it was asked (the "hint
  // used" record itself is the attempt's).
  const [travelHint, setTravelHint] = useState<{ at: number } | null>(null);
  const pathLength = progress.travel?.path.length ?? 0;
  const travelHintVisible = progress.stage === "travel" && travelHint?.at === pathLength;
  useEffect(() => {
    if (!travelHint) return;
    const timer = setTimeout(() => setTravelHint(null), TRAVEL_HINT_MS);
    return () => clearTimeout(timer);
  }, [travelHint]);

  const view = useMemo(() => buildMapView(lesson, progress, { travelHintVisible }), [lesson, progress, travelHintVisible]);

  const onCountryTap = useCallback(
    (country: CountryId) => {
      if (!opened) return;
      // Map taps answer at once: the game ignores a tap once the question is answered (find.ts).
      if (progress.stage === "discover") {
        if (lesson.countries.includes(country)) dispatch({ type: "lesson", action: { type: "discoverSelect", country } });
      } else if (progress.stage === "find") {
        dispatch({ type: "lesson", action: { type: "findGuess", country } });
      }
    },
    [dispatch, lesson, opened, progress.stage],
  );

  // Back to the level's continent's levels: back down the stack where it is there, in its place otherwise (a level
  // continued from Home), so the header's and Results' "Back to levels" always lead there.
  const backToLevels = () => router.dismissTo({ pathname: "/continent/[id]", params: { id: getLevel(levelId)!.continent } });
  // Next level, opened where it was left (Discover the first time), in this screen's place.
  const openNext = (next: LevelInfo) => {
    const now = Date.now();
    if (!acceptPress(lastPress.current, now)) return;
    lastPress.current = now;
    dispatch({ type: "openLevel", levelId: next.id });
    router.replace({ pathname: "/level/[id]", params: { id: next.id } });
  };
  const playAgain = () => confirmRestart("playAgain", getLevel(levelId)!.title, i18n, () => dispatch({ type: "restartLevel", levelId }));

  // On a wide screen (a phone held sideways, a tablet) the panel sits beside the map; otherwise below it, the map
  // taking less of the height when the text is enlarged.
  const wide = width > height && width >= 600;
  const mapHeight = Math.max(180, height * (fontScale > 1.3 ? 0.34 : 0.4));

  const panelProps = { lesson, progress, act };
  const panel = !opened ? null : progress.stage === "discover" ? (
    <DiscoverPanel {...panelProps} />
  ) : progress.stage === "find" ? (
    <FindPanel {...panelProps} />
  ) : progress.stage === "travel" ? (
    <TravelPanel
      {...panelProps}
      hintVisible={travelHintVisible}
      onHint={() => {
        act({ type: "travelHint" });
        setTravelHint({ at: pathLength });
      }}
    />
  ) : (
    <ResultsPanel {...panelProps} next={nextLevel(state, lesson.id)} newBest={state.newBest === lesson.id} onNext={openNext} onBackToLevels={backToLevels} onPlayAgain={playAgain} />
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScreenHeader back={{ label: t("results.backToLevels"), onPress: backToLevels }} />
      {opened && <StepsBar stage={progress.stage} />}
      <View style={[styles.body, wide && styles.bodyWide]}>
        <View style={wide ? styles.mapWide : [styles.map, { height: mapHeight }]}>
          {opened && <LessonMap lesson={lesson} map={map} view={view} stage={progress.stage} onCountryTap={onCountryTap} reducedMotion={reducedMotion} />}
        </View>
        <View style={styles.panel}>{panel}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  bodyWide: { flexDirection: "row" },
  map: { paddingHorizontal: space.lg },
  mapWide: { flex: 1.2, paddingLeft: space.lg, paddingBottom: space.lg },
  panel: { flex: 1 },
});

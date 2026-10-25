import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { LessonStage } from "@/core/lesson/progress";
import { MAX_STARS } from "@/core/lesson/rating";
import { STEPS } from "../game/steps";
import { useI18n } from "../i18n/i18n";
import { colors, radius, space, type } from "../theme/tokens";

/**
 * The lesson's three steps under the header (the website's Header steps): done ones with a check, the current one
 * filled in its colour, upcoming ones with their number. In Results every step is done and none is current.
 */
export function StepsBar({ stage }: { stage: LessonStage }) {
  const { t } = useI18n();
  // On phones only the current step is named on screen, as on the website; the dots show the rest.
  const narrow = useWindowDimensions().width < 520;
  const current = stage === "results" ? STEPS.length : STEPS.findIndex((s) => s.stages.includes(stage));
  return (
    <View style={styles.steps} accessibilityRole="list" accessibilityLabel={t("steps.label")}>
      {STEPS.map((step, i) => {
        const label = t(step.key);
        const done = i < current;
        const now = i === current;
        return (
          <View
            key={step.key}
            accessible
            accessibilityLabel={done ? t("welcome.stepDone", { step: label }) : now ? t("steps.current", { step: label }) : t("welcome.stepTodo", { step: label })}
            style={[styles.step, (done || now) && { backgroundColor: step.soft }, now && { borderColor: step.accent }]}
          >
            <Text style={[styles.stepDot, { backgroundColor: done || now ? step.accent : colors.line, color: done || now ? colors.white : colors.inkSoft }]}>{done ? "✓" : i + 1}</Text>
            {(now || !narrow) && <Text style={[styles.stepLabel, { color: done || now ? step.accent : colors.inkSoft }]}>{label}</Text>}
          </View>
        );
      })}
    </View>
  );
}

/** Stars as the website draws them: earned ones filled amber, the rest outlined. Decorative: their count is said beside them. */
export function Stars({ count, size = 22 }: { count: number; size?: number }) {
  return (
    <View style={styles.stars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <Svg key={i} width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"
            fill={i < count ? colors.amber : "none"}
            stroke={i < count ? colors.amberDark : colors.inkSoft}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        </Svg>
      ))}
    </View>
  );
}

/** A check for a correct answer; a curved "try again" arrow otherwise (the website's FeedbackIcon). */
export function FeedbackIcon({ correct, color }: { correct: boolean; color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={11} fill={color} />
      {correct ? (
        <Path d="M7 12.5l3.3 3.3L17 9" fill="none" stroke={colors.white} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <Path d="M16.5 9.5A5 5 0 1 0 17 14M16.8 6.3v3.4h-3.4" fill="none" stroke={colors.white} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, paddingHorizontal: space.lg, paddingVertical: space.sm },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  stepDot: { ...type.small, fontWeight: "800", minWidth: 24, paddingHorizontal: 4, borderRadius: radius.pill, overflow: "hidden", textAlign: "center" },
  stepLabel: { ...type.small, fontWeight: "700", paddingRight: space.xs },
  stars: { flexDirection: "row", gap: 2 },
});

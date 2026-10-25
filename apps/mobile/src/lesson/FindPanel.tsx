import { StyleSheet, Text, View } from "react-native";
import { countryHint, getCountry } from "@/core/content/countries";
import { isLastAnswered } from "@/core/game/find";
import type { MessageKey } from "@/core/i18n/translate";
import { Button } from "../components/Button";
import { useI18n } from "../i18n/i18n";
import { colors, radius, space, type } from "../theme/tokens";
import { Panel, type PanelProps } from "./Panel";
import { FeedbackIcon } from "./parts";

const HINT_BUTTON: Record<number, MessageKey> = { 0: "find.hint", 1: "find.hintMore", 2: "find.hintReveal" };

/**
 * Find (the website's FindPanel): one question per country of the level, in the order Start finding drew; tap the
 * country on the map. Wrong answers and hints are the game's own (src/core/game/find.ts): a question answered on
 * the first try without hints counts as "first try", and the next question waits for Next.
 */
export function FindPanel({ lesson, progress, act }: PanelProps) {
  const { t, l, countryParams } = useI18n();
  const session = progress.find;
  if (!session) return null;
  const { question, index } = session;
  const total = session.order.length;
  const target = getCountry(question.target);
  const answer = session.results[index];
  const feedback = question.feedback;
  const done = index + (question.solved ? 1 : 0);
  const last = isLastAnswered(session);
  const prompt = t("find.prompt", countryParams(question.target));
  const asked = countryParams(question.target).country;

  let feedbackText = "";
  if (feedback?.kind === "correct") feedbackText = t(answer?.independent ? "find.correct" : "find.correctAssisted", countryParams(feedback.country));
  else if (feedback?.kind === "wrong") feedbackText = t("find.wrong", countryParams(feedback.country));
  else if (feedback?.kind === "outside") feedbackText = t("find.outside");
  const correct = feedback?.kind === "correct";

  return (
    <Panel
      top={`find:${index}`}
      footer={
        question.solved ? (
          <Button variant="primary" grow label={t(last ? "find.toTravel" : "find.next")} onPress={() => act({ type: last ? "findToTravel" : "findNext" })} />
        ) : (
          <Button grow label={t(HINT_BUTTON[question.hintLevel] ?? "find.hintReveal")} onPress={() => act({ type: "findHint" })} disabled={question.hintLevel >= 3} />
        )
      }
    >
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>{t("find.question", { current: index + 1, total })}</Text>
        {/* One segment per question: answered, the current one, still to come. */}
        <View
          style={styles.pips}
          accessibilityRole="progressbar"
          accessibilityLabel={t("find.question", { current: index + 1, total })}
          accessibilityValue={{ min: 0, max: total, now: done }}
        >
          {session.order.map((id, i) => (
            <View key={id} style={[styles.pip, i < done ? styles.pipDone : i === index ? styles.pipCurrent : null]} />
          ))}
        </View>
      </View>

      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          <Emphasized text={prompt} part={asked} />
        </Text>
        {!question.solved && <Text style={styles.lead}>{t("find.instructions")}</Text>}
      </View>

      <View accessibilityLiveRegion="polite">
        {feedbackText !== "" && (
          <View style={[styles.feedback, correct ? styles.feedbackCorrect : styles.feedbackWrong]}>
            <FeedbackIcon correct={correct} color={correct ? colors.discoverInk : colors.coralStrong} />
            <View style={styles.feedbackWords}>
              <Text style={styles.feedbackText}>{feedbackText}</Text>
              {correct && <Text style={styles.feedbackDetail}>{t(answer?.independent ? "find.firstTry" : "find.withHelp")}</Text>}
            </View>
          </View>
        )}
      </View>

      {question.hintLevel > 0 && !question.solved && (
        <View style={styles.hints} accessibilityLiveRegion="polite">
          <Text style={styles.hint}>
            {`• ${t("find.hintCapital", { capital: l(target.capital.name) })}${target.landmark ? ` ${t("find.hintLandmark", { landmark: l(target.landmark.nameInText) })}` : ""}`}
          </Text>
          {question.hintLevel >= 2 && <Text style={styles.hint}>{`• ${l(countryHint(lesson, target.id))}${question.hintLevel === 2 ? ` ${t("find.hintArea")}` : ""}`}</Text>}
          {question.hintLevel >= 3 && <Text style={styles.hint}>{`• ${t("find.hintRevealed")}`}</Text>}
        </View>
      )}
    </Panel>
  );
}

/** `text` with `part` (the country asked for) emphasised, whatever the word order of the language. */
function Emphasized({ text, part }: { text: string; part: string }) {
  const at = text.indexOf(part);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <Text style={styles.target}>{part}</Text>
      {text.slice(at + part.length)}
    </>
  );
}

const styles = StyleSheet.create({
  heading: { gap: space.xs },
  eyebrow: { ...type.small, fontWeight: "800", color: colors.findInk, textTransform: "uppercase" },
  pips: { flexDirection: "row", gap: 4 },
  pip: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.line },
  pipDone: { backgroundColor: colors.find },
  pipCurrent: { backgroundColor: colors.findInk },
  title: { ...type.title, color: colors.ink },
  target: { color: colors.coralStrong },
  lead: { ...type.body, color: colors.inkSoft },
  feedback: { flexDirection: "row", alignItems: "flex-start", gap: space.sm, padding: space.md, borderRadius: radius.sm },
  feedbackCorrect: { backgroundColor: colors.discoverSoft },
  feedbackWrong: { backgroundColor: colors.coralSoft },
  feedbackWords: { flex: 1, gap: 2 },
  feedbackText: { ...type.bodyStrong, color: colors.ink },
  feedbackDetail: { ...type.small, color: colors.ink },
  hints: { gap: space.xs, padding: space.md, borderRadius: radius.sm, backgroundColor: colors.findSoft },
  hint: { ...type.body, color: colors.ink },
});

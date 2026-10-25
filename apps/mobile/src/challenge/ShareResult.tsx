import * as Sharing from "expo-sharing";
import { useRef, useState, type ComponentRef } from "react";
import { Modal, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ChallengeResult } from "@/core/challenge/quickChallenge";
import { shareSummary, shareText } from "@/core/challenge/share";
import { CARD_HEIGHT, CARD_WIDTH } from "@/core/challenge/shareCardLayout";
import { Button } from "../components/Button";
import { useI18n } from "../i18n/i18n";
import { colors, radius, space, type } from "../theme/tokens";
import { ShareCard } from "./ShareCard";

type Status = { kind: "idle" } | { kind: "preparing" } | { kind: "failed"; key: "challengeShare.prepareFailed" | "challengeShare.shareFailed" };

/**
 * Share result (the website's ShareResult dialog): the card for this result in the language now shown (ShareCard),
 * then Android's share sheet with it as a PNG (expo-sharing), or the share message alone, as text (the system's
 * Share). Closing the share sheet is no failure and shows nothing, as on the website; Android doesn't say whether
 * something was shared, so nothing claims it was.
 */
export function ShareResult({ result, open, onClose }: { result: ChallengeResult; open: boolean; onClose: () => void }) {
  const { t, app, locale } = useI18n();
  const { width } = useWindowDimensions();
  const text = shareText(shareSummary(result), locale);
  const card = useRef<ComponentRef<typeof View>>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const preview = Math.min(width - 2 * space.lg, 420);

  const shareImage = async () => {
    if (!card.current) return;
    setStatus({ kind: "preparing" });
    let uri: string;
    try {
      uri = await captureRef(card, { format: "png", width: CARD_WIDTH, height: CARD_HEIGHT, result: "tmpfile", fileName: text.fileName.replace(/\.png$/, "") });
    } catch {
      setStatus({ kind: "failed", key: "challengeShare.prepareFailed" });
      return;
    }
    try {
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: t("challengeShare.title"), UTI: "public.png" });
      setStatus({ kind: "idle" });
    } catch {
      setStatus({ kind: "failed", key: "challengeShare.shareFailed" });
    }
  };

  const shareMessage = async () => {
    try {
      await Share.share({ message: text.message }, { dialogTitle: t("challengeShare.title") });
    } catch {
      // The share sheet couldn't open: nothing was shared, and nothing else is affected.
    }
  };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>
            {t("challengeShare.title")}
          </Text>
          <View style={styles.preview}>
            <ShareCard ref={card} text={text} width={preview} />
          </View>
          <Text style={styles.found}>{text.found}</Text>
          {status.kind === "preparing" && <Text style={styles.note}>{t("challengeShare.preparing")}</Text>}
          {status.kind === "failed" && (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {t(status.key)}
            </Text>
          )}
          <Button variant="primary" label={t("challengeShare.shareImage")} onPress={shareImage} disabled={status.kind === "preparing"} />
          <Button label={app("shareMessage")} onPress={shareMessage} />
          <Button label={t("challengeShare.close")} onPress={onClose} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md },
  title: { ...type.title, color: colors.ink },
  preview: { alignItems: "center", borderRadius: radius.md, overflow: "hidden" },
  found: { ...type.bodyStrong, color: colors.ink, textAlign: "center" },
  note: { ...type.body, color: colors.inkSoft },
  error: { ...type.body, color: colors.coralStrong },
});

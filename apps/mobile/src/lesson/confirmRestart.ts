import { Alert } from "react-native";
import type { LocalizedText } from "@/core/i18n/locales";
import type { MessageKey, MessageParams } from "@/core/i18n/translate";

/**
 * Starting a level over (or playing it again) discards the player's place in it, so it asks first, naming the level,
 * as the website's RestartDialog does; keeping it is the default (back and tapping outside keep it too). Confirming
 * calls `restart` (restartLevel: only that level's place is cleared; its records, completion and unlocks stay).
 */
export function confirmRestart(
  mode: "startOver" | "playAgain",
  title: LocalizedText,
  i18n: { t: (key: MessageKey, params?: MessageParams) => string; l: (text: LocalizedText) => string },
  restart: () => void,
) {
  const { t, l } = i18n;
  const again = mode === "playAgain";
  Alert.alert(
    t(again ? "welcome.playAgainTitle" : "welcome.startOverTitle", { level: l(title) }),
    t(again ? "welcome.playAgainText" : "welcome.startOverText"),
    [
      { text: t(again ? "welcome.playAgainKeep" : "welcome.startOverKeep"), style: "cancel" },
      { text: t(again ? "welcome.playAgain" : "welcome.startOver"), style: "destructive", onPress: restart },
    ],
    { cancelable: true },
  );
}

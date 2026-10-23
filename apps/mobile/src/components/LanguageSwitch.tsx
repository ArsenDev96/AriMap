import { Pressable, StyleSheet, Text, View } from "react-native";
import { LOCALE_META, LOCALES } from "@/core/i18n/locales";
import { useGame } from "../game/GameProvider";
import { useI18n } from "../i18n/i18n";
import { colors, radius, space, TAP, type } from "../theme/tokens";

/**
 * The website's language switch: each language named in itself ("EN", "ՀՅ"; read as "English", "Հայերեն"), no
 * flags. Changing it changes only the language (setLocale), which is saved with the game.
 */
export function LanguageSwitch() {
  const { state, dispatch } = useGame();
  const { t } = useI18n();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t("language.label")} style={styles.group}>
      {LOCALES.map((locale) => {
        const selected = state.locale === locale;
        return (
          <Pressable
            key={locale}
            accessibilityRole="radio"
            accessibilityLabel={LOCALE_META[locale].name}
            accessibilityState={{ checked: selected }}
            onPress={() => dispatch({ type: "setLocale", locale })}
            style={[styles.option, selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{LOCALE_META[locale].short}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: "row",
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    padding: 2,
  },
  option: {
    minWidth: TAP,
    minHeight: TAP - 4,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  selected: { backgroundColor: colors.ink },
  label: { ...type.bodyStrong, color: colors.ink },
  selectedLabel: { color: colors.white },
});

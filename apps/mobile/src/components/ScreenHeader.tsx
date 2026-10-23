import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, space, TAP, type } from "../theme/tokens";
import { LanguageSwitch } from "./LanguageSwitch";

interface Props {
  /** The header's start: the app's name on Home, or a back action elsewhere. */
  children?: ReactNode;
  back?: { label: string; onPress?: () => void };
}

/**
 * The header every screen keeps in view above its scrolling content: its title or a back action, and the language
 * switch. It wraps onto two rows with large text rather than shrinking anything.
 */
export function ScreenHeader({ children, back }: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.start}>
        {back ? (
          <Pressable accessibilityRole="button" accessibilityLabel={back.label} onPress={back.onPress ?? (() => router.back())} style={styles.back} hitSlop={4}>
            <Text style={styles.backLabel}>{`← ${back.label}`}</Text>
          </Pressable>
        ) : (
          children
        )}
      </View>
      <LanguageSwitch />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.bg,
  },
  start: { flexShrink: 1, flexGrow: 1 },
  back: { minHeight: TAP, justifyContent: "center", alignSelf: "flex-start" },
  backLabel: { ...type.bodyStrong, color: colors.ink },
});

import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, space } from "../theme/tokens";

interface Props {
  header: ReactNode;
  children: ReactNode;
  /** The screen's main action, in its own area below the scrolling content (as on the website). */
  action?: ReactNode;
}

/**
 * A screen drawn edge to edge (Android's default from API 35): the header stays in view under the status bar, only the
 * content scrolls, and the action area stays clear of the navigation bar. Side insets (a phone held sideways, a
 * display cutout) are kept clear too.
 */
export function Screen({ header, children, action }: Props) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, space.lg);
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {header}
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, !action && { paddingBottom: bottom }]}>
        {children}
      </ScrollView>
      {action && <View style={[styles.action, { paddingBottom: bottom }]}>{action}</View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  action: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
});

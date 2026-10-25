import { useEffect, useRef, type ComponentRef, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LessonAction, LessonProgress } from "@/core/lesson/progress";
import type { LessonDefinition } from "@/core/lessons/types";
import { colors, space } from "../theme/tokens";

/** What every stage's panel is given (the website's PanelProps). */
export interface PanelProps {
  lesson: LessonDefinition;
  progress: LessonProgress;
  /** A gameplay action (the website's `act`), through the press guard. */
  act: (action: LessonAction) => void;
}

/**
 * A stage's panel beside the map: its content scrolls, and its main action, when it has one, stays in view below it,
 * clear of the navigation bar (as the website pins it on phones). The content starts at its top again whenever
 * `top` changes (a new country chosen in Discover, a new stage).
 */
export function Panel({ children, footer, top }: { children: ReactNode; footer?: ReactNode; top: string }) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, space.lg);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [top]);
  return (
    <>
      <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={[styles.content, !footer && { paddingBottom: bottom }]}>
        {children}
      </ScrollView>
      {footer && <View style={[styles.footer, { paddingBottom: bottom }]}>{footer}</View>}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: space.lg, gap: space.md },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
});

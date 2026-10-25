import { Pressable, StyleSheet, Text, useWindowDimensions } from "react-native";
import { longestWordWidth } from "../theme/textWidth";
import { colors, radius, space, TAP, type } from "../theme/tokens";

interface Props {
  label: string;
  onPress: () => void;
  /** "primary": the screen's main action (coral); "secondary": an action on a card. */
  variant?: "primary" | "secondary";
  /** The full name, when the visible label alone is ambiguous ("Start: Around the Alps"). It starts with the label. */
  accessibilityLabel?: string;
  disabled?: boolean;
  /**
   * Shares its row's width, never less than its longest word needs, so the row wraps rather than break a word
   * (Travel's "Undo" in Armenian at 200% text on a small phone).
   */
  grow?: boolean;
  testID?: string;
}

/** At least a 48dp target; with larger text it grows taller and wraps between words, never clipping. */
export function Button({ label, onPress, variant = "secondary", accessibilityLabel, disabled = false, grow = false, testID }: Props) {
  const primary = variant === "primary";
  const { fontScale } = useWindowDimensions();
  // Grown from the width its longest word needs (a basis of 0 lets a wrapped row overlap what follows it).
  const growWidth = grow ? { flexBasis: Math.max(GROW_MIN, longestWordWidth([label], type.bodyStrong.fontSize * fontScale) + 2 * space.md + 2 * BORDER) } : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        pressed && (primary ? styles.primaryPressed : styles.secondaryPressed),
        disabled && styles.disabled,
        grow && styles.grow,
        growWidth,
      ]}
    >
      <Text style={[styles.label, primary ? styles.primaryLabel : styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const GROW_MIN = 120;
const BORDER = 2;

const styles = StyleSheet.create({
  base: {
    minHeight: TAP,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.coralStrong },
  primaryPressed: { backgroundColor: colors.coralStrongPressed },
  secondary: { backgroundColor: colors.surface, borderWidth: BORDER, borderColor: colors.ink },
  secondaryPressed: { backgroundColor: colors.surfaceWarm },
  disabled: { opacity: 0.4 },
  grow: { flexGrow: 1, paddingHorizontal: space.md },
  label: { ...type.bodyStrong, textAlign: "center" },
  primaryLabel: { color: colors.white },
  secondaryLabel: { color: colors.ink },
});

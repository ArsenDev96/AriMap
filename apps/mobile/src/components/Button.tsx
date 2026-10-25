import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, space, TAP, type } from "../theme/tokens";

interface Props {
  label: string;
  onPress: () => void;
  /** "primary": the screen's main action (coral); "secondary": an action on a card. */
  variant?: "primary" | "secondary";
  /** The full name, when the visible label alone is ambiguous ("Start: Around the Alps"). It starts with the label. */
  accessibilityLabel?: string;
  disabled?: boolean;
  /** Takes an equal share of its row's width (the row wraps when the labels need more room). */
  grow?: boolean;
  testID?: string;
}

/** At least a 48dp target; with larger text it grows taller and wraps between words, never clipping. */
export function Button({ label, onPress, variant = "secondary", accessibilityLabel, disabled = false, grow = false, testID }: Props) {
  const primary = variant === "primary";
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
      ]}
    >
      <Text style={[styles.label, primary ? styles.primaryLabel : styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

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
  secondary: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.ink },
  secondaryPressed: { backgroundColor: colors.surfaceWarm },
  disabled: { opacity: 0.4 },
  grow: { flexGrow: 1, flexBasis: 0, minWidth: 120, paddingHorizontal: space.md },
  label: { ...type.bodyStrong, textAlign: "center" },
  primaryLabel: { color: colors.white },
  secondaryLabel: { color: colors.ink },
});

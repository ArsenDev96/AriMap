import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, space, TAP, type } from "../theme/tokens";

interface Props {
  label: string;
  onPress: () => void;
  /** "primary": the screen's main action (coral); "secondary": an action on a card. */
  variant?: "primary" | "secondary";
  /** The full name, when the visible label alone is ambiguous ("Start: Around the Alps"). It starts with the label. */
  accessibilityLabel?: string;
}

/** At least a 48dp target; with larger text it grows taller and wraps between words, never clipping. */
export function Button({ label, onPress, variant = "secondary", accessibilityLabel }: Props) {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.base, primary ? styles.primary : styles.secondary, pressed && (primary ? styles.primaryPressed : styles.secondaryPressed)]}
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
  label: { ...type.bodyStrong, textAlign: "center" },
  primaryLabel: { color: colors.white },
  secondaryLabel: { color: colors.ink },
});

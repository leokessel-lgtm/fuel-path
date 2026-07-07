import { Pressable, StyleSheet, View } from "react-native";

import { colors, radii, spacing } from "../theme";

export const currentLocationFieldInset = 52;

export function CurrentLocationFieldButton({
  accessibilityHint,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  accessibilityHint?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <View style={styles.icon}>
        <View style={styles.lineVertical} />
        <View style={styles.lineHorizontal} />
        <View style={styles.dot} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    bottom: 0,
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: spacing.xs,
    top: 0,
    width: 44,
  },
  buttonPressed: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  icon: {
    alignItems: "center",
    borderColor: colors.green,
    borderRadius: 9,
    borderWidth: 2,
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  lineVertical: {
    backgroundColor: colors.green,
    height: 24,
    position: "absolute",
    width: 2,
  },
  lineHorizontal: {
    backgroundColor: colors.green,
    height: 2,
    position: "absolute",
    width: 24,
  },
  dot: {
    backgroundColor: colors.green,
    borderColor: colors.white,
    borderRadius: 4,
    borderWidth: 1,
    height: 8,
    width: 8,
  },
});

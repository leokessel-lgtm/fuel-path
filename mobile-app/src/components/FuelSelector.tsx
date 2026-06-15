import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typeScale } from "../theme";
import { FuelCode } from "../types";

const fuelCodes: FuelCode[] = ["E10", "U91", "P95", "P98", "DL", "PDL"];

export function FuelSelector({
  value,
  onChange,
}: {
  value: FuelCode;
  onChange: (fuel: FuelCode) => void;
}) {
  return (
    <View style={styles.row}>
      {fuelCodes.map((fuel) => {
        const selected = fuel === value;
        return (
          <Pressable
            key={fuel}
            onPress={() => onChange(fuel)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{fuel}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  label: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  labelSelected: {
    color: colors.white,
  },
});

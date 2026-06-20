import { StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { AppPreferences, FuelCode } from "../types";
import { FuelSelector } from "./FuelSelector";

export function VehicleFuelCard({
  preferences,
  onFuelChange,
}: {
  preferences: AppPreferences;
  onFuelChange: (fuel: FuelCode) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Vehicle</Text>
      <Text style={styles.title}>{preferences.vehicleName || "Vehicle not set"}</Text>
      <Text style={styles.muted}>
        {preferences.vehicleRego
          ? `Registration ${preferences.vehicleRego}`
          : "Fuel type is enough to start. Vehicle details can come later."}
      </Text>
      <FuelSelector value={preferences.fuel} onChange={onFuelChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadow.float,
    ...surfaces.floating,
    borderRadius: radii.xxl,
    gap: spacing.md,
    padding: spacing.md,
  },
  eyebrow: {
    ...typography.eyebrow,
    textTransform: "uppercase",
  },
  title: {
    ...typography.title,
  },
  muted: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    lineHeight: 18,
  },
});

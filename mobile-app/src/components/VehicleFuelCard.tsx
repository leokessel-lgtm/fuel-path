import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import {
  AppPreferences,
  EvChargingPreference,
  EvConnector,
  FuelCode,
  HomeChargingAccess,
  VehicleEnergyType,
} from "../types";
import { FuelSelector } from "./FuelSelector";

const energyOptions: Array<{ label: string; value: VehicleEnergyType; helper: string }> = [
  { label: "Fuel", value: "petrol", helper: "Petrol car" },
  { label: "Diesel", value: "diesel", helper: "Diesel car" },
  { label: "Hybrid", value: "hybrid", helper: "Fuel + plug" },
  { label: "EV", value: "electric", helper: "Electric only" },
];

const evConnectorOptions: EvConnector[] = ["CCS2", "CHADEMO", "TYPE2", "TESLA", "NACS"];
const evBatteryPresets = [50, 75, 100];
const evRangePresets = [250, 400, 550];
const homeChargingOptions: Array<{ label: string; value: HomeChargingAccess }> = [
  { label: "Not sure", value: "unknown" },
  { label: "Home charging", value: "yes" },
  { label: "Public only", value: "no" },
];
const chargingPreferenceOptions: Array<{ label: string; value: EvChargingPreference; helper: string }> = [
  { label: "Balanced", value: "balanced", helper: "Good default" },
  { label: "Cheapest", value: "cheap", helper: "Prefer low cost" },
  { label: "Fastest", value: "fast", helper: "Prefer high power" },
  { label: "Reliable", value: "reliable", helper: "Prefer known operators" },
  { label: "Closest", value: "nearby", helper: "Minimise detour" },
];

export function VehicleFuelCard({
  preferences,
  onFuelChange,
  onHomeChargingAccessChange,
  onToggleEvConnector,
  onVehicleProfileChange,
  onVehicleEnergyTypeChange,
}: {
  preferences: AppPreferences;
  onFuelChange: (fuel: FuelCode) => void;
  onHomeChargingAccessChange: (homeChargingAccess: HomeChargingAccess) => void;
  onToggleEvConnector: (connector: EvConnector) => void;
  onVehicleProfileChange: (
    updates: Partial<Pick<AppPreferences, "evBatteryKwh" | "evRangeKm" | "fuelTankLitres" | "evChargingPreference">>,
  ) => void;
  onVehicleEnergyTypeChange: (vehicleEnergyType: VehicleEnergyType) => void;
}) {
  const usesFuel = preferences.vehicleEnergyType !== "electric";
  const usesEvCharging = preferences.vehicleEnergyType === "electric" || preferences.vehicleEnergyType === "hybrid";
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>My vehicle</Text>
      <Text style={styles.title}>{preferences.vehicleName || "Vehicle not set"}</Text>
      <Text style={styles.muted}>
        {preferences.vehicleRego
          ? `Registration ${preferences.vehicleRego}`
          : "Set the energy type once, then Fuel Path can show the right fuel grades or compatible chargers."}
      </Text>
      <View style={styles.nearbyImpactCard}>
        <Text style={styles.nearbyImpactTitle}>Used across the app</Text>
        <Text style={styles.nearbyImpactText}>{vehicleImpactCopy(preferences)}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Energy type</Text>
        <View style={styles.energyGrid}>
          {energyOptions.map((option) => {
            const selected = preferences.vehicleEnergyType === option.value;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.value}
                onPress={() => onVehicleEnergyTypeChange(option.value)}
                style={[styles.energyChip, selected && styles.energyChipSelected]}
              >
                <Text style={[styles.energyChipLabel, selected && styles.energyChipLabelSelected]}>
                  {option.label}
                </Text>
                <Text style={[styles.energyChipHelper, selected && styles.energyChipHelperSelected]}>
                  {option.helper}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {usesFuel ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Fuel grade</Text>
          <FuelSelector value={preferences.fuel} onChange={onFuelChange} />
        </View>
      ) : null}
      {usesEvCharging ? (
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionLabel}>EV compatibility</Text>
            <Text style={styles.sectionHint}>
              {preferences.evConnectors.length ? `${preferences.evConnectors.length} selected` : "Any connector"}
            </Text>
          </View>
          <Text style={styles.muted}>
            Nearby EV charging will start with these connector filters. Leave blank if you want to browse every charger.
          </Text>
          <View style={styles.connectorRow}>
            {evConnectorOptions.map((connector) => {
              const selected = preferences.evConnectors.includes(connector);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={connector}
                  onPress={() => onToggleEvConnector(connector)}
                  style={[styles.connectorChip, selected && styles.connectorChipSelected]}
                >
                  <Text style={[styles.connectorText, selected && styles.connectorTextSelected]}>
                    {connector}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionLabel}>Charging priority</Text>
            <Text style={styles.sectionHint}>{chargingPreferenceLabel(preferences.evChargingPreference)}</Text>
          </View>
          <Text style={styles.muted}>
            Nearby uses this as the default ranking signal, while connector chips stay as compatibility settings.
          </Text>
          <View style={styles.energyGrid}>
            {chargingPreferenceOptions.map((option) => {
              const selected = preferences.evChargingPreference === option.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={option.value}
                  onPress={() => onVehicleProfileChange({ evChargingPreference: option.value })}
                  style={[styles.energyChip, selected && styles.energyChipSelected]}
                >
                  <Text style={[styles.energyChipLabel, selected && styles.energyChipLabelSelected]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.energyChipHelper, selected && styles.energyChipHelperSelected]}>
                    {option.helper}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionLabel}>Usable range</Text>
            <Text style={styles.sectionHint}>{preferences.evRangeKm} km</Text>
          </View>
          <View style={styles.connectorRow}>
            {evRangePresets.map((rangeKm) => (
              <ProfileChip
                key={rangeKm}
                label={`${rangeKm} km`}
                selected={preferences.evRangeKm === rangeKm}
                onPress={() => onVehicleProfileChange({ evRangeKm: rangeKm })}
              />
            ))}
          </View>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionLabel}>Battery size</Text>
            <Text style={styles.sectionHint}>{preferences.evBatteryKwh} kWh</Text>
          </View>
          <View style={styles.connectorRow}>
            {evBatteryPresets.map((batteryKwh) => (
              <ProfileChip
                key={batteryKwh}
                label={`${batteryKwh} kWh`}
                selected={preferences.evBatteryKwh === batteryKwh}
                onPress={() => onVehicleProfileChange({ evBatteryKwh: batteryKwh })}
              />
            ))}
          </View>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionLabel}>Charging access</Text>
            <Text style={styles.sectionHint}>{homeChargingLabel(preferences.homeChargingAccess)}</Text>
          </View>
          <View style={styles.connectorRow}>
            {homeChargingOptions.map((option) => (
              <ProfileChip
                key={option.value}
                label={option.label}
                selected={preferences.homeChargingAccess === option.value}
                onPress={() => onHomeChargingAccessChange(option.value)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ProfileChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.connectorChip, selected && styles.connectorChipSelected]}
    >
      <Text style={[styles.connectorText, selected && styles.connectorTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function homeChargingLabel(value: HomeChargingAccess) {
  if (value === "yes") return "Home";
  if (value === "no") return "Public only";
  return "Unknown";
}

function chargingPreferenceLabel(value: EvChargingPreference) {
  if (value === "cheap") return "Cheapest";
  if (value === "fast") return "Fastest";
  if (value === "reliable") return "Reliable";
  if (value === "nearby") return "Closest";
  return "Balanced";
}

function vehicleImpactCopy(preferences: AppPreferences) {
  if (preferences.vehicleEnergyType === "electric") {
    const connectors = preferences.evConnectors.length ? preferences.evConnectors.join(" / ") : "all connectors";
    return `Nearby starts with charging, ranks by ${chargingPreferenceLabel(preferences.evChargingPreference).toLowerCase()}, filters for ${connectors}, and treats availability as unconfirmed unless the provider proves live status.`;
  }
  if (preferences.vehicleEnergyType === "hybrid") {
    const connectors = preferences.evConnectors.length ? preferences.evConnectors.join(" / ") : "all connectors";
    return `Nearby shows a fuel-and-charge mix using ${preferences.fuel}, ${connectors}, ${chargingPreferenceLabel(preferences.evChargingPreference).toLowerCase()} charging priority and home-charging settings.`;
  }
  return `Nearby starts with ${preferences.fuel} fuel prices. Plan uses a standard fill estimate automatically.`;
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
  nearbyImpactCard: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.lg,
    gap: 2,
    padding: spacing.md,
  },
  nearbyImpactTitle: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  nearbyImpactText: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "600",
    lineHeight: 18,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionLabel: {
    color: colors.greenDark,
    fontSize: typeScale.micro,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  sectionHint: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  energyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  energyChip: {
    ...surfaces.softPanel,
    borderRadius: radii.lg,
    flexBasis: "48%",
    flexGrow: 1,
    gap: 2,
    padding: spacing.sm,
  },
  energyChipSelected: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  energyChipLabel: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  energyChipLabelSelected: {
    color: colors.white,
  },
  energyChipHelper: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "500",
  },
  energyChipHelperSelected: {
    color: colors.greenSoft,
  },
  connectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  connectorChip: {
    backgroundColor: colors.panelStrong,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  connectorChipSelected: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  connectorText: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  connectorTextSelected: {
    color: colors.white,
  },
});

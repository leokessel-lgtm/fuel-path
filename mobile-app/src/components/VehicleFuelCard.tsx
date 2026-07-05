import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import {
  AppPreferences,
  EvChargingPreference,
  EvConnector,
  FuelCode,
  HomeChargingAccess,
  VehicleEnergyType,
  VehicleProfile,
} from "../types";
import { FuelSelector } from "./FuelSelector";

const energyOptions: Array<{ label: string; value: VehicleEnergyType }> = [
  { label: "Petrol", value: "petrol" },
  { label: "Diesel", value: "diesel" },
  { label: "EV", value: "electric" },
];
const evConnectorOptions: EvConnector[] = ["CCS2", "CHADEMO", "TYPE2", "TESLA", "NACS"];
const evBatteryPresets = [50, 75, 100];
const evRangePresets = [250, 400, 550];
const homeChargingOptions: Array<{ label: string; value: HomeChargingAccess }> = [
  { label: "Not sure", value: "unknown" },
  { label: "Home", value: "yes" },
  { label: "Public only", value: "no" },
];
const chargingPreferenceOptions: Array<{ label: string; value: EvChargingPreference }> = [
  { label: "Balanced", value: "balanced" },
  { label: "Cheapest", value: "cheap" },
  { label: "Fastest", value: "fast" },
  { label: "Reliable", value: "reliable" },
  { label: "Closest", value: "nearby" },
];
const maxVehicleProfiles = 5;

export function VehicleFuelCard({
  preferences,
  onAddVehicle,
  onFuelChange,
  onHomeChargingAccessChange,
  onRemoveVehicle,
  onSelectVehicle,
  onToggleEvConnector,
  onVehicleProfileChange,
  onVehicleEnergyTypeChange,
}: {
  preferences: AppPreferences;
  onAddVehicle: (vehicleEnergyType?: VehicleEnergyType) => void;
  onFuelChange: (fuel: FuelCode) => void;
  onHomeChargingAccessChange: (homeChargingAccess: HomeChargingAccess) => void;
  onRemoveVehicle: (vehicleId: string) => void;
  onSelectVehicle: (vehicleId: string) => void;
  onToggleEvConnector: (connector: EvConnector) => void;
  onVehicleProfileChange: (
    updates: Partial<Pick<AppPreferences, "evBatteryKwh" | "evRangeKm" | "fuelTankLitres" | "homeChargingAccess" | "evChargingPreference" | "vehicleName" | "vehicleRego">>,
  ) => void;
  onVehicleEnergyTypeChange: (vehicleEnergyType: VehicleEnergyType) => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const activeVehicle = preferences.vehicles.find((vehicle) => vehicle.id === preferences.activeVehicleId)
    || preferences.vehicles[0];
  const usesFuel = preferences.vehicleEnergyType !== "electric";
  const usesEvCharging = preferences.vehicleEnergyType === "electric";
  const canAddVehicle = preferences.vehicles.length < maxVehicleProfiles;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Vehicle & fuel</Text>
          <Text style={styles.title}>{vehicleDisplayName(activeVehicle, preferences)}</Text>
          <Text style={styles.muted}>{vehicleImpactCopy(preferences)}</Text>
        </View>
        <View style={styles.activeBadge}>
          <Text style={styles.activeBadgeText}>Active</Text>
        </View>
      </View>

      <View style={styles.vehicleList}>
        {preferences.vehicles.map((vehicle) => {
          const selected = vehicle.id === preferences.activeVehicleId;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={vehicle.id}
              onPress={() => onSelectVehicle(vehicle.id)}
              style={[styles.vehicleRow, selected && styles.vehicleRowSelected]}
            >
              <View style={[styles.vehicleAvatar, selected && styles.vehicleAvatarSelected]}>
                <Text style={[styles.vehicleAvatarText, selected && styles.vehicleAvatarTextSelected]}>
                  {vehicleInitials(vehicle)}
                </Text>
              </View>
              <View style={styles.vehicleRowCopy}>
                <Text style={[styles.vehicleRowTitle, selected && styles.vehicleRowTitleSelected]}>
                  {vehicleDisplayName(vehicle, preferences)}
                </Text>
                <Text style={[styles.vehicleRowMeta, selected && styles.vehicleRowMetaSelected]}>
                  {vehicleSummary(vehicle)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.addRow}>
        <Pressable
          accessibilityRole="button"
          disabled={!canAddVehicle}
          onPress={() => onAddVehicle("petrol")}
          style={[styles.addButton, !canAddVehicle && styles.addButtonDisabled]}
        >
          <Text style={[styles.addButtonText, !canAddVehicle && styles.addButtonTextDisabled]}>Add fuel car</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!canAddVehicle}
          onPress={() => onAddVehicle("electric")}
          style={[styles.addButton, !canAddVehicle && styles.addButtonDisabled]}
        >
          <Text style={[styles.addButtonText, !canAddVehicle && styles.addButtonTextDisabled]}>Add EV</Text>
        </Pressable>
      </View>
      {!canAddVehicle ? <Text style={styles.limitText}>Five vehicles keeps switching quick. Remove one to add another.</Text> : null}

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Current vehicle</Text>
        <TextInput
          accessibilityLabel="Vehicle name"
          onChangeText={(vehicleName) => onVehicleProfileChange({ vehicleName })}
          placeholder="Vehicle name"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={preferences.vehicleName}
        />
        <TextInput
          accessibilityLabel="Registration"
          autoCapitalize="characters"
          onChangeText={(vehicleRego) => onVehicleProfileChange({ vehicleRego })}
          placeholder="Registration optional"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={preferences.vehicleRego}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Type</Text>
        <View style={styles.chipRow}>
          {energyOptions.map((option) => (
            <ProfileChip
              key={option.value}
              label={option.label}
              selected={preferences.vehicleEnergyType === option.value}
              onPress={() => onVehicleEnergyTypeChange(option.value)}
            />
          ))}
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
            <Text style={styles.sectionLabel}>EV match</Text>
            <Text style={styles.sectionHint}>{preferences.evConnectors.length ? `${preferences.evConnectors.length} plugs` : "Any plug"}</Text>
          </View>
          <View style={styles.chipRow}>
            {evConnectorOptions.map((connector) => (
              <ProfileChip
                key={connector}
                label={connector}
                selected={preferences.evConnectors.includes(connector)}
                onPress={() => onToggleEvConnector(connector)}
              />
            ))}
          </View>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionLabel}>Usable range</Text>
            <Text style={styles.sectionHint}>{preferences.evRangeKm} km</Text>
          </View>
          <View style={styles.chipRow}>
            {evRangePresets.map((rangeKm) => (
              <ProfileChip
                key={rangeKm}
                label={`${rangeKm} km`}
                selected={preferences.evRangeKm === rangeKm}
                onPress={() => onVehicleProfileChange({ evRangeKm: rangeKm })}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAdvancedOpen((current) => !current)}
            style={styles.advancedButton}
          >
            <Text style={styles.advancedButtonText}>{advancedOpen ? "Hide EV details" : "EV details"}</Text>
            <Text style={styles.advancedButtonMeta}>{chargingPreferenceLabel(preferences.evChargingPreference)}</Text>
          </Pressable>
          {advancedOpen ? (
            <View style={styles.advancedSection}>
              <Text style={styles.sectionLabel}>Charging priority</Text>
              <View style={styles.chipRow}>
                {chargingPreferenceOptions.map((option) => (
                  <ProfileChip
                    key={option.value}
                    label={option.label}
                    selected={preferences.evChargingPreference === option.value}
                    onPress={() => onVehicleProfileChange({ evChargingPreference: option.value })}
                  />
                ))}
              </View>
              <Text style={styles.sectionLabel}>Battery size</Text>
              <View style={styles.chipRow}>
                {evBatteryPresets.map((batteryKwh) => (
                  <ProfileChip
                    key={batteryKwh}
                    label={`${batteryKwh} kWh`}
                    selected={preferences.evBatteryKwh === batteryKwh}
                    onPress={() => onVehicleProfileChange({ evBatteryKwh: batteryKwh })}
                  />
                ))}
              </View>
              <Text style={styles.sectionLabel}>Charging access</Text>
              <View style={styles.chipRow}>
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
      ) : null}

      {preferences.vehicles.length > 1 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onRemoveVehicle(preferences.activeVehicleId)}
          style={styles.removeButton}
        >
          <Text style={styles.removeButtonText}>Remove current vehicle</Text>
        </Pressable>
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
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function vehicleDisplayName(vehicle: VehicleProfile | undefined, preferences: AppPreferences) {
  if (!vehicle) return "My vehicle";
  return vehicle.name || vehicle.rego || (vehicle.id === preferences.activeVehicleId ? "My vehicle" : "Vehicle");
}

function vehicleInitials(vehicle: VehicleProfile) {
  const source = vehicle.rego || vehicle.name || energyLabel(vehicle.vehicleEnergyType);
  return source.trim().slice(0, 2).toUpperCase();
}

function vehicleSummary(vehicle: VehicleProfile) {
  if (vehicle.vehicleEnergyType === "electric") {
    const connectors = vehicle.evConnectors.length ? vehicle.evConnectors.join("/") : "any plug";
    return `EV | ${vehicle.evRangeKm} km | ${connectors}`;
  }
  return `${energyLabel(vehicle.vehicleEnergyType)} | ${vehicle.fuel}`;
}

function energyLabel(value: VehicleEnergyType) {
  if (value === "electric") return "EV";
  if (value === "diesel") return "Diesel";
  return "Petrol";
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
    const connectors = preferences.evConnectors.length ? preferences.evConnectors.join(" / ") : "any connector";
    return `Nearby starts with EV charging, Plan checks route chargers, and both use ${connectors}.`;
  }
  return `Nearby starts with ${preferences.fuel}. Plan uses this fuel grade with your discounts and route rules.`;
}

const styles = StyleSheet.create({
  card: {
    ...shadow.float,
    ...surfaces.floating,
    borderRadius: radii.xxl,
    gap: spacing.md,
    padding: spacing.md,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
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
  activeBadge: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  activeBadgeText: {
    color: colors.greenDark,
    fontSize: typeScale.micro,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  vehicleList: {
    gap: spacing.xs,
  },
  vehicleRow: {
    ...surfaces.softPanel,
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 58,
    padding: spacing.sm,
  },
  vehicleRowSelected: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  vehicleAvatar: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  vehicleAvatarSelected: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  vehicleAvatarText: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  vehicleAvatarTextSelected: {
    color: colors.white,
  },
  vehicleRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  vehicleRowTitle: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  vehicleRowTitleSelected: {
    color: colors.white,
  },
  vehicleRowMeta: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "500",
    marginTop: 2,
  },
  vehicleRowMetaSelected: {
    color: colors.greenSoft,
  },
  addRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  addButton: {
    ...surfaces.floating,
    alignItems: "center",
    borderRadius: radii.pill,
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  addButtonText: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  addButtonDisabled: {
    backgroundColor: colors.panelStrong,
    borderColor: colors.line,
  },
  addButtonTextDisabled: {
    color: colors.mutedSoft,
  },
  limitText: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  divider: {
    backgroundColor: colors.line,
    height: 1,
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
  input: {
    ...surfaces.softPanel,
    borderRadius: radii.md,
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "700",
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    ...surfaces.floating,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  chipText: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  chipTextSelected: {
    color: colors.white,
  },
  advancedButton: {
    ...surfaces.softPanel,
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  advancedButtonText: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  advancedButtonMeta: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  advancedSection: {
    gap: spacing.sm,
  },
  removeButton: {
    alignSelf: "flex-start",
    minHeight: 36,
    justifyContent: "center",
  },
  removeButtonText: {
    color: colors.red,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
});

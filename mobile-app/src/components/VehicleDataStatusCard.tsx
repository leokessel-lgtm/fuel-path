import { StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { EvChargingStatus, FuelProviderStatus } from "../api/fuelPathApi";
import { VehicleEnergyType } from "../types";

export function VehicleDataStatusCard({
  evStatus,
  fuelStatus,
  vehicleEnergyType,
}: {
  evStatus?: EvChargingStatus;
  fuelStatus?: FuelProviderStatus;
  vehicleEnergyType: VehicleEnergyType;
}) {
  const showsFuel = vehicleEnergyType !== "electric";
  const showsEv = vehicleEnergyType === "electric" || vehicleEnergyType === "hybrid";
  const fuelLiveRegions = fuelStatus?.capabilitySummary.live || 0;
  const fuelLimitedRegions = fuelStatus?.capabilitySummary.limited || 0;
  const fuelPendingRegions = fuelStatus?.capabilitySummary.pending_access || 0;
  const fuelLabel = fuelLiveRegions
    ? `${fuelLiveRegions} live fuel regions`
    : fuelPendingRegions
      ? "Fuel access pending"
      : "Fuel coverage limited";
  const evProviderLabel = providerName(evStatus?.provider);
  const evEnabled = Boolean(evStatus?.configured);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>Vehicle data</Text>
          <Text style={styles.title}>{vehicleDataTitle(vehicleEnergyType)}</Text>
        </View>
        <View style={[styles.statusPill, dataStatusReady({ evEnabled, fuelLiveRegions, showsEv, showsFuel }) ? styles.statusPillEnabled : styles.statusPillBlocked]}>
          <Text style={[styles.statusPillText, dataStatusReady({ evEnabled, fuelLiveRegions, showsEv, showsFuel }) ? styles.statusPillTextEnabled : styles.statusPillTextBlocked]}>
            {dataStatusReady({ evEnabled, fuelLiveRegions, showsEv, showsFuel }) ? "Ready" : "Check"}
          </Text>
        </View>
      </View>
      <View style={styles.metaRow}>
        {showsFuel ? <Text style={styles.metaPill}>{fuelLabel}</Text> : null}
        {showsFuel && fuelLimitedRegions ? <Text style={styles.metaPill}>{fuelLimitedRegions} limited</Text> : null}
        {showsEv ? <Text style={styles.metaPill}>{evProviderLabel}</Text> : null}
        {showsEv ? <Text style={styles.metaPill}>No live bay claims</Text> : null}
      </View>
      <Text style={styles.muted}>
        {vehicleDataWarning({ evStatus, fuelStatus, showsEv, showsFuel })}
      </Text>
    </View>
  );
}

function vehicleDataTitle(vehicleEnergyType: VehicleEnergyType) {
  if (vehicleEnergyType === "electric") return "EV charger directory status";
  if (vehicleEnergyType === "hybrid") return "Fuel and charging data status";
  return "Fuel price data status";
}

function dataStatusReady({
  evEnabled,
  fuelLiveRegions,
  showsEv,
  showsFuel,
}: {
  evEnabled: boolean;
  fuelLiveRegions: number;
  showsEv: boolean;
  showsFuel: boolean;
}) {
  const fuelReady = !showsFuel || fuelLiveRegions > 0;
  const evReady = !showsEv || evEnabled;
  return fuelReady && evReady;
}

function vehicleDataWarning({
  evStatus,
  fuelStatus,
  showsEv,
  showsFuel,
}: {
  evStatus?: EvChargingStatus;
  fuelStatus?: FuelProviderStatus;
  showsEv: boolean;
  showsFuel: boolean;
}) {
  const parts = [];
  if (showsFuel) {
    parts.push(
      fuelStatus
        ? "Fuel prices are selected region-by-region from provider capability, freshness and access status."
        : "Fuel provider status is still loading; confirm price freshness before driving.",
    );
  }
  if (showsEv) {
    parts.push(
      evStatus?.warning ||
        "EV charger results are directory data. Confirm access, tariff and live bay status in the charging network app before driving.",
    );
  }
  return parts.join(" ");
}

function providerName(provider?: string) {
  if (provider === "api_ninjas") return "API Ninjas";
  if (provider === "open_charge_map") return "Open Charge Map";
  if (provider === "plugshare") return "PlugShare";
  if (provider === "here") return "HERE";
  if (provider === "tomtom") return "TomTom";
  if (provider === "mapbox") return "Mapbox";
  if (provider === "network_partner") return "Network partner";
  return "Provider unknown";
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
    color: colors.ink,
    fontSize: typeScale.lead,
    fontWeight: "800",
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  statusPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusPillEnabled: {
    backgroundColor: colors.greenSoft,
  },
  statusPillBlocked: {
    backgroundColor: colors.amberSoft,
  },
  statusPillText: {
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  statusPillTextEnabled: {
    color: colors.greenDark,
  },
  statusPillTextBlocked: {
    color: colors.amber,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  metaPill: {
    backgroundColor: colors.panelStrong,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  muted: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    lineHeight: 18,
  },
});

import { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, type ListRenderItem } from "react-native";

import {
  EvChargerRow,
  EvSheetFilters,
  NearbyControlDeck,
  NearbyMode,
} from "./NearbyEvControls";
import { StationRow } from "./StationRow";
import { colors, radii, shadow, spacing, surfaces, typeScale } from "../theme";
import { AppPreferences, EvCharger, EvConnector, EvPowerMode, FuelCode, NearbyResponse, NearbySheetSnap, StationViewModel } from "../types";
import { vehicleProfileHint } from "../utils/evChargingDisplay";
import { fuelMismatchContextLine } from "../utils/fuelMismatch";

const nearbySheetBottomOffset = 8;
const combinedRowKeyExtractor = (row: CombinedNearbyRow) => `${row.type}-${row.id}`;

export function NearbyCombinedPanel({
  chargers,
  connectors,
  error,
  evNotice,
  loading,
  mode,
  onCloseSelection,
  onFuelChange,
  onModeChange,
  onExpandSearch,
  onNavigateToCharger,
  onSelectCharger,
  onSelectStation,
  onToggleConnector,
  onToggleExpanded,
  onSnapChange,
  onPowerModeChange,
  powerMode,
  preferences,
  selectedCharger,
  selectedCode,
  selectedStation,
  sheetSnap,
  sheetExpanded,
  expandedSheetTop,
  sortedStations,
  stationContext,
  stationNotice,
}: {
  chargers: EvCharger[];
  connectors: EvConnector[];
  error: string;
  evNotice: string;
  loading: boolean;
  mode: NearbyMode;
  onCloseSelection: () => void;
  onFuelChange: (fuel: FuelCode) => void;
  onModeChange: (mode: NearbyMode) => void;
  onExpandSearch: () => void;
  onNavigateToCharger: (charger: EvCharger) => void;
  onSelectCharger: (chargerId: string) => void;
  onSelectStation: (stationCode: string) => void;
  onToggleConnector: (connector: EvConnector) => void;
  onToggleExpanded: (expanded: boolean) => void;
  onSnapChange?: (snap: NearbySheetSnap) => void;
  onPowerModeChange: (value: EvPowerMode) => void;
  powerMode: EvPowerMode;
  preferences: AppPreferences;
  selectedCharger?: EvCharger;
  selectedCode?: string;
  selectedStation?: StationViewModel;
  sheetSnap: NearbySheetSnap;
  sheetExpanded: boolean;
  expandedSheetTop: number;
  sortedStations: StationViewModel[];
  stationContext?: NearbyResponse["context"];
  stationNotice?: string;
}) {
  const combinedRows = combinedNearbyRows(sortedStations, chargers, connectors, preferences.evChargingPreference);
  const selectedRows = combinedRows.filter((row) => row.id === selectedCode);
  const previewRows = selectedRows.length ? selectedRows : combinedRows.slice(0, 2);
  const vehicleHint = vehicleProfileHint(
    preferences.fuel,
    connectors,
    preferences.evChargingPreference,
    preferences.vehicleEnergyType,
  );
  const showEvControls = mode === "ev" || preferences.vehicleEnergyType === "electric";
  const isPeek = sheetSnap === "peek";
  const isFull = sheetSnap === "full";
  const fuelNotice = fuelMismatchContextLine(stationContext) || (!combinedRows.length ? stationNotice : "");
  const renderCombinedItem = useCallback<ListRenderItem<CombinedNearbyRow>>(
    ({ item }) => (
      <CombinedNearbyListRow
        onNavigateToCharger={onNavigateToCharger}
        onSelectCharger={onSelectCharger}
        onSelectStation={onSelectStation}
        row={item}
        selected={item.id === selectedCode}
      />
    ),
    [onNavigateToCharger, onSelectCharger, onSelectStation, selectedCode],
  );
  const requestSnap = (snap: NearbySheetSnap) => {
    if (onSnapChange) {
      onSnapChange(snap);
      return;
    }
    onToggleExpanded(snap === "full");
  };

  return (
    <View style={[styles.sheet, isFull ? [styles.sheetExpanded, { top: expandedSheetTop }] : isPeek ? styles.sheetPeek : styles.sheetCollapsed]}>
      <View style={styles.sheetHeader}>
        <Pressable
          accessibilityLabel={sheetExpanded ? "Collapse combined fuel and charger list" : "Expand combined fuel and charger list"}
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => requestSnap(nextSnap(sheetSnap))}
          style={styles.grabberTouch}
        >
          <View style={styles.grabber} />
        </Pressable>
        {isFull ? (
          <Pressable
            accessibilityLabel="Show map"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => requestSnap("browse")}
            style={styles.mapButton}
          >
            <Text style={styles.mapButtonText}>Map</Text>
          </Pressable>
        ) : selectedCode ? (
          <Pressable
            accessibilityLabel="Close selected result"
            accessibilityRole="button"
            hitSlop={10}
            onPress={onCloseSelection}
            style={styles.mapButton}
          >
            <Text style={styles.mapButtonText}>Close</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.titleRow}>
        <View>
          <Text style={styles.eyebrow}>My vehicle nearby</Text>
          <Text style={styles.title}>
            {loading ? "Finding your best options..." : resultTitle(sortedStations.length, chargers.length)}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={sheetExpanded ? "Show combined map" : "Show combined list"}
          accessibilityRole="button"
          onPress={() => requestSnap(isFull ? "browse" : "full")}
          style={styles.listToggle}
        >
          <Text style={styles.listToggleText}>{sheetExpanded ? "Map" : "Full list"}</Text>
        </Pressable>
      </View>

      {error && isFull ? <Text style={styles.notice}>{error}</Text> : null}
      {!error && fuelNotice && !isPeek ? <Text style={styles.notice}>{fuelNotice}</Text> : null}
      {!error && evNotice && !isPeek ? <Text style={styles.notice}>{evNotice}</Text> : null}

      {!isPeek ? (
        <NearbyControlDeck
          compact={!isFull}
          fuel={preferences.fuel}
          mode={mode}
          onFuelChange={onFuelChange}
          onModeChange={onModeChange}
          vehicleHint={vehicleHint}
        />
      ) : null}
      {showEvControls && isFull ? (
        <EvSheetFilters
          connectors={connectors}
          chargingPreference={preferences.evChargingPreference}
          onPowerModeChange={onPowerModeChange}
          onToggleConnector={onToggleConnector}
          powerMode={powerMode}
          showAdvanced={isFull}
        />
      ) : null}
      {!loading && !error && !isFull
        ? (
          <>
            {!isPeek ? (
              <Text numberOfLines={1} style={styles.peekHint}>Browse view. Full list for more.</Text>
            ) : null}
            {previewRows.map((row) => (
              <CombinedNearbyListRow
                key={combinedRowKeyExtractor(row)}
                onNavigateToCharger={onNavigateToCharger}
                onSelectCharger={onSelectCharger}
                onSelectStation={onSelectStation}
                row={row}
                selected={row.id === selectedCode}
              />
            ))}
          </>
        )
        : null}

      {!loading && !error && isFull ? (
        <FlatList
          ListHeaderComponent={<Text style={styles.sectionLabel}>Best nearby mix</Text>}
          contentContainerStyle={styles.listContent}
          data={combinedRows}
          keyExtractor={combinedRowKeyExtractor}
          renderItem={renderCombinedItem}
          showsVerticalScrollIndicator
          style={styles.list}
        />
      ) : null}

      {!loading && !error && !combinedRows.length ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No fuel or chargers found here yet</Text>
          <Text style={styles.emptyText}>
            This can happen in remote areas where fuel access is pending or charger directory coverage is thin. Try a wider area and confirm options before driving.
          </Text>
          <Pressable accessibilityRole="button" onPress={onExpandSearch} style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>Search wider area</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

type CombinedNearbyRow =
  | { distanceKm: number; id: string; rankReason: string; score: number; station: StationViewModel; type: "fuel" }
  | { charger: EvCharger; distanceKm: number; id: string; rankReason: string; score: number; type: "charger" };

function combinedNearbyRows(
  stations: StationViewModel[],
  chargers: EvCharger[],
  connectors: EvConnector[],
  chargingPreference: AppPreferences["evChargingPreference"],
): CombinedNearbyRow[] {
  const cheapestFuel = stations.reduce(
    (lowest, station) => Math.min(lowest, Number(station.adjustedCpl || station.pumpCpl || Infinity)),
    Infinity,
  );
  return [
    ...stations.map((station) => fuelCombinedRow(station, cheapestFuel)),
    ...chargers.map((charger) => chargerCombinedRow(charger, connectors, chargingPreference)),
  ].sort((left, right) => left.score - right.score || left.distanceKm - right.distanceKm);
}

function fuelCombinedRow(station: StationViewModel, cheapestFuel: number): CombinedNearbyRow {
  const pricePremium = Number.isFinite(cheapestFuel)
    ? Math.max(0, Number(station.adjustedCpl || station.pumpCpl) - cheapestFuel)
    : 0;
  return {
    distanceKm: station.distanceKm,
    id: station.station.stationCode,
    rankReason: pricePremium < 0.2
      ? `Best nearby ${station.fuel || "fuel"} price`
      : `${pricePremium.toFixed(1)} c/L above cheapest, still nearby`,
    score: station.distanceKm * 1.15 + pricePremium * 0.18,
    station,
    type: "fuel",
  };
}

function chargerCombinedRow(
  charger: EvCharger,
  connectors: EvConnector[],
  chargingPreference: AppPreferences["evChargingPreference"],
): CombinedNearbyRow {
  const connectorMatch = connectors.length > 0 &&
    charger.connectors.some((connector) => connectors.includes(connector as EvConnector));
  const powerBonus = charger.powerBand === "ultra_fast"
    ? 2.4
    : charger.powerBand === "dc_fast"
      ? 1.4
      : charger.powerBand === "ac"
        ? 0.3
        : 0;
  const preferenceBonus = chargerPreferenceBonus(charger, chargingPreference);
  return {
    charger,
    distanceKm: charger.distanceKm,
    id: charger.id,
    rankReason: chargerRankReason(charger, connectorMatch),
    score: Math.max(0, charger.distanceKm * 1.05 - powerBonus - preferenceBonus - (connectorMatch ? 1.2 : 0)),
    type: "charger",
  };
}

function chargerPreferenceBonus(
  charger: EvCharger,
  chargingPreference: AppPreferences["evChargingPreference"],
) {
  if (chargingPreference === "nearby") return Math.max(0, 1.4 - charger.distanceKm * 0.1);
  if (chargingPreference === "fast") {
    if (charger.powerBand === "ultra_fast") return 2;
    if (charger.powerBand === "dc_fast") return 1.1;
  }
  if (chargingPreference === "reliable") {
    return charger.operator && charger.operator !== "Unknown operator" ? 0.9 : 0;
  }
  if (chargingPreference === "cheap") {
    return charger.pricing && !/unknown|unconfirmed/i.test(charger.pricing) ? 0.8 : 0;
  }
  return 0;
}

function chargerRankReason(charger: EvCharger, connectorMatch: boolean) {
  if (connectorMatch && charger.powerBand === "ultra_fast") return "Compatible ultra-fast charger";
  if (connectorMatch && charger.powerBand === "dc_fast") return "Compatible fast charger";
  if (connectorMatch) return "Matches your vehicle connector profile";
  if (charger.powerBand === "ultra_fast") return "Ultra-fast charger, connector unconfirmed";
  if (charger.powerBand === "dc_fast") return "Fast charger, connector unconfirmed";
  return "Nearby charger, details need confirmation";
}

function resultTitle(stationCount: number, chargerCount: number) {
  if (stationCount && chargerCount) return `${stationCount} fuel, ${chargerCount} charge`;
  if (stationCount) return `${stationCount} fuel stops`;
  if (chargerCount) return `${chargerCount} chargers`;
  return "No nearby options yet";
}

function chargerSourceLabel(chargers: EvCharger[]) {
  const source = chargers.find((charger) => charger.source)?.source || "";
  if (source === "api_ninjas") return "Chargers from API Ninjas";
  if (source === "open_charge_map") return "Chargers from Open Charge Map";
  if (source === "openweb_ninja") return "Chargers from OpenWeb Ninja";
  return "Charger directory data";
}

function CombinedNearbyListRow({
  onNavigateToCharger,
  onSelectCharger,
  onSelectStation,
  row,
  selected,
}: {
  onNavigateToCharger: (charger: EvCharger) => void;
  onSelectCharger: (chargerId: string) => void;
  onSelectStation: (stationCode: string) => void;
  row: CombinedNearbyRow;
  selected: boolean;
}) {
  const handleFuelPress = useCallback(
    () => onSelectStation(row.id),
    [onSelectStation, row.id],
  );
  const handleChargerPress = useCallback(
    () => onSelectCharger(row.id),
    [onSelectCharger, row.id],
  );
  if (row.type === "fuel") {
    return (
      <StationRow
        item={row.station}
        rankReason={row.rankReason}
        selected={selected}
        onPress={handleFuelPress}
      />
    );
  }
  return (
    <EvChargerRow
      charger={row.charger}
      rankReason={row.rankReason}
      selected={selected}
      onNavigate={onNavigateToCharger}
      onPress={handleChargerPress}
    />
  );
}

function nextSnap(activeSnap: NearbySheetSnap): NearbySheetSnap {
  if (activeSnap === "peek") return "browse";
  if (activeSnap === "browse") return "full";
  return "browse";
}

const styles = StyleSheet.create({
  sheet: {
    ...shadow.float,
    ...surfaces.floating,
    borderRadius: radii.xxl,
    bottom: nearbySheetBottomOffset,
    gap: spacing.sm,
    left: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    position: "absolute",
    right: spacing.md,
    zIndex: 6,
  },
  sheetCollapsed: {
    maxHeight: 285,
    overflow: "hidden",
  },
  sheetPeek: {
    bottom: 18,
    maxHeight: 180,
    overflow: "hidden",
  },
  sheetExpanded: {
    bottom: 8,
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 20,
  },
  grabberTouch: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 24,
    paddingVertical: 2,
  },
  grabber: {
    alignSelf: "center",
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    height: 4,
    width: 44,
  },
  mapButton: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    position: "absolute",
    right: 0,
  },
  mapButtonText: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: "600",
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  eyebrow: {
    color: colors.muted,
    fontSize: typeScale.micro,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  title: {
    color: colors.ink,
    fontSize: typeScale.lead,
    fontWeight: "900",
  },
  listToggle: {
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  listToggleText: {
    color: colors.white,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  notice: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "500",
    lineHeight: 18,
  },
  peekHint: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
    lineHeight: 18,
  },
  sourceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  sourcePill: {
    backgroundColor: colors.panelStrong,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "800",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: typeScale.micro,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  emptyCard: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  emptyText: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "500",
    lineHeight: 18,
  },
  emptyButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
});

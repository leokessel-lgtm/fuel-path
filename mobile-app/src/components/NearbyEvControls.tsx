import { useCallback } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, type ListRenderItem } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { EvCharger, EvChargingPreference, EvConnector, EvPowerMode, FuelCode, NearbySheetSnap } from "../types";
import { evChargingPreferenceLabel, evPowerOptions } from "../utils/evChargingDisplay";

export type NearbyMode = "fuel" | "ev" | "both";
export type NearbyEnergyChoice = FuelCode | "EV";

const evConnectorOptions: EvConnector[] = ["CCS2", "CHADEMO", "TYPE2", "TESLA"];
const nearbySheetBottomOffset = 8;
const energySelectorMinWidth = 214;
const evChargerKeyExtractor = (charger: EvCharger) => charger.id;
const energyOptions: Array<{ label: string; shortLabel: string; value: NearbyEnergyChoice }> = [
  { label: "E10", shortLabel: "E10", value: "E10" },
  { label: "U91", shortLabel: "U91", value: "U91" },
  { label: "P95", shortLabel: "P95", value: "P95" },
  { label: "P98", shortLabel: "P98", value: "P98" },
  { label: "Diesel", shortLabel: "Diesel", value: "DL" },
  { label: "Premium diesel", shortLabel: "Premium diesel", value: "PDL" },
  { label: "EV charge", shortLabel: "EV charge", value: "EV" },
];

export function NearbyEnergySelector({
  eyebrow = "Show nearby",
  includeEv = true,
  onChange,
  onToggleOpen,
  open,
  value,
}: {
  eyebrow?: string;
  includeEv?: boolean;
  onChange: (value: NearbyEnergyChoice) => void;
  onToggleOpen: () => void;
  open: boolean;
  value: NearbyEnergyChoice;
}) {
  const options = includeEv ? energyOptions : energyOptions.filter((option) => option.value !== "EV");
  const selected = options.find((option) => option.value === value) || options[1];
  return (
    <View style={styles.energySelector}>
      <Pressable
        accessibilityLabel="Choose fuel or EV charging"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggleOpen}
        style={styles.energyButton}
      >
        <View>
          <Text style={styles.energyEyebrow}>{eyebrow}</Text>
          <Text style={styles.energyButtonText}>{selected.shortLabel}</Text>
        </View>
        <Text style={styles.energyChevron}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.energyMenu}>
          {options.map((option) => {
            const optionSelected = option.value === value;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: optionSelected }}
                key={option.value}
                onPress={() => onChange(option.value)}
                style={[styles.energyOption, optionSelected && styles.energyOptionSelected]}
              >
                <Text style={[styles.energyOptionText, optionSelected && styles.energyOptionTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function NearbyControlDeck({
  fuel,
  mode,
  onFuelChange,
  onModeChange,
  compact = false,
  showFuelSelector = true,
  vehicleHint,
}: {
  fuel: FuelCode;
  mode: NearbyMode;
  onFuelChange: (fuel: FuelCode) => void;
  onModeChange: (mode: NearbyMode) => void;
  compact?: boolean;
  showFuelSelector?: boolean;
  vehicleHint?: string;
}) {
  const contextLabel = nearbyModeContextLabel(mode, fuel);
  return (
    <View style={styles.controlDeck}>
      {compact ? <Text numberOfLines={1} style={styles.controlContext}>{contextLabel}</Text> : null}
      {vehicleHint && !compact ? <Text style={styles.controlHint}>{vehicleHint}</Text> : null}
      <NearbyModeToggle mode={mode} onModeChange={onModeChange} />
    </View>
  );
}

function NearbyModeToggle({
  mode,
  onModeChange,
}: {
  mode: NearbyMode;
  onModeChange: (mode: NearbyMode) => void;
}) {
  return (
    <View style={styles.modeToggle}>
      <ModeChip
        label="Fuel"
        selected={mode === "fuel"}
        onPress={() => onModeChange("fuel")}
      />
      <ModeChip
        label="Best"
        accessibilityLabel="Best for my vehicle"
        selected={mode === "both"}
        onPress={() => onModeChange("both")}
      />
      <ModeChip
        label="Charge"
        selected={mode === "ev"}
        onPress={() => onModeChange("ev")}
      />
    </View>
  );
}

function ModeChip({
  accessibilityLabel,
  label,
  selected,
  onPress,
}: {
  accessibilityLabel?: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel || label}
      onPress={onPress}
      style={[styles.modeChip, selected && styles.modeChipSelected]}
    >
      <Text style={[styles.modeChipText, selected && styles.modeChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function EvChargerPanel({
  chargers,
  connectors,
  error,
  loading,
  notice,
  onClearConnectorFilters,
  onClearPowerMode,
  onCloseSelectedCharger,
  onExpandSearch,
  onNavigate,
  onPowerModeChange,
  onSelectCharger,
  onToggleExpanded,
  onSnapChange,
  onToggleConnector,
  selectedCharger,
  selectedChargerId,
  sheetSnap,
  sheetExpanded,
  expandedSheetTop,
  powerMode,
  chargingPreference = "balanced",
  controls,
}: {
  chargers: EvCharger[];
  connectors: EvConnector[];
  error: string;
  loading: boolean;
  notice: string;
  onClearConnectorFilters: () => void;
  onClearPowerMode: () => void;
  onCloseSelectedCharger: () => void;
  onExpandSearch: () => void;
  onNavigate: (charger: EvCharger) => void;
  onPowerModeChange: (value: EvPowerMode) => void;
  onSelectCharger: (chargerId: string) => void;
  onToggleExpanded: (expanded: boolean) => void;
  onSnapChange?: (snap: NearbySheetSnap) => void;
  onToggleConnector: (connector: EvConnector) => void;
  selectedCharger?: EvCharger;
  selectedChargerId?: string;
  sheetSnap: NearbySheetSnap;
  sheetExpanded: boolean;
  expandedSheetTop: number;
  powerMode: EvPowerMode;
  chargingPreference?: EvChargingPreference;
  controls?: React.ReactNode;
}) {
  const isPeek = sheetSnap === "peek";
  const isFull = sheetSnap === "full";
  const requestSnap = (snap: NearbySheetSnap) => {
    if (onSnapChange) {
      onSnapChange(snap);
      return;
    }
    onToggleExpanded(snap === "full");
  };
  const renderChargerItem = useCallback<ListRenderItem<EvCharger>>(
    ({ item }) => (
      <EvChargerListRow
        charger={item}
        onNavigate={onNavigate}
        onSelectCharger={onSelectCharger}
        selected={item.id === selectedChargerId}
      />
    ),
    [onNavigate, onSelectCharger, selectedChargerId],
  );

  return (
    <View style={[styles.evPanel, isFull ? [styles.evPanelExpanded, { top: expandedSheetTop }] : isPeek ? styles.evPanelPeek : styles.evPanelCollapsed]}>
      <View style={styles.evSheetHeader}>
        <Pressable
          accessibilityLabel={sheetExpanded ? "Collapse charger list" : "Expand charger list"}
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => requestSnap(nextSnap(sheetSnap))}
          style={styles.evGrabberTouch}
        >
          <View style={styles.evGrabber} />
        </Pressable>
        {isFull ? (
          <Pressable
            accessibilityLabel="Show map"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => requestSnap("browse")}
            style={styles.evMapButton}
          >
            <Text style={styles.evMapButtonText}>Map</Text>
          </Pressable>
        ) : selectedCharger ? (
          <Pressable
            accessibilityLabel="Close selected charger"
            accessibilityRole="button"
            hitSlop={10}
            onPress={onCloseSelectedCharger}
            style={styles.evMapButton}
          >
            <Text style={styles.evMapButtonText}>Close</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.evPanelTitleRow}>
        <Text style={styles.evPanelTitle}>{loading ? "Finding chargers..." : chargerCountTitle(chargers.length)}</Text>
      </View>
      {!isPeek && error ? <Text style={styles.evPanelNotice}>{error}</Text> : null}
      {!isPeek && !error && !loading && chargers.length ? (
        <Text style={styles.evPanelNotice}>{conciseEvNotice(notice) || "Check charger details in the network app before driving."}</Text>
      ) : null}
      {!isPeek && controls ? <View style={styles.controlDeck}>{controls}</View> : null}
      {isFull ? (
        <EvSheetFilters
          connectors={connectors}
          chargingPreference={chargingPreference}
          onPowerModeChange={onPowerModeChange}
          onToggleConnector={onToggleConnector}
          powerMode={powerMode}
          showAdvanced={isFull}
        />
      ) : !isPeek ? (
        <EvPowerFilterRow onPowerModeChange={onPowerModeChange} powerMode={powerMode} />
      ) : null}
      {!loading && !error && selectedCharger && !isFull ? (
        <>
          <EvChargerRow
            charger={selectedCharger}
            selected
            onNavigate={onNavigate}
            onPress={() => onSelectCharger(selectedCharger.id)}
          />
        </>
      ) : null}
      {!loading && !error && isFull ? (
        <FlatList
          contentContainerStyle={styles.evListContent}
          data={chargers}
          keyExtractor={evChargerKeyExtractor}
          renderItem={renderChargerItem}
          showsVerticalScrollIndicator
          style={styles.evList}
        />
      ) : null}
      {!loading && !error && !chargers.length ? (
        <View style={styles.evEmptyCard}>
          <Text style={styles.evCardTitle}>No matching chargers</Text>
          <Text style={styles.evCardMeta}>
            Try broadening compatibility, speed or the map area. API Ninjas is directory data, so remote coverage can be patchy.
          </Text>
          <View style={styles.emptyActionRow}>
            {connectors.length ? (
              <Pressable accessibilityRole="button" onPress={onClearConnectorFilters} style={styles.emptyActionButton}>
                <Text style={styles.emptyActionText}>Show all connectors</Text>
              </Pressable>
            ) : null}
            {powerMode ? (
              <Pressable accessibilityRole="button" onPress={onClearPowerMode} style={styles.emptyActionButton}>
                <Text style={styles.emptyActionText}>Reset speed</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={onExpandSearch} style={styles.emptyActionButton}>
              <Text style={styles.emptyActionText}>Wider area</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function EvSheetFilters({
  chargingPreference,
  connectors,
  onPowerModeChange,
  onToggleConnector,
  powerMode,
  showAdvanced,
}: {
  chargingPreference?: EvChargingPreference;
  connectors: EvConnector[];
  onPowerModeChange: (value: EvPowerMode) => void;
  onToggleConnector: (connector: EvConnector) => void;
  powerMode: EvPowerMode;
  showAdvanced: boolean;
}) {
  return (
    <View style={styles.evSheetFilters}>
      <View style={styles.compatibilityBadge}>
        <Text style={styles.compatibilityBadgeText}>
          {vehicleCompatibilityLabel(connectors, chargingPreference)}
        </Text>
      </View>
      <EvPowerFilterRow onPowerModeChange={onPowerModeChange} powerMode={powerMode} />
      {showAdvanced ? (
        <View style={styles.evAdvancedFilters}>
          <Text style={styles.evAdvancedLabel}>Advanced connector filters</Text>
          <View style={styles.filterRow}>
            {evConnectorOptions.map((connector) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: connectors.includes(connector) }}
                key={connector}
                onPress={() => onToggleConnector(connector)}
                style={[styles.filterChip, connectors.includes(connector) && styles.filterChipSelected]}
              >
                <Text style={[styles.filterChipText, connectors.includes(connector) && styles.filterChipTextSelected]}>
                  {connector}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function EvPowerFilterRow({
  onPowerModeChange,
  powerMode,
}: {
  onPowerModeChange: (value: EvPowerMode) => void;
  powerMode: EvPowerMode;
}) {
  return (
    <View style={styles.evQuickFilterRow}>
      {evPowerOptions.map((option) => {
        const selected = powerMode === option.value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={option.label}
            onPress={() => onPowerModeChange(option.value)}
            style={[styles.evQuickFilterChip, selected && styles.evQuickFilterChipSelected]}
          >
            <Text style={[styles.evQuickFilterText, selected && styles.evQuickFilterTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function nearbyModeContextLabel(mode: NearbyMode, fuel: FuelCode) {
  if (mode === "both") return "Best mix for your vehicle";
  if (mode === "ev") return "Compatible chargers near you";
  return `${fuel} prices near you`;
}

function chargerProfileHint(
  connectors: EvConnector[],
  chargingPreference?: EvChargingPreference,
) {
  const connectorLabel = connectors.length ? connectors.join(" / ") : "all connector types";
  return `Compatible chargers: ${connectorLabel}, ${evChargingPreferenceLabel(chargingPreference)} charging.`;
}

function vehicleCompatibilityLabel(connectors: EvConnector[], chargingPreference?: EvChargingPreference) {
  const connectorLabel = connectors.length ? connectors.join(" / ") : "all connectors";
  return `My vehicle: ${connectorLabel}, ${evChargingPreferenceLabel(chargingPreference)} charging.`;
}

export function EvChargerRow({
  charger,
  onNavigate,
  onPress,
  rankReason,
  selected,
}: {
  charger: EvCharger;
  onNavigate: (charger: EvCharger) => void;
  onPress: () => void;
  rankReason?: string;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={chargerRowAccessibilityLabel(charger)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.evRow, selected && styles.evRowSelected]}
    >
      <View style={styles.evPowerTile}>
        {charger.maxPowerKw ? (
          <>
            <Text style={styles.evPowerValue}>{Math.round(charger.maxPowerKw)}</Text>
            <Text style={styles.evPowerUnit}>kW</Text>
          </>
        ) : (
          <>
            <Text style={styles.evPowerUnknownValue}>Power</Text>
            <Text style={styles.evPowerUnknownUnit}>unconfirmed</Text>
          </>
        )}
      </View>
      <View style={styles.evCardMain}>
        <Text numberOfLines={1} style={styles.evCardTitle}>{charger.name}</Text>
        <Text numberOfLines={1} style={styles.evCardMeta}>{charger.address || charger.operator}</Text>
        <View style={styles.evCardChipRow}>
          <Text numberOfLines={1} style={styles.evConnectorBadge}>{chargerConnectorSummary(charger)}</Text>
        </View>
        {rankReason ? (
          <Text numberOfLines={1} style={styles.evRankReason}>{rankReason}</Text>
        ) : null}
      </View>
      <View style={styles.evActionColumn}>
        <Pressable
          accessibilityLabel={`Navigate to ${charger.name}`}
          onPress={() => onNavigate(charger)}
          style={styles.evNavigateButton}
        >
          <Text style={styles.evNavigateButtonIcon}>↗</Text>
        </Pressable>
        <View style={styles.evDistanceBadge}>
          <Text style={styles.evDistanceBadgeText}>{formatEvDistance(charger.distanceKm)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function EvChargerListRow({
  charger,
  onNavigate,
  onSelectCharger,
  selected,
}: {
  charger: EvCharger;
  onNavigate: (charger: EvCharger) => void;
  onSelectCharger: (chargerId: string) => void;
  selected: boolean;
}) {
  const handlePress = useCallback(
    () => onSelectCharger(charger.id),
    [charger.id, onSelectCharger],
  );
  return (
    <EvChargerRow
      charger={charger}
      selected={selected}
      onNavigate={onNavigate}
      onPress={handlePress}
    />
  );
}

function formatEvDistance(distanceKm: number | undefined, suffix = "") {
  if (!Number.isFinite(distanceKm)) return suffix ? "distance unknown" : "Distance unknown";
  if (Number(distanceKm) < 0.05) return suffix ? "at this point" : "Here";
  return `${Number(distanceKm).toFixed(1)} km${suffix ? ` ${suffix}` : ""}`;
}

function chargerConnectorSummary(charger: EvCharger) {
  if (charger.connectors.length) return charger.connectors.join(" | ");
  const labels = charger.connections
    .flatMap((connection) => connection.connectorLabel ? [connection.connectorLabel] : [])
    .slice(0, 2);
  return labels.length ? labels.join(" | ") : "Connector details unknown";
}

function powerBandLabel(powerBand: EvCharger["powerBand"]) {
  if (powerBand === "ultra_fast") return "ultra-fast";
  if (powerBand === "dc_fast") return "fast";
  if (powerBand === "ac") return "AC";
  return "power unconfirmed";
}

function conciseEvNotice(notice: string) {
  if (!notice) return "";
  if (/sanitised local prototype|prototype EV charger|no configured EV directory provider/i.test(notice)) {
    return "Check charger details in the network app before driving.";
  }
  if (notice.includes("API Ninjas")) {
    return "Check live bay status in the network app.";
  }
  if (notice.includes("Open Charge Map")) {
    return "Check live bay status in the network app.";
  }
  return notice;
}

function chargerCountTitle(count: number) {
  if (count === 1) return "1 charger";
  return `${count} chargers`;
}

function chargerRowAccessibilityLabel(charger: EvCharger) {
  const power = charger.maxPowerKw
    ? `${Math.round(charger.maxPowerKw)} kilowatt maximum power`
    : "power unknown";
  return [
    charger.name,
    charger.address || charger.operator,
    chargerConnectorSummary(charger),
    power,
    formatEvDistance(charger.distanceKm, "away"),
    charger.availabilityLabel,
  ].filter(Boolean).join(". ");
}

function nextSnap(activeSnap: NearbySheetSnap): NearbySheetSnap {
  if (activeSnap === "peek") return "browse";
  if (activeSnap === "browse") return "full";
  return "browse";
}

const styles = StyleSheet.create({
  controlDeck: {
    gap: spacing.sm,
  },
  energySelector: {
    alignSelf: "flex-start",
    minWidth: energySelectorMinWidth,
    zIndex: 10,
  },
  energyButton: {
    ...surfaces.floating,
    alignItems: "center",
    backgroundColor: colors.black,
    borderRadius: radii.xl,
    flexDirection: "row",
    gap: spacing.lg,
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  energyEyebrow: {
    color: colors.white,
    fontSize: typeScale.micro,
    fontWeight: "800",
    letterSpacing: 0.4,
    opacity: 0.72,
    textTransform: "uppercase",
  },
  energyButtonText: {
    color: colors.white,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  energyChevron: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "900",
  },
  energyMenu: {
    ...shadow.float,
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.xs,
    minWidth: energySelectorMinWidth,
    marginTop: spacing.xs,
    padding: spacing.xs,
  },
  energyOption: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  energyOptionSelected: {
    backgroundColor: colors.greenSoft,
  },
  energyOptionText: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "800",
  },
  energyOptionTextSelected: {
    color: colors.greenDark,
  },
  controlContext: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "800",
    lineHeight: 16,
  },
  controlHint: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
    lineHeight: 18,
  },
  modeToggle: {
    backgroundColor: colors.panelStrong,
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs,
  },
  modeChip: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modeChipSelected: {
    backgroundColor: colors.greenDark,
    borderColor: colors.greenDark,
  },
  modeChipText: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  modeChipTextSelected: {
    color: colors.white,
  },
  evSheetFilters: {
    gap: spacing.xs,
  },
  evQuickFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  compatibilityBadge: {
    backgroundColor: colors.blueSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    width: "100%",
  },
  compatibilityBadgeText: {
    color: colors.blue,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  evQuickFilterChip: {
    alignItems: "center",
    backgroundColor: colors.panelStrong,
    borderRadius: radii.pill,
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  evQuickFilterChipSelected: {
    backgroundColor: colors.blue,
  },
  evQuickFilterText: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  evQuickFilterTextSelected: {
    color: colors.white,
  },
  evAdvancedFilters: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  evAdvancedLabel: {
    color: colors.muted,
    fontSize: typeScale.micro,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  filterChip: {
    backgroundColor: colors.panelStrong,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  filterChipSelected: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  filterChipText: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  filterChipTextSelected: {
    color: colors.white,
  },
  evPanel: {
    ...surfaces.floating,
    ...shadow.float,
    borderRadius: radii.xxl,
    gap: spacing.sm,
    bottom: nearbySheetBottomOffset,
    left: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    position: "absolute",
    right: spacing.md,
    zIndex: 6,
  },
  evPanelCollapsed: {
    maxHeight: 275,
    overflow: "hidden",
  },
  evPanelPeek: {
    bottom: 18,
    maxHeight: 180,
    overflow: "hidden",
  },
  evPanelExpanded: {
    bottom: 8,
  },
  evSheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 20,
  },
  evGrabberTouch: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 24,
    paddingVertical: 2,
  },
  evGrabber: {
    alignSelf: "center",
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    height: 4,
    width: 44,
  },
  evMapButton: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    position: "absolute",
    right: 0,
  },
  evMapButtonText: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: "600",
  },
  evPanelTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  evPanelTitle: {
    ...typography.bodyStrong,
    flex: 1,
  },
  evPanelNotice: {
    color: colors.muted,
    fontSize: typeScale.caption,
    lineHeight: 17,
  },
  evPeekHint: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
    lineHeight: 18,
  },
  evListToggle: {
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  evListToggleText: {
    color: colors.white,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  evList: {
    flex: 1,
  },
  evListContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  evRow: {
    backgroundColor: colors.panelStrong,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 108,
    padding: spacing.sm,
  },
  evRowSelected: {
    borderColor: colors.black,
  },
  evEmptyCard: {
    backgroundColor: colors.panelStrong,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    minHeight: 96,
    padding: spacing.md,
  },
  emptyActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  emptyActionButton: {
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emptyActionText: {
    color: colors.white,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  evPowerTile: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 66,
    width: 66,
  },
  evPowerValue: {
    color: colors.blue,
    fontSize: typeScale.title,
    fontWeight: "900",
  },
  evPowerUnknownValue: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 15,
    textAlign: "center",
    textTransform: "uppercase",
  },
  evPowerUnknownUnit: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14,
    textAlign: "center",
  },
  evPowerUnit: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  evCardMain: {
    flex: 1,
    minWidth: 0,
  },
  evCardTitle: {
    ...typography.bodyStrong,
  },
  evCardMeta: {
    color: colors.muted,
    fontSize: typeScale.caption,
    marginTop: 2,
  },
  evCardChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  evCardTrust: {
    color: colors.amber,
    fontSize: typeScale.caption,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  evRankReason: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "900",
    marginTop: spacing.xs,
  },
  evWhyLine: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  evConfidenceBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.blueSoft,
    borderRadius: radii.pill,
    color: colors.blue,
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  evConnectorBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    color: colors.ink,
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "800",
    maxWidth: "68%",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  evActionColumn: {
    alignItems: "center",
    flexShrink: 0,
    gap: 3,
    minWidth: 58,
  },
  evNavigateButton: {
    alignItems: "center",
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  evNavigateButtonIcon: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 22,
  },
  evDistanceBadge: {
    alignItems: "center",
    backgroundColor: colors.black,
    borderColor: colors.blue,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 24,
    paddingHorizontal: spacing.sm,
  },
  evDistanceBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
  },
});

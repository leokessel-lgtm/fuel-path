import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { AccountScreen } from "./src/screens/AccountScreen";
import { NearbyScreen } from "./src/screens/NearbyScreen";
import { PlanScreen } from "./src/screens/PlanScreen";
import { FuelPathLogo } from "./src/components/FuelPathLogo";
import { useAppPreferences } from "./src/hooks/useAppPreferences";
import { useRecentLocations } from "./src/hooks/useRecentLocations";
import { useRouteAlerts } from "./src/hooks/useRouteAlerts";
import { useSavedCommutes } from "./src/hooks/useSavedCommutes";
import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "./src/theme";

type TabKey = "plan" | "nearby" | "account";

declare const process:
  {
    env: Record<string, string | undefined>;
  };

const tabs: Array<{ key: TabKey; label: string; hint: string }> = [
  { key: "plan", label: "Plan", hint: "Trip" },
  { key: "nearby", label: "Nearby", hint: "Map" },
  { key: "account", label: "Settings", hint: "You" },
];
const chromeTextScale = 1.2;
const releaseBuildId = process.env.EXPO_PUBLIC_FUEL_PATH_BUILD_ID || "";
const releaseCheckIntervalMs = 5 * 60 * 1000;

async function fetchLatestReleaseBuildId() {
  const response = await fetch(`/build-version.json?ts=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) return "";
  const payload = await response.json();
  return typeof payload.buildId === "string" ? payload.buildId.trim() : "";
}

function initialTab(): TabKey {
  const configured = process.env.EXPO_PUBLIC_FUEL_PATH_INITIAL_TAB;
  if (configured === "plan" || configured === "nearby" || configured === "account") {
    return configured;
  }
  return "nearby";
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>(() => initialTab());
  const [releaseUpdateAvailable, setReleaseUpdateAvailable] = useState(false);
  const {
    clearNamedPlace,
    preferences,
    addVehicle,
    removeVehicle,
    saveNamedPlace,
    selectVehicle,
    setPreferredStationBrands,
    setStationBrandMode,
    toggleDiscount,
    toggleDiscountRedemption,
    toggleEvConnector,
    togglePreferredStationBrand,
    updateDecisionRule,
    updateFuel,
    updateHomeChargingAccess,
    updateNavigationApp,
    updateVehicleProfile,
    updateVehicleEnergyType,
  } = useAppPreferences();
  const {
    addRecentLocation,
    clearRecentLocations,
    recentLocations,
    removeRecentLocation,
  } = useRecentLocations();
  const {
    renameCommute,
    saveCommute,
    savedCommutes,
    setSavedCommutes,
  } = useSavedCommutes();
  const {
    alertSyncingCommuteId,
    notificationMessage,
    notificationPermission,
    removeCommute,
    requestNotifications,
    toggleCommuteAlert,
    updateCommuteAlertSettings,
    updateCommuteAlertRule,
  } = useRouteAlerts({
    preferences,
    savedCommutes,
    setSavedCommutes,
  });
  useEffect(() => {
    if (Platform.OS !== "web" || !releaseBuildId) return undefined;
    let active = true;
    const checkLatestRelease = async () => {
      try {
        const latestBuildId = await fetchLatestReleaseBuildId();
        if (active && latestBuildId && latestBuildId !== releaseBuildId) {
          setReleaseUpdateAvailable(true);
        }
      } catch {
        // Release freshness should never block the app.
      }
    };
    const handleVisible = () => {
      if (document.visibilityState === "visible") void checkLatestRelease();
    };
    const intervalId = window.setInterval(checkLatestRelease, releaseCheckIntervalMs);
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", checkLatestRelease);
    void checkLatestRelease();
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", checkLatestRelease);
    };
  }, []);

  const hasNamedVehicle = Boolean(preferences.vehicleName.trim() || preferences.vehicleRego.trim());
  const vehicleInitials = hasNamedVehicle
    ? (preferences.vehicleRego || preferences.vehicleName).trim().slice(0, 2).toUpperCase()
    : vehicleEnergyLabel(preferences.vehicleEnergyType).slice(0, 2).toUpperCase();
  const vehicleDetail = preferences.vehicleName
    ? `${vehicleEnergyLabel(preferences.vehicleEnergyType)} | ${vehicleProfileShortLabel(preferences)}`
    : vehicleProfileShortLabel(preferences);

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.appShell}>
        <View role="banner" style={styles.header}>
          <View style={styles.brandLockup}>
            <FuelPathLogo />
            <View style={styles.brandText}>
              <Text maxFontSizeMultiplier={chromeTextScale} numberOfLines={1} style={styles.brand}>Fuel Path</Text>
              <Text maxFontSizeMultiplier={chromeTextScale} numberOfLines={1} style={styles.subhead}>Live fuel decisions</Text>
            </View>
          </View>
          <Pressable
            accessibilityLabel={hasNamedVehicle ? "View vehicle profile" : "View fuel profile"}
            accessibilityRole="button"
            onPress={() => setActiveTab("account")}
            style={({ pressed }) => [styles.vehiclePill, pressed && styles.vehiclePillPressed]}
          >
            <View style={styles.vehicleIcon}>
              <Text maxFontSizeMultiplier={chromeTextScale} style={styles.vehicleIconText}>{vehicleInitials}</Text>
            </View>
            <View style={styles.vehicleTextGroup}>
              <Text maxFontSizeMultiplier={chromeTextScale} numberOfLines={1} style={styles.vehiclePrimary}>
                {hasNamedVehicle ? preferences.vehicleRego || preferences.vehicleName : "Fuel profile"}
              </Text>
              <Text maxFontSizeMultiplier={chromeTextScale} numberOfLines={1} style={styles.vehicleSecondary}>
                {vehicleDetail}
              </Text>
            </View>
          </Pressable>
        </View>
        {releaseUpdateAvailable ? (
          <View role="status" style={styles.releaseBanner}>
            <Text style={styles.releaseBannerText}>New version ready</Text>
            <Pressable
              accessibilityLabel="Refresh Fuel Path"
              accessibilityRole="button"
              onPress={() => window.location.reload()}
              style={styles.releaseButton}
            >
              <Text style={styles.releaseButtonText}>Refresh</Text>
            </Pressable>
          </View>
        ) : null}

        <View role="main" style={styles.content}>
          {activeTab === "plan" ? (
            <PlanScreen
              preferences={preferences}
              onFuelChange={updateFuel}
              onVehicleEnergyTypeChange={updateVehicleEnergyType}
              onAddRecentLocation={addRecentLocation}
              onClearRecentLocations={clearRecentLocations}
              onRemoveRecentLocation={removeRecentLocation}
              onSaveNamedPlace={saveNamedPlace}
              onSaveCommute={saveCommute}
              onToggleCommuteAlert={toggleCommuteAlert}
              alertSyncingCommuteId={alertSyncingCommuteId}
              recentLocations={recentLocations}
              savedCommutes={savedCommutes}
            />
          ) : null}
          {activeTab === "nearby" ? (
            <NearbyScreen preferences={preferences} onFuelChange={updateFuel} />
          ) : null}
          {activeTab === "account" ? (
            <AccountScreen
              preferences={preferences}
              notificationMessage={notificationMessage}
              notificationPermission={notificationPermission}
              alertSyncingCommuteId={alertSyncingCommuteId}
              onFuelChange={updateFuel}
              onHomeChargingAccessChange={updateHomeChargingAccess}
              onToggleEvConnector={toggleEvConnector}
              onVehicleProfileChange={updateVehicleProfile}
              onVehicleEnergyTypeChange={updateVehicleEnergyType}
              onAddVehicle={addVehicle}
              onRemoveVehicle={removeVehicle}
              onSelectVehicle={selectVehicle}
              onRequestNotifications={requestNotifications}
              onClearNamedPlace={clearNamedPlace}
              onSaveNamedPlace={saveNamedPlace}
              onRenameCommute={renameCommute}
              onToggleDiscount={toggleDiscount}
              onToggleDiscountRedemption={toggleDiscountRedemption}
              onSetStationBrandMode={setStationBrandMode}
              onSetPreferredStationBrands={setPreferredStationBrands}
              onTogglePreferredStationBrand={togglePreferredStationBrand}
              onNavigationAppChange={updateNavigationApp}
              onToggleCommuteAlert={toggleCommuteAlert}
              onUpdateCommuteAlertSettings={updateCommuteAlertSettings}
              onRemoveCommute={removeCommute}
              savedCommutes={savedCommutes}
            />
          ) : null}
        </View>

        <View role="navigation">
          <View accessibilityRole="tablist" style={styles.tabBar}>
            {tabs.map((tab) => {
              const selected = activeTab === tab.key;
              return (
                <Pressable
                  accessibilityLabel={tab.label}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  aria-selected={selected}
                  hitSlop={10}
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[styles.tabButton, selected && styles.tabButtonSelected]}
                >
                  <Text maxFontSizeMultiplier={chromeTextScale} numberOfLines={1} style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function vehicleEnergyLabel(value: string) {
  if (value === "electric") return "EV";
  if (value === "diesel") return "Diesel";
  return "Fuel";
}

function vehicleProfileShortLabel(preferences: {
  evConnectors?: string[];
  evRangeKm?: number;
  fuel: string;
  fuelTankLitres?: number;
  vehicleEnergyType?: string;
}) {
  if (preferences.vehicleEnergyType === "electric") {
    const connectors = preferences.evConnectors?.length ? preferences.evConnectors.join("/") : "Connectors not set";
    return preferences.evRangeKm ? `${preferences.evRangeKm} km | ${connectors}` : connectors;
  }
  return preferences.fuel;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  appShell: {
    flex: 1,
    alignSelf: "center",
    backgroundColor: colors.canvas,
    borderColor: "rgba(20, 35, 29, 0.08)",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxWidth: 1180,
    overflow: "hidden",
    width: "100%",
  },
  header: {
    alignItems: "center",
    backgroundColor: "rgba(238, 242, 244, 0.92)",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  brandLockup: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  brandText: {
    flexShrink: 1,
  },
  brand: {
    ...typography.title,
    lineHeight: 25,
  },
  subhead: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    marginTop: 2,
  },
  vehiclePill: {
    ...surfaces.floating,
    alignItems: "center",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.sm,
    maxWidth: 188,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  vehiclePillPressed: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  vehicleIcon: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: radii.pill,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  vehicleIconText: {
    color: colors.white,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  vehicleTextGroup: {
    flexShrink: 1,
  },
  vehiclePrimary: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  vehicleSecondary: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "400",
    marginTop: 1,
  },
  releaseBanner: {
    alignItems: "center",
    backgroundColor: colors.black,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  releaseBannerText: {
    color: colors.white,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  releaseButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  releaseButtonText: {
    color: colors.white,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
  tabBar: {
    ...shadow.float,
    alignSelf: "center",
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 4,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    maxWidth: 440,
    padding: 5,
    elevation: 12,
    width: "92%",
    zIndex: 20,
  },
  tabButton: {
    alignItems: "center",
    borderRadius: radii.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tabButtonSelected: {
    backgroundColor: colors.green,
    paddingHorizontal: spacing.lg,
  },
  tabLabel: {
    color: "#c4cdc8",
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  tabLabelSelected: {
    color: colors.white,
    fontSize: typeScale.body,
    fontWeight: "700",
  },
});

import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  SafeAreaView,
  StatusBar as NativeStatusBar,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AccountScreen } from "./src/screens/AccountScreen";
import { NearbyScreen } from "./src/screens/NearbyScreen";
import { PlanScreen } from "./src/screens/PlanScreen";
import {
  cancelSavedCommuteAlert,
  configureRouteNotificationHandler,
  getExpoRoutePushToken,
  getRouteNotificationPermission,
  requestRouteNotificationPermission,
  scheduleSavedCommuteAlert,
} from "./src/services/routeNotifications";
import { syncSavedRouteAlert } from "./src/services/backendAlerts";
import {
  loadSavedCommutes,
  persistSavedCommutes,
} from "./src/services/savedCommutesStore";
import {
  defaultPreferences,
  loadPreferences,
  persistPreferences,
} from "./src/services/preferencesStore";
import {
  loadRecentLocations,
  normaliseRecentLocations,
  persistRecentLocations,
} from "./src/services/recentLocationsStore";
import { colors, radii, shadow, spacing, typeScale } from "./src/theme";
import {
  AppPreferences,
  FuelCode,
  MapPoint,
  NotificationPermissionState,
  SavedCommute,
} from "./src/types";

type TabKey = "plan" | "nearby" | "account";

const tabs: Array<{ key: TabKey; label: string; hint: string }> = [
  { key: "plan", label: "Plan", hint: "Trip" },
  { key: "nearby", label: "Nearby", hint: "Map" },
  { key: "account", label: "Account", hint: "You" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("nearby");
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [recentLocations, setRecentLocations] = useState<MapPoint[]>([]);
  const [recentLocationsLoaded, setRecentLocationsLoaded] = useState(false);
  const [savedCommutes, setSavedCommutes] = useState<SavedCommute[]>([]);
  const [savedCommutesLoaded, setSavedCommutesLoaded] = useState(false);
  const [alertSyncingCommuteId, setAlertSyncingCommuteId] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>("unknown");
  const [notificationMessage, setNotificationMessage] = useState(
    "Enable alerts when you want Fuel Path to check saved routes for you.",
  );
  const hasVehicle = Boolean(preferences.vehicleName.trim() || preferences.vehicleRego.trim());
  const vehicleInitials = hasVehicle
    ? (preferences.vehicleRego || preferences.vehicleName).trim().slice(0, 2).toUpperCase()
    : "+";
  const vehicleDetail = preferences.vehicleName
    ? `${preferences.fuel} | ${preferences.vehicleName}`
    : preferences.fuel;

  const updateFuel = (fuel: FuelCode) => {
    setPreferences((current) => ({ ...current, fuel }));
  };

  const toggleDiscount = (discountId: string) => {
    setPreferences((current) => {
      const selected = new Set(current.selectedDiscounts);
      if (selected.has(discountId)) {
        selected.delete(discountId);
      } else {
        selected.add(discountId);
      }
      return { ...current, selectedDiscounts: Array.from(selected) };
    });
  };

  const saveNamedPlace = (kind: "home" | "work", point: MapPoint) => {
    setPreferences((current) => ({
      ...current,
      [kind === "home" ? "homeLocation" : "workLocation"]: point,
    }));
  };

  const clearNamedPlace = (kind: "home" | "work") => {
    setPreferences((current) => ({
      ...current,
      [kind === "home" ? "homeLocation" : "workLocation"]: undefined,
    }));
  };

  const addRecentLocation = (point: MapPoint) => {
    setRecentLocations((current) => normaliseRecentLocations([point, ...current]));
  };

  const removeRecentLocation = (point: MapPoint) => {
    setRecentLocations((current) =>
      current.filter(
        (item) =>
          !closeCoordinate(item.lat, point.lat) || !closeCoordinate(item.lon, point.lon),
      ),
    );
  };

  const clearRecentLocations = () => {
    setRecentLocations([]);
  };

  const saveCommute = ({
    from,
    fuel,
    name,
    to,
  }: Pick<SavedCommute, "from" | "fuel" | "name" | "to">) => {
    setSavedCommutes((current) => {
      const existing = current.find((commute) =>
        sameCommute(commute, { from, fuel, to }),
      );
      if (existing) return current;
      return [
        {
          id: makeCommuteId(from, to, fuel),
          name,
          from,
          to,
          fuel,
          alertEnabled: false,
          alertTime: "07:30",
          alertStatus: "off",
          alertStatusMessage: "Route alert is off.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...current,
      ];
    });
  };

  const toggleCommuteAlert = async (commuteId: string) => {
    const targetCommute = savedCommutes.find((commute) => commute.id === commuteId);
    if (!targetCommute || alertSyncingCommuteId) return;

    setAlertSyncingCommuteId(commuteId);
    try {
      if (targetCommute.alertEnabled) {
        const result = await cancelSavedCommuteAlert(targetCommute);
        const backendSync = await syncSavedRouteAlert({
          commute: targetCommute,
          enabled: false,
          preferences,
        });
        setSavedCommutes((current) =>
          current.map((commute) =>
            commute.id === commuteId
              ? {
                  ...commute,
                  alertEnabled: false,
                  alertStatus: result.status,
                  alertStatusMessage: alertStatusMessage(result.message, backendSync.message),
                  backendSyncedAt: backendSync.syncedAt,
                  nextAlertAt: undefined,
                  scheduledNotificationId: undefined,
                  updatedAt: new Date().toISOString(),
                }
              : commute,
          ),
        );
        return;
      }

      const permission = await requestRouteNotificationPermission();
      setNotificationPermission(permission.state);
      setNotificationMessage(permission.message);

      if (permission.state !== "granted") {
        const alertStatus =
          permission.state === "unavailable" ? "unavailable" : "needs_permission";
        setSavedCommutes((current) =>
          current.map((commute) =>
            commute.id === commuteId
              ? {
                  ...commute,
                  alertEnabled: false,
                  alertStatus,
                  alertStatusMessage: permission.message,
                  nextAlertAt: undefined,
                  scheduledNotificationId: undefined,
                  updatedAt: new Date().toISOString(),
                }
              : commute,
          ),
        );
        return;
      }

      const result = await scheduleSavedCommuteAlert(targetCommute);
      const tokenResult = await getExpoRoutePushToken();
      const backendSync =
        tokenResult.status === "ready"
          ? await syncSavedRouteAlert({
              commute: targetCommute,
              enabled: true,
              expoPushToken: tokenResult.token,
              preferences,
            })
          : {
              status: tokenResult.status,
              message: tokenResult.message,
              syncedAt: undefined,
            };
      const backendSynced = backendSync.status === "synced";
      setSavedCommutes((current) =>
        current.map((commute) =>
          commute.id === commuteId
            ? {
                ...commute,
                alertEnabled: result.status === "scheduled" || backendSynced,
                alertStatus: backendSynced ? "backend_synced" : result.status,
                alertStatusMessage: alertStatusMessage(
                  backendSynced
                    ? "Price-triggered backend alert synced."
                    : result.message,
                  backendSynced && result.status === "scheduled"
                    ? "Local daily reminder also scheduled."
                    : backendSync.message,
                ),
                backendSyncedAt: backendSync.syncedAt,
                nextAlertAt: result.nextAlertAt,
                scheduledNotificationId: result.notificationId,
                updatedAt: new Date().toISOString(),
              }
            : commute,
        ),
      );
    } finally {
      setAlertSyncingCommuteId(null);
    }
  };

  const requestNotifications = async () => {
    const result = await requestRouteNotificationPermission();
    setNotificationPermission(result.state);
    setNotificationMessage(result.message);
  };

  useEffect(() => {
    let active = true;
    loadPreferences().then((storedPreferences) => {
      if (!active) return;
      setPreferences(storedPreferences);
      setPreferencesLoaded(true);
    });
    configureRouteNotificationHandler().catch(() => {});
    getRouteNotificationPermission().then((result) => {
      if (!active) return;
      setNotificationPermission(result.state);
      setNotificationMessage(result.message);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    persistPreferences(preferences).catch(() => {});
  }, [preferences, preferencesLoaded]);

  useEffect(() => {
    let active = true;
    loadSavedCommutes().then((commutes) => {
      if (!active) return;
      setSavedCommutes(commutes);
      setSavedCommutesLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!savedCommutesLoaded) return;
    persistSavedCommutes(savedCommutes).catch(() => {});
  }, [savedCommutes, savedCommutesLoaded]);

  useEffect(() => {
    let active = true;
    loadRecentLocations().then((locations) => {
      if (!active) return;
      setRecentLocations(locations);
      setRecentLocationsLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!recentLocationsLoaded) return;
    persistRecentLocations(recentLocations).catch(() => {});
  }, [recentLocations, recentLocationsLoaded]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.appShell}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Fuel Path</Text>
            <Text style={styles.subhead}>Native app shell</Text>
          </View>
          <Pressable
            accessibilityLabel={hasVehicle ? "View vehicle profile" : "Add vehicle profile"}
            onPress={() => setActiveTab("account")}
            style={({ pressed }) => [styles.vehiclePill, pressed && styles.vehiclePillPressed]}
          >
            <View style={styles.vehicleIcon}>
              <Text style={styles.vehicleIconText}>{vehicleInitials}</Text>
            </View>
            <View style={styles.vehicleTextGroup}>
              <Text numberOfLines={1} style={styles.vehiclePrimary}>
                {hasVehicle ? preferences.vehicleRego || preferences.vehicleName : "Add vehicle"}
              </Text>
              <Text numberOfLines={1} style={styles.vehicleSecondary}>
                {hasVehicle ? vehicleDetail : "Set fuel"}
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.content}>
          {activeTab === "plan" ? (
            <PlanScreen
              preferences={preferences}
              onFuelChange={updateFuel}
              onAddRecentLocation={addRecentLocation}
              onClearRecentLocations={clearRecentLocations}
              onRemoveRecentLocation={removeRecentLocation}
              onSaveNamedPlace={saveNamedPlace}
              onSaveCommute={saveCommute}
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
              onRequestNotifications={requestNotifications}
              onClearNamedPlace={clearNamedPlace}
              onSaveNamedPlace={saveNamedPlace}
              onToggleDiscount={toggleDiscount}
              onToggleCommuteAlert={toggleCommuteAlert}
              savedCommutes={savedCommutes}
            />
          ) : null}
        </View>

        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabButton, selected && styles.tabButtonSelected]}
              >
                <Text style={[styles.tabHint, selected && styles.tabHintSelected]}>{tab.hint}</Text>
                <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

function sameCommute(
  left: SavedCommute,
  right: Pick<SavedCommute, "from" | "fuel" | "to">,
) {
  return (
    left.fuel === right.fuel &&
    closeCoordinate(left.from.lat, right.from.lat) &&
    closeCoordinate(left.from.lon, right.from.lon) &&
    closeCoordinate(left.to.lat, right.to.lat) &&
    closeCoordinate(left.to.lon, right.to.lon)
  );
}

function closeCoordinate(left: number, right: number) {
  return Math.abs(left - right) < 0.0002;
}

function makeCommuteId(from: SavedCommute["from"], to: SavedCommute["to"], fuel: FuelCode) {
  return [
    "commute",
    fuel,
    from.lat.toFixed(4),
    from.lon.toFixed(4),
    to.lat.toFixed(4),
    to.lon.toFixed(4),
  ].join(":");
}

function alertStatusMessage(primary: string, secondary?: string) {
  return [primary, secondary].filter(Boolean).join(" ");
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.mapMist,
    paddingTop: NativeStatusBar.currentHeight ?? 0,
  },
  appShell: {
    flex: 1,
    backgroundColor: colors.mapMist,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  brand: {
    color: colors.ink,
    fontSize: typeScale.title,
    fontWeight: "900",
  },
  subhead: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
    marginTop: 2,
  },
  vehiclePill: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    maxWidth: 188,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
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
    fontWeight: "900",
  },
  vehicleTextGroup: {
    flexShrink: 1,
  },
  vehiclePrimary: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  vehicleSecondary: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 1,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    ...shadow.soft,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    flexDirection: "row",
    gap: spacing.xs,
    margin: spacing.md,
    padding: spacing.xs,
  },
  tabButton: {
    alignItems: "center",
    borderRadius: radii.lg,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  tabButtonSelected: {
    backgroundColor: colors.green,
  },
  tabHint: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  tabHintSelected: {
    color: colors.white,
  },
  tabLabel: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
    marginTop: 2,
  },
  tabLabelSelected: {
    color: colors.white,
  },
});

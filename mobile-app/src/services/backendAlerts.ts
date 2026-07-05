import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { ALERTS_SYNC_TOKEN, API_BASE_URL, EAS_PROJECT_ID } from "../config";
import { AppPreferences, SavedCommute, VehicleProfile } from "../types";
import { eligibleDiscountIds } from "../utils/discountRedemptions";

type AlertIdentity = {
  deviceId: string;
  userId: string;
};

type SyncResult = {
  message: string;
  status: "synced" | "skipped" | "failed";
  syncedAt?: string;
};

const ALERT_IDENTITY_KEY = "fuel-path:alert-identity:v1";

export async function syncSavedRouteAlert({
  commute,
  enabled,
  expoPushToken,
  preferences,
}: {
  commute: SavedCommute;
  enabled: boolean;
  expoPushToken?: string;
  preferences: AppPreferences;
}): Promise<SyncResult> {
  if (!ALERTS_SYNC_TOKEN) {
    return {
      status: "skipped",
      message: "Smart route checks need a validation build.",
    };
  }

  try {
    const identity = await getAlertIdentity();
    if (enabled && expoPushToken) {
      await postAlertJson("/api/push/register", {
        userId: identity.userId,
        deviceId: identity.deviceId,
        platform: Platform.OS,
        expoPushToken,
        appVersion: "1.0.0",
      });
    }

    await postAlertJson("/api/saved-routes", backendSavedRoutePayload({
      commute,
      enabled,
      identity,
      preferences,
    }));

    return {
      status: "synced",
      message: enabled
        ? "Smart route watch updated."
        : "Route watch turned off.",
      syncedAt: new Date().toISOString(),
    };
  } catch {
    return {
      status: "failed",
      message: "Smart route watch could not update. Reminder state was kept.",
    };
  }
}

export async function deleteBackendSavedRoute({
  commute,
}: {
  commute: SavedCommute;
}): Promise<SyncResult> {
  if (!ALERTS_SYNC_TOKEN) {
    return {
      status: "skipped",
      message: "Smart route checks need a validation build.",
    };
  }

  try {
    const identity = await getAlertIdentity();
    await deleteAlertJson("/api/saved-routes", {
      routeId: commute.id,
      userId: identity.userId,
    });
    return {
      status: "synced",
      message: "Route watch deleted.",
      syncedAt: new Date().toISOString(),
    };
  } catch {
    return {
      status: "failed",
      message: "Route watch delete failed. Saved route was kept so you can retry.",
    };
  }
}

export async function getAlertIdentity(): Promise<AlertIdentity> {
  try {
    const raw = await AsyncStorage.getItem(ALERT_IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AlertIdentity>;
      if (parsed.userId && parsed.deviceId) {
        return { userId: parsed.userId, deviceId: parsed.deviceId };
      }
    }
  } catch {
    // Fall through to creating a new local identity.
  }

  const identity = {
    userId: `local_${randomId()}`,
    deviceId: `device_${randomId()}`,
  };
  await AsyncStorage.setItem(ALERT_IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

export function backendAlertsConfigured() {
  return Boolean(ALERTS_SYNC_TOKEN);
}

export function configuredEasProjectId() {
  return EAS_PROJECT_ID;
}

function backendSavedRoutePayload({
  commute,
  enabled,
  identity,
  preferences,
}: {
  commute: SavedCommute;
  enabled: boolean;
  identity: AlertIdentity;
  preferences: AppPreferences;
}) {
  const vehicle = routeVehicle(commute, preferences);
  const routeFuel = vehicle.vehicleEnergyType === "electric" ? commute.fuel : vehicle.fuel;
  return {
    id: commute.id,
    userId: identity.userId,
    name: commute.name,
    from: commute.from,
    to: commute.to,
    fuel: routeFuel,
    vehicleId: vehicle.id,
    vehicleEnergyType: vehicle.vehicleEnergyType,
    alertEnabled: enabled,
    alertTimeLocal: commute.alertTime,
    alertDays: commute.alertDays,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Australia/Sydney",
    minSavingDollars: commute.minSavingDollars ?? preferences.minSavingDollars,
    maxDetourMinutes: commute.maxDetourMinutes ?? preferences.maxDetourMinutes,
    eligibleDiscounts: eligibleDiscountIds(preferences),
    tankLitres: vehicle.fuelTankLitres || preferences.fuelTankLitres || 55,
    tankPercent: commute.tankThresholdPercent ?? 45,
    economy: estimatedEconomy(vehicle),
    reserveKm: 35,
    evBatteryKwh: vehicle.evBatteryKwh,
    evRangeKm: vehicle.evRangeKm,
    evConnectors: vehicle.evConnectors,
    createdAt: commute.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

function routeVehicle(commute: SavedCommute, preferences: AppPreferences): VehicleProfile {
  return preferences.vehicles.find((vehicle) => vehicle.id === commute.vehicleId)
    || preferences.vehicles.find((vehicle) => vehicle.id === preferences.activeVehicleId)
    || preferences.vehicles[0]
    || {
      id: preferences.activeVehicleId || "vehicle-default",
      name: preferences.vehicleName,
      rego: "",
      vehicleEnergyType: preferences.vehicleEnergyType,
      fuel: preferences.fuel,
      evConnectors: preferences.evConnectors,
      fuelTankLitres: preferences.fuelTankLitres,
      evBatteryKwh: preferences.evBatteryKwh,
      evRangeKm: preferences.evRangeKm,
      homeChargingAccess: preferences.homeChargingAccess,
      evChargingPreference: preferences.evChargingPreference,
    };
}

function estimatedEconomy(vehicle: VehicleProfile) {
  if (vehicle.vehicleEnergyType === "diesel") return 7.4;
  if (vehicle.vehicleEnergyType === "electric") return 0;
  return 8.2;
}

async function postAlertJson(path: string, body: unknown) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${ALERTS_SYNC_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || `Fuel Path alerts returned ${response.status}`);
  }
  return payload;
}

async function deleteAlertJson(path: string, params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${API_BASE_URL}${path}?${query}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${ALERTS_SYNC_TOKEN}`,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || `Fuel Path alerts returned ${response.status}`);
  }
  return payload;
}

function randomId() {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.randomUUID) return cryptoObject.randomUUID();
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

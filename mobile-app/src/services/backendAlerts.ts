import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { API_BASE_URL, EAS_PROJECT_ID } from "../config";
import { AppPreferences, SavedCommute, VehicleProfile } from "../types";
import { eligibleDiscountIds } from "../utils/discountRedemptions";

type AlertIdentity = {
  deviceId: string;
  userId: string;
};

type AlertCapability = {
  expiresAt: string;
  token: string;
};

type SyncResult = {
  message: string;
  remoteDeliveryEnabled?: boolean;
  status: "synced" | "skipped" | "failed";
  syncedAt?: string;
};

const ALERT_IDENTITY_KEY = "fuel-path:alert-identity:v1";
const ALERT_CAPABILITY_KEY = "fuel-path:alert-capability:v1";
const ALERT_CAPABILITY_REFRESH_BUFFER_MS = 60 * 60 * 1000;

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
  try {
    const identity = await getAlertIdentity();
    const capability = await getAlertCapability(identity);
    if (!capability) {
      return {
        status: "skipped",
        message: "Smart route checks need backend capability issuing.",
      };
    }
    if (enabled && expoPushToken) {
      await postAlertJson("/api/push/register", capability.token, {
        userId: identity.userId,
        deviceId: identity.deviceId,
        platform: Platform.OS,
        expoPushToken,
        appVersion: "1.0.0",
      });
    }

    const savedRoute = await postAlertJson("/api/saved-routes", capability.token, backendSavedRoutePayload({
      commute,
      enabled,
      identity,
      preferences,
    }));
    const remoteDeliveryEnabled = routeWatchRemoteDeliveryEnabled(savedRoute);
    if (enabled && remoteDeliveryEnabled === false) {
      return {
        status: "skipped",
        remoteDeliveryEnabled,
        message: "Smart route watch was saved, but push delivery is not enabled for this build yet.",
      };
    }

    return {
      status: "synced",
      remoteDeliveryEnabled,
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
  try {
    const identity = await getAlertIdentity();
    const capability = await getAlertCapability(identity);
    if (!capability) {
      return {
        status: "skipped",
        message: "Smart route checks need backend capability issuing.",
      };
    }
    await deleteAlertJson("/api/saved-routes", capability.token, {
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

async function getAlertIdentity(): Promise<AlertIdentity> {
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

function backendAlertsConfigured() {
  return true;
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

async function getAlertCapability(identity: AlertIdentity): Promise<AlertCapability | null> {
  try {
    const raw = await AsyncStorage.getItem(ALERT_CAPABILITY_KEY);
    if (raw) {
      const capability = normaliseAlertCapability(JSON.parse(raw));
      if (capability) return capability;
      await AsyncStorage.removeItem(ALERT_CAPABILITY_KEY);
    }
  } catch {
    // Fall through to requesting a fresh scoped capability.
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/alerts?action=client-capability`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(identity),
    });
    const payload = await readAlertJson(response);
    const capability = normaliseAlertCapability(payload);
    if (!response.ok || !capability) return null;
    await AsyncStorage.setItem(ALERT_CAPABILITY_KEY, JSON.stringify(capability));
    return capability;
  } catch {
    return null;
  }
}

function normaliseAlertCapability(payload: unknown): AlertCapability | null {
  if (!payload || typeof payload !== "object") return null;
  const token = typeof (payload as { token?: unknown }).token === "string"
    ? (payload as { token: string }).token.trim()
    : "";
  const expiresAt = typeof (payload as { expiresAt?: unknown }).expiresAt === "string"
    ? (payload as { expiresAt: string }).expiresAt
    : "";
  const expiresAtMs = new Date(expiresAt).getTime();
  if (!token || !Number.isFinite(expiresAtMs)) return null;
  if (expiresAtMs - ALERT_CAPABILITY_REFRESH_BUFFER_MS <= Date.now()) return null;
  return { token, expiresAt };
}

async function postAlertJson(path: string, token: string, body: unknown) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await readAlertJson(response);
  if (!response.ok) {
    throw new Error("Route watch could not update. Your saved route is still on this device, so you can try again.");
  }
  return payload;
}

function routeWatchRemoteDeliveryEnabled(payload: unknown) {
  if (!payload || typeof payload !== "object") return undefined;
  const alerts = (payload as { alerts?: { pushDeliveryEnabled?: unknown } }).alerts;
  if (typeof alerts?.pushDeliveryEnabled !== "boolean") return undefined;
  return alerts.pushDeliveryEnabled;
}

async function deleteAlertJson(path: string, token: string, params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${API_BASE_URL}${path}?${query}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await readAlertJson(response);
  if (!response.ok) {
    throw new Error("Route watch could not update. Your saved route is still on this device, so you can try again.");
  }
  return payload;
}

async function readAlertJson(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function randomId() {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.randomUUID) return cryptoObject.randomUUID();
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

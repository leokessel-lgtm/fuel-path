import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { API_BASE_URL, EAS_PROJECT_ID } from "../config";
import { AppPreferences, SavedCommute, VehicleProfile } from "../types";
import { eligibleDiscountIds } from "../utils/discountRedemptions";
import { randomSecret, randomUuid, secureDelete, secureGet, secureSet } from "./alertDeviceSecurity";

type AlertIdentity = {
  installationId: string;
  installationSecret: string;
};

type AlertCapability = {
  expiresAt: string;
  token: string;
};

type SyncResult = {
  code?: string;
  message: string;
  remoteDeliveryEnabled?: boolean;
  status: "synced" | "skipped" | "failed";
  syncedAt?: string;
};

const ALERT_IDENTITY_KEY = "fuel-path:alert-installation:v2";
const ALERT_CAPABILITY_KEY = `fuel-path:alert-capability:v2:${encodeURIComponent(API_BASE_URL)}`;
const ALERT_BACKEND_ENROLLED_KEY = "fuel-path:alert-backend-enrolled:v1";
const ALERT_INSTALL_MARKER_KEY = "fuel-path:install-marker:v1";
const ALERT_LEGACY_IDENTITY_KEY = "fuel-path:alert-identity:v1";
const ALERT_LEGACY_CAPABILITY_KEY = "fuel-path:alert-capability:v1";
const ALERT_CAPABILITY_REFRESH_BUFFER_MS = 60 * 1000;
let alertIdentityPromise: Promise<AlertIdentity> | null = null;

export async function initialiseAnonymousInstallation() {
  await getAlertIdentity();
}

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
    if (!enabled) {
      const savedRoute = await postAlertJson("/api/saved-routes", capability.token, backendSavedRoutePayload({
        commute,
        enabled: false,
        preferences,
      }));
      return {
        status: "synced",
        remoteDeliveryEnabled: routeWatchRemoteDeliveryEnabled(savedRoute),
        message: "Route watch turned off.",
        syncedAt: new Date().toISOString(),
      };
    }
    if (!enabled || !expoPushToken) {
      return { status: "failed", code: "push_token_required", message: "This device push token is unavailable. Try again after reopening notifications." };
    }
    const savedRoute = await postAlertJson("/api/alerts?action=enrol-watch", capability.token, {
      ...backendSavedRoutePayload({ commute, enabled, preferences }),
      platform: Platform.OS,
      expoPushToken,
      appVersion: "1.0.0",
    });
    // Only record enrolment locally after both remote records have been accepted.
    // This marker controls privacy deletion after a native reinstall.
    await secureSet(ALERT_BACKEND_ENROLLED_KEY, "1");
    const remoteDeliveryEnabled = routeWatchRemoteDeliveryEnabled(savedRoute);
    if (enabled && remoteDeliveryEnabled === false) {
      return {
        status: "skipped",
        remoteDeliveryEnabled,
        message: "Smart route watch was saved, but push delivery is not enabled for this build yet.",
        syncedAt: new Date().toISOString(),
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
  } catch (error) {
    return {
      code: error instanceof RouteWatchError ? error.code : "backend_unavailable",
      status: "failed",
      message: error instanceof RouteWatchError
        ? error.message
        : "Smart route watch could not update. Your saved route remains on this device.",
    };
  }
}

export async function deleteMyAlertData(): Promise<SyncResult> {
  try {
    const enrolled = await secureGet(ALERT_BACKEND_ENROLLED_KEY);
    if (enrolled !== "1") {
      await clearAlertIdentity();
      return {
        status: "synced",
        message: "No backend alert data was stored. Your saved routes remain on this device with alerts off.",
        syncedAt: new Date().toISOString(),
      };
    }
    const identity = await getAlertIdentity();
    const capability = await getAlertCapability(identity);
    if (!capability) {
      return { status: "failed", message: "Alert data could not be deleted while the backend is unavailable." };
    }
    await postAlertJson("/api/alerts?action=delete-installation-data", capability.token, {});
    await clearAlertIdentity();
    return {
      status: "synced",
      message: "Alert data deleted. Your saved routes remain on this device with alerts off.",
      syncedAt: new Date().toISOString(),
    };
  } catch {
    return { status: "failed", message: "Alert data could not be deleted. Nothing was cleared locally, so you can retry." };
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
        status: "failed",
        message: "Route watch could not be deleted while the backend is unavailable.",
      };
    }
    await deleteAlertJson("/api/saved-routes", capability.token, {
      routeId: commute.id,
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
  if (!alertIdentityPromise) alertIdentityPromise = loadAlertIdentity();
  return alertIdentityPromise;
}

async function loadAlertIdentity(): Promise<AlertIdentity> {
  try {
    const marker = await AsyncStorage.getItem(ALERT_INSTALL_MARKER_KEY);
    const raw = await secureGet(ALERT_IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AlertIdentity>;
      if (parsed.installationId && parsed.installationSecret) {
        if (!marker && Platform.OS !== "web") {
          const enrolled = await secureGet(ALERT_BACKEND_ENROLLED_KEY);
          if (enrolled === "1") {
            const retired = await retirePersistedIosInstallation(parsed as AlertIdentity);
            if (!retired) throw new Error("Previous installation alert data could not be retired.");
          } else {
            await clearAlertIdentity(false);
          }
        } else {
          return { installationId: parsed.installationId, installationSecret: parsed.installationSecret };
        }
      }
    }
  } catch {
    alertIdentityPromise = null;
    throw new RouteWatchError(
      "installation_identity_unavailable",
      "This device could not create its private route-watch identity. Reinstall Fuel Path before trying again.",
    );
  }

  const identity = {
    installationId: `installation_${await randomUuid()}`,
    installationSecret: await randomSecret(),
  };
  await secureSet(ALERT_IDENTITY_KEY, JSON.stringify(identity));
  await Promise.all([
    AsyncStorage.removeItem(ALERT_LEGACY_IDENTITY_KEY),
    AsyncStorage.removeItem(ALERT_LEGACY_CAPABILITY_KEY),
  ]);
  await AsyncStorage.setItem(ALERT_INSTALL_MARKER_KEY, await randomUuid());
  return identity;
}

async function retirePersistedIosInstallation(identity: AlertIdentity) {
  const capability = await getAlertCapability(identity);
  if (!capability) return false;
  await postAlertJson("/api/alerts?action=delete-installation-data", capability.token, {});
  await clearAlertIdentity(false);
  return true;
}

async function clearAlertIdentity(resetPromise = true) {
  await Promise.all([
    secureDelete(ALERT_IDENTITY_KEY),
    secureDelete(ALERT_CAPABILITY_KEY),
    secureDelete(ALERT_BACKEND_ENROLLED_KEY),
    AsyncStorage.removeItem(ALERT_INSTALL_MARKER_KEY),
    AsyncStorage.removeItem(ALERT_LEGACY_IDENTITY_KEY),
    AsyncStorage.removeItem(ALERT_LEGACY_CAPABILITY_KEY),
  ]);
  if (resetPromise) alertIdentityPromise = null;
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
  preferences,
}: {
  commute: SavedCommute;
  enabled: boolean;
  preferences: AppPreferences;
}) {
  const vehicle = routeVehicle(commute, preferences);
  const routeFuel = vehicle.vehicleEnergyType === "electric" ? commute.fuel : vehicle.fuel;
  return {
    id: commute.id,
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

async function getAlertCapability(identity: AlertIdentity): Promise<AlertCapability> {
  try {
    const raw = await secureGet(ALERT_CAPABILITY_KEY);
    if (raw) {
      const capability = normaliseAlertCapability(JSON.parse(raw));
      if (capability) return capability;
      await secureDelete(ALERT_CAPABILITY_KEY);
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
    if (!response.ok || !capability) {
      throw new RouteWatchError(
        response.status === 429 ? "capability_rate_limited" : "capability_unavailable",
        safeAlertError(payload) || "Smart route checks are temporarily unavailable.",
      );
    }
    await secureSet(ALERT_CAPABILITY_KEY, JSON.stringify(capability));
    return capability;
  } catch (error) {
    if (error instanceof RouteWatchError) throw error;
    throw new RouteWatchError(
      "capability_unavailable",
      "Smart route checks are temporarily unavailable. Please try again shortly.",
    );
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
    throw new RouteWatchError(
      response.status === 401 ? "capability_rejected" : response.status === 429 ? "rate_limited" : "backend_rejected",
      safeAlertError(payload) || "Smart route watch could not update. Your saved route remains on this device.",
    );
  }
  return payload;
}

class RouteWatchError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

function safeAlertError(payload: unknown) {
  const value = payload && typeof payload === "object" ? (payload as { error?: unknown }).error : "";
  return typeof value === "string" ? value.slice(0, 180) : "";
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

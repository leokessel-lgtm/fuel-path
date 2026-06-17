import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { ALERTS_SYNC_TOKEN, API_BASE_URL, EAS_PROJECT_ID } from "../config";
import { AppPreferences, SavedCommute } from "../types";

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
      message: "Backend alert sync needs a validation build token.",
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
        ? "Price-triggered backend alert synced."
        : "Backend route alert turned off.",
      syncedAt: new Date().toISOString(),
    };
  } catch {
    return {
      status: "failed",
      message: "Backend alert sync failed. Local reminder state was kept.",
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
  return {
    id: commute.id,
    userId: identity.userId,
    name: commute.name,
    from: commute.from,
    to: commute.to,
    fuel: commute.fuel,
    alertEnabled: enabled,
    alertTimeLocal: commute.alertTime,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Australia/Sydney",
    minSavingDollars: 5,
    maxDetourMinutes: 8,
    eligibleDiscounts: preferences.selectedDiscounts,
    tankLitres: 55,
    tankPercent: 45,
    economy: 8.2,
    reserveKm: 35,
    createdAt: commute.createdAt,
    updatedAt: new Date().toISOString(),
  };
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

function randomId() {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.randomUUID) return cryptoObject.randomUUID();
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

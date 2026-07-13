import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

import {
  deleteBackendSavedRoute,
  deleteMyAlertData as deleteBackendAlertData,
  syncSavedRouteAlert,
} from "../services/backendAlerts";
import {
  cancelSavedCommuteAlert,
  configureRouteNotificationHandler,
  getExpoRoutePushToken,
  getRouteNotificationPermission,
  requestRouteNotificationPermission,
  scheduleSavedCommuteAlert,
  subscribeToPushTokenChanges,
} from "../services/routeNotifications";
import { scheduledRouteNotificationIds } from "../services/routeNotificationSchedule";
import {
  AppPreferences,
  CommuteAlertStatus,
  NotificationPermissionState,
  SavedCommute,
  Weekday,
} from "../types";

type CommuteAlertSettingsUpdate = Partial<Pick<
  SavedCommute,
  "alertDays" | "alertTime" | "localReminderEnabled" | "maxDetourMinutes" | "minSavingDollars" | "tankThresholdPercent" | "vehicleId"
>>;

export function useRouteAlerts({
  preferences,
  savedCommutes,
  setSavedCommutes,
}: {
  preferences: AppPreferences;
  savedCommutes: SavedCommute[];
  setSavedCommutes: Dispatch<SetStateAction<SavedCommute[]>>;
}) {
  const [alertSyncingCommuteId, setAlertSyncingCommuteId] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>("unknown");
  const [notificationMessage, setNotificationMessage] = useState(
    "Watch saved routes when you want Fuel Path to alert only on useful fuel decisions.",
  );

  useEffect(() => {
    let active = true;
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
    const staleLocalReminderCommutes = savedCommutes.filter((commute) =>
      commute.localReminderEnabled === false &&
      scheduledRouteNotificationIds(commute).length > 0
    );
    if (!staleLocalReminderCommutes.length) return;

    let active = true;
    Promise.all(staleLocalReminderCommutes.map((commute) => cancelSavedCommuteAlert(commute)))
      .then((results) => {
        if (!active) return;
        const failedIds = new Set(staleLocalReminderCommutes
          .filter((_, index) => results[index]?.status === "failed")
          .map((commute) => commute.id));
        setSavedCommutes((current) =>
          current.map((commute) => {
            if (
              failedIds.has(commute.id) ||
              commute.localReminderEnabled !== false ||
              scheduledRouteNotificationIds(commute).length === 0
            ) {
              return commute;
            }
            return {
              ...commute,
              alertStatus: commute.backendSyncedAt
                ? "backend_synced"
                : commute.alertStatus === "scheduled"
                  ? "off"
                  : commute.alertStatus,
              alertStatusMessage: commute.backendSyncedAt
                ? "Route watch is on. Smart alerts only when worth checking."
                : "Local reminders are off.",
              nextAlertAt: undefined,
              scheduledNotificationId: undefined,
              scheduledNotificationIds: undefined,
              updatedAt: new Date().toISOString(),
            };
          }),
        );
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [savedCommutes, setSavedCommutes]);

  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    let active = true;
    let pushTokenSubscription: { remove: () => void } | undefined;

    const disableRevokedAlerts = async () => {
      const permission = await getRouteNotificationPermission();
      if (!active) return;
      setNotificationPermission(permission.state);
      setNotificationMessage(permission.message);
      const watchedCommutes = savedCommutes.filter((commute) => commute.alertEnabled);
      if (permission.state !== "denied" || !watchedCommutes.length) return;
      const cancellations = await Promise.all(watchedCommutes.map((commute) => cancelSavedCommuteAlert(commute)));
      const failedLocalIds = new Set(watchedCommutes
        .filter((_, index) => cancellations[index]?.status === "failed")
        .map((commute) => commute.id));
      const backendSyncs = await Promise.all(watchedCommutes
        .map((commute) => syncSavedRouteAlert({
          commute,
          enabled: false,
          preferences,
        })));
      const failedBackendIds = new Set(watchedCommutes
        .filter((_, index) => backendSyncs[index]?.status !== "synced")
        .map((commute) => commute.id));
      if (!active) return;
      setSavedCommutes((current) => reconcileRevokedRouteAlerts(current, {
        watchedRouteIds: new Set(watchedCommutes.map((commute) => commute.id)),
        failedBackendIds,
        failedLocalIds,
        syncedAt: new Date().toISOString(),
      }));
    };

    let lastPushTokenRefreshAt = 0;
    const refreshRotatedToken = async () => {
      const now = Date.now();
      if (now - lastPushTokenRefreshAt < 30_000) return;
      lastPushTokenRefreshAt = now;
      const token = await getExpoRoutePushToken();
      if (!active || !token.token) return;
      await Promise.all(savedCommutes
        .filter((commute) => commute.alertEnabled)
        .map((commute) => syncSavedRouteAlert({
          commute,
          enabled: true,
          expoPushToken: token.token,
          preferences,
        })));
    };

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void disableRevokedAlerts();
    });
    void subscribeToPushTokenChanges(() => {
      void refreshRotatedToken();
    })
      .then((subscription) => {
        if (!active) {
          subscription?.remove();
        } else {
          pushTokenSubscription = subscription;
        }
      })
      .catch(() => {});

    return () => {
      active = false;
      appStateSubscription.remove();
      pushTokenSubscription?.remove();
    };
  }, [preferences, savedCommutes, setSavedCommutes]);

  const requestNotifications = useCallback(async () => {
    const result = await requestRouteNotificationPermission();
    setNotificationPermission(result.state);
    setNotificationMessage(result.message);
  }, []);

  const toggleCommuteAlert = useCallback(async (commuteId: string) => {
    const targetCommute = savedCommutes.find((commute) => commute.id === commuteId);
    if (!targetCommute || alertSyncingCommuteId) return;

    setAlertSyncingCommuteId(commuteId);
    try {
      if (targetCommute.alertEnabled) {
        const backendSync = await syncSavedRouteAlert({
          commute: targetCommute,
          enabled: false,
          preferences,
        });
        if (backendSync.status !== "synced") {
          setSavedCommutes((current) => current.map((commute) =>
            commute.id === commuteId
              ? { ...commute, alertStatus: "failed", alertStatusMessage: backendSync.message }
              : commute
          ));
          return;
        }
        const result = await cancelSavedCommuteAlert(targetCommute);
        const localCancellationFailed = result.status === "failed";
        setSavedCommutes((current) =>
          current.map((commute) =>
            commute.id === commuteId
              ? alertStateUpdate(commute, {
                  alertEnabled: false,
                  alertStatus: result.status,
                  alertStatusMessage: alertStatusMessage(result.message, backendSync.message),
                  backendSyncedAt: backendSync.syncedAt,
                  localReminderEnabled: localCancellationFailed ? false : commute.localReminderEnabled,
                  nextAlertAt: localCancellationFailed ? commute.nextAlertAt : undefined,
                  scheduledNotificationId: localCancellationFailed ? commute.scheduledNotificationId : undefined,
                  scheduledNotificationIds: localCancellationFailed ? commute.scheduledNotificationIds : undefined,
                })
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
              ? alertStateUpdate(commute, {
                  alertEnabled: false,
                  alertStatus,
                  alertStatusMessage: permission.message,
                  nextAlertAt: undefined,
                  scheduledNotificationId: undefined,
                  scheduledNotificationIds: undefined,
                })
              : commute,
          ),
        );
        return;
      }

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
      const backendSynced = smartRouteDeliveryReady(backendSync);
      const result = backendSynced && targetCommute.localReminderEnabled !== false
        ? await scheduleSavedCommuteAlert(targetCommute)
        : { status: "off" as const, message: "Local reminders are off.", nextAlertAt: undefined, notificationId: undefined, notificationIds: undefined };
      const localReminderScheduled = result.status === "scheduled";
      setSavedCommutes((current) =>
        current.map((commute) =>
          commute.id === commuteId
            ? alertStateUpdate(commute, {
                alertEnabled: localReminderScheduled || backendSynced,
                alertStatus: backendSynced
                  ? "backend_synced"
                  : backendSync.status === "failed"
                    ? "failed"
                    : result.status,
                alertStatusMessage: alertStatusMessage(
                  backendSynced ? "Route watch is on. Smart alerts only when worth checking." : backendSync.message,
                  backendSynced && result.status === "scheduled"
                    ? "Reminder scheduled for selected days."
                    : backendSync.message,
                ),
                backendSyncedAt: backendSync.syncedAt,
                nextAlertAt: result.nextAlertAt,
                scheduledNotificationId: result.notificationId,
                scheduledNotificationIds: result.notificationIds,
              })
            : commute,
        ),
      );
    } finally {
      setAlertSyncingCommuteId(null);
    }
  }, [alertSyncingCommuteId, preferences, savedCommutes, setSavedCommutes]);

  const deleteAllAlertData = useCallback(async () => {
    if (alertSyncingCommuteId) return false;
    setAlertSyncingCommuteId("all-alert-data");
    try {
      const result = await deleteBackendAlertData();
      if (result.status !== "synced") {
        setNotificationMessage(result.message);
        return false;
      }
      const cancellations = await Promise.all(savedCommutes.map((commute) => cancelSavedCommuteAlert(commute)));
      const failedLocalIds = new Set(savedCommutes
        .filter((_, index) => cancellations[index]?.status === "failed")
        .map((commute) => commute.id));
      setSavedCommutes((current) => current.map((commute) => ({
        ...commute,
        alertEnabled: false,
        alertStatus: failedLocalIds.has(commute.id) ? "failed" : "off",
        alertStatusMessage: failedLocalIds.has(commute.id)
          ? "Backend alert data was deleted. Local reminder cancellation needs retry."
          : "Route alert is off.",
        backendSyncedAt: undefined,
        localReminderEnabled: false,
        nextAlertAt: failedLocalIds.has(commute.id) ? commute.nextAlertAt : undefined,
        scheduledNotificationId: failedLocalIds.has(commute.id) ? commute.scheduledNotificationId : undefined,
        scheduledNotificationIds: failedLocalIds.has(commute.id) ? commute.scheduledNotificationIds : undefined,
        updatedAt: new Date().toISOString(),
      })));
      setNotificationMessage(failedLocalIds.size
        ? "Backend alert data was deleted. Some local reminders could not be cancelled, so local app data was kept. Try again."
        : result.message);
      return failedLocalIds.size === 0;
    } finally {
      setAlertSyncingCommuteId(null);
    }
  }, [alertSyncingCommuteId, savedCommutes, setSavedCommutes]);

  const removeCommute = useCallback(async (commuteId: string) => {
    const targetCommute = savedCommutes.find((commute) => commute.id === commuteId);
    if (!targetCommute || alertSyncingCommuteId) return;

    setAlertSyncingCommuteId(commuteId);
    try {
      const localCancel = await cancelSavedCommuteAlert(targetCommute);
      if (localCancel.status === "failed") {
        setSavedCommutes((current) => current.map((commute) =>
          commute.id === commuteId
            ? alertStateUpdate(commute, {
                alertEnabled: commute.alertEnabled,
                alertStatus: "failed",
                alertStatusMessage: localCancel.message,
                backendSyncedAt: commute.backendSyncedAt,
                nextAlertAt: commute.nextAlertAt,
                scheduledNotificationId: commute.scheduledNotificationId,
                scheduledNotificationIds: commute.scheduledNotificationIds,
              })
            : commute
        ));
        return;
      }
      const backendDelete = targetCommute.backendSyncedAt
        ? await deleteBackendSavedRoute({ commute: targetCommute })
        : { status: "synced" as const, message: "No backend route watch was stored." };
      if (backendDelete.status !== "synced") {
        setSavedCommutes((current) =>
          current.map((commute) =>
            commute.id === commuteId
              ? alertStateUpdate(commute, {
                  alertEnabled: commute.alertEnabled,
                  alertStatus: "failed",
                  alertStatusMessage: backendDelete.message,
                  backendSyncedAt: commute.backendSyncedAt,
                  nextAlertAt: commute.nextAlertAt,
                  scheduledNotificationId: commute.scheduledNotificationId,
                  scheduledNotificationIds: commute.scheduledNotificationIds,
                })
              : commute,
          ),
        );
        return;
      }

      setSavedCommutes((current) => current.filter((commute) => commute.id !== commuteId));
      setNotificationMessage(alertStatusMessage("Saved route removed.", backendDelete.message));
    } finally {
      setAlertSyncingCommuteId(null);
    }
  }, [alertSyncingCommuteId, savedCommutes, setSavedCommutes]);

  const updateCommuteAlertRule = useCallback(async (
    commuteId: string,
    key: "minSavingDollars" | "maxDetourMinutes" | "tankThresholdPercent",
    value: number,
  ) => {
    const targetCommute = savedCommutes.find((commute) => commute.id === commuteId);
    if (!targetCommute || alertSyncingCommuteId) return;
    const updatedCommute = {
      ...targetCommute,
      [key]: value,
      updatedAt: new Date().toISOString(),
    };

    setSavedCommutes((current) =>
      current.map((commute) => (commute.id === commuteId ? updatedCommute : commute)),
    );

    if (!targetCommute.alertEnabled) return;

    setAlertSyncingCommuteId(commuteId);
    try {
      const backendSync = await syncSavedRouteAlert({
        commute: updatedCommute,
        enabled: true,
        preferences,
      });
      setSavedCommutes((current) =>
        current.map((commute) =>
          commute.id === commuteId
            ? alertStateUpdate(commute, {
                alertEnabled: commute.alertEnabled,
                alertStatus:
                  smartRouteDeliveryReady(backendSync)
                    ? "backend_synced"
                    : commute.alertStatus || "scheduled",
                alertStatusMessage: backendSync.message,
                backendSyncedAt: backendSync.syncedAt || commute.backendSyncedAt,
                nextAlertAt: commute.nextAlertAt,
                scheduledNotificationId: commute.scheduledNotificationId,
              })
            : commute,
        ),
      );
    } finally {
      setAlertSyncingCommuteId(null);
    }
  }, [alertSyncingCommuteId, preferences, savedCommutes, setSavedCommutes]);

  const updateCommuteAlertSettings = useCallback(async (
    commuteId: string,
    updates: CommuteAlertSettingsUpdate,
  ) => {
    const targetCommute = savedCommutes.find((commute) => commute.id === commuteId);
    if (!targetCommute || alertSyncingCommuteId) return;
    const updatedCommute = normaliseCommuteAlertSettingsUpdate({
      ...targetCommute,
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    setSavedCommutes((current) =>
      current.map((commute) => (commute.id === commuteId ? updatedCommute : commute)),
    );

    if (!targetCommute.alertEnabled) return;

    setAlertSyncingCommuteId(commuteId);
    try {
      const localSchedule = await scheduleSavedCommuteAlert(updatedCommute);
      const backendSync = await syncSavedRouteAlert({
        commute: updatedCommute,
        enabled: true,
        preferences,
      });
      const backendSynced = smartRouteDeliveryReady(backendSync);
      const localReminderScheduled = localSchedule.status === "scheduled";
      setSavedCommutes((current) =>
        current.map((commute) =>
          commute.id === commuteId
            ? alertStateUpdate(commute, {
                alertEnabled: localReminderScheduled || backendSynced,
                alertStatus: backendSynced
                  ? "backend_synced"
                  : backendSync.status === "failed"
                    ? "failed"
                    : localSchedule.status,
                alertStatusMessage: alertStatusMessage(
                  backendSynced
                    ? "Route watch updated. Smart alerts only when worth checking."
                    : localSchedule.message,
                  backendSynced && localSchedule.status === "scheduled"
                    ? "Reminder updated for selected days."
                    : backendSync.message,
                ),
                backendSyncedAt: backendSync.syncedAt || commute.backendSyncedAt,
                nextAlertAt: localSchedule.nextAlertAt,
                scheduledNotificationId: localSchedule.notificationId,
                scheduledNotificationIds: localSchedule.notificationIds,
              })
            : commute,
        ),
      );
    } finally {
      setAlertSyncingCommuteId(null);
    }
  }, [alertSyncingCommuteId, preferences, savedCommutes, setSavedCommutes]);

  return {
    alertSyncingCommuteId,
    deleteAllAlertData,
    notificationMessage,
    notificationPermission,
    removeCommute,
    requestNotifications,
    toggleCommuteAlert,
    updateCommuteAlertSettings,
    updateCommuteAlertRule,
  };
}

function alertStateUpdate(
  commute: SavedCommute,
  update: {
    alertEnabled: boolean;
    alertStatus: CommuteAlertStatus;
    alertStatusMessage: string;
    backendSyncedAt?: string;
    localReminderEnabled?: boolean;
    nextAlertAt?: string;
    scheduledNotificationId?: string;
    scheduledNotificationIds?: string[];
  },
) {
  return {
    ...commute,
    ...update,
    updatedAt: new Date().toISOString(),
  };
}

function alertStatusMessage(primary: string, secondary?: string) {
  return [primary, secondary].filter(Boolean).join(" ");
}

function smartRouteDeliveryReady(result: { remoteDeliveryEnabled?: boolean; status: string }) {
  // A saved backend watch remains enrolled while the global delivery gate is off.
  // The gate controls sending, not whether this device and route were registered.
  return result.status === "synced" || result.status === "skipped";
}

export function reconcileRevokedRouteAlerts(
  commutes: SavedCommute[],
  {
    watchedRouteIds,
    failedBackendIds,
    failedLocalIds,
    syncedAt,
  }: {
    watchedRouteIds: Set<string>;
    failedBackendIds: Set<string>;
    failedLocalIds: Set<string>;
    syncedAt: string;
  },
) {
  return commutes.map((commute) => {
    // A permission change only reconciles watches that were actually enabled.
    // Do not rewrite already-off routes or touch their local reminder metadata.
    if (!watchedRouteIds.has(commute.id)) return commute;

    const backendFailed = failedBackendIds.has(commute.id);
    const localCancellationFailed = failedLocalIds.has(commute.id);
    return alertStateUpdate(commute, {
      alertEnabled: backendFailed,
      alertStatus: backendFailed || localCancellationFailed ? "failed" : "needs_permission",
      alertStatusMessage: backendFailed
        ? "Notifications are off. Route watch update still needs retry."
        : localCancellationFailed
          ? "Notifications are off. Local reminder cancellation needs retry."
          : "Notifications are off. Route watch data was kept.",
      backendSyncedAt: backendFailed ? commute.backendSyncedAt : syncedAt,
      localReminderEnabled: false,
      nextAlertAt: localCancellationFailed ? commute.nextAlertAt : undefined,
      scheduledNotificationId: localCancellationFailed ? commute.scheduledNotificationId : undefined,
      scheduledNotificationIds: localCancellationFailed ? commute.scheduledNotificationIds : undefined,
    });
  });
}

const weekdays: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function normaliseCommuteAlertSettingsUpdate(commute: SavedCommute): SavedCommute {
  const alertDays = Array.isArray(commute.alertDays)
    ? weekdays.filter((day) => commute.alertDays?.includes(day))
    : weekdays;
  return {
    ...commute,
    alertDays: alertDays.length ? alertDays : weekdays,
    alertTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(commute.alertTime) ? commute.alertTime : "07:30",
    minSavingDollars: boundedNumber(commute.minSavingDollars, 1, 25, 5),
    maxDetourMinutes: boundedNumber(commute.maxDetourMinutes, 1, 30, 8),
    tankThresholdPercent: boundedNumber(commute.tankThresholdPercent, 5, 95, 45),
  };
}

function boundedNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";

import { deleteBackendSavedRoute, syncSavedRouteAlert } from "../services/backendAlerts";
import {
  cancelSavedCommuteAlert,
  configureRouteNotificationHandler,
  getExpoRoutePushToken,
  getRouteNotificationPermission,
  requestRouteNotificationPermission,
  scheduleSavedCommuteAlert,
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
      .then(() => {
        if (!active) return;
        setSavedCommutes((current) =>
          current.map((commute) => {
            if (
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
        const result = await cancelSavedCommuteAlert(targetCommute);
        const backendSync = await syncSavedRouteAlert({
          commute: targetCommute,
          enabled: false,
          preferences,
        });
        setSavedCommutes((current) =>
          current.map((commute) =>
            commute.id === commuteId
              ? alertStateUpdate(commute, {
                  alertEnabled: false,
                  alertStatus: result.status,
                  alertStatusMessage: alertStatusMessage(result.message, backendSync.message),
                  backendSyncedAt: backendSync.syncedAt,
                  nextAlertAt: undefined,
                  scheduledNotificationId: undefined,
                  scheduledNotificationIds: undefined,
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
                  backendSynced
                    ? "Route watch is on. Smart alerts only when worth checking."
                    : result.message,
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

  const removeCommute = useCallback(async (commuteId: string) => {
    const targetCommute = savedCommutes.find((commute) => commute.id === commuteId);
    if (!targetCommute || alertSyncingCommuteId) return;

    setAlertSyncingCommuteId(commuteId);
    try {
      const localCancel = await cancelSavedCommuteAlert(targetCommute);
      const backendDelete = await deleteBackendSavedRoute({ commute: targetCommute });
      if (backendDelete.status === "failed") {
        setSavedCommutes((current) =>
          current.map((commute) =>
            commute.id === commuteId
              ? alertStateUpdate(commute, {
                  alertEnabled: commute.alertEnabled,
                  alertStatus: "failed",
                  alertStatusMessage: alertStatusMessage(localCancel.message, backendDelete.message),
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
                  backendSync.status === "synced"
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
      const backendSynced = backendSync.status === "synced";
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

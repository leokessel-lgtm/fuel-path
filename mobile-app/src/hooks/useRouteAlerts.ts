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
import {
  AppPreferences,
  CommuteAlertStatus,
  NotificationPermissionState,
  SavedCommute,
} from "../types";

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
    "Enable alerts when you want Fuel Path to check saved routes for you.",
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
      setSavedCommutes((current) =>
        current.map((commute) =>
          commute.id === commuteId
            ? alertStateUpdate(commute, {
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

  return {
    alertSyncingCommuteId,
    notificationMessage,
    notificationPermission,
    removeCommute,
    requestNotifications,
    toggleCommuteAlert,
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

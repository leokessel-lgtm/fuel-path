import { Platform } from "react-native";

import { CommuteAlertStatus, NotificationPermissionState, SavedCommute } from "../types";

type PermissionResult = {
  message: string;
  state: NotificationPermissionState;
};

type ScheduleResult = {
  message: string;
  nextAlertAt?: string;
  notificationId?: string;
  status: CommuteAlertStatus;
};

const ROUTE_ALERT_CHANNEL_ID = "route-alerts";

export async function configureRouteNotificationHandler() {
  if (Platform.OS === "web") return;

  const Notifications = await import("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function getRouteNotificationPermission(): Promise<PermissionResult> {
  if (Platform.OS === "web") {
    return {
      state: "unavailable",
      message: "Route alerts need an iOS or Android build.",
    };
  }

  const Notifications = await import("expo-notifications");
  const permission = await Notifications.getPermissionsAsync();
  return permissionResultForStatus(permission.status);
}

export async function requestRouteNotificationPermission(): Promise<PermissionResult> {
  if (Platform.OS === "web") {
    return {
      state: "unavailable",
      message: "Route alerts need an iOS or Android build.",
    };
  }

  const Notifications = await import("expo-notifications");
  await ensureRouteAlertChannel(Notifications);

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === "granted") {
    return permissionResultForStatus(existing.status);
  }

  const requested = await Notifications.requestPermissionsAsync();
  return permissionResultForStatus(requested.status);
}

export async function scheduleSavedCommuteAlert(commute: SavedCommute): Promise<ScheduleResult> {
  if (Platform.OS === "web") {
    return {
      status: "unavailable",
      message: "Alert scheduling needs an iOS or Android build.",
    };
  }

  try {
    const Notifications = await import("expo-notifications");
    await ensureRouteAlertChannel(Notifications);

    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted") {
      return {
        status: "needs_permission",
        message: "Enable notifications before this route can alert you.",
      };
    }

    if (commute.scheduledNotificationId) {
      await Notifications.cancelScheduledNotificationAsync(commute.scheduledNotificationId);
    }

    const { hour, minute } = parseAlertTime(commute.alertTime);
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Check fuel before your saved drive",
        body: `${commute.name}: refresh route prices before you head out.`,
        data: {
          commuteId: commute.id,
          routeName: commute.name,
          type: "saved-route-alert",
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        channelId: ROUTE_ALERT_CHANNEL_ID,
        hour,
        minute,
      },
    });

    return {
      status: "scheduled",
      message: "Daily route reminder scheduled.",
      nextAlertAt: nextDailyAlertAt(commute.alertTime).toISOString(),
      notificationId,
    };
  } catch {
    return {
      status: "failed",
      message: "Could not schedule this route alert.",
    };
  }
}

export async function cancelSavedCommuteAlert(commute: SavedCommute): Promise<ScheduleResult> {
  if (Platform.OS !== "web" && commute.scheduledNotificationId) {
    try {
      const Notifications = await import("expo-notifications");
      await Notifications.cancelScheduledNotificationAsync(commute.scheduledNotificationId);
    } catch {
      return {
        status: "failed",
        message: "Could not cancel this route alert.",
      };
    }
  }

  return {
    status: "off",
    message: "Route alert is off.",
  };
}

async function ensureRouteAlertChannel(
  Notifications: typeof import("expo-notifications"),
) {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(ROUTE_ALERT_CHANNEL_ID, {
    name: "Saved route alerts",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 120, 200],
  });
}

function permissionResultForStatus(status: string): PermissionResult {
  if (status === "granted") {
    return {
      state: "granted",
      message: "Route alerts are enabled for this device.",
    };
  }

  if (status === "denied") {
    return {
      state: "denied",
      message: "Notifications are off. You can still save commutes.",
    };
  }

  return {
    state: "undetermined",
    message: "Enable alerts when you want Fuel Path to check saved routes for you.",
  };
}

function parseAlertTime(value: string) {
  const [hourValue, minuteValue] = value.split(":");
  const hour = Number(hourValue);
  const minute = Number(minuteValue);

  if (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  ) {
    return { hour, minute };
  }

  return { hour: 7, minute: 30 };
}

function nextDailyAlertAt(alertTime: string) {
  const { hour, minute } = parseAlertTime(alertTime);
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= Date.now()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

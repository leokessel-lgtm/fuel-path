import { Platform } from "react-native";
import Constants from "expo-constants";

import { configuredEasProjectId } from "./backendAlerts";
import { CommuteAlertStatus, NotificationPermissionState, SavedCommute } from "../types";
import {
  ROUTE_ALERT_CHANNEL_ID,
  nextRouteAlertAt,
  routeAlertScheduleInputs,
  scheduledRouteNotificationIds,
} from "./routeNotificationSchedule";

type PermissionResult = {
  message: string;
  state: NotificationPermissionState;
};

type ScheduleResult = {
  message: string;
  nextAlertAt?: string;
  notificationId?: string;
  notificationIds?: string[];
  status: CommuteAlertStatus;
};

type PushTokenResult = {
  message: string;
  token?: string;
  status: "ready" | "unavailable" | "failed";
};

export async function configureRouteNotificationHandler() {
  if (Platform.OS === "web") return;
  if (androidNotificationsUnavailableInExpoGo()) return;

  const Notifications = await import("expo-notifications");
  await ensureRouteAlertChannel(Notifications);
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

  if (androidNotificationsUnavailableInExpoGo()) {
    return {
      state: "unavailable",
      message: "Android Expo Go cannot run route notifications. Use a development or preview build.",
    };
  }

  try {
    const Notifications = await import("expo-notifications");
    const permission = await Notifications.getPermissionsAsync();
    return permissionResultForStatus(permission.status);
  } catch {
    return {
      state: "unavailable",
      message: "Could not check notification permission on this build. You can still save commutes.",
    };
  }
}

export async function requestRouteNotificationPermission(): Promise<PermissionResult> {
  if (Platform.OS === "web") {
    return {
      state: "unavailable",
      message: "Route alerts need an iOS or Android build.",
    };
  }

  if (androidNotificationsUnavailableInExpoGo()) {
    return {
      state: "unavailable",
      message: "Android Expo Go cannot run route notifications. Use a development or preview build.",
    };
  }

  try {
    const Notifications = await import("expo-notifications");
    await ensureRouteAlertChannel(Notifications);

    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === "granted") {
      return permissionResultForStatus(existing.status);
    }

    const requested = await Notifications.requestPermissionsAsync();
    return permissionResultForStatus(requested.status);
  } catch {
    return {
      state: "unavailable",
      message: "Could not request notification permission on this build. You can still save commutes.",
    };
  }
}

export async function scheduleSavedCommuteAlert(commute: SavedCommute): Promise<ScheduleResult> {
  if (Platform.OS === "web") {
    return {
      status: "unavailable",
      message: "Alert scheduling needs an iOS or Android build.",
    };
  }

  if (androidNotificationsUnavailableInExpoGo()) {
    return {
      status: "unavailable",
      message: "Android Expo Go cannot schedule route notifications. Use a development or preview build.",
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

    const existingNotificationIds = scheduledRouteNotificationIds(commute);
    for (const notificationId of existingNotificationIds) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    }

    if (commute.localReminderEnabled === false) {
      return {
        status: "off",
        message: "Local reminders are off.",
      };
    }

    const notificationIds: string[] = [];
    const scheduleInputs = routeAlertScheduleInputs(commute);
    for (const scheduleInput of scheduleInputs) {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Fuel worth checking before your drive",
          body: `${commute.name}: watching ${commute.fuel} savings before you leave.`,
          data: {
            commuteId: commute.id,
            routeName: commute.name,
            type: "saved-route-alert",
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          channelId: ROUTE_ALERT_CHANNEL_ID,
          weekday: scheduleInput.weekday,
          hour: scheduleInput.hour,
          minute: scheduleInput.minute,
        },
      });
      notificationIds.push(notificationId);
    }

    return {
      status: "scheduled",
      message: "Route watch is on. Reminder scheduled for selected days.",
      nextAlertAt: nextRouteAlertAt(commute.alertTime, commute.alertDays).toISOString(),
      notificationId: notificationIds[0],
      notificationIds,
    };
  } catch {
    return {
      status: "failed",
      message: "Could not schedule this route alert.",
    };
  }
}

export async function getExpoRoutePushToken(): Promise<PushTokenResult> {
  if (Platform.OS === "web") {
    return {
      status: "unavailable",
      message: "Push alerts need an iOS or Android build.",
    };
  }

  if (androidNotificationsUnavailableInExpoGo() || remotePushUnavailableInExpoGo()) {
    return {
      status: "unavailable",
      message: "Smart route notifications need a development or preview build, not Expo Go.",
    };
  }

  try {
    const Notifications = await import("expo-notifications");
    await ensureRouteAlertChannel(Notifications);

    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted") {
      return {
        status: "unavailable",
        message: "Enable notifications before smart route alerts can run.",
      };
    }

    const projectId = expoProjectId();
    if (!projectId) {
      return {
        status: "unavailable",
        message: "Smart route notifications need an EAS project id in the native build.",
      };
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return {
      status: "ready",
      token: token.data,
      message: "Smart route notifications are ready for this build.",
    };
  } catch {
    return {
      status: "failed",
      message: "Could not get this device push token.",
    };
  }
}

export async function cancelSavedCommuteAlert(commute: SavedCommute): Promise<ScheduleResult> {
  if (Platform.OS !== "web" && !androidNotificationsUnavailableInExpoGo()) {
    try {
      const Notifications = await import("expo-notifications");
      const notificationIds = scheduledRouteNotificationIds(commute);
      for (const notificationId of notificationIds) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      }
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

export async function subscribeToPushTokenChanges(onChange: () => void) {
  if (Platform.OS === "web" || androidNotificationsUnavailableInExpoGo()) return undefined;
  try {
    const Notifications = await import("expo-notifications");
    return Notifications.addPushTokenListener(onChange);
  } catch {
    return undefined;
  }
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
      message: "Route alert permission is enabled on this validation build.",
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
    message: "Enable notifications when you want Fuel Path to watch saved routes for useful fuel decisions.",
  };
}

function expoProjectId() {
  return (
    configuredEasProjectId() ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    ""
  );
}

function remotePushUnavailableInExpoGo() {
  return Constants.appOwnership === "expo";
}

function androidNotificationsUnavailableInExpoGo() {
  return Platform.OS === "android" && Constants.appOwnership === "expo";
}

import { CommuteAlertStatus, NotificationPermissionState, SavedCommute } from "../types";

type PermissionResult = { message: string; state: NotificationPermissionState };
type ScheduleResult = { message: string; status: CommuteAlertStatus };
type PushTokenResult = { message: string; status: "unavailable" };

const unavailablePermission: PermissionResult = {
  state: "unavailable",
  message: "Route alerts need an iOS or Android build.",
};

export async function configureRouteNotificationHandler() {}
export async function getRouteNotificationPermission() { return unavailablePermission; }
export async function requestRouteNotificationPermission() { return unavailablePermission; }
export async function getExpoRoutePushToken(): Promise<PushTokenResult> {
  return { status: "unavailable", message: "Push alerts need an iOS or Android build." };
}
export async function scheduleSavedCommuteAlert(_commute: SavedCommute): Promise<ScheduleResult> {
  return { status: "unavailable", message: "Alert scheduling needs an iOS or Android build." };
}
export async function cancelSavedCommuteAlert(_commute: SavedCommute): Promise<ScheduleResult> {
  return { status: "off", message: "Route alert is off." };
}

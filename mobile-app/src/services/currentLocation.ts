import * as Location from "expo-location";
import { Platform } from "react-native";

import { MapPoint } from "../types";

const CURRENT_LOCATION_TIMEOUT_MS = 9000;

export async function getCurrentMapPoint(label = "Current location"): Promise<MapPoint> {
  return resolveCurrentMapPoint({ label, requestPermission: true });
}

export async function getGrantedCurrentMapPoint(label = "Current location"): Promise<MapPoint> {
  return resolveCurrentMapPoint({ label, requestPermission: false });
}

async function resolveCurrentMapPoint({
  label,
  requestPermission,
}: {
  label: string;
  requestPermission: boolean;
}): Promise<MapPoint> {
  if (Platform.OS === "web") {
    return resolveBrowserMapPoint(label, requestPermission);
  }

  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      throw new Error("Location services are turned off on this device.");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("turned off")) {
      throw err;
    }
  }

  const permission = requestPermission
    ? await Location.requestForegroundPermissionsAsync()
    : await Location.getForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("Location permission was not granted.");
  }

  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: 5 * 60 * 1000,
    requiredAccuracy: 5000,
  });
  const current =
    lastKnown ||
    (await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      CURRENT_LOCATION_TIMEOUT_MS,
      "Current location took too long. Try again near a window, or type a start address.",
    ));

  return {
    lat: current.coords.latitude,
    lon: current.coords.longitude,
    label,
  };
}

function resolveBrowserMapPoint(label: string, requestPermission: boolean): Promise<MapPoint> {
  const geolocation = globalThis.navigator?.geolocation;
  if (!geolocation) {
    return Promise.reject(new Error("Current location is not available in this browser."));
  }
  if (!requestPermission) {
    return Promise.reject(new Error("Location permission has not been requested yet."));
  }

  return withTimeout(
    new Promise<MapPoint>((resolve, reject) => {
      geolocation.getCurrentPosition(
        (position) =>
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            label,
          }),
        (error) => reject(new Error(browserLocationError(error))),
        {
          enableHighAccuracy: false,
          maximumAge: 5 * 60 * 1000,
          timeout: CURRENT_LOCATION_TIMEOUT_MS,
        },
      );
    }),
    CURRENT_LOCATION_TIMEOUT_MS + 1000,
    "Current location took too long. Try again, or type a start address.",
  );
}

function browserLocationError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission was blocked. Allow location for localhost, or type a start address.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Current location is unavailable. Try again, or type a start address.";
  }
  if (error.code === error.TIMEOUT) {
    return "Current location took too long. Try again, or type a start address.";
  }
  return "Current location is not available.";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

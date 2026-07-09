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

  let servicesEnabled = true;
  try {
    servicesEnabled = await Location.hasServicesEnabledAsync();
  } catch {
    throw new Error("Current location is not available on this device right now.");
  }
  if (!servicesEnabled) {
    throw new Error("Location services are turned off on this device.");
  }

  const permission = await nativeLocationPermission(requestPermission);
  if (permission.status !== "granted") {
    throw new Error("Location permission was not granted.");
  }

  const lastKnown = await safeLastKnownPosition();
  const current = lastKnown || await safeCurrentPosition();

  return {
    lat: current.coords.latitude,
    lon: current.coords.longitude,
    label,
  };
}

async function nativeLocationPermission(requestPermission: boolean) {
  try {
    return requestPermission
      ? await Location.requestForegroundPermissionsAsync()
      : await Location.getForegroundPermissionsAsync();
  } catch {
    throw new Error("Location permission could not be checked.");
  }
}

async function safeLastKnownPosition() {
  try {
    return await Location.getLastKnownPositionAsync({
      maxAge: 5 * 60 * 1000,
      requiredAccuracy: 5000,
    });
  } catch {
    return null;
  }
}

async function safeCurrentPosition() {
  try {
    return await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      CURRENT_LOCATION_TIMEOUT_MS,
      "Current location took too long. Try again near a window, or type a start address.",
    );
  } catch (err) {
    if (err instanceof Error && /too long/i.test(err.message)) throw err;
    throw new Error("Current location is unavailable on this device right now.");
  }
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
    return "Location permission is off. Allow location for Fuel Path, or type a start address.";
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

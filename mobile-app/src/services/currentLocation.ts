import * as Location from "expo-location";

import { MapPoint } from "../types";

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

  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    lat: current.coords.latitude,
    lon: current.coords.longitude,
    label,
  };
}

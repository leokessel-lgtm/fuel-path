import { MapPoint } from "../types";

const CURRENT_LOCATION_TIMEOUT_MS = 9000;

export async function getCurrentMapPoint(label = "Current location"): Promise<MapPoint> {
  return resolveBrowserMapPoint(label, true);
}

export async function getGrantedCurrentMapPoint(label = "Current location"): Promise<MapPoint> {
  return resolveBrowserMapPoint(label, false);
}

function resolveBrowserMapPoint(label: string, requestPermission: boolean): Promise<MapPoint> {
  const geolocation = globalThis.navigator?.geolocation;
  if (!geolocation) return Promise.reject(new Error("Current location is not available in this browser."));
  if (!requestPermission) return Promise.reject(new Error("Location permission has not been requested yet."));
  return withTimeout(
    new Promise<MapPoint>((resolve, reject) => geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude, label }),
      (error) => reject(new Error(browserLocationError(error))),
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: CURRENT_LOCATION_TIMEOUT_MS },
    )),
    CURRENT_LOCATION_TIMEOUT_MS + 1000,
    "Current location took too long. Try again, or type a start address.",
  );
}

function browserLocationError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return "Location permission is off. Allow location for Fuel Path, or type a start address.";
  if (error.code === error.POSITION_UNAVAILABLE) return "Current location is unavailable. Try again, or type a start address.";
  if (error.code === error.TIMEOUT) return "Current location took too long. Try again, or type a start address.";
  return "Current location is not available.";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); });
  return Promise.race([promise, timeout]).finally(() => { if (timer) clearTimeout(timer); });
}

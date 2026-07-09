import { Platform } from "react-native";

declare const process:
  {
    env: Record<string, string | undefined>;
  };

declare const __DEV__: boolean;

const PRODUCTION_API_BASE_URL = "https://fuel-path.vercel.app";
const CONFIGURED_API_BASE_URL = process.env.EXPO_PUBLIC_FUEL_PATH_API_BASE_URL;
const CONFIGURED_EAS_PROJECT_ID = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "";

function defaultApiBaseUrl() {
  if (Platform.OS === "web" && typeof globalThis.location?.origin === "string") {
    const hostname = globalThis.location.hostname;
    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    if (localHosts.has(hostname)) {
      return PRODUCTION_API_BASE_URL;
    }
    if (!localHosts.has(hostname)) {
      return globalThis.location.origin;
    }
  }

  // Native dev builds run on real devices as well as emulators; set
  // EXPO_PUBLIC_FUEL_PATH_API_BASE_URL explicitly when testing a local backend.
  return PRODUCTION_API_BASE_URL;
}

function configuredApiBaseUrl() {
  const configured = CONFIGURED_API_BASE_URL;
  if (configured === "__SAME_ORIGIN__" && typeof globalThis.location?.origin === "string") {
    return globalThis.location.origin;
  }
  return configured || defaultApiBaseUrl();
}

export const API_BASE_URL =
  configuredApiBaseUrl();

export const EAS_PROJECT_ID =
  CONFIGURED_EAS_PROJECT_ID;

import { Platform } from "react-native";

declare const process:
  {
    env: Record<string, string | undefined>;
  };

declare const __DEV__: boolean;

const PRODUCTION_API_BASE_URL = "https://fuel-path.vercel.app";
const CONFIGURED_API_BASE_URL = process.env.EXPO_PUBLIC_FUEL_PATH_API_BASE_URL;
const CONFIGURED_ALERTS_SYNC_TOKEN =
  process.env.EXPO_PUBLIC_FUEL_PATH_ALERTS_VALIDATION_TOKEN ||
  process.env.EXPO_PUBLIC_FUEL_PATH_ALERTS_TOKEN ||
  "";
const CONFIGURED_EAS_PROJECT_ID = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "";

function defaultApiBaseUrl() {
  if (__DEV__ && Platform.OS === "android") {
    return "http://10.0.2.2:4174";
  }
  if (__DEV__) {
    return "http://127.0.0.1:4174";
  }
  if (Platform.OS === "web" && typeof globalThis.location?.origin === "string") {
    const hostname = globalThis.location.hostname;
    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    if (localHosts.has(hostname)) {
      return globalThis.location.origin;
    }
    if (!localHosts.has(hostname)) {
      return globalThis.location.origin;
    }
  }
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

export const ALERTS_SYNC_TOKEN =
  CONFIGURED_ALERTS_SYNC_TOKEN;

export const EAS_PROJECT_ID =
  CONFIGURED_EAS_PROJECT_ID;

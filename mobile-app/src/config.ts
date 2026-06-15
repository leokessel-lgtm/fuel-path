import { Platform } from "react-native";

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

function defaultApiBaseUrl() {
  if (Platform.OS === "android") {
    return "http://10.0.2.2:4174";
  }
  if (Platform.OS === "web" && typeof globalThis.location?.origin === "string") {
    const hostname = globalThis.location.hostname;
    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    if (!localHosts.has(hostname)) {
      return globalThis.location.origin;
    }
  }
  return "http://127.0.0.1:4174";
}

function configuredApiBaseUrl() {
  const configured = process?.env?.EXPO_PUBLIC_FUEL_PATH_API_BASE_URL;
  if (configured === "__SAME_ORIGIN__" && typeof globalThis.location?.origin === "string") {
    return globalThis.location.origin;
  }
  return configured || defaultApiBaseUrl();
}

export const API_BASE_URL =
  configuredApiBaseUrl();

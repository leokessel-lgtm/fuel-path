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
  return "http://127.0.0.1:4174";
}

export const API_BASE_URL =
  process?.env?.EXPO_PUBLIC_FUEL_PATH_API_BASE_URL || defaultApiBaseUrl();

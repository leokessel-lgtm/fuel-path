import { EAS_PROJECT_ID } from "../config";

const nativeOnly = {
  status: "skipped" as const,
  message: "Smart route alerts are available in the native app.",
};

export const initialiseAnonymousInstallation = async () => undefined;
export const syncSavedRouteAlert = async () => nativeOnly;
export const deleteMyAlertData = async () => nativeOnly;
export const deleteBackendSavedRoute = async () => nativeOnly;
export const configuredEasProjectId = () => EAS_PROJECT_ID;

import { AppPreferences, SavedCommute } from "../types";

type SyncResult = {
  message: string;
  remoteDeliveryEnabled?: boolean;
  status: "synced" | "skipped" | "failed";
  syncedAt?: string;
};

export function initialiseAnonymousInstallation(): Promise<void>;
export function syncSavedRouteAlert(input: {
  commute: SavedCommute;
  enabled: boolean;
  expoPushToken?: string;
  preferences: AppPreferences;
}): Promise<SyncResult>;
export function deleteMyAlertData(): Promise<SyncResult>;
export function deleteBackendSavedRoute(input: { commute: SavedCommute }): Promise<SyncResult>;
export function configuredEasProjectId(): string;

import AsyncStorage from "@react-native-async-storage/async-storage";

export const PREFERENCES_KEY = "fuel-path:preferences:v1";
export const PREFERENCES_BACKUP_KEY = "fuel-path:preferences:v1:backup";
export const SAVED_COMMUTES_KEY = "fuel-path:saved-commutes:v1";
export const SAVED_COMMUTES_BACKUP_KEY = "fuel-path:saved-commutes:v1:backup";
export const RECENT_LOCATIONS_KEY = "fuel-path:recent-locations:v1";
export const RECENT_LOCATIONS_BACKUP_KEY = "fuel-path:recent-locations:v1:backup";
export const MONETISATION_EVENTS_KEY = "fuelpath.monetisationBehaviour.events.v1";
export const MONETISATION_SESSION_KEY = "fuelpath.monetisationBehaviour.sessionId.v1";

export const ROUTINE_LOCAL_DATA_KEYS = [
  PREFERENCES_KEY,
  PREFERENCES_BACKUP_KEY,
  SAVED_COMMUTES_KEY,
  SAVED_COMMUTES_BACKUP_KEY,
  RECENT_LOCATIONS_KEY,
  RECENT_LOCATIONS_BACKUP_KEY,
  MONETISATION_EVENTS_KEY,
  MONETISATION_SESSION_KEY,
] as const;

export async function clearRoutineLocalData() {
  await AsyncStorage.multiRemove([...ROUTINE_LOCAL_DATA_KEYS]);
}

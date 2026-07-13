import AsyncStorage from "@react-native-async-storage/async-storage";

export const randomUuid = async () => crypto.randomUUID();

export async function randomSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export const secureGet = (key: string) => AsyncStorage.getItem(key);
export const secureSet = (key: string, value: string) => AsyncStorage.setItem(key, value);
export const secureDelete = (key: string) => AsyncStorage.removeItem(key);

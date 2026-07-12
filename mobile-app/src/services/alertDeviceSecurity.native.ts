import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

export const randomUuid = () => Crypto.randomUUID();

export async function randomSecret() {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export const secureGet = (key: string) => SecureStore.getItemAsync(key);

export const secureSet = (key: string, value: string) => SecureStore.setItemAsync(key, value, {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});

export const secureDelete = (key: string) => SecureStore.deleteItemAsync(key);

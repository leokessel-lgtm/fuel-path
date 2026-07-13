import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

export async function randomUuid() {
  try {
    return Crypto.randomUUID();
  } catch {
    const bytes = await Crypto.getRandomBytesAsync(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}

export async function randomSecret() {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export const secureGet = (key: string) => SecureStore.getItemAsync(key);

export const secureSet = (key: string, value: string) => SecureStore.setItemAsync(key, value, {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});

export const secureDelete = (key: string) => SecureStore.deleteItemAsync(key);

import * as IntentLauncher from "expo-intent-launcher";

export function startAndroidIntent(action: string, options: { data: string; packageName?: string }) {
  return IntentLauncher.startActivityAsync(action, options);
}

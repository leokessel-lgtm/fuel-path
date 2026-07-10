export function startAndroidIntent() {
  return Promise.reject(new Error("Android intents are unavailable on web."));
}

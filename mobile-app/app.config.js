const baseConfig = require("./app.json").expo;

const androidGoogleMapsApiKey = process.env.FUEL_PATH_ANDROID_GOOGLE_MAPS_API_KEY || "";
const easProjectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
  process.env.EAS_PROJECT_ID ||
  baseConfig.extra?.eas?.projectId ||
  "";

const easExtra = easProjectId
  ? {
      eas: {
        ...(baseConfig.extra?.eas || {}),
        projectId: easProjectId,
      },
    }
  : {};

module.exports = ({ config }) => ({
  ...config,
  ...baseConfig,
  plugins: [
    ...(baseConfig.plugins || []),
    "expo-image",
    ...(androidGoogleMapsApiKey
      ? [["react-native-maps", { androidGoogleMapsApiKey }]]
      : []),
  ],
  extra: {
    ...(baseConfig.extra || {}),
    ...easExtra,
    androidGoogleMapsApiKeyConfigured: Boolean(androidGoogleMapsApiKey),
    easProjectIdConfigured: Boolean(easProjectId),
  },
});

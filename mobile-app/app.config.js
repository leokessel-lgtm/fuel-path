const baseConfig = require("./app.json").expo;

const androidGoogleMapsApiKey = process.env.FUEL_PATH_ANDROID_GOOGLE_MAPS_API_KEY || "";

module.exports = ({ config }) => ({
  ...config,
  ...baseConfig,
  plugins: [
    ...(baseConfig.plugins || []),
    ...(androidGoogleMapsApiKey
      ? [["react-native-maps", { androidGoogleMapsApiKey }]]
      : []),
  ],
  extra: {
    ...(baseConfig.extra || {}),
    androidGoogleMapsApiKeyConfigured: Boolean(androidGoogleMapsApiKey),
  },
});

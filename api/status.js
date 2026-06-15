const { methodAllowed, sendJson } = require("./_sample");

module.exports = function handler(req, res) {
  if (!methodAllowed(req, res)) return;
  sendJson(res, 200, {
    api: "fuel-path-vercel-sample",
    credentialsConfigured: false,
    defaultSource: "sample",
    cacheSeconds: 300,
    maps: {
      provider: "osm",
      googleMapsConfigured: false,
      googleDirectionsEnabled: false,
      googleMapsApiKey: "",
    },
    geocoding: {
      activeProvider: "sample",
      activeMode: "public-demo",
      recommendedProductionProvider: "google_places_autocomplete_new",
      requestedProvider: "sample",
      supportedProviders: ["sample"],
      fallbackProvider: "sample",
      backendProxyRequired: true,
      sessionTokenRequired: false,
      googlePlacesConfigured: false,
      mapboxConfigured: false,
    },
  });
};

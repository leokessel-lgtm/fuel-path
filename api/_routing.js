const { providerTimeoutMs, singleFlight } = require("./_providerRuntime");

function createRouting({ fetchJson, googleRoutesApiKey }) {
  function activeRouteProvider() {
    const requested = String(process.env.FUEL_PATH_ROUTE_PROVIDER || "auto").toLowerCase();
    if (requested === "google") return googleRoutesApiKey() ? "google" : "osrm";
    if (requested === "osrm") return "osrm";
    return googleRoutesApiKey() ? "google" : "osrm";
  }

  function routeProviderStatus() {
    const activeProvider = activeRouteProvider();
    const googleRoutesConfigured = Boolean(googleRoutesApiKey());
    const billableRequestsEnabled = activeProvider === "google" && googleRoutesConfigured;
    return {
      activeProvider,
      activeMode: activeProvider === "google" ? "production_candidate" : "validation",
      costMode: billableRequestsEnabled ? "billable_provider_enabled" : "no_cost_validation",
      billableRequestsEnabled,
      requestedProvider: process.env.FUEL_PATH_ROUTE_PROVIDER || "auto",
      supportedProviders: ["google", "osrm"],
      fallbackProvider: "osrm",
      googleRoutesConfigured,
    };
  }

  async function buildRoute({ from, to }) {
    const provider = activeRouteProvider();
    return singleFlight(`route:${provider}:${routePointKey(from)}:${routePointKey(to)}`, () => buildRouteFresh({ from, to, provider }));
  }

  async function buildRouteFresh({ from, to, provider }) {
    if (provider === "google") {
      try {
        return await googleRoute(from, to);
      } catch (error) {
        return await osrmRoute(from, to, {
          providerWarning: `Google Routes unavailable: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
    return osrmRoute(from, to);
  }

  async function googleRoute(from, to) {
    const payload = await fetchJson("https://routes.googleapis.com/directions/v2:computeRoutes", {
      data: {
        origin: { location: { latLng: { latitude: from.lat, longitude: from.lon } } },
        destination: { location: { latLng: { latitude: to.lat, longitude: to.lon } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        units: "METRIC",
        languageCode: "en-AU",
      },
      headers: {
        "X-Goog-Api-Key": googleRoutesApiKey(),
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      timeoutMs: providerTimeoutMs("google_routes", 15000),
    });
    const route = payload?.routes?.[0];
    const points = decodePolyline(route?.polyline?.encodedPolyline || "");
    if (!route || points.length < 2) throw new Error("Google route returned no geometry");
    points[0].label = from.label;
    points[points.length - 1].label = to.label;
    return {
      provider: "google_routes",
      distanceKm: round(Number(route.distanceMeters || 0) / 1000, 2),
      durationMin: round(parseDurationSeconds(route.duration) / 60, 1),
      points,
    };
  }

  async function osrmRoute(from, to, extra = {}) {
    if (!from.lat || !from.lon || !to.lat || !to.lon) {
      throw new Error("fromLat, fromLon, toLat and toLon are required");
    }
    const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${encodeURIComponent(coords).replace(/%3B/g, ";").replace(/%2C/g, ",")}?overview=full&geometries=geojson`;
    const payload = await fetchJson(url, { timeoutMs: providerTimeoutMs("osrm", 20000) });
    const route = payload?.routes?.[0];
    const coordinates = route?.geometry?.coordinates || [];
    if (payload?.code !== "Ok" || coordinates.length < 2) throw new Error(payload?.message || "Route not found");
    const points = coordinates.map(([lon, lat]) => ({ lat: Number(lat), lon: Number(lon) }));
    points[0].label = from.label;
    points[points.length - 1].label = to.label;
    return {
      provider: "osrm",
      providerMode: "validation",
      distanceKm: round(Number(route.distance || 0) / 1000, 2),
      durationMin: round(Number(route.duration || 0) / 60, 1),
      points,
      ...extra,
    };
  }

  return {
    buildRoute,
    routeProviderStatus,
  };
}

function routePointKey(point = {}) {
  const lat = Number(point.lat);
  const lon = Number(point.lon);
  return `${Number.isFinite(lat) ? lat.toFixed(5) : "x"},${Number.isFinite(lon) ? lon.toFixed(5) : "x"}`;
}

function parseDurationSeconds(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  const match = /^([0-9.]+)s$/.exec(String(value));
  return match ? Number(match[1]) : 0;
}

function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < encoded.length) {
    const latitudeResult = decodePolylineChunk(encoded, index);
    lat += latitudeResult.delta;
    index = latitudeResult.index;
    const longitudeResult = decodePolylineChunk(encoded, index);
    lon += longitudeResult.delta;
    index = longitudeResult.index;
    points.push({ lat: lat / 1e5, lon: lon / 1e5 });
  }
  return points;
}

function decodePolylineChunk(encoded, startIndex) {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte;
  do {
    byte = encoded.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20 && index < encoded.length);
  const delta = result & 1 ? ~(result >> 1) : result >> 1;
  return { delta, index };
}

function round(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

module.exports = {
  createRouting,
};

const { addressIndexStatus, searchAddressIndex } = require("./_addressIndex");
const { additionalLocalGeocodeHints } = require("./_geocodeHints");
const { distanceKm } = require("./_geoMath");
const { providerHealth, providerTimeoutMs } = require("./_providerRuntime");
const {
  addressrBaseUrl,
  addressrHeaders,
  geoapifyApiKey,
  googlePlacesApiKey,
  hereApiKey,
  mapboxAccessToken,
} = require("./_providerCredentials");
const {
  RECOMMENDED_GEOCODE_PROVIDER,
  createGeocodeProviderStatus,
  googlePlacesDailyCap,
  googlePlacesMinQueryLength,
  paidGeocodeFallbackEnabled,
  selectGeocodeProvider,
} = require("./_geocodeProviders");
const {
  geocodeQuotaStorageStatus,
  reserveGeocodeQuota,
} = require("./_geocodeQuotaStorage");
const { REGION_ORDER } = require("./_capabilities");
const { regionalLocalGeocode } = require("./_regionalGeocodeHints");

const GEOCODE_CACHE_SECONDS = 60 * 60 * 6;
const GEOCODE_DEGRADED_CACHE_SECONDS = 60;
const GEOCODE_CACHE_MAX_ENTRIES = 500;
const NOMINATIM_RATE_LIMIT_BACKOFF_MS = 60 * 1000;

function createGeocoder({ fetchJson, loadStationData }) {
  function geocodeProviderStatus() {
    return createGeocodeProviderStatus({
      builtInLocalHintCount: LOCAL_GEOCODE_HINTS.length,
      googlePlacesQuotaStorage: geocodeQuotaStorageStatus(),
    });
  }

  const GEOCODE_QUERY_CORRECTIONS = {
    artamon: "artarmon",
  };

  const LOCAL_GEOCODE_HINTS = [
    {
      label: "66B Easton Avenue, Sylvania NSW 2224",
      lat: -34.0114122,
      lon: 151.0993847,
      kind: "address",
      aliases: ["66b eas", "66b east", "easton", "easton ave", "easton avenue sylvania"],
    },
    {
      label: "Sydney Opera House, Bennelong Point NSW 2000",
      lat: -33.8567844,
      lon: 151.2152967,
      kind: "poi",
      aliases: ["opera", "opera house", "sydney opera"],
    },
    {
      label: "Sydney CBD, Sydney NSW",
      lat: -33.8747234,
      lon: 151.2053644,
      kind: "suburb",
      aliases: ["sydney cbd", "cbd sydney", "city sydney"],
    },
    {
      label: "Sydney Harbour Bridge, Sydney NSW",
      lat: -33.8523063,
      lon: 151.2107871,
      kind: "poi",
      aliases: ["harbour bridge", "sydney harbour bridge"],
    },
    {
      label: "Bondi Beach, Bondi NSW 2026",
      lat: -33.8914755,
      lon: 151.2766845,
      kind: "poi",
      aliases: ["bondi", "bondi beach"],
    },
    {
      label: "Sydney Airport, Mascot NSW 2020",
      lat: -33.9399228,
      lon: 151.1752764,
      kind: "airport",
      aliases: ["sydney airport", "kingsford smith airport", "mascot airport"],
    },
    {
      label: "Westfield Parramatta, Parramatta NSW 2150",
      lat: -33.817986,
      lon: 151.001057,
      kind: "poi",
      aliases: ["westfield parramatta", "parramatta westfield"],
    },
    {
      label: "Canberra ACT",
      lat: -35.2975906,
      lon: 149.1012676,
      kind: "city",
      aliases: ["canberra", "canberra act"],
    },
    {
      label: "Canberra Centre, Canberra ACT 2601",
      lat: -35.279341,
      lon: 149.133663,
      kind: "poi",
      aliases: ["canberra centre"],
    },
    {
      label: "Melbourne CBD, Melbourne VIC",
      lat: -37.8136276,
      lon: 144.9630576,
      kind: "city",
      aliases: ["melbourne", "melbourne cbd", "city melbourne"],
    },
    {
      label: "Melbourne Central, Melbourne VIC 3000",
      lat: -37.810064,
      lon: 144.962792,
      kind: "poi",
      aliases: ["melbourne central"],
    },
    {
      label: "Flinders Street Station, Melbourne VIC 3000",
      lat: -37.818305,
      lon: 144.966964,
      kind: "poi",
      aliases: ["flinders street station", "flinders st station"],
    },
    {
      label: "Queen Victoria Market, Melbourne VIC 3000",
      lat: -37.807579,
      lon: 144.956785,
      kind: "poi",
      aliases: ["queen victoria market", "qvm"],
    },
    {
      label: "Melbourne Cricket Ground, East Melbourne VIC 3002",
      lat: -37.819967,
      lon: 144.983449,
      kind: "poi",
      aliases: ["mcg", "melbourne cricket ground"],
    },
    {
      label: "Melbourne Airport, Tullamarine VIC 3045",
      lat: -37.669012,
      lon: 144.841027,
      kind: "airport",
      aliases: ["melbourne airport", "tullamarine airport"],
    },
    {
      label: "Brisbane CBD, Brisbane QLD",
      lat: -27.4697707,
      lon: 153.0251235,
      kind: "city",
      aliases: ["brisbane", "brisbane cbd", "city brisbane"],
    },
    {
      label: "South Bank, Brisbane QLD 4101",
      lat: -27.481079,
      lon: 153.023379,
      kind: "poi",
      aliases: ["south bank brisbane", "southbank brisbane"],
    },
    {
      label: "Queen Street Mall, Brisbane QLD 4000",
      lat: -27.470849,
      lon: 153.024475,
      kind: "poi",
      aliases: ["queen street mall", "queen street mall brisbane"],
    },
    {
      label: "Brisbane Airport, Brisbane Airport QLD 4008",
      lat: -27.384199,
      lon: 153.1175,
      kind: "airport",
      aliases: ["brisbane airport"],
    },
    {
      label: "Perth CBD, Perth WA",
      lat: -31.9523123,
      lon: 115.861309,
      kind: "city",
      aliases: ["perth", "perth cbd", "city perth"],
    },
    {
      label: "Elizabeth Quay, Perth WA 6000",
      lat: -31.958647,
      lon: 115.857494,
      kind: "poi",
      aliases: ["elizabeth quay", "elizabeth quay perth"],
    },
    {
      label: "Perth Airport, Perth Airport WA 6105",
      lat: -31.940299,
      lon: 115.966904,
      kind: "airport",
      aliases: ["perth airport"],
    },
    {
      label: "Adelaide CBD, Adelaide SA",
      lat: -34.9284989,
      lon: 138.6007456,
      kind: "city",
      aliases: ["adelaide", "adelaide cbd", "city adelaide"],
    },
    {
      label: "Rundle Mall, Adelaide SA 5000",
      lat: -34.922776,
      lon: 138.602686,
      kind: "poi",
      aliases: ["rundle mall", "rundle mall adelaide"],
    },
    {
      label: "Adelaide Airport, Adelaide Airport SA 5950",
      lat: -34.945,
      lon: 138.530556,
      kind: "airport",
      aliases: ["adelaide airport"],
    },
    {
      label: "Hobart CBD, Hobart TAS",
      lat: -42.8821377,
      lon: 147.3271949,
      kind: "city",
      aliases: ["hobart", "hobart cbd", "city hobart"],
    },
    {
      label: "Salamanca Market, Hobart TAS 7000",
      lat: -42.886438,
      lon: 147.33174,
      kind: "poi",
      aliases: ["salamanca market", "salamanca hobart"],
    },
    {
      label: "Hobart Airport, Cambridge TAS 7170",
      lat: -42.836111,
      lon: 147.510278,
      kind: "airport",
      aliases: ["hobart airport"],
    },
    {
      label: "Darwin CBD, Darwin NT",
      lat: -12.46344,
      lon: 130.845642,
      kind: "city",
      aliases: ["darwin", "darwin cbd", "city darwin"],
    },
    {
      label: "Darwin Waterfront, Darwin NT 0800",
      lat: -12.466762,
      lon: 130.846361,
      kind: "poi",
      aliases: ["darwin waterfront", "waterfront darwin"],
    },
    {
      label: "Darwin Airport, Eaton NT 0820",
      lat: -12.414722,
      lon: 130.876667,
      kind: "airport",
      aliases: ["darwin airport"],
    },
  ];

  const ALL_LOCAL_GEOCODE_HINTS = [...LOCAL_GEOCODE_HINTS, ...additionalLocalGeocodeHints()];
  const LIVE_GEOCODE_REGION_CODES = ["NSW", "ACT", "QLD", "WA", "SA"];
  const geocodeCache = new Map();
  let nominatimBlockedUntilMs = 0;

  const STREET_QUERY_PATTERN = /^(.+\b(?:street|st|road|rd|avenue|ave|drive|dr|parade|pde|place|pl|lane|ln|way|crescent|cres)\b)\b.*$/i;
  const PARTIAL_STREET_QUERY_PATTERN = /^(\d+[a-z]?\s+[a-z][a-z\s'-]{2,})$/i;
  const STREET_TYPE_EXPANSIONS = ["street", "road", "avenue", "drive", "parade", "place", "lane", "way"];
  const STATION_QUERY_TERMS = [
    "7 eleven",
    "ampol",
    "bp",
    "caltex",
    "coles express",
    "eg",
    "fuel",
    "metro",
    "mobil",
    "petrol",
    "reddy",
    "service station",
    "servo",
    "shell",
    "united",
    "woolworths",
  ];
  const NON_LOCALITY_QUERY_SUFFIXES = new Set([
    "airport",
    "arena",
    "beach",
    "centre",
    "center",
    "hospital",
    "interchange",
    "mall",
    "market",
    "park",
    "parkland",
    "stadium",
    "station",
    "wharf",
    "zoo",
  ]);

  function geocodeQueryVariants(query) {
    const cleaned = String(query || "").trim().replace(/\s+/g, " ").replace(/\.+$/, "");
    const variants = [cleaned];
    const upperCleaned = cleaned.toUpperCase();
    const detectedStateCodes = LIVE_GEOCODE_REGION_CODES.filter((code) =>
      new RegExp(`\\b${code}\\b`, "i").test(upperCleaned),
    );
    const targetStateCodes = detectedStateCodes.length ? detectedStateCodes : LIVE_GEOCODE_REGION_CODES;
    let corrected = cleaned;
    for (const [typo, replacement] of Object.entries(GEOCODE_QUERY_CORRECTIONS)) {
      corrected = corrected.replace(new RegExp(`\\b${typo}\\b`, "gi"), replacement);
    }
    if (corrected !== cleaned) variants.push(corrected);
    for (const value of [...variants]) {
      const match = STREET_QUERY_PATTERN.exec(value);
      if (match) {
        const streetOnly = match[1].trim();
        variants.push(streetOnly);
        for (const code of targetStateCodes) {
          variants.push(`${streetOnly} ${code}`);
        }
      }
    }
    if (PARTIAL_STREET_QUERY_PATTERN.test(cleaned) && !STREET_QUERY_PATTERN.test(cleaned)) {
      for (const type of STREET_TYPE_EXPANSIONS) {
        for (const code of targetStateCodes) {
          variants.push(`${cleaned} ${type} ${code}`);
        }
      }
    }
    for (const code of targetStateCodes) {
      variants.push(`${cleaned} ${code}`);
    }
    variants.push(`${cleaned} Australia`);
    return [...new Set(variants.filter(Boolean).map((value) => value.trim()))].slice(0, 16);
  }

  function geocodeItemPayload({ label, lat, lon, provider, kind = "place", providerId = "", ...extra }) {
    return {
      label,
      lat: Number(lat),
      lon: Number(lon),
      type: kind,
      provider,
      ...(providerId ? { providerId } : {}),
      ...extra,
    };
  }

  async function nominatimGeocode(query, limit) {
    if (Date.now() < nominatimBlockedUntilMs) {
      throw new Error("Validation geocoder is cooling down after rate limiting");
    }
    const suggestions = [];
    const seen = new Set();
    for (const candidateQuery of geocodeQueryVariants(query)) {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", candidateQuery);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("countrycodes", "au");
      url.searchParams.set("addressdetails", "1");
      let payload;
      try {
        payload = await fetchJson(url.toString(), { timeoutMs: providerTimeoutMs("nominatim", 12000) });
      } catch (error) {
        if (isRateLimitError(error)) {
          nominatimBlockedUntilMs = Date.now() + NOMINATIM_RATE_LIMIT_BACKOFF_MS;
        }
        throw error;
      }
      if (Array.isArray(payload) && payload.length) {
        for (const item of payload) {
          const suggestion = geocodeItemPayload({
            label: String(item.display_name || item.name || candidateQuery),
            lat: item.lat,
            lon: item.lon,
            kind: String(item.type || item.class || "place"),
            provider: "nominatim",
            providerId: `${item.osm_type || ""}:${item.osm_id || ""}`,
          });
          const key = geocodeSuggestionKey(suggestion);
          if (!seen.has(key)) {
            suggestions.push(suggestion);
            seen.add(key);
          }
          if (suggestions.length >= limit) return suggestions;
        }
      }
    }
    if (!suggestions.length) throw new Error(`No location found for ${query}`);
    return suggestions;
  }

  async function localStationGeocode(query, limit) {
    const needle = normaliseSearchText(query);
    if (needle.length < 3) return [];
    try {
      const data = await loadStationData({ requestedSource: "auto", points: [], radiusKm: 0 });
      const scored = [];
      for (const station of data.stations || []) {
        const haystack = normaliseSearchText(
          [station.name, station.brand, station.suburb, station.address].filter(Boolean).join(" "),
        );
        if (!haystack.includes(needle)) continue;
        const name = String(station.name || station.brand || "Fuel station");
        const suburb = station.suburb ? `, ${station.suburb}` : "";
        const address = station.address ? ` - ${station.address}` : "";
        scored.push({
          score: haystack.startsWith(needle) ? 0 : haystack.indexOf(needle),
          item: geocodeItemPayload({
            label: `${name}${suburb}${address}`,
            lat: station.lat,
            lon: station.lon,
            kind: "fuel_station",
            provider: "fuel_path",
            providerId: String(station.stationCode || ""),
          }),
        });
      }
      return scored
        .sort((left, right) => left.score - right.score || left.item.label.length - right.item.label.length)
        .slice(0, limit)
        .map((row) => row.item);
    } catch {
      return [];
    }
  }

  function localHintGeocode(query, limit) {
    const needles = localHintSearchNeedles(query);
    const needle = needles[0] || "";
    if (needle.length < 3) return [];
    const queryStateCode = detectStateCode(query);
    const queryLocality = detectQueryLocality(query);
    const addressLikeStreetQuery = looksLikeAddressStreetQuery(query);
    const cityLevelLocality = queryStateCode === "ACT" && queryLocality === "canberra";
    return ALL_LOCAL_GEOCODE_HINTS.map((hint) => {
      if (queryStateCode && hintStateCode(hint) && hintStateCode(hint) !== queryStateCode) return null;
      if (addressLikeStreetQuery && hint.kind === "street" && !queryLocality && !queryHasPostcode(query)) return null;
      if (!cityLevelLocality && queryLocality && hintLocality(hint) && !localityMatches(queryLocality, hintLocality(hint))) return null;
      const texts = [hint.label, ...(hint.aliases || [])].map(normaliseSearchText);
      if (hint.kind === "street" && isAmbiguousStreetHintQuery(query, queryLocality, queryStateCode, texts)) return null;
      const match = localHintMatch(needles, texts, hint.kind);
      if (!match) return null;
      const bestIndex = Math.min(...needles.flatMap((searchNeedle) => texts.map((value) => localHintBestIndex(searchNeedle, value))));
      return {
        score: match.score + bestIndex,
        item: geocodeItemPayload({
          label: hint.label,
          lat: hint.lat,
          lon: hint.lon,
          kind: hint.kind,
          provider: "fuel_path_hint",
          providerId: normaliseSearchText(hint.label),
          confidence: match.confidence,
          matchType: match.matchType,
          source: "local_geocode_hints",
        }),
      };
    })
      .filter(Boolean)
      .sort((left, right) => left.score - right.score || left.item.label.length - right.item.label.length)
      .slice(0, limit)
      .map((row) => row.item);
  }

  function detectStateCode(value) {
    const text = String(value || "").toUpperCase();
    return REGION_ORDER.find((code) => new RegExp(`\\b${code}\\b`).test(text)) || "";
  }

  function hintStateCode(hint) {
    return detectStateCode(hint?.label || "");
  }

  function hintLocality(hint) {
    return extractLabelLocality(hint?.label || "");
  }

  function detectQueryLocality(query) {
    const text = String(query || "").trim().replace(/\s+/g, " ");
    const streetMatch = /\b(?:street|st|road|rd|avenue|ave|drive|dr|parade|pde|place|pl|terrace|highway|mall|court|close|vista|circuit|way|lane|ln)\b\s+(.+?)(?:\s+\b(NSW|ACT|QLD|WA|VIC|SA|TAS|NT)\b|\s*$)/i.exec(text);
    if (streetMatch?.[1]) {
      const locality = normaliseSearchText(streetMatch[1]);
      if (locality.length < 3) return "";
      return NON_LOCALITY_QUERY_SUFFIXES.has(locality) ? "" : locality;
    }
    return "";
  }

  function looksLikeAddressStreetQuery(query) {
    const text = String(query || "").trim();
    return /^(?:unit|apt|apartment|flat|suite|townhouse)?\s*\d+[a-z]?(?:\/\d+[a-z]?)?\s+.+\b(?:street|st|road|rd|avenue|ave|drive|dr|parade|pde|place|pl|terrace|highway|mall|court|close|vista|circuit|way|lane|ln)\b/i.test(text);
  }

  function isAmbiguousStreetHintQuery(query, queryLocality, queryStateCode, hintTexts = []) {
    const text = String(query || "").trim();
    if (queryStateCode && !hasExplicitUppercaseStateCode(text)) return true;
    if (queryStateCode || queryLocality || queryHasPostcode(query)) return false;
    if (/\b(?:street|st|road|rd|avenue|ave|drive|dr|parade|pde|place|pl|terrace|highway|mall|court|close|vista|circuit|way|lane|ln)\b/i.test(text)) return true;
    const needle = normaliseSearchText(text);
    return needle.length >= 3 && hintTexts.some((value) => value.startsWith(needle));
  }

  function hasExplicitUppercaseStateCode(value) {
    return /\b(NSW|ACT|QLD|WA|VIC|SA|TAS|NT)\b/.test(String(value || ""));
  }

  function queryHasPostcode(query) {
    return /\b\d{4}\b/.test(String(query || ""));
  }

  function extractLabelLocality(label) {
    const text = String(label || "").trim();
    const commaParts = text.split(",").map((part) => part.trim()).filter(Boolean);
    if (commaParts.length >= 2) {
      const withState = commaParts.find((part) => /\b(NSW|ACT|QLD|WA|VIC|SA|TAS|NT)\b/i.test(part));
      if (withState) return normaliseSearchText(withState.replace(/\b(NSW|ACT|QLD|WA|VIC|SA|TAS|NT)\b.*$/i, ""));
    }
    const stateMatch = /,\s*([^,]+?)\s+\b(NSW|ACT|QLD|WA|VIC|SA|TAS|NT)\b/i.exec(text) || /\b([A-Za-z][A-Za-z\s'.-]+?)\s+\b(NSW|ACT|QLD|WA|VIC|SA|TAS|NT)\b/i.exec(text);
    return stateMatch?.[1] ? normaliseSearchText(stateMatch[1]) : "";
  }

  function localityMatches(left, right) {
    if (!left || !right) return true;
    return left === right || left.includes(right) || right.includes(left);
  }

  function localHintBestIndex(needle, value) {
    const directIndex = value.indexOf(needle);
    if (directIndex >= 0) return directIndex;
    const reverseIndex = needle.indexOf(value);
    return reverseIndex >= 0 ? reverseIndex : 999;
  }

  function localHintSearchNeedles(query) {
    const needle = normaliseSearchText(query);
    let corrected = needle;
    for (const [typo, replacement] of Object.entries(GEOCODE_QUERY_CORRECTIONS)) {
      corrected = corrected.replace(new RegExp(`\\b${typo}\\b`, "gi"), replacement);
    }
    const withoutState = stripTerminalStateCode(needle);
    const correctedWithoutState = stripTerminalStateCode(corrected);
    return [...new Set([needle, corrected, withoutState, correctedWithoutState].filter((value) => value.length >= 3))];
  }

  function stripTerminalStateCode(value) {
    return String(value || "").replace(/\b(nsw|act|qld|wa|vic|sa|tas|nt)\b$/i, "").trim();
  }

  function localHintMatch(needles, texts, kind) {
    let best = null;
    for (const needle of needles) {
      for (const value of texts) {
        const candidate = localHintTextMatch(needle, value, kind);
        if (!candidate) continue;
        if (!best || candidate.score < best.score) best = candidate;
      }
    }
    return best;
  }

  function localHintTextMatch(needle, value, kind) {
    if (!value) return null;
    if (needle === value) {
      return { matchType: "exact_hint", confidence: "medium", score: 0 };
    }
    if (value.startsWith(needle)) {
      return { matchType: "hint_prefix", confidence: "medium", score: 10 };
    }
    if (value.includes(needle)) {
      return { matchType: "hint_contains", confidence: "medium", score: 20 };
    }
    if (kind === "city") return null;
    if (value.length >= 6 && needle.includes(value)) {
      return { matchType: "fallback_area", confidence: "low", score: 40 - Math.min(value.length, 40) / 10 };
    }
    return null;
  }

  function hasStrongLocalSuggestion(suggestions) {
    return suggestions.some(
      (item) =>
        isStrongLocalHintSuggestion(item) ||
        isStrongRegionalSuggestion(item) ||
        (item.provider === "fuel_path_gnaf" &&
          item.type === "address" &&
          ["exact_address", "address_prefix"].includes(item.matchType)),
    );
  }

  function isStrongLocalHintSuggestion(item) {
    return (
      item.provider === "fuel_path_hint" &&
      ["exact_hint", "hint_prefix"].includes(item.matchType) &&
      !["street", "address"].includes(item.type)
    );
  }

  function isStrongRegionalSuggestion(item) {
    return (
      item.provider === "fuel_path_regional_gazetteer" &&
      ["regional_exact", "regional_prefix"].includes(item.matchType) &&
      item.type !== "street"
    );
  }

  function normaliseSearchText(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function round(value, decimals = 0) {
    const factor = 10 ** decimals;
    return Math.round(Number(value) * factor) / factor;
  }

  function geocodeSuggestionKey(item) {
    return `${Math.round(Number(item.lat) * 100000)}:${Math.round(Number(item.lon) * 100000)}:${normaliseSearchText(item.label).slice(0, 48)}`;
  }

  async function googlePlaceDetails(placeId, sessionToken) {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    if (sessionToken) url.searchParams.set("sessionToken", sessionToken);
    const payload = await fetchJson(url.toString(), {
      headers: {
        "X-Goog-Api-Key": googlePlacesApiKey(),
        "X-Goog-FieldMask": "id,displayName,formattedAddress,location,types",
      },
      timeoutMs: providerTimeoutMs("google_places", 12000),
    });
    const location = payload?.location || {};
    if (location.latitude === undefined || location.longitude === undefined) return null;
    return geocodeItemPayload({
      label: String(payload.formattedAddress || payload.displayName?.text || placeId),
      lat: location.latitude,
      lon: location.longitude,
      kind: (payload.types || []).join(",") || "place",
      provider: "google",
      providerId: String(payload.id || placeId),
    });
  }

  async function googleGeocode(query, limit, sessionToken) {
    await assertGooglePlacesFallbackAllowed(query, sessionToken);
    const payload = await fetchJson("https://places.googleapis.com/v1/places:autocomplete", {
      data: {
        input: query,
        sessionToken,
        includedRegionCodes: ["au"],
        languageCode: "en-AU",
      },
      headers: {
        "X-Goog-Api-Key": googlePlacesApiKey(),
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.types",
      },
      timeoutMs: providerTimeoutMs("google_places", 12000),
    });
    const suggestions = [];
    for (const item of payload?.suggestions || []) {
      const placeId = item?.placePrediction?.placeId;
      if (!placeId) continue;
      const details = await googlePlaceDetails(String(placeId), sessionToken);
      if (details) suggestions.push(details);
      if (suggestions.length >= limit) break;
    }
    if (!suggestions.length) throw new Error(`No location found for ${query}`);
    return suggestions;
  }

  async function assertGooglePlacesFallbackAllowed(query, sessionToken) {
    if (!paidGeocodeFallbackEnabled()) {
      throw new Error("Google Places fallback is disabled by cost controls");
    }
    if (!sessionToken) {
      throw new Error("Google Places fallback requires a session token");
    }
    if (normaliseSearchText(query).length < googlePlacesMinQueryLength()) {
      throw new Error("Google Places fallback query is too short");
    }
    const today = new Date().toISOString().slice(0, 10);
    const cap = googlePlacesDailyCap();
    if (productionRuntime() && !geocodeQuotaStorageStatus().durable) {
      throw new Error("Google Places fallback requires durable quota storage in production");
    }
    const quota = await reserveGeocodeQuota({
      quotaKey: "google_places_fallback",
      date: today,
      cap,
    });
    if (!quota.allowed) {
      throw new Error("Google Places daily fallback cap reached");
    }
  }

  async function mapboxGeocode(query, limit) {
    const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
    url.searchParams.set("q", query);
    url.searchParams.set("country", "au");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("autocomplete", "true");
    url.searchParams.set("access_token", mapboxAccessToken());
    const payload = await fetchJson(url.toString(), { timeoutMs: providerTimeoutMs("mapbox", 12000) });
    const suggestions = [];
    for (const feature of payload?.features || []) {
      const coordinates = feature?.geometry?.coordinates || [];
      if (coordinates.length < 2) continue;
      const properties = feature.properties || {};
      suggestions.push(
        geocodeItemPayload({
          label: String(properties.full_address || properties.name_preferred || properties.name || feature.place_name || query),
          lat: coordinates[1],
          lon: coordinates[0],
          kind: String(properties.feature_type || "place"),
          provider: "mapbox",
          providerId: String(properties.mapbox_id || feature.id || ""),
        }),
      );
    }
    if (!suggestions.length) throw new Error(`No location found for ${query}`);
    return suggestions;
  }

  async function hereGeocode(query, limit) {
    const url = new URL("https://autosuggest.search.hereapi.com/v1/autosuggest");
    url.searchParams.set("q", query);
    url.searchParams.set("at", "-33.8688,151.2093");
    url.searchParams.set("in", "countryCode:AUS");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("apiKey", hereApiKey());
    const payload = await fetchJson(url.toString(), { timeoutMs: providerTimeoutMs("here", 12000) });
    const suggestions = [];
    for (const item of payload?.items || []) {
      const position = item.position || {};
      if (position.lat === undefined || position.lng === undefined) continue;
      suggestions.push(
        geocodeItemPayload({
          label: String(item.title || item.address?.label || query),
          lat: position.lat,
          lon: position.lng,
          kind: String(item.resultType || "place"),
          provider: "here",
          providerId: String(item.id || ""),
        }),
      );
    }
    if (!suggestions.length) throw new Error(`No location found for ${query}`);
    return suggestions;
  }

  async function geoapifyGeocode(query, limit) {
    const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
    url.searchParams.set("text", query);
    url.searchParams.set("filter", "countrycode:au");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("apiKey", geoapifyApiKey());
    const payload = await fetchJson(url.toString(), { timeoutMs: providerTimeoutMs("geoapify", 12000) });
    const items = Array.isArray(payload?.features) ? payload.features : Array.isArray(payload?.results) ? payload.results : [];
    const suggestions = [];
    for (const item of items) {
      const properties = item.properties || item;
      const coordinates = item.geometry?.coordinates || [];
      const lat = properties.lat ?? coordinates[1];
      const lon = properties.lon ?? coordinates[0];
      if (lat === undefined || lon === undefined) continue;
      suggestions.push(
        geocodeItemPayload({
          label: String(properties.formatted || properties.address_line1 || query),
          lat,
          lon,
          kind: String(properties.result_type || "place"),
          provider: "geoapify",
          providerId: String(properties.place_id || ""),
        }),
      );
    }
    if (!suggestions.length) throw new Error(`No location found for ${query}`);
    return suggestions;
  }

  async function addressrGeocode(query, limit) {
    const baseUrl = addressrBaseUrl();
    if (!baseUrl) throw new Error("Addressr geocoding is not configured");
    const searchUrl = new URL("/addresses", baseUrl);
    searchUrl.searchParams.set("q", query);
    const payload = await fetchJson(searchUrl.toString(), {
      headers: addressrHeaders(),
      timeoutMs: providerTimeoutMs("addressr", 12000),
    });
    const items = Array.isArray(payload) ? payload : Array.isArray(payload?.addresses) ? payload.addresses : [];
    const suggestions = [];
    for (const item of items.slice(0, Math.max(1, Math.min(Number(limit) || 5, 10)))) {
      const details = await addressrAddressDetails(item, baseUrl);
      if (details) suggestions.push(details);
      if (suggestions.length >= limit) break;
    }
    if (!suggestions.length) throw new Error(`No location found for ${query}`);
    return suggestions;
  }

  async function addressrAddressDetails(item, baseUrl) {
    const href = item?.links?.self?.href || item?._links?.self?.href || "";
    const fallbackLabel = item?.sla || item?.label || "";
    if (!href) return null;
    const detailUrl = new URL(href, baseUrl);
    const payload = await fetchJson(detailUrl.toString(), {
      headers: addressrHeaders(),
      timeoutMs: providerTimeoutMs("addressr", 12000),
    });
    const geocodes = Array.isArray(payload?.geo?.geocodes) ? payload.geo.geocodes : [];
    const defaultGeocode = geocodes.find((geocode) => geocode.default) || geocodes[0] || {};
    const lat = defaultGeocode.latitude ?? defaultGeocode.lat;
    const lon = defaultGeocode.longitude ?? defaultGeocode.lon;
    if (lat === undefined || lon === undefined) return null;
    const structured = payload?.structured || {};
    return geocodeItemPayload({
      label: formatAddressrLabel(payload.sla || fallbackLabel || payload.pid || href),
      lat,
      lon,
      kind: "address",
      provider: "addressr",
      providerId: String(payload.pid || href.split("/").pop() || href),
      matchType: "addressr_address",
      score: Number(item?.score || 800),
      state: structured.state?.abbreviation,
      postcode: structured.postcode,
      accuracy: defaultGeocode.reliability?.name || defaultGeocode.type?.name || "addressr_gnaf",
    });
  }

  function formatAddressrLabel(value) {
    return titleCase(value).replace(/\b(Nsw|Act|Nt|Qld|Sa|Tas|Vic|Wa|Ot)\b/g, (match) => match.toUpperCase());
  }

  async function geocode({ query, limit, sessionToken, provider, searchContext }) {
    const selectedProvider = selectGeocodeProvider(provider || process.env.FUEL_PATH_GEOCODE_PROVIDER || "auto");
    const addressIndex = addressIndexStatus();
    const safeSearchContext = normaliseSearchContext(searchContext);
    const cacheKey = geocodeCacheKey({ provider: selectedProvider, query, limit, addressIndex, searchContext: safeSearchContext });
    const cached = readGeocodeCache(cacheKey);
    if (cached) {
      const cachedCacheMode = cached.lookupStatus === "ok" ? "fresh" : geocodeCacheMode(cached.lookupStatus);
      return {
        ...cached,
        cache: "hit",
        cacheMode: cachedCacheMode,
        providerHealth: geocodeProviderHealth(cached.provider, cached.lookupStatus, cached.warning, cachedCacheMode),
        degraded: cached.lookupStatus !== "ok",
        sessionToken,
      };
    }
    const addressLookupLimit = safeSearchContext ? Math.max(limit * 4, 20) : limit;
    const addressSuggestions = await searchAddressIndex(query, addressLookupLimit, { searchContext: safeSearchContext });
    const hintSuggestions = localHintGeocode(query, limit);
    const strongHintSuggestions = hintSuggestions.filter(isStrongLocalHintSuggestion);
    const weakHintSuggestions = hintSuggestions.filter((item) => !isStrongLocalHintSuggestion(item));
    const stationSuggestions =
      !stationGeocodeDisabled() && selectedProvider === "nominatim" && looksLikeStationQuery(query)
        ? await localStationGeocode(query, limit)
        : [];
    const localSuggestions = rankLocalSuggestions(
      query,
      [
        ...addressSuggestions,
        ...strongHintSuggestions,
        ...regionalLocalGeocode(query, limit),
        ...weakHintSuggestions,
        ...stationSuggestions,
      ],
      limit,
      safeSearchContext,
    );
    let providerSuggestions = [];
    let providerWarning = "";
    if (!hasExactAddressSuggestion(addressSuggestions) && !hasStrongLocalSuggestion(localSuggestions)) {
      try {
        providerSuggestions =
          selectedProvider === "google"
            ? await googleGeocode(query, limit, sessionToken)
            : selectedProvider === "addressr"
              ? await addressrGeocode(query, limit)
              : selectedProvider === "mapbox"
                ? await mapboxGeocode(query, limit)
                : selectedProvider === "here"
                  ? await hereGeocode(query, limit)
                  : selectedProvider === "geoapify"
                    ? await geoapifyGeocode(query, limit)
                    : await nominatimGeocode(query, limit);
      } catch (error) {
        providerWarning = geocodeProviderWarning(error, selectedProvider);
      }
    }
    const suggestions =
      selectedProvider === "nominatim"
        ? mergeGeocodeSuggestions([...localSuggestions, ...providerSuggestions], limit)
        : mergeGeocodeSuggestions([...addressSuggestions, ...providerSuggestions, ...localSuggestions], limit);
    const lookupStatus = suggestions.length
      ? providerWarning
        ? "local_fallback"
        : "ok"
      : providerWarning
        ? "degraded"
        : "no_match";
    const payload = {
      provider: selectedProvider,
      providerMode: selectedProvider === "nominatim" ? "validation" : "production_candidate",
      recommendedProductionProvider: RECOMMENDED_GEOCODE_PROVIDER,
      requestedProvider: provider || process.env.FUEL_PATH_GEOCODE_PROVIDER || "auto",
      sessionToken,
      query,
      ...(safeSearchContext ? { searchContext: safeSearchContext } : {}),
      location: suggestions[0] || null,
      suggestions,
      lookupStatus,
      cache: "miss",
      cacheMode: geocodeCacheMode(lookupStatus),
      providerHealth: geocodeProviderHealth(selectedProvider, lookupStatus, providerWarning, geocodeCacheMode(lookupStatus)),
      degraded: lookupStatus !== "ok",
      ...(providerWarning ? { warning: providerWarning } : {}),
    };
    writeGeocodeCache(cacheKey, payload, lookupStatus === "ok" || lookupStatus === "local_fallback");
    return payload;
  }

  function stationGeocodeDisabled() {
    return process.env.FUEL_PATH_DISABLE_STATION_GEOCODE === "1";
  }

  function geocodeCacheKey({ provider, query, limit, addressIndex, searchContext }) {
    return `${provider}:${limit}:${addressIndexSignature(addressIndex)}:${searchContextSignature(searchContext)}:${explicitStateCodeSignature(query)}:${normaliseSearchText(query)}`;
  }

  function addressIndexSignature(status) {
    if (!status?.configured) return "address-index:disabled";
    return [
      "address-index",
      status.mode || "unknown",
      status.apiConfigured ? "api" : "",
      status.postgresConfigured ? "postgres" : "",
      status.sqliteConfigured ? "sqlite" : "",
      `seed:${status.seedRecords || 0}`,
    ].filter(Boolean).join(":");
  }

  function explicitStateCodeSignature(query) {
    return hasExplicitUppercaseStateCode(query) ? "state:explicit" : "state:typed";
  }

  function hasExactAddressSuggestion(suggestions) {
    return suggestions.some(
      (item) => item.provider === "fuel_path_gnaf" && item.matchType === "exact_address",
    );
  }

  function readGeocodeCache(key) {
    const entry = geocodeCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      geocodeCache.delete(key);
      return null;
    }
    return entry.payload;
  }

  function writeGeocodeCache(key, payload, durable) {
    geocodeCache.set(key, {
      expiresAt: Date.now() + (durable ? GEOCODE_CACHE_SECONDS : GEOCODE_DEGRADED_CACHE_SECONDS) * 1000,
      payload,
    });
    trimGeocodeCache();
  }

  function trimGeocodeCache() {
    const maxEntries = geocodeCacheMaxEntries();
    while (geocodeCache.size > maxEntries) {
      const oldestKey = geocodeCache.keys().next().value;
      if (!oldestKey) break;
      geocodeCache.delete(oldestKey);
    }
  }

  function geocodeCacheMaxEntries() {
    const parsed = Number(process.env.FUEL_PATH_GEOCODE_CACHE_MAX_ENTRIES);
    if (!Number.isFinite(parsed)) return GEOCODE_CACHE_MAX_ENTRIES;
    return Math.max(1, Math.min(5000, Math.round(parsed)));
  }

  function geocodeCacheMode(lookupStatus) {
    if (lookupStatus === "ok") return "refreshed";
    if (lookupStatus === "local_fallback") return "local_fallback";
    if (lookupStatus === "degraded") return "degraded";
    if (lookupStatus === "no_match") return "no_match";
    return "none";
  }

  function isRateLimitError(error) {
    return String(error?.message || error).includes("429");
  }

  function geocodeProviderHealth(provider, lookupStatus, warning = "", cacheMode = "none") {
    const status = lookupStatus === "ok"
      ? "ok"
      : lookupStatus === "degraded"
        ? "unavailable"
        : "degraded";
    return providerHealth(provider || "geocode", {
      status,
      cacheMode,
      cacheAgeSeconds: cacheMode === "fresh" ? 0 : null,
      error: lookupStatus === "degraded" ? warning : "",
      warning,
    });
  }

  function geocodeProviderWarning(error, provider) {
    const message = String(error?.message || error || "");
    if (isRateLimitError(error) || /cooling down|rate limit/i.test(message)) {
      return `${provider} lookup is temporarily rate-limited. Try a fuller address, suburb or postcode, or enable a production autocomplete provider.`;
    }
    if (/abort|timeout/i.test(message)) {
      return `${provider} lookup timed out. Try a fuller address, suburb or postcode.`;
    }
    if (/No location found/i.test(message)) {
      return `No strong location match found. Try a fuller address, suburb or postcode.`;
    }
    if (/disabled by cost controls/i.test(message)) {
      return "Google Places fallback is disabled. Try a fuller address, suburb or exact street address.";
    }
    if (/session token/i.test(message)) {
      return "Google Places fallback is blocked until the app supplies a session token. Try a fuller address, suburb or exact street address.";
    }
    if (/too short/i.test(message)) {
      return "Google Places fallback needs more characters before it can search.";
    }
    if (/daily fallback cap/i.test(message)) {
      return "Google Places fallback is paused because today's lookup cap has been reached.";
    }
    if (/durable quota storage/i.test(message)) {
      return "Google Places fallback is paused until durable quota storage is configured.";
    }
    return `${provider} lookup is temporarily unavailable. Try a fuller address, suburb or postcode.`;
  }

  function productionRuntime() {
    return process.env.VERCEL_ENV === "production" ||
      process.env.NODE_ENV === "production" ||
      process.env.FUEL_PATH_PRODUCTION_HARDENING === "1";
  }

  function looksLikeStationQuery(query) {
    const needle = normaliseSearchText(query);
    if (needle.length < 3) return false;
    return STATION_QUERY_TERMS.some((term) => {
      const normalisedTerm = normaliseSearchText(term);
      return needle === normalisedTerm || needle.includes(normalisedTerm);
    });
  }

  function mergeGeocodeSuggestions(items, limit) {
    const merged = [];
    const seen = new Set();
    for (const item of items) {
      const key = geocodeSuggestionKey(item);
      if (seen.has(key)) continue;
      merged.push(item);
      seen.add(key);
      if (merged.length >= limit) break;
    }
    return merged;
  }

  function rankLocalSuggestions(query, items, limit, searchContext = null) {
    return items
      .map((item, index) => ({
        item,
        index,
        score: localSuggestionRank(query, item, searchContext),
      }))
      .sort((left, right) =>
        left.score - right.score ||
        left.item.label.length - right.item.label.length ||
        left.index - right.index,
      )
      .map((row) => row.item)
      .reduce((merged, item) => {
        if (merged.length >= limit) return merged;
        const key = geocodeSuggestionKey(item);
        if (merged.some((existing) => geocodeSuggestionKey(existing) === key)) return merged;
        merged.push(item);
        return merged;
      }, []);
  }

  function localSuggestionRank(query, item, searchContext = null) {
    const needle = normaliseSearchText(query);
    const label = normaliseSearchText(item?.label || "");
    const queryStateCode = detectStateCode(query);
    const refineRequired = Boolean(item?.refineRequired || item?.matchType === "building_refine");
    const unitIntent = unitIntentConfidence(query);
    let score = localMatchTypeRank(item?.matchType);
    if (item?.provider === "fuel_path_gnaf") score -= item.matchType === "exact_address" ? 80 : 50;
    if (queryStateCode && detectStateCode(item?.label || "") !== queryStateCode) score += 12;
    if (label === needle) score -= 36;
    else if (label.startsWith(needle)) score -= 18;
    else if (label.includes(needle)) score -= 4;
    if (!refineRequired && unitIntent === "specific" && labelMatchesUnitIntent(query, item?.label)) score -= 35;
    if (refineRequired && unitIntent !== "specific" && !isNumberFirstAddressQuery(needle)) score -= 55;
    if (refineRequired && unitIntent === "specific") score += 45;
    if (item?.provider === "fuel_path_regional_gazetteer" && item?.type === "regional_town" && !hasPlaceIntent(needle)) {
      score -= 10;
    }
    const regionalPoiNameMatch = regionalPoiNameMatches(needle, item);
    if (item?.provider === "fuel_path_regional_gazetteer" && item?.type === "regional_poi" && !hasPlaceIntent(needle) && !regionalPoiNameMatch) {
      score += 10;
    }
    if (regionalPoiNameMatch) score -= 75;
    if (placeIntentMatches(needle, item)) score -= 14;
    if (hasPlaceIntent(needle) && isBroadAreaSuggestion(item) && !placeIntentMatches(needle, item)) score += 10;
    score -= searchContextBoost(item, searchContext);
    return score;
  }

  function normaliseSearchContext(value = {}) {
    if (!value) return null;
    const lat = Number(value.nearLat);
    const lon = Number(value.nearLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const radiusKm = Number(value.nearRadiusKm);
    return {
      nearLat: round(lat, 5),
      nearLon: round(lon, 5),
      nearRadiusKm: Math.max(2, Math.min(300, Number.isFinite(radiusKm) ? radiusKm : 40)),
    };
  }

  function searchContextSignature(searchContext) {
    if (!searchContext) return "context:none";
    return [
      "context",
      searchContext.nearLat.toFixed(3),
      searchContext.nearLon.toFixed(3),
      Math.round(searchContext.nearRadiusKm),
    ].join(":");
  }

  function searchContextBoost(item, searchContext) {
    if (!searchContext || item?.provider !== "fuel_path_gnaf") return 0;
    const lat = Number(item?.lat);
    const lon = Number(item?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 0;
    const distance = distanceKm({ lat, lon }, { lat: searchContext.nearLat, lon: searchContext.nearLon });
    if (!Number.isFinite(distance)) return 0;
    const radius = searchContext.nearRadiusKm;
    if (distance <= radius) return 14 + Math.max(0, 1 - distance / radius) * 4;
    if (distance <= radius * 2) return 4;
    return 0;
  }

  function localMatchTypeRank(matchType) {
    if (["exact_address", "exact_hint", "regional_exact"].includes(matchType)) return 0;
    if (matchType === "building_refine") return 18;
    if (["address_prefix", "hint_prefix", "regional_prefix"].includes(matchType)) return 20;
    if (matchType === "regional_street_locality") return 12;
    if (["hint_contains", "regional_contains"].includes(matchType)) return 40;
    if (["fallback_area", "regional_area_fallback"].includes(matchType)) return 70;
    return 55;
  }

  function unitIntentConfidence(query) {
    const text = normaliseSearchText(query);
    if (/^\d+\s+\d+\b/.test(text)) return "specific";
    const match = text.match(/\b(?:apartment|apt|flat|level|lvl|office|offc|shop|suite|townhouse|unit)\s+([a-z0-9-]+)\b/);
    if (!match) return "none";
    return match[1].length >= 2 ? "specific" : "partial";
  }

  function isNumberFirstAddressQuery(needle) {
    return /^\d+[a-z]?(?:-\d+[a-z]?)?\b/.test(normaliseSearchText(needle));
  }

  function labelMatchesUnitIntent(query, label) {
    const queryText = normaliseSearchText(query);
    const labelText = normaliseSearchText(label);
    const slashMatch = queryText.match(/^(\d+)\s+\d+\b/);
    if (slashMatch && new RegExp(`\\b(?:apartment|apt|flat|office|offc|shop|suite|townhouse|unit)\\s+${slashMatch[1]}\\b`).test(labelText)) {
      return true;
    }
    const unitMatch = queryText.match(/\b(apartment|apt|flat|office|offc|shop|suite|townhouse|unit)\s+([a-z0-9-]+)\b/);
    if (!unitMatch) return false;
    return new RegExp(`\\b${unitMatch[1]}\\s+${unitMatch[2]}\\b`).test(labelText);
  }

  function regionalPoiNameMatches(needle, item) {
    if (item?.provider !== "fuel_path_regional_gazetteer" || item?.type !== "regional_poi") return false;
    const primaryName = normaliseSearchText(String(item?.label || "").split(",")[0] || "");
    return primaryName.length >= 5 && needle.includes(primaryName);
  }

  function hasPlaceIntent(needle) {
    return placeIntentTerms(needle).length > 0;
  }

  function placeIntentMatches(needle, item) {
    const terms = placeIntentTerms(needle);
    if (!terms.length) return false;
    const type = normaliseSearchText(item?.type || "");
    const label = normaliseSearchText(item?.label || "");
    return terms.some((term) => {
      if (term === "airport") return type.includes("airport") || label.includes("airport");
      if (["centre", "center", "mall", "market"].includes(term)) return ["poi", "venue", "regional_poi"].includes(type) || label.includes(term);
      if (["stadium", "ground", "oval", "arena"].includes(term)) return ["venue", "regional_poi", "poi"].includes(type) || label.includes(term);
      if (["station", "interchange", "wharf"].includes(term)) return ["station", "ferry_wharf", "regional_poi"].includes(type) || label.includes(term);
      if (["hospital", "university", "beach", "zoo", "park", "parkland", "lookout", "gallery", "museum", "memorial", "theatre"].includes(term)) {
        return type.includes(term) || ["poi", "venue", "regional_poi", "park", "beach", "hospital", "university"].includes(type) || label.includes(term);
      }
      return false;
    });
  }

  function placeIntentTerms(needle) {
    const tokens = normaliseSearchText(needle).split(" ").filter((token) => token.length >= 3);
    return tokens.filter((token) =>
      [
        "airport",
        "arena",
        "beach",
        "centre",
        "center",
        "gallery",
        "ground",
        "hospital",
        "interchange",
        "lookout",
        "mall",
        "market",
        "memorial",
        "museum",
        "oval",
        "park",
        "parkland",
        "stadium",
        "station",
        "theatre",
        "university",
        "wharf",
        "zoo",
      ].includes(token),
    );
  }

  function isBroadAreaSuggestion(item) {
    return ["city", "suburb", "regional_town"].includes(item?.type);
  }

  return {
    geocode,
    geocodeProviderStatus,
  };
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase())
    .replace(/\bRd\b/g, "Road")
    .replace(/\bSt\b/g, "Street")
    .replace(/\bAve\b/g, "Avenue");
}

module.exports = {
  createGeocoder,
};

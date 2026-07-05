const QLD_BOUNDS = {
  minLat: -29.1,
  maxLat: -9,
  minLon: 138,
  maxLon: 154.2,
};
const WA_BOUNDS = {
  minLat: -36,
  maxLat: -13,
  minLon: 112,
  maxLon: 129.05,
};
const NSW_BOUNDS = {
  minLat: -37.7,
  maxLat: -28,
  minLon: 140.9,
  maxLon: 154.2,
};
const VIC_BOUNDS = {
  minLat: -39.3,
  maxLat: -33.9,
  minLon: 140.9,
  maxLon: 150.2,
};
const SA_BOUNDS = {
  minLat: -38.2,
  maxLat: -25.9,
  minLon: 129,
  maxLon: 141.1,
};
const TAS_BOUNDS = {
  minLat: -43.8,
  maxLat: -39,
  minLon: 143.5,
  maxLon: 148.6,
};
const NT_BOUNDS = {
  minLat: -26.1,
  maxLat: -10.8,
  minLon: 129,
  maxLon: 138.1,
};
const ACT_BOUNDS = {
  minLat: -35.95,
  maxLat: -35.1,
  minLon: 148.7,
  maxLon: 149.45,
};
const CAPABILITY_LABELS = ["live", "limited", "pending_access", "fallback", "unsupported"];
const REGION_ORDER = ["NSW", "ACT", "QLD", "WA", "VIC", "SA", "TAS", "NT"];
const TERMS_GATED_PUBLIC_REGIONS = ["NSW", "ACT", "QLD", "VIC", "SA", "TAS", "NT"];
const NT_MYFUEL_ACCESS_PATH =
  "NT Consumer Affairs has approved Fuel Path access to the MyFuel NT third-party API. The backend uses the approved token, postcode, outlet-identifier and reference-data endpoints with server-side credentials.";
const NSW_VIC_BORDER_POINTS = [
  { lon: 141.0, lat: -34.0 },
  { lon: 142.2, lat: -34.18 },
  { lon: 143.6, lat: -35.35 },
  { lon: 144.75, lat: -36.12 },
  { lon: 146.0, lat: -35.998 },
  { lon: 146.45, lat: -36.03 },
  { lon: 146.9, lat: -36.08 },
  { lon: 148.25, lat: -36.65 },
  { lon: 149.98, lat: -37.5 },
];

function hasLiveCredentials() {
  return Boolean(process.env.NSW_FUEL_API_KEY && process.env.NSW_FUEL_API_SECRET);
}

function hasQldCredentials() {
  return Boolean(process.env.QLD_FUEL_API_TOKEN);
}

function hasSaCredentials() {
  return Boolean(process.env.SA_FUEL_API_TOKEN);
}

function hasWaProvider() {
  return process.env.FUEL_PATH_WA_FUELWATCH_ENABLED !== "0";
}

function hasVicCredentials() {
  return Boolean(process.env.VIC_SERVO_SAVER_API_KEY);
}

function hasNtCredentials() {
  return Boolean(process.env.NT_MYFUEL_USERNAME && process.env.NT_MYFUEL_PASSWORD);
}

function hasTasUsageTermsConfirmed() {
  return process.env.FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED === "1" || hasFuelCheckUsageTermsConfirmed();
}

function hasFuelCheckUsageTermsConfirmed() {
  return process.env.FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED === "1";
}

function hasNswActUsageTermsConfirmed() {
  return process.env.FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED === "1" || hasFuelCheckUsageTermsConfirmed();
}

function hasQldUsageTermsConfirmed() {
  return process.env.FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED === "1";
}

function publicRuntime() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production" || process.env.FUEL_PATH_PRODUCTION_HARDENING === "1";
}

function hasTasLiveAccess() {
  return hasLiveCredentials() && (!publicRuntime() || hasTasUsageTermsConfirmed());
}

function hasNswLiveAccess() {
  return hasLiveCredentials() && (!publicRuntime() || hasNswActUsageTermsConfirmed());
}

function hasQldLiveAccess() {
  return hasQldCredentials() && (!publicRuntime() || hasQldUsageTermsConfirmed());
}

function hasNtLiveAccess() {
  return hasNtCredentials();
}

function hasAnyLiveCredentials() {
  return hasLiveCredentials() || hasQldCredentials() || hasSaCredentials() || hasWaProvider() || hasVicCredentials() || hasNtCredentials();
}

function vicNextAction() {
  return hasVicCredentials()
    ? "Track VIC Servo Saver terms and attribution evidence; route this provider through normal launch checks."
    : "Apply for Servo Saver Public API access and capture the approved schema, licence, caching and attribution terms.";
}

function fuelProviderCapabilityMatrix() {
  return [
    capabilityEntry({
      region: "NSW",
      name: "New South Wales",
      provider: "api_nsw_fuelcheck",
      capability: hasNswLiveAccess() ? "live" : hasLiveCredentials() ? "limited" : "pending_access",
      configured: hasLiveCredentials(),
      coverage: "NSW FuelCheck live prices.",
      blocker: hasNswLiveAccess()
        ? ""
        : hasLiveCredentials()
          ? "NSW FuelCheck live adapter is available for internal validation, but public usage, caching and attribution terms are not confirmed."
          : "API.NSW FuelCheck credentials are not configured.",
      nextAction: hasNswLiveAccess()
        ? "Monitor adapter health and terms evidence."
        : hasLiveCredentials()
        ? "Confirm FuelCheck usage, caching and attribution terms before public launch claims."
        : "Configure approved API.NSW Fuel API credentials.",
    }),
    capabilityEntry({
      region: "ACT",
      name: "Australian Capital Territory",
      provider: "api_nsw_fuelcheck",
      capability: hasNswLiveAccess() ? "live" : hasLiveCredentials() ? "limited" : "pending_access",
      configured: hasLiveCredentials(),
      coverage: "ACT prices exposed through the API.NSW FuelCheck feed.",
      blocker: hasNswLiveAccess()
        ? ""
        : hasLiveCredentials()
          ? "ACT FuelCheck feed is available for internal validation, but ACT public usage, caching and attribution terms are not confirmed."
          : "API.NSW FuelCheck credentials are not configured.",
      nextAction: hasNswLiveAccess()
        ? "Monitor adapter health and terms evidence."
        : hasLiveCredentials()
        ? "Confirm ACT FuelCheck usage, caching and attribution terms before public launch claims."
        : "Configure approved API.NSW Fuel API credentials.",
    }),
    capabilityEntry({
      region: "QLD",
      name: "Queensland",
      provider: "api_qld_fuelprices",
      capability: hasQldLiveAccess() ? "live" : hasQldCredentials() ? "limited" : "pending_access",
      configured: hasQldCredentials(),
      coverage: "QLD Fuel Prices Direct Outbound API.",
      blocker: hasQldLiveAccess()
        ? ""
        : hasQldCredentials()
          ? "QLD Fuel Prices adapter is available for internal validation, but public usage, caching and attribution terms are not confirmed."
          : "QLD Fuel Prices API token is not configured.",
      nextAction: hasQldLiveAccess()
        ? "Monitor adapter health and terms evidence."
        : hasQldCredentials()
        ? "Confirm QLD usage, caching and attribution terms before public launch claims."
        : "Configure QLD Fuel Prices API token.",
    }),
    capabilityEntry({
      region: "WA",
      name: "Western Australia",
      provider: "api_wa_fuelwatch",
      capability: hasWaProvider() ? "live" : "unsupported",
      configured: hasWaProvider(),
      coverage: "WA FuelWatch live prices statewide using request-budgeted RSS. Tomorrow locked prices are checked after 2:30pm AWST.",
      blocker: hasWaProvider() ? "" : "WA FuelWatch provider is disabled.",
    }),
    capabilityEntry({
      region: "VIC",
      name: "Victoria",
      provider: "api_vic_servo_saver",
      capability: hasVicCredentials() ? "live" : "pending_access",
      configured: hasVicCredentials(),
      coverage: "Victoria fuel prices and station metadata from the Service Victoria Servo Saver Open API.",
      accessPath:
        "Service Victoria lists a Servo Saver Open API for third-party fuel price access; public use should follow the published service terms and cache strategy.",
      blocker: hasVicCredentials()
        ? ""
        : "VIC Servo Saver API access is not configured.",
      nextAction: vicNextAction(),
    }),
    capabilityEntry({
      region: "SA",
      name: "South Australia",
      provider: "api_sa_fuel_price_reporting",
      capability: hasSaCredentials() ? "live" : "pending_access",
      configured: hasSaCredentials(),
      coverage: "SA Fuel Pricing Information Scheme Direct API live prices.",
      blocker: hasSaCredentials() ? "" : "SA Fuel Pricing Information Scheme API token is not configured.",
    }),
    capabilityEntry({
      region: "TAS",
      name: "Tasmania",
      provider: "api_tas_fuelcheck",
      capability: hasTasLiveAccess() ? "live" : hasLiveCredentials() ? "limited" : "pending_access",
      configured: hasLiveCredentials(),
      coverage: "TAS FuelCheck prices are exposed through API.NSW Fuel API v2.",
      accessPath: "API.NSW Fuel API v2 supports TAS nearby payloads through the same approved credential path.",
      blocker: hasTasLiveAccess()
        ? ""
        : hasLiveCredentials()
          ? "TAS live adapter is available for internal validation, but public usage, caching and attribution terms are not confirmed."
          : "API.NSW FuelCheck credentials are not configured.",
      nextAction: hasTasLiveAccess()
        ? "Monitor adapter health and terms evidence."
        : hasLiveCredentials()
        ? "Confirm usage, caching and attribution terms before public launch claims."
        : "Configure approved API.NSW Fuel API credentials.",
    }),
    capabilityEntry({
      region: "NT",
      name: "Northern Territory",
      provider: "api_nt_myfuel",
      capability: hasNtLiveAccess() ? "live" : "pending_access",
      configured: hasNtCredentials(),
      coverage: "MyFuel NT third-party API live fuel prices across the Northern Territory.",
      accessPath: NT_MYFUEL_ACCESS_PATH,
      blocker: hasNtLiveAccess() ? "" : "MyFuel NT username/password credentials are not configured.",
      nextAction: hasNtLiveAccess()
        ? "Monitor adapter health, cache behaviour and provider terms evidence."
        : "Configure approved MyFuel NT API username and password.",
    }),
  ];
}

function capabilityEntry({ region, name, provider, capability, configured, coverage, blocker, accessPath, nextAction }) {
  const safeCapability = CAPABILITY_LABELS.includes(capability) ? capability : "unsupported";
  return {
    region,
    name,
    provider,
    capability: safeCapability,
    configured: Boolean(configured),
    liveData: safeCapability === "live" || safeCapability === "limited",
    coverage,
    accessPath,
    blocker,
    nextAction,
  };
}

function capabilitySummary(capabilities = fuelProviderCapabilityMatrix()) {
  return capabilities.reduce((summary, item) => {
    summary[item.capability] = (summary[item.capability] || 0) + 1;
    return summary;
  }, {});
}

function providerPublicClaimStatus(capabilities = fuelProviderCapabilityMatrix()) {
  const termsBlocked = capabilities.filter((entry) =>
    entry.configured &&
    entry.capability === "limited" &&
    /usage|caching|attribution|terms/i.test(`${entry.blocker || ""} ${entry.nextAction || ""}`),
  );
  const evidenceRequired = capabilities.filter((entry) =>
    TERMS_GATED_PUBLIC_REGIONS.includes(entry.region) &&
    entry.configured &&
    entry.capability === "live" &&
    !providerTermsEvidenceConfirmed(),
  );
  const accessBlocked = capabilities.filter((entry) => entry.capability === "pending_access");
  const publicLiveRegions = capabilities.filter((entry) => entry.capability === "live").map((entry) => entry.region);
  const blockers = [
    ...termsBlocked.map((entry) => `${entry.region.toLowerCase()}_terms_not_confirmed`),
    ...evidenceRequired.map((entry) => `${entry.region.toLowerCase()}_terms_evidence_not_attested`),
  ];

  return {
    publicLivePriceClaimsAllowed: blockers.length === 0,
    nationalLiveCoverageClaimsAllowed: blockers.length === 0 && accessBlocked.length === 0,
    status: blockers.length ? "blocked" : "ready",
    publicLiveRegions,
    blockers,
    termsBlocked: termsBlocked.map((entry) => entry.region),
    evidenceRequired: evidenceRequired.map((entry) => entry.region),
    accessBlocked: accessBlocked.map((entry) => entry.region),
    evidenceAttested: providerTermsEvidenceConfirmed(),
    nextAction: blockers.length
      ? "Confirm provider usage, caching, attribution and written evidence before public live-price claims."
      : "Provider public live-price claim status is ready for the currently configured regions.",
  };
}

function providerTermsEvidenceConfirmed() {
  return process.env.FUEL_PATH_PROVIDER_TERMS_EVIDENCE_CONFIRMED === "1";
}

function pointInQld(point) {
  const lat = Number(point?.lat);
  const lon = Number(point?.lon);
  if (lon < 141 && lat < -26) return false;
  return pointInBounds(point, QLD_BOUNDS);
}

function pointInWa(point) {
  return pointInBounds(point, WA_BOUNDS);
}

function pointInSa(point) {
  return pointInBounds(point, SA_BOUNDS);
}

function pointInTas(point) {
  return pointInBounds(point, TAS_BOUNDS);
}

function pointInNt(point) {
  return pointInBounds(point, NT_BOUNDS);
}

function pointInAct(point) {
  return pointInBounds(point, ACT_BOUNDS);
}

function pointInVic(point) {
  const lat = Number(point?.lat);
  const lon = Number(point?.lon);
  if (pointInAct(point)) return false;
  if (!pointInBounds(point, VIC_BOUNDS)) return false;

  const borderLat = nswVicBorderLatAtLon(lon);
  if (borderLat !== undefined) return lat < borderLat;

  const firstBorderPoint = NSW_VIC_BORDER_POINTS[0];
  const lastBorderPoint = NSW_VIC_BORDER_POINTS[NSW_VIC_BORDER_POINTS.length - 1];
  if (lon > lastBorderPoint.lon) return lat <= lastBorderPoint.lat;
  if (lon < firstBorderPoint.lon) return lat < firstBorderPoint.lat;

  return pointInBounds(point, VIC_BOUNDS);
}

function pointInNswOrAct(point) {
  if (pointInAct(point)) return true;
  if (!pointInBounds(point, NSW_BOUNDS)) return false;
  return !pointInQld(point) && !pointInWa(point) && !pointInVic(point) && !pointInSa(point) && !pointInTas(point) && !pointInNt(point);
}

function pointInBounds(point, bounds) {
  const lat = Number(point?.lat);
  const lon = Number(point?.lon);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lon >= bounds.minLon &&
    lon <= bounds.maxLon
  );
}

function nswVicBorderLatAtLon(lon) {
  const first = NSW_VIC_BORDER_POINTS[0];
  const last = NSW_VIC_BORDER_POINTS[NSW_VIC_BORDER_POINTS.length - 1];
  if (lon < first.lon || lon > last.lon) return undefined;

  for (let index = 1; index < NSW_VIC_BORDER_POINTS.length; index += 1) {
    const left = NSW_VIC_BORDER_POINTS[index - 1];
    const right = NSW_VIC_BORDER_POINTS[index];
    if (lon < left.lon || lon > right.lon) continue;
    const span = right.lon - left.lon;
    const ratio = span ? (lon - left.lon) / span : 0;
    return left.lat + (right.lat - left.lat) * ratio;
  }

  return undefined;
}

function qldNswBorderArea(point, radiusKm = 0) {
  return pointInQld(point) && Number(point.lat) <= -27.75 && Number(point.lon) >= 151 && Number(radiusKm) >= 20;
}

function liveProviderKeysForArea(points = [], radiusKm = 0) {
  if (!points.length) {
    if (hasNswLiveAccess()) return ["nsw"];
    if (hasQldLiveAccess()) return ["qld"];
    if (hasWaProvider()) return ["wa"];
    if (hasVicCredentials()) return ["vic"];
    if (hasNtLiveAccess()) return ["nt"];
    return [];
  }
  const hasQldPoint = points.some(pointInQld);
  const hasWaPoint = points.some(pointInWa);
  const hasVicPoint = points.some(pointInVic);
  const hasSaPoint = points.some(pointInSa);
  const hasTasPoint = points.some(pointInTas);
  const hasNtPoint = points.some(pointInNt);
  const hasNswPoint = points.some(pointInNswOrAct);
  if (hasWaPoint) return ["wa"];
  if (hasSaPoint) return hasSaCredentials() ? ["sa"] : [];
  if (hasTasPoint) return hasTasLiveAccess() ? ["tas"] : [];
  if (hasNtPoint) return hasNtLiveAccess() ? ["nt"] : [];
  if (hasVicPoint) {
    const providers = ["vic"];
    if (hasNswPoint && hasNswLiveAccess()) providers.push("nsw");
    return providers;
  }
  if (hasQldPoint) {
    const providers = hasQldLiveAccess() ? ["qld"] : [];
    if ((hasNswPoint || points.some((point) => qldNswBorderArea(point, radiusKm))) && hasNswLiveAccess()) {
      providers.push("nsw");
    }
    return providers;
  }
  if (hasNswPoint) return hasNswLiveAccess() ? ["nsw"] : [];
  return [];
}

function regionCodeForPoint(point) {
  if (pointInAct(point)) return "ACT";
  if (pointInQld(point)) return "QLD";
  if (pointInWa(point)) return "WA";
  if (pointInVic(point)) return "VIC";
  if (pointInTas(point)) return "TAS";
  if (pointInNt(point)) return "NT";
  if (pointInSa(point)) return "SA";
  if (pointInNswOrAct(point)) return "NSW";
  return "UNSUPPORTED";
}

function capabilitiesForPoints(points = []) {
  const matrixByRegion = new Map(fuelProviderCapabilityMatrix().map((item) => [item.region, item]));
  const regionCodes = new Set();
  for (const point of points) regionCodes.add(regionCodeForPoint(point));
  if (!regionCodes.size) return [];

  const capabilities = REGION_ORDER.filter((region) => regionCodes.has(region)).map((region) => matrixByRegion.get(region));
  if (regionCodes.has("UNSUPPORTED")) {
    capabilities.push(
      capabilityEntry({
        region: "UNSUPPORTED",
        name: "Unsupported area",
        provider: "none",
        capability: "unsupported",
        configured: false,
        coverage: "No Australian fuel provider coverage matched this location.",
        blocker: "Fuel Path cannot identify this location as an Australian state or territory.",
      }),
    );
  }
  return capabilities.filter(Boolean);
}

function primaryCapability(capabilities = []) {
  if (!capabilities.length) return "unsupported";
  if (capabilities.some((item) => item.capability === "unsupported")) return "unsupported";
  if (capabilities.some((item) => item.capability === "fallback")) return "fallback";
  if (capabilities.some((item) => item.capability === "pending_access")) return "pending_access";
  if (capabilities.some((item) => item.capability === "limited")) return "limited";
  return "live";
}

function capabilityWarning(capabilities = []) {
  if (!capabilities.length) return "No live fuel provider covers this area yet.";
  const names = capabilities.map((item) => item.region).join("/");
  const capability = primaryCapability(capabilities);
  if (capability === "pending_access") {
    return `Fuel Path has ${names} in the national provider matrix, but live prices are not enabled for this area yet.`;
  }
  if (capability === "limited") {
    return `Fuel Path has limited live coverage for ${names}; confirm freshness before driving.`;
  }
  if (capability === "fallback") {
    return `Fuel Path is using fallback data for ${names}; do not treat this as a live price recommendation.`;
  }
  if (capability === "unsupported") {
    return "No live fuel provider covers this area yet.";
  }
  return "";
}

function pointInProviderCoverage(provider, point) {
  if (provider === "nsw") return pointInNswOrAct(point);
  if (provider === "qld") return pointInQld(point);
  if (provider === "wa") return pointInWa(point);
  if (provider === "vic") return pointInVic(point);
  if (provider === "sa") return pointInSa(point);
  if (provider === "tas") return pointInTas(point);
  if (provider === "nt") return pointInNt(point);
  return false;
}

module.exports = {
  REGION_ORDER,
  capabilitiesForPoints,
  capabilitySummary,
  capabilityWarning,
  fuelProviderCapabilityMatrix,
  hasAnyLiveCredentials,
  hasFuelCheckUsageTermsConfirmed,
  hasLiveCredentials,
  hasNtCredentials,
  hasNtLiveAccess,
  hasNswActUsageTermsConfirmed,
  hasNswLiveAccess,
  hasQldCredentials,
  hasQldLiveAccess,
  hasQldUsageTermsConfirmed,
  hasSaCredentials,
  hasTasLiveAccess,
  hasTasUsageTermsConfirmed,
  hasVicCredentials,
  hasWaProvider,
  liveProviderKeysForArea,
  pointInAct,
  pointInNt,
  pointInProviderCoverage,
  pointInQld,
  pointInSa,
  pointInTas,
  pointInVic,
  pointInWa,
  primaryCapability,
  providerPublicClaimStatus,
};

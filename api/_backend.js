const sample = require("./_sample");
const { purgeAlertRetention, setAlertStorageForTests } = require("./_alertStorage");
const {
  appendPredictionBacktestRecord,
  appendPredictionMarketSnapshotRecord,
  listPredictionBacktestRecords,
  listPredictionMarketSnapshotRecords,
  predictionStorageStatus,
  purgePredictionBacktests,
  setPredictionStorageForTests,
} = require("./_predictionStorage");
const { singleFlight } = require("./_providerRuntime");
const { logServerError } = require("./_serverDiagnostics");
const { runProductDatabaseMigrations } = require("./_productDatabaseMigrations");
const { fetchJson } = require("./_providerHttp");
const { tokenAuthorised, tokenSecurity } = require("./_securityPolicy");
const { createPredictionService } = require("./_predictionService");
const { createRetentionService } = require("./_retentionService");
const { createStationDecorator } = require("./_stationDiscounts");
const { createStationProviderService } = require("./_stationProviderService");
const { createStationProviderRegistry } = require("./_stationProviderRegistry");
const {
  boolParam,
  methodAllowed,
  numberParam,
  sendJson,
  setParam,
  stringParam,
} = require("./_request");
const { googleRoutesApiKey } = require("./_providerCredentials");
const { distanceKm } = require("./_geoMath");
const {
  routeContextStations,
  scoreRoute,
  stationPayload,
} = require("./_routeScoring");
const { createGeocoder } = require("./_geocode");
const { createAlertOrchestration } = require("./_alertOrchestration");
const { enrolBackendRouteWatch } = require("./_alertEnrolment");
const DISCOUNT_RULES = require("../shared/discountRegistry.json");
const { createWaFuelWatchAdapter } = require("./_waFuelWatch");
const { createFppDirectProvider } = require("./_fppDirectProvider");
const { createNswFuelCheckAdapter } = require("./_nswFuelCheck");
const {
  REGION_ORDER,
  capabilitiesForPoints,
  capabilitySummary,
  capabilityWarning,
  fuelProviderCapabilityMatrix,
  hasAnyLiveCredentials,
  hasNswActUsageTermsConfirmed,
  hasLiveCredentials,
  hasNtCredentials,
  hasQldCredentials,
  hasQldUsageTermsConfirmed,
  hasSaCredentials,
  hasTasUsageTermsConfirmed,
  hasVicCredentials,
  hasWaProvider,
  liveProviderKeysForArea,
  pointInAct,
  pointInNt,
  pointInProviderCoverage,
  pointInSa,
  pointInTas,
  pointInVic,
  primaryCapability,
  providerPublicClaimStatus,
} = require("./_capabilities");
const { createRouting } = require("./_routing");
const DEFAULT_CACHE_SECONDS = 300;
const { buildRoute, routeProviderStatus } = createRouting({
  fetchJson,
  googleRoutesApiKey,
});
const stationWithDiscountRules = createStationDecorator({ discountRules: DISCOUNT_RULES });
const {
  loadLiveWaStations,
  normaliseWaFuelWatchPayloads,
  waFuelWatchRequestPlan,
  waRegionPlanForArea,
  waTomorrowPriceAvailable,
} = createWaFuelWatchAdapter({ decorateStation: stationWithDiscountRules });
const { createVicServoSaverAdapter } = require("./_vicServoSaverProvider");
const {
  loadLiveQldStations,
  loadLiveSaStations,
  normaliseQldPayload,
  normaliseSaPayload,
} = createFppDirectProvider({ decorateStation: stationWithDiscountRules });
const {
  loadLiveStations,
  loadLiveTasStations,
  normaliseNswPayload,
  normaliseTasPayload,
} = createNswFuelCheckAdapter({ decorateStation: stationWithDiscountRules });
const { loadLiveVicStations } = createVicServoSaverAdapter({ decorateStation: stationWithDiscountRules });
const {
  createMyFuelNtProvider,
  normaliseNtPayload,
  normaliseNtReferencePayload,
} = require("./_ntMyFuelProvider");
const { loadLiveNtStations } = createMyFuelNtProvider({ decorateStation: stationWithDiscountRules });
const productionRuntime = () => process.env.VERCEL_ENV === "production"
  || process.env.NODE_ENV === "production"
  || process.env.FUEL_PATH_PRODUCTION_HARDENING === "1";
const { loadStationData } = createStationProviderService({
  sampleStations: () => sample.sampleStations({ includeFixtureFallback: true }),
  decorateStation: stationWithDiscountRules,
  singleFlight,
  liveProviderKeysForArea,
  capabilitiesForPoints,
  capabilityWarning,
  primaryCapability,
  pointInProviderCoverage,
  hasAnyLiveCredentials,
  termsConfirmed: {
    qld: hasQldUsageTermsConfirmed,
    nswAct: hasNswActUsageTermsConfirmed,
    tas: hasTasUsageTermsConfirmed,
  },
  providerRegistry: createStationProviderRegistry({
    loadLiveQldStations, loadLiveWaStations, loadLiveVicStations, loadLiveSaStations,
    loadLiveNtStations, loadLiveStations, loadLiveTasStations,
  }),
  productionRuntime,
  sampleSourceAllowed: () => process.env.FUEL_PATH_ALLOW_SAMPLE_SOURCE === "1" || !productionRuntime(),
});
const {
  listPredictionBacktests,
  predictionSignal,
  predictionStatus,
  predictionWriteAuthorised,
  predictionWriteSecurity,
  recordPredictionBacktest,
  recordPredictionMarketObservation,
  runPredictionMarketBacktestJob,
} = createPredictionService({
  REGION_ORDER,
  appendPredictionBacktestRecord,
  appendPredictionMarketSnapshotRecord,
  distanceKm,
  listPredictionBacktestRecords,
  listPredictionMarketSnapshotRecords,
  loadStationData,
  predictionStorageStatus,
  tokenAuthorised,
  tokenSecurity,
});
const { geocode, geocodeProviderStatus } = createGeocoder({
  fetchJson,
  loadStationData,
});
const {
  alertsStatus,
  alertsWriteAuthorised,
  alertsAdminWriteAuthorised,
  alertRecordsReadAuthorised,
  alertsWriteSecurity,
  checkPushReceipts,
  cronAuthorised,
  deleteBackendSavedRoute,
  evaluateSavedRouteAlert,
  validateSavedRouteAlertDelivery,
  issueAlertClientCapability,
  listBackendAlertEvaluations,
  listBackendPushDevices,
  listBackendSavedRoutes,
  registerPushDevice,
  runScheduledRouteAlertEvaluation,
  saveBackendSavedRoute,
  setAlertRouteScorerForTests,
} = createAlertOrchestration({
  buildRoute,
  capabilitiesForPoints,
  loadStationData,
  predictionStatus,
  scoreRoute,
});
const { retentionCleanupAuthorised, runRetentionCleanup } = createRetentionService({
  purgeAlertRetention,
  purgePredictionBacktests,
  cronAuthorised,
});
function cacheSeconds() {
  return Math.max(60, Number(process.env.FUEL_PATH_LIVE_CACHE_SECONDS || DEFAULT_CACHE_SECONDS));
}

function pointFromQuery(req, prefix) {
  return {
    lat: numberParam(req.query[`${prefix}Lat`], 0),
    lon: numberParam(req.query[`${prefix}Lon`], 0),
    label: stringParam(req.query[`${prefix}Label`], prefix),
  };
}

function routeFromPayload(payload) {
  const points = Array.isArray(payload?.points) ? payload.points : [];
  const cleaned = points
    .map((point) => ({
      lat: Number(point?.lat),
      lon: Number(point?.lon),
      label: String(point?.label || ""),
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
  if (cleaned.length < 2) throw new Error("Route payload needs at least two valid points");
  return {
    id: String(payload.id || "custom-route"),
    name: String(payload.name || "Custom route"),
    provider: String(payload.provider || "open"),
    points: cleaned,
    defaultCorridorKm: Number(payload.defaultCorridorKm || 2.5),
    defaultDetourSpeedKmh: Number(payload.defaultDetourSpeedKmh || 45),
  };
}
module.exports = {
  alertsAdminWriteAuthorised,
  alertRecordsReadAuthorised,
  alertsWriteAuthorised,
  alertsWriteSecurity,
  alertsStatus,
  boolParam,
  buildRoute,
  cacheSeconds,
  capabilitiesForPoints,
  capabilitySummary,
  checkPushReceipts,
  cronAuthorised,
  deleteBackendSavedRoute,
  enrolBackendRouteWatch,
  distanceKm,
  evaluateSavedRouteAlert,
  validateSavedRouteAlertDelivery,
  fuelProviderCapabilityMatrix,
  geocode,
  geocodeProviderStatus,
  hasAnyLiveCredentials,
  hasNswActUsageTermsConfirmed,
  hasLiveCredentials,
  hasNtCredentials,
  hasQldCredentials,
  hasQldUsageTermsConfirmed,
  hasSaCredentials,
  hasTasUsageTermsConfirmed,
  hasVicCredentials,
  hasWaProvider,
  issueAlertClientCapability,
  loadStationData,
  loadLiveSaStations,
  loadLiveWaStations,
  liveProviderKeysForArea,
  logServerError,
  methodAllowed,
  normaliseQldPayload,
  normaliseNtPayload,
  normaliseNtReferencePayload,
  normaliseSaPayload,
  normaliseTasPayload,
  normaliseWaFuelWatchPayloads,
  numberParam,
  listPredictionBacktests,
  listBackendAlertEvaluations,
  listBackendPushDevices,
  listBackendSavedRoutes,
  pointInAct,
  pointFromQuery,
  pointInNt,
  pointInSa,
  pointInTas,
  pointInVic,
  predictionSignal,
  predictionStatus,
  predictionWriteAuthorised,
  predictionWriteSecurity,
  providerPublicClaimStatus,
  registerPushDevice,
  recordPredictionMarketObservation,
  recordPredictionBacktest,
  retentionCleanupAuthorised,
  routeContextStations,
  routeFromPayload,
  routeProviderStatus,
  runPredictionMarketBacktestJob,
  runProductDatabaseMigrations,
  runRetentionCleanup,
  runScheduledRouteAlertEvaluation,
  saveBackendSavedRoute,
  scoreRoute,
  sendJson,
  setAlertRouteScorerForTests,
  setAlertStorageForTests,
  setPredictionStorageForTests,
  setParam,
  stationPayload,
  stringParam,
  waFuelWatchRequestPlan,
  waRegionPlanForArea,
  waTomorrowPriceAvailable,
};

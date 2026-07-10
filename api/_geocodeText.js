function normaliseSearchText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase())
    .replace(/\bRd\b/g, "Road")
    .replace(/\bSt\b/g, "Street")
    .replace(/\bAve\b/g, "Avenue");
}

function isBroadAreaSuggestion(item) {
  return ["city", "suburb", "regional_town"].includes(item?.type);
}

function broadAreaSuggestionLeavesSpecificQueryTerms(query, suggestion) {
  const queryTokens = significantLocationTokens(query);
  if (queryTokens.length < 2) return false;
  const labelTokens = new Set(significantLocationTokens(suggestion?.label));
  return queryTokens.some((token) => !labelTokens.has(token));
}

function significantLocationTokens(value) {
  return normaliseSearchText(value)
    .split(" ")
    .filter((token) => token && !/^\d{4}$/.test(token) && !/^(?:act|nsw|nt|qld|sa|tas|vic|wa)$/.test(token));
}

function isWithinSearchContext(item, searchContext, distanceBetween) {
  if (!searchContext || item?.provider !== "fuel_path_gnaf") return false;
  const lat = Number(item?.lat);
  const lon = Number(item?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  const distance = distanceBetween({ lat, lon }, { lat: searchContext.nearLat, lon: searchContext.nearLon });
  return Number.isFinite(distance) && distance <= searchContext.nearRadiusKm;
}

module.exports = {
  broadAreaSuggestionLeavesSpecificQueryTerms,
  isBroadAreaSuggestion,
  isWithinSearchContext,
  normaliseSearchText,
  titleCase,
};

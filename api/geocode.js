const { methodAllowed, places, numberParam, sendJson, stringParam } = require("./_sample");

module.exports = function handler(req, res) {
  if (!methodAllowed(req, res)) return;
  const q = stringParam(req.query.q).trim().toLowerCase();
  const limit = numberParam(req.query.limit, 5);
  const suggestions = places
    .filter((place) => {
      const label = place.label.toLowerCase();
      return !q || label.includes(q) || q.split(/\s+/).some((part) => part.length > 2 && label.includes(part));
    })
    .slice(0, limit);
  const fallback = suggestions[0] || places[0];

  sendJson(res, 200, {
    provider: "sample",
    providerMode: "public-demo",
    recommendedProductionProvider: "google_places_autocomplete_new",
    location: fallback,
    suggestions: suggestions.length ? suggestions : [fallback],
  });
};

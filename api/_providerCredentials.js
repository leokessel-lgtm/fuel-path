function googleMapsApiKey() {
  return process.env.FUEL_PATH_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
}

function googlePlacesApiKey() {
  return process.env.FUEL_PATH_GOOGLE_PLACES_API_KEY || googleMapsApiKey();
}

function googleRoutesApiKey() {
  return process.env.FUEL_PATH_GOOGLE_ROUTES_API_KEY || googleMapsApiKey();
}

function mapboxAccessToken() {
  return process.env.FUEL_PATH_MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_ACCESS_TOKEN || "";
}

function hereApiKey() {
  return process.env.FUEL_PATH_HERE_API_KEY || process.env.HERE_API_KEY || "";
}

function geoapifyApiKey() {
  return process.env.FUEL_PATH_GEOAPIFY_API_KEY || process.env.GEOAPIFY_API_KEY || "";
}

function addressrApiKey() {
  return process.env.FUEL_PATH_ADDRESSR_RAPIDAPI_KEY || process.env.ADDRESSR_RAPIDAPI_KEY || "";
}

function addressrBaseUrl() {
  const configured = process.env.FUEL_PATH_ADDRESSR_BASE_URL || process.env.ADDRESSR_BASE_URL || "";
  if (configured) return configured;
  return addressrApiKey() ? "https://addressr.p.rapidapi.com" : "";
}

function addressrRapidApiHost() {
  return process.env.FUEL_PATH_ADDRESSR_RAPIDAPI_HOST || "addressr.p.rapidapi.com";
}

function addressrHeaders() {
  const apiKey = addressrApiKey();
  if (!apiKey) return {};
  return {
    "x-rapidapi-key": apiKey,
    "x-rapidapi-host": addressrRapidApiHost(),
  };
}

module.exports = {
  addressrApiKey,
  addressrBaseUrl,
  addressrHeaders,
  geoapifyApiKey,
  googlePlacesApiKey,
  googleRoutesApiKey,
  hereApiKey,
  mapboxAccessToken,
};

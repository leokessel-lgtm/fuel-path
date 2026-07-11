function createGeocodeCache({ freshSeconds = 21600, degradedSeconds = 60, defaultMaxEntries = 500 } = {}) {
  const entries = new Map();

  function read(key) {
    const entry = entries.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      entries.delete(key);
      return null;
    }
    return entry.payload;
  }

  function write(key, payload, durable) {
    entries.set(key, { expiresAt: Date.now() + (durable ? freshSeconds : degradedSeconds) * 1000, payload });
    const maxEntries = configuredMaxEntries(defaultMaxEntries);
    while (entries.size > maxEntries) {
      const oldestKey = entries.keys().next().value;
      if (!oldestKey) break;
      entries.delete(oldestKey);
    }
  }

  return { read, write };
}

function configuredMaxEntries(fallback) {
  const parsed = Number(process.env.FUEL_PATH_GEOCODE_CACHE_MAX_ENTRIES);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(5000, Math.round(parsed)));
}

module.exports = { createGeocodeCache };

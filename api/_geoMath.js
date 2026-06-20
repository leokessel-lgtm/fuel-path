function distanceKm(a, b) {
  const radiusKm = 6371;
  const dLat = toRad(Number(b.lat) - Number(a.lat));
  const dLon = toRad(Number(b.lon) - Number(a.lon));
  const lat1 = toRad(Number(a.lat));
  const lat2 = toRad(Number(b.lat));
  const hav = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(hav));
}

function totalRouteKm(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distanceKm(points[index - 1], points[index]);
  }
  return total;
}

function routeBounds(points = [], paddingKm = 0) {
  const validPoints = points.filter((point) => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)));
  if (!validPoints.length) return null;
  const lats = validPoints.map((point) => Number(point.lat));
  const lons = validPoints.map((point) => Number(point.lon));
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const latPadding = Math.max(0, Number(paddingKm || 0)) / 110.574;
  const lonPadding = Math.max(0, Number(paddingKm || 0)) / Math.max(1, 111.32 * Math.cos(toRad(midLat)));
  return {
    minLat: Math.min(...lats) - latPadding,
    maxLat: Math.max(...lats) + latPadding,
    minLon: Math.min(...lons) - lonPadding,
    maxLon: Math.max(...lons) + lonPadding,
  };
}

function pointInRouteBounds(point, bounds) {
  if (!bounds) return true;
  const lat = Number(point.lat);
  const lon = Number(point.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= bounds.minLat && lat <= bounds.maxLat && lon >= bounds.minLon && lon <= bounds.maxLon;
}

function nearestRoutePosition(station, points) {
  if (!points.length) return [0, 0];
  if (points.length === 1) return [distanceKm(station, points[0]), 0];

  let bestDistance = Infinity;
  let bestAlong = 0;
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentKm = distanceKm(start, end);
    if (segmentKm <= 0) continue;
    const localStation = toLocalXYKm(station, start);
    const localEnd = toLocalXYKm(end, start);
    const lengthSquared = localEnd.x ** 2 + localEnd.y ** 2;
    const t = Math.max(0, Math.min(1, (localStation.x * localEnd.x + localStation.y * localEnd.y) / lengthSquared));
    const projected = { x: localEnd.x * t, y: localEnd.y * t };
    const localDistance = Math.hypot(localStation.x - projected.x, localStation.y - projected.y);
    if (localDistance < bestDistance) {
      bestDistance = localDistance;
      bestAlong = travelled + segmentKm * t;
    }
    travelled += segmentKm;
  }
  return [bestDistance, bestAlong];
}

function toLocalXYKm(point, origin) {
  const latKm = 110.574;
  const lonKm = 111.32 * Math.cos(toRad(origin.lat));
  return {
    x: (point.lon - origin.lon) * lonKm,
    y: (point.lat - origin.lat) * latKm,
  };
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

module.exports = {
  distanceKm,
  nearestRoutePosition,
  pointInRouteBounds,
  routeBounds,
  totalRouteKm,
};

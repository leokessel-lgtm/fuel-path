import { Linking, Platform } from "react-native";

import { AppPreferences, EvConnector, MapPoint } from "../types";
import { NearbyMode } from "../components/NearbyEvControls";

export function sameStationCodes(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export function preferredNearbyMode(preferences: AppPreferences): NearbyMode {
  return preferences.vehicleEnergyType === "electric" ? "ev" : "fuel";
}

export function toggleConnectorFilter(current: EvConnector[], connector: EvConnector) {
  return current.includes(connector)
    ? current.filter((item) => item !== connector)
    : [...current, connector];
}

function combinedNearbyNotice(stationNotice: string, evNotice: string, chargerCount: number) {
  const chargerNotice = chargerCount
    ? `${chargerCount} charger pins shown. Charger availability is directory-only.`
    : evNotice;
  return [stationNotice, chargerNotice].filter(Boolean).join(" ");
}

export function distanceKm(left: MapPoint, right: MapPoint) {
  const radiusKm = 6371;
  const dLat = toRad(right.lat - left.lat);
  const dLon = toRad(right.lon - left.lon);
  const lat1 = toRad(left.lat);
  const lat2 = toRad(right.lat);
  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(hav));
}

export function shortLocationLabel(query: string, resolvedLabel: string) {
  return query.length <= 42 ? query : resolvedLabel.split(",").slice(0, 3).join(",").trim() || query;
}

export async function openDirections(lat: number, lon: number, labelText = "Destination") {
  const label = encodeURIComponent(labelText);
  const safeLat = Number(lat);
  const safeLon = Number(lon);
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?daddr=${safeLat},${safeLon}&q=${label}`
      : Platform.OS === "android"
        ? `geo:0,0?q=${safeLat},${safeLon}(${label})`
        : `https://www.google.com/maps/dir/?api=1&destination=${safeLat},${safeLon}&travelmode=driving`;
  await Linking.openURL(url);
}

export async function openRouteDirectionsViaStop({
  destination,
  origin,
  stop,
}: {
  destination: MapPoint;
  origin: MapPoint;
  stop: { lat: number; lon: number; label: string };
}) {
  const originValue = coordinateParam(origin.lat, origin.lon);
  const stopValue = coordinateParam(stop.lat, stop.lon);
  const destinationValue = coordinateParam(destination.lat, destination.lon);
  const params = new URLSearchParams({
    api: "1",
    origin: originValue,
    destination: destinationValue,
    travelmode: "driving",
    waypoints: stopValue,
  });
  const url = `https://www.google.com/maps/dir/?${params.toString()}`;
  await Linking.openURL(url);
}

function coordinateParam(lat: number, lon: number) {
  return `${Number(lat)},${Number(lon)}`;
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

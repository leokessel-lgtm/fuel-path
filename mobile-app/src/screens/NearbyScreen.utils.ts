import * as IntentLauncher from "expo-intent-launcher";
import { ActionSheetIOS, Alert, Linking, Platform } from "react-native";

import { AppPreferences, EvConnector, MapPoint, NavigationAppPreference } from "../types";
import { NearbyMode } from "../components/NearbyEvControls";

const ANDROID_VIEW_ACTION = "android.intent.action.VIEW";
const ANDROID_GOOGLE_MAPS_PACKAGE = "com.google.android.apps.maps";
const ANDROID_WAZE_PACKAGE = "com.waze";

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

export async function openDirections(
  lat: number,
  lon: number,
  labelText = "Destination",
  navigationApp: NavigationAppPreference = "device_maps",
) {
  const label = encodeURIComponent(labelText);
  const safeLat = Number(lat);
  const safeLon = Number(lon);
  const appleMapsUrl = `http://maps.apple.com/?daddr=${safeLat},${safeLon}&q=${label}&dirflg=d`;
  const wazeUrl = `https://waze.com/ul?ll=${safeLat},${safeLon}&navigate=yes&utm_source=fuelpath`;
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${safeLat},${safeLon}&travelmode=driving`;
  if (Platform.OS === "ios") {
    const nativeGoogleMapsUrl = nativeGoogleMapsUrlFor(googleMapsUrl);
    const option = await chooseNavigationOption({
      navigationApp,
      title: "Navigate to destination",
      options: [
        { label: "Apple Maps", provider: "apple_maps", url: appleMapsUrl },
        ...(await canOpenWaze() ? [{ label: "Waze", provider: "waze" as const, url: wazeUrl }] : []),
        ...(await canOpenGoogleMaps() ? [{ label: "Google Maps", provider: "google_maps" as const, url: nativeGoogleMapsUrl }] : []),
      ],
    });
    await openNavigationOption(option);
    return;
  }
  if (Platform.OS === "android") {
    const geoUrl = `geo:0,0?q=${safeLat},${safeLon}(${label})`;
    const option = await chooseNavigationOption({
      navigationApp,
      title: "Navigate to destination",
      options: [
        {
          fallbackUrl: appleMapsUrl,
          label: "Apple Maps",
          provider: "apple_maps",
          url: appleMapsUrl,
        },
        {
          androidIntent: androidWazeIntent(safeLat, safeLon),
          fallbackUrl: wazeUrl,
          label: "Waze",
          provider: "waze",
          url: androidWazeUrl(safeLat, safeLon),
        },
        {
          androidIntent: androidGoogleMapsIntent(androidGoogleNavigationUrl(safeLat, safeLon)),
          fallbackUrl: googleMapsUrl,
          label: "Google Maps",
          provider: "google_maps",
          url: googleMapsUrl,
        },
        {
          androidIntent: androidDeviceMapsIntent(geoUrl),
          fallbackUrl: googleMapsUrl,
          label: "Maps",
          provider: "device_maps",
          url: geoUrl,
        },
      ],
    });
    await openNavigationOption(option);
    return;
  }
  const url =
    googleMapsUrl;
  await Linking.openURL(url);
}

export async function openRouteDirectionsViaStop({
  destination,
  navigationApp = "device_maps",
  origin,
  stop,
}: {
  destination: MapPoint;
  navigationApp?: NavigationAppPreference;
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
  const googleMapsUrl = `https://www.google.com/maps/dir/?${params.toString()}`;
  if (Platform.OS === "ios") {
    const appleMapsUrl = appleMapsRouteViaStopUrl(origin, stop, destination);
    const nativeGoogleMapsUrl = nativeGoogleMapsUrlFor(googleMapsUrl);
    const wazeStopUrl = `https://waze.com/ul?ll=${coordinateParam(stop.lat, stop.lon)}&navigate=yes&utm_source=fuelpath`;
    const option = await chooseNavigationOption({
      navigationApp,
      title: "Navigate via fuel stop",
      options: [
        { label: "Apple Maps", provider: "apple_maps", url: appleMapsUrl },
        ...(await canOpenWaze() ? [{ label: "Waze to stop", provider: "waze" as const, url: wazeStopUrl }] : []),
        ...(await canOpenGoogleMaps() ? [{ label: "Google Maps", provider: "google_maps" as const, url: nativeGoogleMapsUrl }] : []),
      ],
    });
    await openNavigationOption(option);
    return;
  }
  if (Platform.OS === "android") {
    const wazeStopUrl = `https://waze.com/ul?ll=${coordinateParam(stop.lat, stop.lon)}&navigate=yes&utm_source=fuelpath`;
    const appleMapsUrl = appleMapsRouteViaStopUrl(origin, stop, destination);
    const option = await chooseNavigationOption({
      navigationApp,
      title: "Navigate via fuel stop",
      options: [
        {
          androidIntent: androidGoogleMapsIntent(googleMapsUrl),
          fallbackUrl: googleMapsUrl,
          label: "Maps",
          provider: "device_maps",
          url: googleMapsUrl,
        },
        {
          fallbackUrl: appleMapsUrl,
          label: "Apple Maps",
          provider: "apple_maps",
          url: appleMapsUrl,
        },
        {
          androidIntent: androidWazeIntent(stop.lat, stop.lon),
          fallbackUrl: wazeStopUrl,
          label: "Waze to stop",
          provider: "waze",
          url: androidWazeUrl(stop.lat, stop.lon),
        },
        {
          androidIntent: androidGoogleMapsIntent(googleMapsUrl),
          fallbackUrl: googleMapsUrl,
          label: "Google Maps",
          provider: "google_maps",
          url: googleMapsUrl,
        },
      ],
    });
    await openNavigationOption(option);
    return;
  }
  await Linking.openURL(googleMapsUrl);
}

function coordinateParam(lat: number, lon: number) {
  return `${Number(lat)},${Number(lon)}`;
}

function appleMapsRouteViaStopUrl(
  origin: MapPoint,
  stop: { lat: number; lon: number },
  destination: MapPoint,
) {
  const params = new URLSearchParams({
    dirflg: "d",
    saddr: coordinateParam(origin.lat, origin.lon),
  });
  params.append("daddr", coordinateParam(stop.lat, stop.lon));
  params.append("daddr", coordinateParam(destination.lat, destination.lon));
  return `http://maps.apple.com/?${params.toString()}`;
}

function nativeGoogleMapsUrlFor(googleMapsUrl: string) {
  return `comgooglemapsurl://${googleMapsUrl.replace(/^https?:\/\//, "")}`;
}

function androidGoogleNavigationUrl(lat: number, lon: number) {
  return `google.navigation:q=${Number(lat)},${Number(lon)}&mode=d`;
}

function androidGoogleMapsIntent(data: string) {
  return {
    action: ANDROID_VIEW_ACTION,
    data,
    packageName: ANDROID_GOOGLE_MAPS_PACKAGE,
  };
}

function androidDeviceMapsIntent(data: string) {
  return {
    action: ANDROID_VIEW_ACTION,
    data,
  };
}

function androidWazeUrl(lat: number, lon: number) {
  return `waze://?ll=${Number(lat)},${Number(lon)}&navigate=yes&utm_source=fuelpath`;
}

function androidWazeIntent(lat: number, lon: number) {
  return {
    action: ANDROID_VIEW_ACTION,
    data: androidWazeUrl(lat, lon),
    packageName: ANDROID_WAZE_PACKAGE,
  };
}

async function canOpenWaze() {
  return Linking.canOpenURL("waze://");
}

async function canOpenGoogleMaps() {
  return Linking.canOpenURL("comgooglemapsurl://");
}

type NavigationOption = {
  androidIntent?: {
    action: string;
    data: string;
    packageName?: string;
  };
  fallbackUrl?: string;
  label: string;
  provider: NavigationAppPreference;
  url: string;
};

async function openNavigationOption(option: NavigationOption | undefined) {
  if (!option) return;
  try {
    if (Platform.OS === "android" && option.androidIntent) {
      await IntentLauncher.startActivityAsync(option.androidIntent.action, {
        data: option.androidIntent.data,
        packageName: option.androidIntent.packageName,
      });
      return;
    }
    await Linking.openURL(option.url);
  } catch (error) {
    if (!option.fallbackUrl) throw error;
    await Linking.openURL(option.fallbackUrl);
  }
}

function chooseNavigationOption({
  navigationApp,
  options,
  title,
}: {
  navigationApp: NavigationAppPreference;
  options: NavigationOption[];
  title: string;
}) {
  if (navigationApp !== "ask") {
    const preferred = options.find((option) => option.provider === navigationApp)
      || options.find((option) => option.provider === "device_maps")
      || options.find((option) => option.provider === "apple_maps")
      || options.find((option) => option.provider === "google_maps")
      || options[0];
    return Promise.resolve(preferred);
  }
  if (options.length <= 1) return Promise.resolve(options[0]);
  if (Platform.OS === "android") {
    return new Promise<NavigationOption | undefined>((resolve) => {
      Alert.alert(
        title,
        undefined,
        [
          ...options.map((option) => ({
            text: option.label,
            onPress: () => resolve(option),
          })),
          {
            style: "cancel" as const,
            text: "Cancel",
            onPress: () => resolve(undefined),
          },
        ],
        {
          cancelable: true,
          onDismiss: () => resolve(undefined),
        },
      );
    });
  }
  return new Promise<NavigationOption | undefined>((resolve) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        cancelButtonIndex: options.length,
        options: [...options.map((option) => option.label), "Cancel"],
        title,
      },
      (buttonIndex) => {
        resolve(buttonIndex < options.length ? options[buttonIndex] : undefined);
      },
    );
  });
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

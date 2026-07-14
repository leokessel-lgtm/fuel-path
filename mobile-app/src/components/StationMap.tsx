import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, mapSkin, radii, shadow, spacing } from "../theme";
import { EvCharger, MapPoint, StationViewModel } from "../types";
import { BrandBadge } from "./BrandBadge";
import { maxVisibleEvMarkers, prioritiseSelectedChargers } from "./stationMapDensity";

const maxStationMarkers = 240;
const mixedEnergyMaxStationMarkers = 48;
const emptyChargers: EvCharger[] = [];
const emptyRoutePoints: MapPoint[] = [];

type CameraInsets = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export function StationMap({
  centre,
  chargers = emptyChargers,
  stations,
  selectedChargerId,
  selectedStationCode,
  onSelect,
  onSelectCharger,
  onViewportStationsChange,
  onMapSearchAreaChange: _onMapSearchAreaChange,
  cameraFocusKey: _cameraFocusKey,
  showCentreMarker = true,
  routeEndpoints,
  routePoints = emptyRoutePoints,
  cameraInsets,
  userLocation,
  onMapPress,
}: {
  centre: MapPoint;
  chargers?: EvCharger[];
  stations: StationViewModel[];
  selectedChargerId?: string;
  selectedStationCode?: string;
  onSelect: (stationCode: string) => void;
  onSelectCharger?: (chargerId: string) => void;
  onViewportStationsChange?: (stationCodes: string[]) => void;
  onMapSearchAreaChange?: (area: { centre: MapPoint; radiusKm: number }) => void;
  cameraFocusKey?: string;
  showCentreMarker?: boolean;
  routeEndpoints?: { from: MapPoint; to: MapPoint };
  routePoints?: MapPoint[];
  cameraInsets?: CameraInsets;
  userLocation?: MapPoint;
  onMapPress?: () => void;
}) {
  useEffect(() => {
    onViewportStationsChange?.(stations.map((item) => item.station.stationCode));
  }, [onViewportStationsChange, stations]);

  const visibleRoutePoints = routePoints.length >= 2 ? sampleRoutePoints(routePoints, 90) : [];
  const activeInsets = resolveCameraInsets(routeEndpoints ? "route" : "nearby", cameraInsets);
  const points = routeEndpoints
    ? visibleRoutePoints.length
      ? visibleRoutePoints
      : [routeEndpoints.from, routeEndpoints.to]
    : [
        centre,
        ...(userLocation ? [userLocation] : []),
        ...stations.map((item) => ({
          lat: item.station.lat,
          lon: item.station.lon,
          label: item.station.name,
        })),
        ...chargers.map((charger) => ({
          lat: charger.lat,
          lon: charger.lon,
          label: charger.name,
        })),
      ];
  const bounds = boundingBox(points);
  const visibleStations = prioritiseSelectedStations(
    stations,
    selectedStationCode,
  ).slice(0, chargers.length ? mixedEnergyMaxStationMarkers : maxStationMarkers);
  const visibleChargers = prioritiseSelectedChargers(chargers, selectedChargerId).slice(0, maxVisibleEvMarkers);

  return (
    <View style={styles.map}>
      <View style={styles.mapGrid} />
      {!routeEndpoints && userLocation ? (
        <View style={[styles.userLocationPin, positionForPoint(userLocation, bounds, activeInsets)]}>
          <View style={styles.userLocationPinInner} />
        </View>
      ) : null}
      {!routeEndpoints && showCentreMarker ? (
        <View style={[styles.locationPin, positionForPoint(centre, bounds, activeInsets)]}>
          <View style={styles.locationPinInner} />
        </View>
      ) : null}
      {visibleRoutePoints.map((point, index) => (
        <View
          key={`${point.lat}-${point.lon}-${index}`}
          style={[styles.routeDot, positionForPoint(point, bounds, activeInsets)]}
        />
      ))}
      {visibleStations.map((item) => {
        const selected = item.station.stationCode === selectedStationCode;
        return (
          <Pressable
            key={item.station.stationCode}
            onPress={() => onSelect(item.station.stationCode)}
            style={[
              styles.pin,
              positionForPoint(item.station, bounds, activeInsets),
              selected && styles.pinSelected,
            ]}
          >
            <BrandBadge station={item.station} size={28} />
            <Text style={[styles.pinPrice, selected && styles.pinPriceSelected]}>
              {item.adjustedCpl.toFixed(1)}
            </Text>
          </Pressable>
        );
      })}
      {visibleChargers.map((charger) => {
        const selected = charger.id === selectedChargerId;
        const label = charger.maxPowerKw ? `${Math.round(charger.maxPowerKw)}kW` : "";
        return (
          <Pressable
            accessibilityLabel={`Select charger ${charger.name}`}
            accessibilityRole="button"
            key={charger.id}
            onPress={() => onSelectCharger?.(charger.id)}
            style={[
              styles.evPin,
              positionForPoint(charger, bounds, activeInsets),
              selected && styles.evPinSelected,
            ]}
          >
            <Text style={[styles.evPinIcon, selected && styles.evPinIconSelected]}>⚡</Text>
            {label ? (
              <Text style={[styles.evPinLabel, selected && styles.evPinLabelSelected]}>
                {label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
      {routeEndpoints ? (
        <View style={[styles.destinationPin, positionForPoint(routeEndpoints.to, bounds, activeInsets)]}>
          <View style={styles.destinationPinInner} />
        </View>
      ) : null}
    </View>
  );
}

function prioritiseSelectedStations(stations: StationViewModel[], selectedStationCode?: string) {
  if (!selectedStationCode) return stations;
  const selected = stations.find((item) => item.station.stationCode === selectedStationCode);
  if (!selected) return stations;
  return [selected, ...stations.filter((item) => item.station.stationCode !== selectedStationCode)];
}

function boundingBox(points: MapPoint[]) {
  const lats = points.map((point) => Number(point.lat));
  const lons = points.map((point) => Number(point.lon));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  return {
    minLat: minLat === maxLat ? minLat - 0.01 : minLat,
    maxLat: minLat === maxLat ? maxLat + 0.01 : maxLat,
    minLon: minLon === maxLon ? minLon - 0.01 : minLon,
    maxLon: minLon === maxLon ? maxLon + 0.01 : maxLon,
  };
}

function positionForPoint(
  point: { lat: number; lon: number },
  bounds: ReturnType<typeof boundingBox>,
  insets: Required<CameraInsets>,
) {
  const insetPercentages = cameraInsetsToPercentages(insets);
  const usableWidth = 100 - insetPercentages.left - insetPercentages.right;
  const usableHeight = 100 - insetPercentages.top - insetPercentages.bottom;
  const x =
    ((point.lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * usableWidth +
    insetPercentages.left;
  const y =
    (1 - (point.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * usableHeight +
    insetPercentages.top;
  return {
    left: `${Math.max(3, Math.min(92, x))}%` as `${number}%`,
    top: `${Math.max(4, Math.min(90, y))}%` as `${number}%`,
  };
}

function sampleRoutePoints(points: MapPoint[], maxPoints: number) {
  if (points.length <= maxPoints) return points;
  const sampled: MapPoint[] = [];
  let previousIndex = -1;
  for (let index = 0; index < maxPoints; index += 1) {
    const sourceIndex = Math.round((index / (maxPoints - 1)) * (points.length - 1));
    if (sourceIndex !== previousIndex) {
      sampled.push(points[sourceIndex]);
      previousIndex = sourceIndex;
    }
  }
  return sampled;
}

function resolveCameraInsets(mode: "nearby" | "route", insets?: CameraInsets): Required<CameraInsets> {
  const defaults =
    mode === "route"
      ? { top: 22, right: 22, bottom: 26, left: 22 }
      : { top: 170, right: 22, bottom: 190, left: 22 };
  return {
    top: insets?.top ?? defaults.top,
    right: insets?.right ?? defaults.right,
    bottom: insets?.bottom ?? defaults.bottom,
    left: insets?.left ?? defaults.left,
  };
}

function cameraInsetsToPercentages(insets: Required<CameraInsets>) {
  return {
    top: Math.min(34, insets.top / 7),
    right: Math.min(20, insets.right / 4),
    bottom: Math.min(36, insets.bottom / 7),
    left: Math.min(20, insets.left / 4),
  };
}

const styles = StyleSheet.create({
  map: {
    backgroundColor: colors.mapMist,
    borderRadius: radii.xl,
    flex: 1,
    minHeight: 330,
    overflow: "hidden",
    position: "relative",
  },
  mapGrid: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#dce8e2",
    opacity: 0.9,
  },
  routeDot: {
    backgroundColor: mapSkin.route,
    borderRadius: radii.pill,
    height: 7,
    marginLeft: -3,
    marginTop: -3,
    opacity: 0.7,
    position: "absolute",
    width: 7,
  },
  locationPin: {
    ...shadow.soft,
    backgroundColor: colors.ink,
    borderColor: colors.white,
    borderRadius: radii.pill,
    borderBottomLeftRadius: 4,
    borderWidth: 3,
    height: 30,
    marginLeft: -15,
    marginTop: -30,
    position: "absolute",
    transform: [{ rotate: "-45deg" }],
    width: 30,
  },
  locationPinInner: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    height: 8,
    left: 8,
    position: "absolute",
    top: 8,
    width: 8,
  },
  userLocationPin: {
    ...shadow.soft,
    backgroundColor: colors.route,
    borderColor: colors.white,
    borderRadius: radii.pill,
    borderBottomLeftRadius: 4,
    borderWidth: 3,
    height: 30,
    marginLeft: -15,
    marginTop: -30,
    position: "absolute",
    transform: [{ rotate: "-45deg" }],
    width: 30,
  },
  userLocationPinInner: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    height: 8,
    left: 8,
    position: "absolute",
    top: 8,
    width: 8,
  },
  pin: {
    ...shadow.soft,
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.white,
    borderRadius: radii.pill,
    borderWidth: 2,
    flexDirection: "row",
    gap: spacing.xs,
    marginLeft: -43,
    marginTop: -38,
    minWidth: 86,
    padding: 4,
    paddingRight: spacing.sm,
    position: "absolute",
    zIndex: 20,
  },
  pinSelected: {
    backgroundColor: colors.black,
    elevation: 8,
    transform: [{ scale: 1.05 }],
    zIndex: 70,
  },
  pinPrice: {
    color: colors.greenDark,
    fontSize: 13,
    fontWeight: "900",
  },
  pinPriceSelected: {
    color: colors.white,
  },
  evPin: {
    ...shadow.soft,
    alignItems: "center",
    backgroundColor: colors.blue,
    borderColor: colors.blue,
    borderRadius: 18,
    borderWidth: 2,
    flexDirection: "row",
    gap: spacing.xs,
    marginLeft: -24,
    marginTop: -38,
    minWidth: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    position: "absolute",
    zIndex: 30,
  },
  evPinSelected: {
    backgroundColor: colors.black,
    borderColor: colors.black,
    elevation: 8,
    transform: [{ scale: 1.05 }],
    zIndex: 80,
  },
  evPinIcon: {
    color: "#ffd166",
    fontSize: 16,
    fontWeight: "900",
  },
  evPinIconSelected: {
    color: "#ffd166",
  },
  evPinLabel: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "900",
  },
  evPinLabelSelected: {
    color: colors.white,
  },
  destinationPin: {
    ...shadow.soft,
    backgroundColor: mapSkin.route,
    borderColor: colors.white,
    borderRadius: radii.pill,
    borderBottomLeftRadius: 4,
    borderWidth: 3,
    height: 30,
    marginLeft: -15,
    marginTop: -30,
    position: "absolute",
    transform: [{ rotate: "-45deg" }],
    width: 30,
  },
  destinationPinInner: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    height: 8,
    left: 8,
    position: "absolute",
    top: 8,
    width: 8,
  },
});

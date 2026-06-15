import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing } from "../theme";
import { MapPoint, StationViewModel } from "../types";
import { BrandBadge } from "./BrandBadge";

const maxStationMarkers = 240;

type CameraInsets = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export function StationMap({
  centre,
  stations,
  selectedStationCode,
  onSelect,
  onViewportStationsChange,
  onMapSearchAreaChange: _onMapSearchAreaChange,
  cameraFocusKey: _cameraFocusKey,
  showCentreMarker = true,
  routeEndpoints,
  routePoints = [],
  cameraInsets,
}: {
  centre: MapPoint;
  stations: StationViewModel[];
  selectedStationCode?: string;
  onSelect: (stationCode: string) => void;
  onViewportStationsChange?: (stationCodes: string[]) => void;
  onMapSearchAreaChange?: (area: { centre: MapPoint; radiusKm: number }) => void;
  cameraFocusKey?: string;
  showCentreMarker?: boolean;
  routeEndpoints?: { from: MapPoint; to: MapPoint };
  routePoints?: MapPoint[];
  cameraInsets?: CameraInsets;
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
        ...stations.map((item) => ({
          lat: item.station.lat,
          lon: item.station.lon,
          label: item.station.name,
        })),
      ];
  const bounds = boundingBox(points);

  return (
    <View style={styles.map}>
      <View style={styles.mapGrid} />
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
      {stations.slice(0, maxStationMarkers).map((item) => {
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
            <Text style={styles.pinPrice}>{item.adjustedCpl.toFixed(1)}</Text>
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
    backgroundColor: colors.green,
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
  pin: {
    ...shadow.soft,
    alignItems: "center",
    backgroundColor: colors.green,
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
  },
  pinSelected: {
    backgroundColor: colors.ink,
    transform: [{ scale: 1.05 }],
  },
  pinPrice: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900",
  },
  destinationPin: {
    ...shadow.soft,
    backgroundColor: colors.green,
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

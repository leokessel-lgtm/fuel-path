import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type MapMarker,
  type Region,
} from "react-native-maps";

import { colors, mapSkin, radii, shadow, spacing } from "../theme";
import { MapPoint, StationViewModel } from "../types";
import { BrandBadge } from "./BrandBadge";

const maxStationMarkers = 240;
const maxPriceMarkers = 18;
const maxDotMarkers = 90;
const markerGridSize = 132;
const compactMarkerGridSize = 36;
const decorativeStationMarkerAccessibility = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants" as const,
};

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
  onMapSearchAreaChange,
  cameraFocusKey,
  showCentreMarker = true,
  routeEndpoints,
  routePoints = [],
  cameraInsets,
  userLocation,
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
  userLocation?: MapPoint;
}) {
  const mapRef = useRef<MapView | null>(null);
  const markerRefs = useRef<Record<string, MapMarker | null>>({});
  const lastCameraKeyRef = useRef("");
  const lastReportedUserCentreKeyRef = useRef("");
  const programmaticMoveRef = useRef(false);
  const userMovedMapRef = useRef(false);
  const userGestureStartedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapMovedByUser, setMapMovedByUser] = useState(false);
  const [cameraResetVersion, setCameraResetVersion] = useState(0);
  const [currentRegion, setCurrentRegion] = useState<Region>(() => regionForPoint(centre));

  const visibleRoutePoints = useMemo(
    () => (routePoints.length >= 2 ? sampleRoutePoints(routePoints, 180) : []),
    [routePoints],
  );
  const activeInsets = useMemo(
    () => resolveCameraInsets(routeEndpoints ? "route" : "nearby", cameraInsets),
    [cameraInsets, routeEndpoints],
  );
  const cameraCoordinates = useMemo(() => {
    if (routeEndpoints) {
      if (visibleRoutePoints.length >= 2) return visibleRoutePoints;
      return [routeEndpoints.from, routeEndpoints.to];
    }
    return [
      centre,
      ...stations.slice(0, maxStationMarkers).map((item) => ({
        lat: item.station.lat,
        lon: item.station.lon,
        label: item.station.name,
      })),
    ];
  }, [centre, routeEndpoints, stations, visibleRoutePoints]);
  const initialRegion = useMemo(() => regionForPoint(centre), [centre]);
  const markerGroups = useMemo(
    () => visibleMarkerGroups(stations.slice(0, maxStationMarkers), currentRegion, selectedStationCode),
    [currentRegion, selectedStationCode, stations],
  );

  useEffect(() => {
    if (!mapReady || !mapRef.current || !cameraCoordinates.length) return;

    const cameraKey = [
      routeEndpoints ? "route" : "nearby",
      cameraFocusKey || "initial",
      cameraResetVersion,
      cameraInsetsKey(activeInsets),
    ].join("|");
    const cameraContextChanged = cameraKey !== lastCameraKeyRef.current;
    if (!cameraContextChanged && userMovedMapRef.current) return;
    if (cameraContextChanged) {
      userGestureStartedRef.current = false;
      lastReportedUserCentreKeyRef.current = "";
      setMapMovedByUser(false);
    }

    runProgrammaticMapMove(programmaticMoveRef, () => {
      if (cameraCoordinates.length === 1) {
        mapRef.current?.animateToRegion(regionForPoint(cameraCoordinates[0]), 260);
        return;
      }
      mapRef.current?.fitToCoordinates(
        cameraCoordinates.map((point) => ({
          latitude: point.lat,
          longitude: point.lon,
        })),
        {
          animated: true,
          edgePadding: activeInsets,
        },
      );
    });
    lastCameraKeyRef.current = cameraKey;
    userMovedMapRef.current = false;
  }, [
    activeInsets,
    cameraCoordinates,
    cameraFocusKey,
    cameraResetVersion,
    mapReady,
    routeEndpoints,
  ]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedStationCode) return;
    const selected = stations.find((item) => item.station.stationCode === selectedStationCode);
    if (!selected) return;

    markerRefs.current[selectedStationCode]?.showCallout();
    if (!userMovedMapRef.current) {
      runProgrammaticMapMove(programmaticMoveRef, () => {
        mapRef.current?.animateCamera(
          {
            center: {
              latitude: selected.station.lat,
              longitude: selected.station.lon,
            },
          },
          { duration: 260 },
        );
      });
    }
  }, [mapReady, selectedStationCode, stations]);

  const handleRegionChangeComplete = (region: Region) => {
    setCurrentRegion(region);
    if (!programmaticMoveRef.current && userGestureStartedRef.current) {
      userMovedMapRef.current = true;
      setMapMovedByUser(true);
      if (!routeEndpoints) {
        const radiusKm = radiusKmForRegion(region);
        const centreKey = `${region.latitude.toFixed(4)}:${region.longitude.toFixed(
          4,
        )}:${Math.round(radiusKm)}`;
        if (centreKey !== lastReportedUserCentreKeyRef.current) {
          lastReportedUserCentreKeyRef.current = centreKey;
          onMapSearchAreaChange?.({
            centre: {
              lat: region.latitude,
              lon: region.longitude,
              label: "Map area",
            },
            radiusKm,
          });
        }
      }
    }
    onViewportStationsChange?.(stationCodesInRegion(stations, region));
  };

  const handleMarkerPress = (stationCode: string) => {
    onSelect(stationCode);
  };

  return (
    <View style={styles.map}>
      <MapView
        ref={mapRef}
        initialRegion={initialRegion}
        mapPadding={activeInsets}
        onMapReady={() => setMapReady(true)}
        onPanDrag={() => {
          if (!programmaticMoveRef.current) {
            userGestureStartedRef.current = true;
            userMovedMapRef.current = true;
            setMapMovedByUser(true);
          }
        }}
        onRegionChangeComplete={handleRegionChangeComplete}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        showsCompass={false}
        showsMyLocationButton={false}
        showsPointsOfInterests
        style={StyleSheet.absoluteFill}
      >
        {visibleRoutePoints.length >= 2 ? (
          <Polyline
            coordinates={visibleRoutePoints.map((point) => ({
              latitude: point.lat,
              longitude: point.lon,
            }))}
            strokeColor={mapSkin.route}
            strokeWidth={6}
          />
        ) : null}

        {!routeEndpoints && userLocation ? (
          <Marker
            coordinate={{ latitude: userLocation.lat, longitude: userLocation.lon }}
            title="My location"
            tracksViewChanges={false}
            zIndex={900}
          >
            <View style={styles.userLocationPin}>
              <View style={styles.userLocationPinInner} />
            </View>
          </Marker>
        ) : null}

        {!routeEndpoints && showCentreMarker ? (
          <Marker
            coordinate={{ latitude: centre.lat, longitude: centre.lon }}
            title={centre.label}
            tracksViewChanges={false}
            zIndex={800}
          >
            <View style={styles.locationPin}>
              <View style={styles.locationPinInner} />
            </View>
          </Marker>
        ) : null}

        {routeEndpoints ? (
          <Marker
            coordinate={{
              latitude: routeEndpoints.to.lat,
              longitude: routeEndpoints.to.lon,
            }}
            title={routeEndpoints.to.label}
            tracksViewChanges={false}
            zIndex={700}
          >
            <View style={styles.destinationPin}>
              <View style={styles.destinationPinInner} />
            </View>
          </Marker>
        ) : null}

        {markerGroups.dotMarkers.map((item) => (
          <Marker
            {...decorativeStationMarkerAccessibility}
            coordinate={{ latitude: item.station.lat, longitude: item.station.lon }}
            key={`dot-${item.station.stationCode}`}
            onPress={() => handleMarkerPress(item.station.stationCode)}
            tracksViewChanges={false}
            zIndex={100}
          >
            <View style={styles.compactPin} />
          </Marker>
        ))}

        {markerGroups.priceMarkers.map((item) => {
          const selected = item.station.stationCode === selectedStationCode;
          return (
            <Marker
              {...decorativeStationMarkerAccessibility}
              coordinate={{ latitude: item.station.lat, longitude: item.station.lon }}
              key={item.station.stationCode}
              onPress={() => handleMarkerPress(item.station.stationCode)}
              ref={(marker) => {
                markerRefs.current[item.station.stationCode] = marker;
              }}
              tracksViewChanges={false}
              zIndex={selected ? 700 : 500}
            >
              <View style={styles.pinAnchor}>
                <View style={[styles.pin, selected && styles.pinSelected]}>
                  <Text style={[styles.pinPrice, selected && styles.pinPriceSelected]}>
                    {item.adjustedCpl.toFixed(1)}
                  </Text>
                  <View style={styles.pinBrand}>
                    <BrandBadge station={item.station} size={20} />
                  </View>
                </View>
                <View style={[styles.pinPointer, selected && styles.pinPointerSelected]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {mapMovedByUser ? (
        <Pressable
          accessibilityLabel={routeEndpoints ? "Return to route" : "Recenter map"}
          accessibilityRole="button"
          onPress={() => {
            userMovedMapRef.current = false;
            userGestureStartedRef.current = false;
            setMapMovedByUser(false);
            lastCameraKeyRef.current = "";
            setCameraResetVersion((current) => current + 1);
          }}
          style={styles.recenterButton}
        >
          <Text style={styles.recenterText}>{routeEndpoints ? "Route" : "Center"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function regionForPoint(point: MapPoint): Region {
  return {
    latitude: point.lat,
    longitude: point.lon,
    latitudeDelta: 0.09,
    longitudeDelta: 0.09,
  };
}

function stationCodesInRegion(stations: StationViewModel[], region: Region) {
  const minLat = region.latitude - region.latitudeDelta / 2;
  const maxLat = region.latitude + region.latitudeDelta / 2;
  const minLon = region.longitude - region.longitudeDelta / 2;
  const maxLon = region.longitude + region.longitudeDelta / 2;
  return stations
    .filter(
      (item) =>
        item.station.lat >= minLat &&
        item.station.lat <= maxLat &&
        item.station.lon >= minLon &&
        item.station.lon <= maxLon,
    )
    .map((item) => item.station.stationCode);
}

function visibleMarkerGroups(
  stations: StationViewModel[],
  region: Region,
  selectedStationCode?: string,
) {
  const protectedCodes = protectedStationCodes(stations, selectedStationCode);
  const priceCells = new Set<string>();
  const compactCells = new Set<string>();
  const priceMarkers: StationViewModel[] = [];
  const dotMarkers: StationViewModel[] = [];

  const ranked = [...stations].sort((left, right) => {
    const leftProtected = protectedCodes.has(left.station.stationCode) ? 0 : 1;
    const rightProtected = protectedCodes.has(right.station.stationCode) ? 0 : 1;
    return (
      leftProtected - rightProtected ||
      markerPriorityScore(left) - markerPriorityScore(right)
    );
  });

  for (const item of ranked) {
    const code = item.station.stationCode;
    const priceCell = markerCell(item, region, markerGridSize);
    const compactCell = markerCell(item, region, compactMarkerGridSize);
    const protectedMarker = protectedCodes.has(code);

    if (
      protectedMarker ||
      (priceMarkers.length < maxPriceMarkers && !priceCells.has(priceCell))
    ) {
      priceMarkers.push(item);
      priceCells.add(priceCell);
      compactCells.add(compactCell);
      continue;
    }

    if (dotMarkers.length < maxDotMarkers && !compactCells.has(compactCell)) {
      dotMarkers.push(item);
      compactCells.add(compactCell);
    }
  }

  return { priceMarkers, dotMarkers };
}

function protectedStationCodes(stations: StationViewModel[], selectedStationCode?: string) {
  const codes = new Set<string>();
  if (selectedStationCode) codes.add(selectedStationCode);
  const cheapest = minBy(stations, (item) => item.adjustedCpl);
  const closest = minBy(stations, (item) => item.distanceKm);
  const bestValue = minBy(stations, markerPriorityScore);
  for (const item of [cheapest, closest, bestValue]) {
    if (item) codes.add(item.station.stationCode);
  }
  return codes;
}

function minBy<T>(items: T[], score: (item: T) => number) {
  let best: T | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const item of items) {
    const nextScore = score(item);
    if (nextScore < bestScore) {
      best = item;
      bestScore = nextScore;
    }
  }
  return best;
}

function markerPriorityScore(item: StationViewModel) {
  return item.adjustedCpl + item.distanceKm * 0.85;
}

function markerCell(item: StationViewModel, region: Region, gridSize: number) {
  const safeLatDelta = Math.max(region.latitudeDelta, 0.005);
  const safeLonDelta = Math.max(region.longitudeDelta, 0.005);
  const x = ((item.station.lon - (region.longitude - safeLonDelta / 2)) / safeLonDelta) * 1000;
  const y = ((item.station.lat - (region.latitude - safeLatDelta / 2)) / safeLatDelta) * 1000;
  return `${Math.round(x / gridSize)}:${Math.round(y / gridSize)}`;
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

function cameraInsetsKey(insets: Required<CameraInsets>) {
  return `${insets.top}:${insets.right}:${insets.bottom}:${insets.left}`;
}

function radiusKmForRegion(region: Region) {
  const centre = {
    lat: region.latitude,
    lon: region.longitude,
  };
  const halfLat = region.latitudeDelta / 2;
  const halfLon = region.longitudeDelta / 2;
  const corners = [
    { lat: region.latitude + halfLat, lon: region.longitude + halfLon },
    { lat: region.latitude + halfLat, lon: region.longitude - halfLon },
    { lat: region.latitude - halfLat, lon: region.longitude + halfLon },
    { lat: region.latitude - halfLat, lon: region.longitude - halfLon },
  ];
  return Math.max(...corners.map((corner) => distanceKm(centre, corner)));
}

function distanceKm(
  left: { lat: number; lon: number },
  right: { lat: number; lon: number },
) {
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

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function runProgrammaticMapMove(
  programmaticMoveRef: { current: boolean },
  move: () => void,
) {
  programmaticMoveRef.current = true;
  move();
  setTimeout(() => {
    programmaticMoveRef.current = false;
  }, 500);
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
  locationPin: {
    ...shadow.soft,
    backgroundColor: colors.ink,
    borderColor: colors.white,
    borderRadius: radii.pill,
    borderBottomLeftRadius: 4,
    borderWidth: 3,
    height: 30,
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
    backgroundColor: colors.blue,
    borderColor: colors.white,
    borderRadius: radii.pill,
    borderBottomLeftRadius: 4,
    borderWidth: 3,
    height: 30,
    transform: [{ rotate: "-45deg" }],
    width: 30,
  },
  userLocationPinInner: {
    backgroundColor: colors.white,
    borderColor: colors.blueSoft,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 10,
    left: 7,
    position: "absolute",
    top: 7,
    width: 10,
  },
  destinationPin: {
    ...shadow.soft,
    backgroundColor: mapSkin.route,
    borderColor: colors.white,
    borderRadius: radii.pill,
    borderBottomLeftRadius: 4,
    borderWidth: 3,
    height: 30,
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
  pinAnchor: {
    alignItems: "center",
  },
  pin: {
    ...shadow.soft,
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "rgba(7, 86, 66, 0.18)",
    borderRadius: radii.md,
    borderWidth: 1,
    minWidth: 52,
    overflow: "hidden",
  },
  pinSelected: {
    borderColor: colors.green,
    transform: [{ scale: 1.05 }],
  },
  pinPrice: {
    backgroundColor: colors.greenDark,
    color: colors.white,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18,
    minWidth: 52,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    textAlign: "center",
  },
  pinPriceSelected: {
    backgroundColor: colors.green,
  },
  pinBrand: {
    alignItems: "center",
    backgroundColor: colors.white,
    minHeight: 22,
    justifyContent: "center",
    width: "100%",
  },
  pinPointer: {
    borderLeftColor: "transparent",
    borderLeftWidth: 6,
    borderRightColor: "transparent",
    borderRightWidth: 6,
    borderTopColor: colors.white,
    borderTopWidth: 8,
    height: 0,
    marginTop: -1,
    width: 0,
  },
  pinPointerSelected: {
    borderTopColor: colors.white,
  },
  compactPin: {
    ...shadow.soft,
    backgroundColor: colors.white,
    borderColor: colors.green,
    borderRadius: radii.pill,
    borderWidth: 3,
    height: 18,
    width: 18,
  },
  recenterButton: {
    ...shadow.soft,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    position: "absolute",
    right: spacing.md,
    top: spacing.md,
  },
  recenterText: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: "900",
  },
});

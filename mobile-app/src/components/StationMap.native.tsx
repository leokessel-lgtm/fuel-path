import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type MapMarker,
  type Region,
} from "react-native-maps";

import { colors, radii, shadow, spacing } from "../theme";
import { MapPoint, StationViewModel } from "../types";
import { BrandBadge } from "./BrandBadge";

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
  onMapCentreChange,
  cameraFocusKey,
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
  onMapCentreChange?: (centre: MapPoint) => void;
  cameraFocusKey?: string;
  showCentreMarker?: boolean;
  routeEndpoints?: { from: MapPoint; to: MapPoint };
  routePoints?: MapPoint[];
  cameraInsets?: CameraInsets;
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
      ...stations.slice(0, 60).map((item) => ({
        lat: item.station.lat,
        lon: item.station.lon,
        label: item.station.name,
      })),
    ];
  }, [centre, routeEndpoints, stations, visibleRoutePoints]);
  const initialRegion = useMemo(() => regionForPoint(centre), [centre]);

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

    runProgrammaticMapMove(programmaticMoveRef, () => {
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
    if (!programmaticMoveRef.current && userGestureStartedRef.current) {
      userMovedMapRef.current = true;
      setMapMovedByUser(true);
      if (!routeEndpoints) {
        const centreKey = `${region.latitude.toFixed(4)}:${region.longitude.toFixed(4)}`;
        if (centreKey !== lastReportedUserCentreKeyRef.current) {
          lastReportedUserCentreKeyRef.current = centreKey;
          onMapCentreChange?.({
            lat: region.latitude,
            lon: region.longitude,
            label: "Map area",
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
            strokeColor={colors.green}
            strokeWidth={5}
          />
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

        {stations.slice(0, 60).map((item) => {
          const selected = item.station.stationCode === selectedStationCode;
          return (
            <Marker
              coordinate={{ latitude: item.station.lat, longitude: item.station.lon }}
              description={`${item.adjustedCpl.toFixed(1)} c/L`}
              key={item.station.stationCode}
              onPress={() => handleMarkerPress(item.station.stationCode)}
              ref={(marker) => {
                markerRefs.current[item.station.stationCode] = marker;
              }}
              title={item.station.name}
              tracksViewChanges={false}
              zIndex={selected ? 500 : 0}
            >
              <View style={[styles.pin, selected && styles.pinSelected]}>
                <BrandBadge station={item.station} size={28} />
                <Text style={styles.pinPrice}>{item.adjustedCpl.toFixed(1)}</Text>
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
  destinationPin: {
    ...shadow.soft,
    backgroundColor: colors.green,
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
  pin: {
    ...shadow.soft,
    alignItems: "center",
    backgroundColor: colors.green,
    borderColor: colors.white,
    borderRadius: radii.pill,
    borderWidth: 2,
    flexDirection: "row",
    gap: spacing.xs,
    minWidth: 86,
    padding: 4,
    paddingRight: spacing.sm,
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

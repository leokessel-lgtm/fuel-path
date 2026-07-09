import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type MapMarker,
  type Region,
} from "react-native-maps";

import { brandStyleForStation } from "../data/brandAssets";
import { colors, mapSkin, radii, shadow, spacing } from "../theme";
import { EvCharger, MapPoint, StationViewModel } from "../types";
import { BrandBadge } from "./BrandBadge";

const maxStationMarkers = 420;
const routeMaxPriceMarkers = 18;
const compactRouteMaxPriceMarkers = 14;
const defaultMarkerDensity = {
  maxPriceMarkers: 8,
  markerGridSize: 240,
  compactMarkerGridSize: 128,
};
const tabletMarkerDensity = {
  maxPriceMarkers: 20,
  markerGridSize: 150,
  compactMarkerGridSize: 110,
};
const compactMarkerDensity = {
  maxPriceMarkers: 3,
  markerGridSize: 390,
  compactMarkerGridSize: 230,
};
const nearbyInitialRegionDelta = 0.035;
const nearbyInitialMarkerRadiusKm = 4.2;
const routeCameraChargerLimit = 16;
const maxEvMarkers = 96;
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

type ClusterMarker = {
  count: number;
  items: StationViewModel[];
  lat: number;
  lon: number;
};

const emptyRoutePoints: MapPoint[] = [];
const emptyChargers: EvCharger[] = [];

export function StationMap({
  centre,
  chargers = emptyChargers,
  stations,
  selectedChargerId,
  selectedStationCode,
  onSelect,
  onSelectCharger,
  onViewportStationsChange,
  onMapSearchAreaChange,
  cameraFocusKey,
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
  onMapSearchAreaChange?: (area: {
    centre: MapPoint;
    radiusKm: number;
  }) => void;
  cameraFocusKey?: string;
  showCentreMarker?: boolean;
  routeEndpoints?: { from: MapPoint; to: MapPoint };
  routePoints?: MapPoint[];
  cameraInsets?: CameraInsets;
  userLocation?: MapPoint;
  onMapPress?: () => void;
}) {
  const { width } = useWindowDimensions();
  const mapRef = useRef<MapView | null>(null);
  const markerRefs = useRef<Record<string, MapMarker | null>>({});
  const lastCameraKeyRef = useRef("");
  const lastReportedUserCentreKeyRef = useRef("");
  const lastSelectedChargerIdRef = useRef<string | undefined>(undefined);
  const programmaticMoveRef = useRef(false);
  const userMovedMapRef = useRef(false);
  const userGestureStartedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapMovedByUser, setMapMovedByUser] = useState(false);
  const [cameraResetVersion, setCameraResetVersion] = useState(0);
  const [markerAssetRefreshVersion, setMarkerAssetRefreshVersion] = useState(0);
  const [currentRegion, setCurrentRegion] = useState<Region>(() =>
    regionForPoint(centre),
  );

  const visibleRoutePoints = useMemo(
    () => (routePoints.length >= 2 ? sampleRoutePoints(routePoints, 1200) : []),
    [routePoints],
  );
  const markerDensity = useMemo(
    () => nativeMarkerDensity(width, Platform.OS === "ios" && Platform.isPad),
    [width],
  );
  const routePriceMarkerLimit = useMemo(
    () => nativeRoutePriceMarkerLimit(width),
    [width],
  );
  const activeInsets = useMemo(
    () =>
      resolveCameraInsets(routeEndpoints ? "route" : "nearby", cameraInsets),
    [cameraInsets, routeEndpoints],
  );
  const cameraKey = useMemo(
    () =>
      [
        routeEndpoints ? "route" : "nearby",
        cameraFocusKey || "initial",
        cameraResetVersion,
        cameraInsetsKey(activeInsets),
      ].join("|"),
    [activeInsets, cameraFocusKey, cameraResetVersion, routeEndpoints],
  );
  const cameraCoordinates = useMemo(() => {
    if (routeEndpoints) {
      const routeStationCameraPoints = stations
        .slice(0, routePriceMarkerLimit)
        .map((item) => ({
          lat: item.station.lat,
          lon: item.station.lon,
          label: item.station.name,
        }));
      const routeChargerCameraPoints = prioritiseSelectedChargers(
        chargers,
        selectedChargerId,
      )
        .slice(0, routeCameraChargerLimit)
        .map((charger) => ({
          lat: charger.lat,
          lon: charger.lon,
          label: charger.name,
        }));
      if (visibleRoutePoints.length >= 2) {
        return [
          ...visibleRoutePoints,
          ...routeStationCameraPoints,
          ...routeChargerCameraPoints,
        ];
      }
      return [
        routeEndpoints.from,
        routeEndpoints.to,
        ...routeStationCameraPoints,
        ...routeChargerCameraPoints,
      ];
    }
    return nearbyCameraPointsForCentre(centre, nearbyInitialMarkerRadiusKm);
  }, [
    centre,
    chargers,
    routeEndpoints,
    routePriceMarkerLimit,
    selectedChargerId,
    stations,
    visibleRoutePoints,
  ]);
  const initialRegion = useMemo(() => regionForPoint(centre), [centre]);
  const markerGroups = useMemo(() => {
    if (routeEndpoints) {
      return {
        priceMarkers: prioritiseSelectedStations(
          stations,
          selectedStationCode,
        ).slice(0, routePriceMarkerLimit),
        clusterMarkers: [],
      };
    }
    return visibleMarkerGroups(
      stations.slice(0, maxStationMarkers),
      currentRegion,
      markerDensity,
      selectedStationCode,
    );
  }, [
    currentRegion,
    markerDensity,
    routeEndpoints,
    routePriceMarkerLimit,
    selectedStationCode,
    stations,
  ]);
  const interactiveClusterMarkers = useMemo(
    () =>
      markerGroups.clusterMarkers.filter((cluster) =>
        clusterFitsInteractiveRegion(cluster, currentRegion, activeInsets),
      ),
    [activeInsets, currentRegion, markerGroups.clusterMarkers],
  );
  const visibleChargers = useMemo(
    () =>
      prioritiseSelectedChargers(chargers, selectedChargerId).slice(
        0,
        maxEvMarkers,
      ),
    [chargers, selectedChargerId],
  );

  useEffect(() => {
    if (!mapReady || !mapRef.current || !cameraCoordinates.length) return;

    const cameraContextChanged = cameraKey !== lastCameraKeyRef.current;
    if (!cameraContextChanged && userMovedMapRef.current) return;
    if (cameraContextChanged) {
      userGestureStartedRef.current = false;
      lastReportedUserCentreKeyRef.current = "";
    }

    runProgrammaticMapMove(programmaticMoveRef, () => {
      if (!routeEndpoints) {
        mapRef.current?.animateToRegion(
          regionForPoint(centre, nearbyInitialRegionDelta),
          260,
        );
        return;
      }
      if (cameraCoordinates.length === 1) {
        mapRef.current?.animateToRegion(
          regionForPoint(cameraCoordinates[0]),
          260,
        );
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
    centre,
    cameraCoordinates,
    cameraKey,
    mapReady,
    routeEndpoints,
  ]);

  useEffect(() => {
    if (!mapReady || Platform.OS !== "android" || !markerGroups.priceMarkers.length) {
      return;
    }
    const firstRefresh = setTimeout(() => {
      setMarkerAssetRefreshVersion((current) => current + 1);
    }, 650);
    const secondRefresh = setTimeout(() => {
      setMarkerAssetRefreshVersion((current) => current + 1);
    }, 1600);
    return () => {
      clearTimeout(firstRefresh);
      clearTimeout(secondRefresh);
    };
  }, [mapReady, markerGroups.priceMarkers.length]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedStationCode) return;
    const selected = stations.find(
      (item) => item.station.stationCode === selectedStationCode,
    );
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

  useEffect(() => {
    if (!selectedChargerId) {
      lastSelectedChargerIdRef.current = undefined;
      return;
    }
    const previousSelectedChargerId = lastSelectedChargerIdRef.current;
    lastSelectedChargerIdRef.current = selectedChargerId;
    if (
      !mapReady ||
      !mapRef.current ||
      !previousSelectedChargerId ||
      previousSelectedChargerId === selectedChargerId
    ) {
      return;
    }
    const selected = chargers.find(
      (charger) => charger.id === selectedChargerId,
    );
    if (!selected || userMovedMapRef.current) return;

    runProgrammaticMapMove(programmaticMoveRef, () => {
      mapRef.current?.animateCamera(
        {
          center: {
            latitude: selected.lat,
            longitude: selected.lon,
          },
        },
        { duration: 260 },
      );
    });
  }, [chargers, mapReady, selectedChargerId]);

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

  const handleClusterPress = (cluster: ClusterMarker) => {
    runProgrammaticMapMove(programmaticMoveRef, () => {
      mapRef.current?.animateToRegion(
        regionForClusterZoom(cluster, currentRegion),
        260,
      );
    });
  };

  return (
    <View style={styles.map}>
      <MapView
        ref={mapRef}
        initialRegion={initialRegion}
        onPress={(event: { nativeEvent?: { action?: string } }) => {
          if (event.nativeEvent?.action === "press") {
            onMapPress?.();
          }
        }}
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
          <>
            <Polyline
              coordinates={visibleRoutePoints.map((point) => ({
                latitude: point.lat,
                longitude: point.lon,
              }))}
              strokeColor={mapSkin.routeCasing}
              strokeWidth={10}
            />
            <Polyline
              coordinates={visibleRoutePoints.map((point) => ({
                latitude: point.lat,
                longitude: point.lon,
              }))}
              strokeColor={mapSkin.route}
              strokeWidth={6}
            />
          </>
        ) : null}

        {!routeEndpoints && userLocation ? (
          <Marker
            coordinate={{
              latitude: userLocation.lat,
              longitude: userLocation.lon,
            }}
            title="My location"
            tracksViewChanges={false}
            zIndex={900}
          >
            <View style={styles.pointPinAnchor}>
              <View style={styles.userLocationPin}>
                <View style={styles.userLocationPinInner} />
              </View>
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
            <View style={styles.pointPinAnchor}>
              <View style={styles.locationPin}>
                <View style={styles.locationPinInner} />
              </View>
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
            <View style={styles.pointPinAnchor}>
              <View style={styles.destinationPin}>
                <View style={styles.destinationPinInner} />
              </View>
            </View>
          </Marker>
        ) : null}

        {interactiveClusterMarkers.map((cluster) => (
          <Marker
            {...decorativeStationMarkerAccessibility}
            coordinate={{ latitude: cluster.lat, longitude: cluster.lon }}
            key={`cluster-${cluster.lat.toFixed(5)}-${cluster.lon.toFixed(5)}-${cluster.count}`}
            onPress={() => handleClusterPress(cluster)}
            tracksViewChanges={false}
            zIndex={680}
          >
            <View style={styles.clusterPin}>
              <Text style={styles.clusterCount}>{cluster.count}</Text>
            </View>
          </Marker>
        ))}

        {visibleChargers.map((charger) => {
          const selected = charger.id === selectedChargerId;
          const label = charger.maxPowerKw
            ? `${Math.round(charger.maxPowerKw)}kW`
            : "";
          return (
            <Marker
              accessibilityLabel={`Select charger ${charger.name}`}
              accessibilityRole="button"
              coordinate={{ latitude: charger.lat, longitude: charger.lon }}
              key={charger.id}
              onPress={() => onSelectCharger?.(charger.id)}
              tracksViewChanges={Platform.OS === "android"}
              zIndex={selected ? 760 : 560}
            >
              <View style={styles.evPinAnchor}>
                <View style={[styles.evPin, selected && styles.evPinSelected]}>
                  <Text
                    style={[
                      styles.evPinCode,
                      selected && styles.evPinCodeSelected,
                    ]}
                  >
                    EV
                  </Text>
                  {label ? (
                    <Text
                      style={[
                        styles.evPinLabel,
                        selected && styles.evPinLabelSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Marker>
          );
        })}

        {markerGroups.priceMarkers.map((item) => {
          const selected = item.station.stationCode === selectedStationCode;
          const subdued = Boolean(
            routeEndpoints && selectedStationCode && !selected,
          );
          const brandStyle = brandStyleForStation(item.station);
          const brandIcon = brandStyle.markerIcon || brandStyle.icon;
          const nativeBrandIcon =
            typeof brandIcon === "number" ? brandIcon : undefined;
          return (
            <Fragment key={`${item.station.stationCode}-marker-stack`}>
              <Marker
                {...decorativeStationMarkerAccessibility}
                coordinate={{
                  latitude: item.station.lat,
                  longitude: item.station.lon,
                }}
                key={`${item.station.stationCode}-${markerAssetRefreshVersion}`}
                onPress={() => handleMarkerPress(item.station.stationCode)}
                ref={(marker) => {
                  markerRefs.current[item.station.stationCode] = marker;
                }}
                tracksViewChanges={Platform.OS === "android"}
                zIndex={selected ? 700 : subdued ? 420 : 500}
              >
                <View style={styles.pinAnchor}>
                  <View
                    style={[
                      styles.pin,
                      subdued && styles.pinSubdued,
                      selected && styles.pinSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pinPrice,
                        selected && styles.pinPriceSelected,
                      ]}
                    >
                      {item.adjustedCpl.toFixed(1)}
                    </Text>
                    <View style={styles.pinBrand}>
                      {Platform.OS === "android" ? null : (
                        <BrandBadge
                          marker
                          station={item.station}
                          size={22}
                        />
                      )}
                    </View>
                  </View>
                  <View
                    style={[
                      styles.pinPointer,
                      selected && styles.pinPointerSelected,
                    ]}
                  />
                </View>
              </Marker>
              {Platform.OS === "android" && nativeBrandIcon ? (
                <Marker
                  {...decorativeStationMarkerAccessibility}
                  anchor={{ x: 0.5, y: 1.35 }}
                  coordinate={{
                    latitude: item.station.lat,
                    longitude: item.station.lon,
                  }}
                  image={nativeBrandIcon}
                  key={`${item.station.stationCode}-brand-${markerAssetRefreshVersion}`}
                  onPress={() => handleMarkerPress(item.station.stationCode)}
                  tracksViewChanges={false}
                  zIndex={selected ? 720 : subdued ? 440 : 520}
                />
              ) : null}
            </Fragment>
          );
        })}
      </MapView>

      {mapMovedByUser && cameraKey === lastCameraKeyRef.current ? (
        <Pressable
          accessibilityLabel={
            routeEndpoints ? "Return to route" : "Recenter map"
          }
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
          <Text style={styles.recenterText}>
            {routeEndpoints ? "Route" : "Center"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function regionForPoint(point: MapPoint, delta = 0.09): Region {
  return {
    latitude: point.lat,
    longitude: point.lon,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

function stationCodesInRegion(stations: StationViewModel[], region: Region) {
  const minLat = region.latitude - region.latitudeDelta / 2;
  const maxLat = region.latitude + region.latitudeDelta / 2;
  const minLon = region.longitude - region.longitudeDelta / 2;
  const maxLon = region.longitude + region.longitudeDelta / 2;
  return stations.flatMap((item) =>
    item.station.lat >= minLat &&
    item.station.lat <= maxLat &&
    item.station.lon >= minLon &&
    item.station.lon <= maxLon
      ? [item.station.stationCode]
      : [],
  );
}

function visibleMarkerGroups(
  stations: StationViewModel[],
  region: Region,
  density: typeof defaultMarkerDensity,
  selectedStationCode?: string,
) {
  const protectedCodes = protectedStationCodes(stations, selectedStationCode);
  const priceCells = new Set<string>();
  const compactCells = new Set<string>();
  const clusterGroups = new Map<string, StationViewModel[]>();
  const priceMarkers: StationViewModel[] = [];
  const visibleStations = stations.filter((item) =>
    stationInRegion(item, region),
  );

  const ranked = [...visibleStations].sort((left, right) => {
    const leftProtected = protectedCodes.has(left.station.stationCode) ? 0 : 1;
    const rightProtected = protectedCodes.has(right.station.stationCode)
      ? 0
      : 1;
    return (
      leftProtected - rightProtected ||
      markerPriorityScore(left) - markerPriorityScore(right)
    );
  });

  for (const item of ranked) {
    const code = item.station.stationCode;
    const priceCell = markerCell(item, region, density.markerGridSize);
    const compactCell = markerCell(item, region, density.compactMarkerGridSize);
    const protectedMarker = protectedCodes.has(code);

    if (
      protectedMarker ||
      (priceMarkers.length < density.maxPriceMarkers &&
        !priceCells.has(priceCell))
    ) {
      priceMarkers.push(item);
      priceCells.add(priceCell);
      compactCells.add(compactCell);
      continue;
    }

    const grouped = clusterGroups.get(compactCell) || [];
    grouped.push(item);
    clusterGroups.set(compactCell, grouped);
  }

  const singletonMarkers: StationViewModel[] = [];
  const clusterItems: StationViewModel[][] = [];
  for (const items of clusterGroups.values()) {
    if (items.length === 1) {
      singletonMarkers.push(items[0]);
    } else {
      clusterItems.push(items);
    }
  }
  priceMarkers.push(...singletonMarkers);

  const clusterMarkers = clusterItems
    .map(clusterMarkerForItems)
    .sort((left, right) => right.count - left.count);

  return { priceMarkers, clusterMarkers };
}

function stationInRegion(item: StationViewModel, region: Region) {
  const minLat = region.latitude - region.latitudeDelta / 2;
  const maxLat = region.latitude + region.latitudeDelta / 2;
  const minLon = region.longitude - region.longitudeDelta / 2;
  const maxLon = region.longitude + region.longitudeDelta / 2;
  return (
    item.station.lat >= minLat &&
    item.station.lat <= maxLat &&
    item.station.lon >= minLon &&
    item.station.lon <= maxLon
  );
}

function clusterMarkerForItems(items: StationViewModel[]): ClusterMarker {
  const totals = items.reduce(
    (current, item) => ({
      count: current.count + 1,
      lat: current.lat + item.station.lat,
      lon: current.lon + item.station.lon,
    }),
    { count: 0, lat: 0, lon: 0 },
  );
  return {
    count: totals.count,
    items,
    lat: totals.lat / totals.count,
    lon: totals.lon / totals.count,
  };
}

function clusterFitsInteractiveRegion(
  cluster: ClusterMarker,
  region: Region,
  insets: Required<CameraInsets>,
) {
  const safeLatDelta = Math.max(region.latitudeDelta, 0.005);
  const safeLonDelta = Math.max(region.longitudeDelta, 0.005);
  const yRatio =
    1 - (cluster.lat - (region.latitude - safeLatDelta / 2)) / safeLatDelta;
  const xRatio =
    (cluster.lon - (region.longitude - safeLonDelta / 2)) / safeLonDelta;
  const topRatio = Math.min(0.46, Math.max(0.08, insets.top / 900));
  const bottomRatio = Math.min(0.48, Math.max(0.12, insets.bottom / 900));
  const sideRatio = 0.12;
  return (
    xRatio >= sideRatio &&
    xRatio <= 1 - sideRatio &&
    yRatio >= topRatio &&
    yRatio <= 1 - bottomRatio
  );
}

function regionForClusterZoom(
  cluster: ClusterMarker,
  currentRegion: Region,
): Region {
  const bounds = boundsForCluster(cluster);
  const contentLatDelta = Math.max(
    (bounds.maxLat - bounds.minLat) * 2.4,
    0.006,
  );
  const contentLonDelta = Math.max(
    (bounds.maxLon - bounds.minLon) * 2.4,
    0.006,
  );
  const zoomedLatDelta = Math.max(
    Math.min(currentRegion.latitudeDelta * 0.55, contentLatDelta),
    0.004,
  );
  const zoomedLonDelta = Math.max(
    Math.min(currentRegion.longitudeDelta * 0.55, contentLonDelta),
    0.004,
  );

  return {
    latitude: cluster.lat,
    longitude: cluster.lon,
    latitudeDelta: Math.min(zoomedLatDelta, currentRegion.latitudeDelta * 0.72),
    longitudeDelta: Math.min(
      zoomedLonDelta,
      currentRegion.longitudeDelta * 0.72,
    ),
  };
}

function boundsForCluster(cluster: ClusterMarker) {
  return cluster.items.reduce(
    (bounds, item) => ({
      minLat: Math.min(bounds.minLat, item.station.lat),
      maxLat: Math.max(bounds.maxLat, item.station.lat),
      minLon: Math.min(bounds.minLon, item.station.lon),
      maxLon: Math.max(bounds.maxLon, item.station.lon),
    }),
    {
      minLat: Number.POSITIVE_INFINITY,
      maxLat: Number.NEGATIVE_INFINITY,
      minLon: Number.POSITIVE_INFINITY,
      maxLon: Number.NEGATIVE_INFINITY,
    },
  );
}

function nativeMarkerDensity(width: number, isPad = false) {
  if (isPad || width >= 700) return tabletMarkerDensity;
  return width <= 430 ? compactMarkerDensity : defaultMarkerDensity;
}

function prioritiseSelectedStations(
  stations: StationViewModel[],
  selectedStationCode?: string,
) {
  if (!selectedStationCode) return stations;
  const selected = stations.find(
    (item) => item.station.stationCode === selectedStationCode,
  );
  if (!selected) return stations;
  return [
    selected,
    ...stations.filter(
      (item) => item.station.stationCode !== selectedStationCode,
    ),
  ];
}

function prioritiseSelectedChargers(
  chargers: EvCharger[],
  selectedChargerId?: string,
) {
  if (!selectedChargerId) return chargers;
  const selected = chargers.find((charger) => charger.id === selectedChargerId);
  if (!selected) return chargers;
  return [
    selected,
    ...chargers.filter((charger) => charger.id !== selectedChargerId),
  ];
}

function nativeRoutePriceMarkerLimit(width: number) {
  return width <= 430 ? compactRouteMaxPriceMarkers : routeMaxPriceMarkers;
}

function protectedStationCodes(
  stations: StationViewModel[],
  selectedStationCode?: string,
) {
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

function nearbyCameraPointsForCentre(centre: MapPoint, radiusKm: number) {
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / Math.max(35, 111 * Math.cos(toRad(centre.lat)));
  return [
    centre,
    { lat: centre.lat + latDelta, lon: centre.lon, label: centre.label },
    { lat: centre.lat - latDelta, lon: centre.lon, label: centre.label },
    { lat: centre.lat, lon: centre.lon + lonDelta, label: centre.label },
    { lat: centre.lat, lon: centre.lon - lonDelta, label: centre.label },
  ];
}

function nearestStationsForCamera(
  stations: StationViewModel[],
  centre: MapPoint,
  maxStations: number,
) {
  return [...stations]
    .sort((left, right) => {
      const leftDistance = distanceKm(centre, {
        lat: left.station.lat,
        lon: left.station.lon,
      });
      const rightDistance = distanceKm(centre, {
        lat: right.station.lat,
        lon: right.station.lon,
      });
      return leftDistance - rightDistance;
    })
    .slice(0, maxStations);
}

function markerCell(item: StationViewModel, region: Region, gridSize: number) {
  const safeLatDelta = Math.max(region.latitudeDelta, 0.005);
  const safeLonDelta = Math.max(region.longitudeDelta, 0.005);
  const x =
    ((item.station.lon - (region.longitude - safeLonDelta / 2)) /
      safeLonDelta) *
    1000;
  const y =
    ((item.station.lat - (region.latitude - safeLatDelta / 2)) / safeLatDelta) *
    1000;
  return `${Math.round(x / gridSize)}:${Math.round(y / gridSize)}`;
}

function sampleRoutePoints(points: MapPoint[], maxPoints: number) {
  if (points.length <= maxPoints) return points;
  const sampled: MapPoint[] = [];
  let previousIndex = -1;
  for (let index = 0; index < maxPoints; index += 1) {
    const sourceIndex = Math.round(
      (index / (maxPoints - 1)) * (points.length - 1),
    );
    if (sourceIndex !== previousIndex) {
      sampled.push(points[sourceIndex]);
      previousIndex = sourceIndex;
    }
  }
  return sampled;
}

function resolveCameraInsets(
  mode: "nearby" | "route",
  insets?: CameraInsets,
): Required<CameraInsets> {
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
  pointPinAnchor: {
    alignItems: "center",
    height: 44,
    justifyContent: "flex-start",
    overflow: "visible",
    paddingTop: 1,
    width: 44,
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
    backgroundColor: colors.route,
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
    borderRadius: radii.pill,
    height: 8,
    left: 8,
    position: "absolute",
    top: 8,
    width: 8,
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
    backgroundColor: "transparent",
  },
  pin: {
    ...shadow.soft,
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "rgba(7, 86, 66, 0.18)",
    borderRadius: radii.md,
    borderWidth: 1,
    height: 46,
    minWidth: 54,
    overflow: "hidden",
    width: 54,
  },
  pinSelected: {
    borderColor: colors.black,
    boxShadow: "0 0 0 4px rgba(255, 106, 61, 0.35)",
  },
  pinSubdued: {
    transform: [{ scale: 0.94 }],
  },
  pinPrice: {
    backgroundColor: colors.greenDark,
    color: colors.white,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,
    minWidth: 54,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    textAlign: "center",
  },
  pinPriceSelected: {
    backgroundColor: colors.black,
    color: colors.white,
  },
  pinBrand: {
    alignItems: "center",
    backgroundColor: colors.white,
    minHeight: 24,
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
  clusterPin: {
    ...shadow.soft,
    alignItems: "center",
    backgroundColor: colors.greenDark,
    borderColor: colors.white,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 30,
    justifyContent: "center",
    minWidth: 30,
    paddingHorizontal: spacing.xs,
  },
  clusterCount: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "900",
  },
  evPinAnchor: {
    alignItems: "center",
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
  },
  evPin: {
    ...shadow.soft,
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderColor: colors.white,
    borderRadius: radii.pill,
    borderWidth: 2,
    justifyContent: "center",
    minHeight: 34,
    minWidth: 42,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
  },
  evPinSelected: {
    backgroundColor: colors.black,
    borderColor: mapSkin.route,
  },
  evPinCode: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 12,
  },
  evPinCodeSelected: {
    color: colors.white,
  },
  evPinLabel: {
    color: colors.blue,
    fontSize: 9,
    fontWeight: "900",
    lineHeight: 11,
  },
  evPinLabelSelected: {
    color: colors.white,
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

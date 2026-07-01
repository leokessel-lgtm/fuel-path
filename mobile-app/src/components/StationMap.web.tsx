import { createElement, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import type * as Leaflet from "leaflet";

import { brandStyleForStation } from "../data/brandAssets";
import { colors, mapSkin, radii } from "../theme";
import { EvCharger, MapPoint, StationViewModel } from "../types";

const LEAFLET_CSS_ID = "fuel-path-leaflet-css";
const LEAFLET_CUSTOM_CSS_ID = "fuel-path-leaflet-custom-css";
const maxStationMarkers = 420;
const maxPriceMarkers = 14;
const markerGridSize = 132;
const mixedEnergyMaxPriceMarkers = 8;
const mixedEnergyMarkerGridSize = 190;

type ClusterMarker = {
  count: number;
  items: StationViewModel[];
  lat: number;
  lon: number;
  minPrice: number;
};

type CameraInsets = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export function StationMap({
  centre,
  chargers = [],
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
  routePoints = [],
  cameraInsets,
  userLocation,
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
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markerLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const lastFitKeyRef = useRef("");
  const lastCameraContextKeyRef = useRef("");
  const lastReportedUserCentreKeyRef = useRef("");
  const programmaticMoveRef = useRef(false);
  const userMovedMapRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapRenderVersion, setMapRenderVersion] = useState(0);

  useEffect(() => {
    let active = true;
    ensureLeafletStyles();

    import("leaflet").then((leafletModule) => {
      if (!active || !mapElementRef.current || mapRef.current) return;
      const L = leafletModule.default;
      leafletRef.current = L;

      const map = L.map(mapElementRef.current, {
        attributionControl: true,
        zoomControl: false,
      }).setView([centre.lat, centre.lon], 13);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer(mapSkin.baseTileUrl, {
        attribution: mapSkin.baseAttribution,
        maxZoom: 19,
      }).addTo(map);
      map.on("dragstart zoomstart", () => {
        if (!programmaticMoveRef.current) {
          userMovedMapRef.current = true;
        }
      });

      mapRef.current = map;
      markerLayerRef.current = L.layerGroup().addTo(map);
      window.setTimeout(() => map.invalidateSize(), 0);
      setMapReady(true);
    });

    return () => {
      active = false;
      setMapReady(false);
      markerLayerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      lastFitKeyRef.current = "";
      lastCameraContextKeyRef.current = "";
      lastReportedUserCentreKeyRef.current = "";
      programmaticMoveRef.current = false;
      userMovedMapRef.current = false;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!mapReady || !L || !map || !markerLayer) return;

    markerLayer.clearLayers();

    const fitPoints: Array<[number, number]> = [[centre.lat, centre.lon]];
    const routeLatLngs = routePoints
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon))
      .map((point) => [point.lat, point.lon] as [number, number]);
    const activeInsets = resolveCameraInsets(routeEndpoints ? "route" : "nearby", cameraInsets);
    const cameraStations = showCentreMarker
      ? nearestStationsForCamera(stations, centre, 12)
      : stations.slice(0, maxStationMarkers);
    const cameraChargers = chargers.slice(0, 16);
    const routeStationCameraPoints = routeEndpoints
      ? stations
          .slice(0, maxPriceMarkers)
          .map((item) => [item.station.lat, item.station.lon] as [number, number])
      : [];
    const cameraPoints = routeEndpoints
      ? routeLatLngs.length >= 2
        ? [...routeLatLngs, ...routeStationCameraPoints]
        : [
            [routeEndpoints.from.lat, routeEndpoints.from.lon] as [number, number],
            [routeEndpoints.to.lat, routeEndpoints.to.lon] as [number, number],
            ...routeStationCameraPoints,
          ]
      : [
          [centre.lat, centre.lon] as [number, number],
          ...cameraStations.map((item) => [item.station.lat, item.station.lon] as [number, number]),
          ...cameraChargers.map((charger) => [charger.lat, charger.lon] as [number, number]),
        ];
    const cameraContextKey = routeEndpoints
      ? [
          "route",
          cameraFocusKey || "route",
          routeEndpoints.from.lat.toFixed(4),
          routeEndpoints.from.lon.toFixed(4),
          routeEndpoints.to.lat.toFixed(4),
          routeEndpoints.to.lon.toFixed(4),
          routeLatLngs.length,
        ].join(":")
      : ["nearby", cameraFocusKey || "initial"].join(":");
    const cameraContextChanged = cameraContextKey !== lastCameraContextKeyRef.current;
    if (cameraContextChanged) {
      userMovedMapRef.current = false;
      lastReportedUserCentreKeyRef.current = "";
      lastCameraContextKeyRef.current = cameraContextKey;
    }

    if (routeEndpoints) {
      if (routeLatLngs.length >= 2) {
        const routeLine = L.polyline(routeLatLngs, {
          className: "fuel-path-route-line",
          color: mapSkin.route,
          opacity: 0.85,
          weight: 6,
        });
        markerLayer.addLayer(routeLine);
        fitPoints.push(...routeLatLngs);
      }
      addDestinationMarker(L, markerLayer, routeEndpoints.to);
      fitPoints.push(
        [routeEndpoints.from.lat, routeEndpoints.from.lon],
        [routeEndpoints.to.lat, routeEndpoints.to.lon],
      );
    } else if (showCentreMarker) {
      addLocationMarker(L, markerLayer, centre);
    }
    if (!routeEndpoints && userLocation) {
      addUserLocationMarker(L, markerLayer, userLocation);
    }

    const markerGroups = visibleMarkerGroups(
      stations.slice(0, maxStationMarkers),
      map.getBounds(),
      selectedStationCode,
      chargers.length > 0,
    );

    markerGroups.clusterMarkers.forEach((cluster) => {
      const marker = L.marker([cluster.lat, cluster.lon], {
        icon: L.divIcon({
          className: "",
          html: clusterMarkerHtml(cluster),
          iconAnchor: [28, 34],
          iconSize: [56, 34],
        }),
        alt: "",
        keyboard: false,
        riseOnHover: true,
        zIndexOffset: 680,
      });
      marker.on("click", () => {
        runProgrammaticMapMove(programmaticMoveRef, map, () => {
          map.fitBounds(
            L.latLngBounds(cluster.items.map((item) => [item.station.lat, item.station.lon] as [number, number])),
            {
              ...leafletPadding(activeInsets),
              animate: true,
              maxZoom: 17,
            },
          );
          map.once("moveend", () => setMapRenderVersion((current) => current + 1));
        });
      });
      marker.bindTooltip(
        `${cluster.count} stations, lowest ${cluster.minPrice.toFixed(1)} c/L`,
        { direction: "top", offset: [0, -22] },
      );
      markerLayer.addLayer(marker);
    });

    markerGroups.priceMarkers.forEach((item) => {
      const selected = item.station.stationCode === selectedStationCode;
      const marker = L.marker([item.station.lat, item.station.lon], {
        icon: L.divIcon({
          className: "",
          html: markerHtml(item, selected),
          iconAnchor: [27, 56],
          iconSize: [54, 56],
          tooltipAnchor: [0, -58],
        }),
        alt: "",
        keyboard: false,
        riseOnHover: true,
        zIndexOffset: selected ? 600 : 400,
      });
      marker.on("click", () => {
        onSelect(item.station.stationCode);
        runProgrammaticMapMove(programmaticMoveRef, map, () => {
          if (routeEndpoints) {
            map.panInside([item.station.lat, item.station.lon], {
              animate: true,
              ...leafletPadding(activeInsets),
            });
          } else {
            map.panInside([item.station.lat, item.station.lon], {
              animate: true,
              ...leafletPadding(activeInsets),
            });
          }
        });
      });
      marker.bindTooltip(item.station.name, {
        className: "fuel-path-marker-tooltip",
        direction: "top",
        offset: [0, -6],
      });
      markerLayer.addLayer(marker);
      fitPoints.push([item.station.lat, item.station.lon]);
    });

    chargers.slice(0, maxStationMarkers).forEach((charger) => {
      const selected = charger.id === selectedChargerId;
      const marker = L.marker([charger.lat, charger.lon], {
        icon: L.divIcon({
          className: "",
          html: evChargerMarkerHtml(charger, selected),
          iconAnchor: [24, 54],
          iconSize: [48, 54],
          tooltipAnchor: [0, -56],
        }),
        alt: "",
        keyboard: false,
        riseOnHover: true,
        zIndexOffset: selected ? 760 : 620,
      });
      marker.on("click", () => {
        onSelectCharger?.(charger.id);
        runProgrammaticMapMove(programmaticMoveRef, map, () => {
          map.panInside([charger.lat, charger.lon], {
            animate: true,
            ...leafletPadding(activeInsets),
          });
        });
      });
      marker.bindTooltip(charger.name, {
        className: "fuel-path-marker-tooltip",
        direction: "top",
        offset: [0, -6],
      });
      markerLayer.addLayer(marker);
      fitPoints.push([charger.lat, charger.lon]);
    });

    const fitCameraPoints = routeEndpoints ? [...fitPoints, ...routeStationCameraPoints] : cameraPoints;
    const fitKey = `${fitKeyForPoints(fitCameraPoints)}|${cameraInsetsKey(activeInsets)}`;
    if (fitKey !== lastFitKeyRef.current && (!userMovedMapRef.current || cameraContextChanged)) {
      runProgrammaticMapMove(programmaticMoveRef, map, () => {
        map.invalidateSize();
        map.fitBounds(L.latLngBounds(fitCameraPoints), {
          ...leafletPadding(activeInsets),
          maxZoom: routeEndpoints ? 15 : showCentreMarker ? 15 : 14,
        });
      });
      lastFitKeyRef.current = fitKey;
    } else {
      const selected = stations.find((item) => item.station.stationCode === selectedStationCode);
      const selectedCharger = chargers.find((charger) => charger.id === selectedChargerId);
      if ((selected || selectedCharger) && !userMovedMapRef.current) {
        runProgrammaticMapMove(programmaticMoveRef, map, () => {
          if (selected && routeEndpoints) {
            map.panInside([selected.station.lat, selected.station.lon], {
              animate: true,
              ...leafletPadding(activeInsets),
            });
          } else if (selected) {
            map.panInside([selected.station.lat, selected.station.lon], {
              animate: true,
              ...leafletPadding(activeInsets),
            });
          } else if (selectedCharger) {
            map.panInside([selectedCharger.lat, selectedCharger.lon], {
              animate: true,
              ...leafletPadding(activeInsets),
            });
          }
        });
      }
    }

    const notifyVisibleStations = () => {
      if (!onViewportStationsChange) return;
      const bounds = map.getBounds();
      const visibleCodes = stations
        .filter((item) => bounds.contains([item.station.lat, item.station.lon]))
        .map((item) => item.station.stationCode);
      onViewportStationsChange(visibleCodes);
      if (!routeEndpoints && userMovedMapRef.current && !programmaticMoveRef.current) {
        const nextCentre = map.getCenter();
        const radiusKm = radiusKmForBounds(map.getBounds(), nextCentre);
        const centreKey = `${nextCentre.lat.toFixed(4)}:${nextCentre.lng.toFixed(
          4,
        )}:${Math.round(radiusKm)}`;
        if (centreKey !== lastReportedUserCentreKeyRef.current) {
          lastReportedUserCentreKeyRef.current = centreKey;
          onMapSearchAreaChange?.({
            centre: {
              lat: nextCentre.lat,
              lon: nextCentre.lng,
              label: "Map area",
            },
            radiusKm,
          });
        }
      }
    };

    map.on("moveend zoomend", notifyVisibleStations);
    window.setTimeout(notifyVisibleStations, 0);

    return () => {
      map.off("moveend", notifyVisibleStations);
      map.off("zoomend", notifyVisibleStations);
    };
  }, [
    centre,
    mapReady,
    onSelect,
    onViewportStationsChange,
    onMapSearchAreaChange,
    cameraFocusKey,
    chargers,
    showCentreMarker,
    routeEndpoints,
    routePoints,
    cameraInsets,
    selectedChargerId,
    selectedStationCode,
    stations,
    onSelectCharger,
    userLocation,
    mapRenderVersion,
  ]);

  return (
    <View style={styles.map}>
      {createElement("div", {
        "data-testid": "fuel-path-leaflet-map",
        ref: mapElementRef,
        style: {
          height: "100%",
          minHeight: 330,
          width: "100%",
        },
      })}
    </View>
  );
}

function addLocationMarker(
  L: typeof Leaflet,
  markerLayer: Leaflet.LayerGroup,
  centre: MapPoint,
) {
  const marker = L.marker([centre.lat, centre.lon], {
    icon: L.divIcon({
      className: "",
      html: `<div class="fuel-path-location-pin"><span></span></div>`,
      iconAnchor: [14, 28],
      iconSize: [28, 28],
    }),
    zIndexOffset: 800,
  });
  marker.bindTooltip(centre.label, { direction: "top" });
  markerLayer.addLayer(marker);
}

function addUserLocationMarker(
  L: typeof Leaflet,
  markerLayer: Leaflet.LayerGroup,
  location: MapPoint,
) {
  const marker = L.marker([location.lat, location.lon], {
    icon: L.divIcon({
      className: "",
      html: `<div aria-label="My location" class="fuel-path-user-location-pin"><span></span></div>`,
      iconAnchor: [15, 30],
      iconSize: [30, 30],
    }),
    title: "My location",
    zIndexOffset: 900,
  });
  marker.bindTooltip("My location", { direction: "top" });
  markerLayer.addLayer(marker);
}

function addDestinationMarker(
  L: typeof Leaflet,
  markerLayer: Leaflet.LayerGroup,
  point: MapPoint,
) {
  const marker = L.marker([point.lat, point.lon], {
    icon: L.divIcon({
      className: "",
      html: `<div class="fuel-path-destination-pin"><span></span></div>`,
      iconAnchor: [14, 28],
      iconSize: [28, 28],
    }),
    zIndexOffset: 700,
  });
  marker.bindTooltip(point.label, { direction: "top" });
  markerLayer.addLayer(marker);
}

function markerHtml(item: StationViewModel, selected: boolean) {
  const style = brandStyleForStation(item.station);
  const iconUri = imageUri(style.icon);
  const logo = iconUri
    ? `<img alt="" src="${escapeHtml(iconUri)}" class="fuel-path-marker-logo" />`
    : `<span class="fuel-path-marker-initials" style="background:${style.color}">${escapeHtml(
        style.initials,
      )}</span>`;
  return `
    <div class="fuel-path-marker${selected ? " is-selected" : ""}" data-station-code="${escapeHtml(item.station.stationCode)}" aria-hidden="true">
      <span class="fuel-path-marker-price">${item.adjustedCpl.toFixed(1)}</span>
      <span class="fuel-path-marker-brand">${logo}</span>
    </div>
  `;
}

function clusterMarkerHtml(cluster: ClusterMarker) {
  return `
    <div class="fuel-path-marker-cluster" aria-hidden="true">
      <span class="fuel-path-marker-cluster-count">${cluster.count}</span>
      <span class="fuel-path-marker-cluster-low">${cluster.minPrice.toFixed(1)}</span>
    </div>
  `;
}

function evChargerMarkerHtml(charger: EvCharger, selected: boolean) {
  const label = charger.maxPowerKw ? `${Math.round(charger.maxPowerKw)}kW` : "";
  return `
    <div class="fuel-path-ev-marker${selected ? " is-selected" : ""}" aria-label="${escapeHtml(
      charger.name,
    )}">
      <span class="fuel-path-ev-marker-code">⚡</span>
      ${label ? `<span class="fuel-path-ev-marker-label">${escapeHtml(label)}</span>` : ""}
    </div>
  `;
}

function visibleMarkerGroups(
  stations: StationViewModel[],
  bounds: Leaflet.LatLngBounds,
  selectedStationCode?: string,
  hasEvMarkers = false,
) {
  const protectedCodes = protectedStationCodes(stations, selectedStationCode);
  const priceCells = new Set<string>();
  const clusterGroups = new Map<string, StationViewModel[]>();
  const priceMarkers: StationViewModel[] = [];
  const priceLimit = hasEvMarkers ? mixedEnergyMaxPriceMarkers : maxPriceMarkers;
  const gridSize = hasEvMarkers ? mixedEnergyMarkerGridSize : markerGridSize;
  const visibleStations = stations.filter((item) => bounds.contains([item.station.lat, item.station.lon]));

  const ranked = [...visibleStations].sort((left, right) => {
    const leftProtected = protectedCodes.has(left.station.stationCode) ? 0 : 1;
    const rightProtected = protectedCodes.has(right.station.stationCode) ? 0 : 1;
    return (
      leftProtected - rightProtected ||
      markerPriorityScore(left) - markerPriorityScore(right)
    );
  });

  for (const item of ranked) {
    const cell = markerCell(item, bounds, gridSize);
    const protectedMarker = protectedCodes.has(item.station.stationCode);

    if (
      protectedMarker ||
      (priceMarkers.length < priceLimit && !priceCells.has(cell))
    ) {
      priceMarkers.push(item);
      priceCells.add(cell);
      continue;
    }

    const grouped = clusterGroups.get(cell) || [];
    grouped.push(item);
    clusterGroups.set(cell, grouped);
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
    .sort((left, right) => right.count - left.count || left.minPrice - right.minPrice)

  return { priceMarkers, clusterMarkers };
}

function clusterMarkerForItems(items: StationViewModel[]): ClusterMarker {
  const totals = items.reduce(
    (current, item) => ({
      count: current.count + 1,
      lat: current.lat + item.station.lat,
      lon: current.lon + item.station.lon,
      minPrice: Math.min(current.minPrice, item.adjustedCpl),
    }),
    { count: 0, lat: 0, lon: 0, minPrice: Number.POSITIVE_INFINITY },
  );
  return {
    count: totals.count,
    items,
    lat: totals.lat / totals.count,
    lon: totals.lon / totals.count,
    minPrice: totals.minPrice,
  };
}

function protectedStationCodes(stations: StationViewModel[], selectedStationCode?: string) {
  const codes = new Set<string>();
  if (selectedStationCode) codes.add(selectedStationCode);
  for (const item of stations.slice(0, 4)) {
    codes.add(item.station.stationCode);
  }
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

function markerCell(item: StationViewModel, bounds: Leaflet.LatLngBounds, gridSize: number) {
  const west = bounds.getWest();
  const south = bounds.getSouth();
  const safeLonDelta = Math.max(bounds.getEast() - west, 0.005);
  const safeLatDelta = Math.max(bounds.getNorth() - south, 0.005);
  const x = ((item.station.lon - west) / safeLonDelta) * 1000;
  const y = ((item.station.lat - south) / safeLatDelta) * 1000;
  return `${Math.round(x / gridSize)}:${Math.round(y / gridSize)}`;
}

function imageUri(icon: unknown) {
  if (!icon) return undefined;
  if (typeof icon === "string") return icon;
  if (typeof icon !== "object") return undefined;

  const maybeAsset = icon as { uri?: unknown; src?: unknown };
  if (typeof maybeAsset.uri === "string") return maybeAsset.uri;
  if (typeof maybeAsset.src === "string") return maybeAsset.src;
  return undefined;
}

function fitKeyForPoints(points: Array<[number, number]>) {
  if (points.length <= 24) {
    return points.map(([lat, lon]) => `${lat.toFixed(4)},${lon.toFixed(4)}`).join("|");
  }
  const middle = points[Math.floor(points.length / 2)];
  const last = points[points.length - 1];
  return [
    points.length,
    `${points[0][0].toFixed(4)},${points[0][1].toFixed(4)}`,
    `${middle[0].toFixed(4)},${middle[1].toFixed(4)}`,
    `${last[0].toFixed(4)},${last[1].toFixed(4)}`,
  ].join("|");
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

function leafletPadding(insets: Required<CameraInsets>) {
  return {
    paddingBottomRight: [insets.right, insets.bottom] as [number, number],
    paddingTopLeft: [insets.left, insets.top] as [number, number],
  };
}

function radiusKmForBounds(bounds: Leaflet.LatLngBounds, centre: Leaflet.LatLng) {
  const corners = [
    bounds.getNorthEast(),
    bounds.getNorthWest(),
    bounds.getSouthEast(),
    bounds.getSouthWest(),
  ];
  return Math.max(
    ...corners.map((corner) =>
      distanceKm(
        { lat: centre.lat, lon: centre.lng },
        { lat: corner.lat, lon: corner.lng },
      ),
    ),
  );
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
  map: Leaflet.Map,
  move: () => void,
) {
  programmaticMoveRef.current = true;
  let settled = false;
  let fallbackTimer: ReturnType<typeof window.setTimeout> | undefined;
  const finishProgrammaticMove = () => {
    if (settled) return;
    settled = true;
    programmaticMoveRef.current = false;
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
    map.off("moveend", finishProgrammaticMove);
    map.off("zoomend", finishProgrammaticMove);
  };

  map.once("moveend", finishProgrammaticMove);
  map.once("zoomend", finishProgrammaticMove);
  fallbackTimer = window.setTimeout(finishProgrammaticMove, 1_200);

  try {
    move();
  } catch (error) {
    finishProgrammaticMove();
    throw error;
  }
}

function ensureLeafletStyles() {
  if (typeof document === "undefined") return;

  if (!document.getElementById(LEAFLET_CSS_ID)) {
    const link = document.createElement("link");
    link.id = LEAFLET_CSS_ID;
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }

  if (!document.getElementById(LEAFLET_CUSTOM_CSS_ID)) {
    const style = document.createElement("style");
    style.id = LEAFLET_CUSTOM_CSS_ID;
    style.textContent = `
      .leaflet-container {
        background: ${colors.mapMist};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        height: 100%;
        width: 100%;
      }
      .leaflet-control-attribution {
        font-size: 10px;
      }
      .leaflet-bottom.leaflet-right .leaflet-control-zoom {
        margin-bottom: 132px;
      }
      .leaflet-touch .leaflet-bar a,
      .leaflet-control-zoom a {
        height: 44px;
        line-height: 44px;
        width: 44px;
      }
      .fuel-path-marker {
        align-items: center;
        background: ${colors.white};
        border: 1px solid rgba(7, 86, 66, 0.18);
        border-radius: 12px;
        box-shadow: 0 8px 18px rgba(23, 32, 27, 0.16);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        height: 46px;
        justify-content: stretch;
        overflow: visible;
        position: relative;
        transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
        max-width: 54px;
        min-width: 54px;
        width: 54px;
      }
      .fuel-path-marker::after {
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 8px solid ${colors.white};
        bottom: -7px;
        box-sizing: border-box;
        content: "";
        filter: drop-shadow(0 2px 1px rgba(23, 32, 27, 0.12));
        height: 0;
        left: 50%;
        position: absolute;
        transform: translateX(-50%);
        width: 0;
      }
      .fuel-path-marker.is-selected {
        border-color: ${colors.black};
        box-shadow:
          0 0 0 4px rgba(255, 255, 255, 0.9),
          0 0 0 7px rgba(255, 106, 61, 0.72),
          0 12px 26px rgba(17, 20, 18, 0.32);
        transform: translateY(-4px);
      }
      .fuel-path-marker.is-selected::after {
        border-top-color: ${colors.white};
      }
      .fuel-path-marker-brand {
        align-items: center;
        background: ${colors.white};
        border-bottom-left-radius: 12px;
        border-bottom-right-radius: 12px;
        display: flex;
        flex: 0 0 23px;
        justify-content: center;
        min-height: 23px;
        width: 100%;
      }
      .fuel-path-marker-logo,
      .fuel-path-marker-initials {
        align-items: center;
        background: ${colors.white};
        border-radius: 8px;
        color: ${colors.white};
        display: flex;
        flex: 0 0 auto;
        font-size: 9px;
        font-weight: 900;
        height: 20px;
        justify-content: center;
        object-fit: contain;
        overflow: hidden;
        width: 36px;
      }
      .fuel-path-marker-logo {
        display: block;
        flex-basis: 38px;
        flex-shrink: 0;
        max-width: 38px;
        min-width: 38px;
        object-fit: contain;
        width: 38px;
      }
      .fuel-path-marker-initials {
        border-radius: 999px;
        width: 20px;
      }
      .fuel-path-marker-price {
        align-items: center;
        background: ${colors.greenDark};
        border-top-left-radius: 11px;
        border-top-right-radius: 11px;
        color: ${colors.white};
        display: flex;
        flex: 0 0 23px;
        font-size: 12px;
        font-weight: 900;
        justify-content: center;
        line-height: 1;
        width: 100%;
      }
      .fuel-path-marker.is-selected .fuel-path-marker-price {
        background: ${colors.black};
      }
      .fuel-path-marker-tooltip {
        background: ${colors.white};
        border: 1px solid rgba(23, 32, 27, 0.16);
        border-radius: 8px;
        box-shadow: 0 8px 18px rgba(23, 32, 27, 0.16);
        color: ${colors.ink};
        font-size: 13px;
        font-weight: 700;
        padding: 5px 8px;
        white-space: nowrap;
      }
      .fuel-path-marker-tooltip::before {
        border-top-color: ${colors.white};
      }
      .fuel-path-marker-cluster {
        align-items: center;
        background: rgba(17, 20, 18, 0.88);
        border: 2px solid ${colors.white};
        border-radius: 999px;
        box-shadow: 0 8px 18px rgba(23, 32, 27, 0.2);
        box-sizing: border-box;
        color: ${colors.white};
        display: flex;
        gap: 4px;
        height: 30px;
        justify-content: center;
        padding: 3px 8px;
        white-space: nowrap;
      }
      .fuel-path-marker-cluster-count {
        color: ${colors.white};
        font-size: 12px;
        font-weight: 900;
      }
      .fuel-path-marker-cluster-low {
        color: ${colors.greenSoft};
        font-size: 11px;
        font-weight: 800;
      }
      .fuel-path-ev-marker {
        align-items: center;
        background: ${colors.blue};
        border: 2px solid ${colors.blue};
        border-radius: 18px;
        box-shadow: 0 10px 22px rgba(45, 95, 154, 0.32);
        box-sizing: border-box;
        color: #ffd166;
        display: flex;
        flex-direction: column;
        height: 46px;
        justify-content: center;
        position: relative;
        width: 48px;
      }
      .fuel-path-ev-marker::after {
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 9px solid ${colors.blue};
        bottom: -9px;
        box-sizing: border-box;
        content: "";
        height: 0;
        left: 50%;
        position: absolute;
        transform: translateX(-50%);
        width: 0;
      }
      .fuel-path-ev-marker.is-selected {
        background: ${colors.black};
        border-color: ${colors.black};
        color: #ffd166;
        box-shadow: 0 10px 22px rgba(45, 95, 154, 0.34);
      }
      .fuel-path-ev-marker.is-selected::after {
        border-top-color: ${colors.black};
      }
      .fuel-path-ev-marker-code {
        font-size: 16px;
        font-weight: 900;
        line-height: 18px;
      }
      .fuel-path-ev-marker-label {
        font-size: 12px;
        font-weight: 900;
        line-height: 14px;
      }
      .fuel-path-location-pin {
        background: ${colors.ink};
        border: 3px solid ${colors.white};
        border-radius: 999px 999px 999px 4px;
        box-shadow: 0 8px 18px rgba(23, 32, 27, 0.22);
        box-sizing: border-box;
        height: 28px;
        position: relative;
        transform: rotate(-45deg);
        width: 28px;
      }
      .fuel-path-location-pin span {
        background: ${colors.white};
        border-radius: 999px;
        display: block;
        height: 8px;
        left: 7px;
        position: absolute;
        top: 7px;
        width: 8px;
      }
      .fuel-path-user-location-pin {
        background: ${colors.blue};
        border: 3px solid ${colors.white};
        border-radius: 999px 999px 999px 4px;
        box-shadow: 0 8px 18px rgba(45, 95, 154, 0.28);
        box-sizing: border-box;
        height: 30px;
        position: relative;
        transform: rotate(-45deg);
        width: 30px;
      }
      .fuel-path-user-location-pin span {
        background: ${colors.white};
        border: 2px solid ${colors.blueSoft};
        border-radius: 999px;
        box-sizing: border-box;
        display: block;
        height: 10px;
        left: 7px;
        position: absolute;
        top: 7px;
        width: 10px;
      }
      .fuel-path-destination-pin {
        background: ${mapSkin.route};
        border: 3px solid ${colors.white};
        border-radius: 999px 999px 999px 4px;
        box-shadow: 0 8px 18px ${mapSkin.routeShadow};
        box-sizing: border-box;
        height: 28px;
        position: relative;
        transform: rotate(-45deg);
        width: 28px;
      }
      .fuel-path-destination-pin span {
        background: ${colors.white};
        border-radius: 999px;
        display: block;
        height: 8px;
        left: 7px;
        position: absolute;
        top: 7px;
        width: 8px;
      }
    `;
    document.head.appendChild(style);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
});

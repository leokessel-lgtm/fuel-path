import { createElement, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import type * as Leaflet from "leaflet";

import { brandStyleForStation } from "../data/brandAssets";
import { colors, radii } from "../theme";
import { MapPoint, StationViewModel } from "../types";

const LEAFLET_CSS_ID = "fuel-path-leaflet-css";
const LEAFLET_CUSTOM_CSS_ID = "fuel-path-leaflet-custom-css";
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
  onMapSearchAreaChange,
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
  onMapSearchAreaChange?: (area: { centre: MapPoint; radiusKm: number }) => void;
  cameraFocusKey?: string;
  showCentreMarker?: boolean;
  routeEndpoints?: { from: MapPoint; to: MapPoint };
  routePoints?: MapPoint[];
  cameraInsets?: CameraInsets;
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
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
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
    const cameraPoints = routeEndpoints
      ? routeLatLngs.length >= 2
        ? routeLatLngs
        : [
            [routeEndpoints.from.lat, routeEndpoints.from.lon] as [number, number],
            [routeEndpoints.to.lat, routeEndpoints.to.lon] as [number, number],
          ]
      : [
          [centre.lat, centre.lon] as [number, number],
          ...stations
            .slice(0, maxStationMarkers)
            .map((item) => [item.station.lat, item.station.lon] as [number, number]),
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
      lastCameraContextKeyRef.current = cameraContextKey;
    }

    if (routeEndpoints) {
      if (routeLatLngs.length >= 2) {
        const routeLine = L.polyline(routeLatLngs, {
          className: "fuel-path-route-line",
          color: colors.green,
          opacity: 0.85,
          weight: 5,
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

    stations.slice(0, maxStationMarkers).forEach((item) => {
      const selected = item.station.stationCode === selectedStationCode;
      const accessibilityLabel = markerAccessibilityLabel(item);
      const marker = L.marker([item.station.lat, item.station.lon], {
        icon: L.divIcon({
          className: "",
          html: markerHtml(item, selected, accessibilityLabel),
          iconAnchor: [42, 48],
          iconSize: [84, 48],
        }),
        alt: accessibilityLabel,
        riseOnHover: true,
        title: accessibilityLabel,
        zIndexOffset: selected ? 500 : 0,
      });
      marker.on("click", () => {
        onSelect(item.station.stationCode);
        runProgrammaticMapMove(programmaticMoveRef, () => {
          map.panInside([item.station.lat, item.station.lon], {
            animate: true,
            ...leafletPadding(activeInsets),
          });
        });
      });
      marker.bindTooltip(
        `${item.station.name} - ${item.adjustedCpl.toFixed(1)} c/L`,
        { direction: "top", offset: [0, -28] },
      );
      markerLayer.addLayer(marker);
      fitPoints.push([item.station.lat, item.station.lon]);
    });

    const fitKey = `${fitKeyForPoints(cameraPoints)}|${cameraInsetsKey(activeInsets)}`;
    if (fitKey !== lastFitKeyRef.current && (!userMovedMapRef.current || cameraContextChanged)) {
      runProgrammaticMapMove(programmaticMoveRef, () => {
        map.invalidateSize();
        map.fitBounds(L.latLngBounds(cameraPoints), {
          ...leafletPadding(activeInsets),
          maxZoom: routeEndpoints ? 15 : 14,
        });
      });
      lastFitKeyRef.current = fitKey;
    } else {
      const selected = stations.find((item) => item.station.stationCode === selectedStationCode);
      if (selected && !userMovedMapRef.current) {
        runProgrammaticMapMove(programmaticMoveRef, () => {
          map.panInside([selected.station.lat, selected.station.lon], {
            animate: true,
            ...leafletPadding(activeInsets),
          });
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
    showCentreMarker,
    routeEndpoints,
    routePoints,
    cameraInsets,
    selectedStationCode,
    stations,
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

function markerHtml(item: StationViewModel, selected: boolean, accessibilityLabel: string) {
  const style = brandStyleForStation(item.station);
  const iconUri = imageUri(style.icon);
  const logo = iconUri
    ? `<img alt="" src="${escapeHtml(iconUri)}" class="fuel-path-marker-logo" />`
    : `<span class="fuel-path-marker-initials" style="background:${style.color}">${escapeHtml(
        style.initials,
      )}</span>`;
  return `
    <div class="fuel-path-marker${selected ? " is-selected" : ""}" role="button" aria-label="${escapeHtml(accessibilityLabel)}">
      ${logo}
      <span class="fuel-path-marker-price">${item.adjustedCpl.toFixed(1)}</span>
    </div>
  `;
}

function markerAccessibilityLabel(item: StationViewModel) {
  const brand = item.station.brand || "Unknown brand";
  const name = item.station.name || "Fuel station";
  const price = `${item.adjustedCpl.toFixed(1)} cents per litre`;
  const distance = `${item.distanceKm.toFixed(1)} kilometres away`;
  return `${name}, ${brand}, ${price}, ${distance}`;
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
  move: () => void,
) {
  programmaticMoveRef.current = true;
  move();
  window.setTimeout(() => {
    programmaticMoveRef.current = false;
  }, 500);
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
      .fuel-path-marker {
        align-items: center;
        background: ${colors.green};
        border: 2px solid ${colors.white};
        border-radius: 999px;
        box-shadow: 0 8px 18px rgba(23, 32, 27, 0.24);
        box-sizing: border-box;
        display: flex;
        gap: 4px;
        min-width: 84px;
        padding: 4px 8px 4px 4px;
        transition: transform 160ms ease, background 160ms ease;
      }
      .fuel-path-marker.is-selected {
        background: ${colors.ink};
        transform: scale(1.08);
      }
      .fuel-path-marker-logo,
      .fuel-path-marker-initials {
        align-items: center;
        background: ${colors.white};
        border-radius: 999px;
        color: ${colors.white};
        display: flex;
        flex: 0 0 28px;
        font-size: 10px;
        font-weight: 900;
        height: 28px;
        justify-content: center;
        overflow: hidden;
        width: 28px;
      }
      .fuel-path-marker-price {
        color: ${colors.white};
        font-size: 13px;
        font-weight: 900;
        line-height: 1;
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
      .fuel-path-destination-pin {
        background: ${colors.green};
        border: 3px solid ${colors.white};
        border-radius: 999px 999px 999px 4px;
        box-shadow: 0 8px 18px rgba(23, 32, 27, 0.18);
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Linking,
  Platform,
  StyleSheet,
  View,
} from "react-native";

import { geocodeAddress, getNearbyStations } from "../api/fuelPathApi";
import { FuelSelector } from "../components/FuelSelector";
import { NearbyLocationSearch } from "../components/NearbyLocationSearch";
import {
  defaultNearbySortMode,
  NearbySortMode,
  NearbyStationSheet,
} from "../components/NearbyStationSheet";
import { StationMap } from "../components/StationMap";
import { useNearbyLocationSearch } from "../hooks/useNearbyLocationSearch";
import { getCurrentMapPoint, getGrantedCurrentMapPoint } from "../services/currentLocation";
import { spacing } from "../theme";
import { AppPreferences, FuelCode, MapPoint, StationViewModel } from "../types";
import { sortStations, stationPriceView } from "../utils/pricing";

const defaultNearbyCentre: MapPoint = {
  lat: -34.0114122,
  lon: 151.0993847,
  label: "66B Easton Ave, Sylvania NSW 2224",
};
const defaultNearbyRadiusKm = 8;
const minMapSearchRadiusKm = 10;
const emptyMapRetryRadiusKm = 32;
const maxMapSearchRadiusKm = 90;

type MapSearchArea = {
  centre: MapPoint;
  radiusKm: number;
};

export function NearbyScreen({
  preferences,
  onFuelChange,
}: {
  preferences: AppPreferences;
  onFuelChange: (fuel: FuelCode) => void;
}) {
  const [stations, setStations] = useState<StationViewModel[]>([]);
  const [centre, setCentre] = useState<MapPoint>(defaultNearbyCentre);
  const [currentLocation, setCurrentLocation] = useState<MapPoint>();
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState(defaultNearbyRadiusKm);
  const [cameraFocusVersion, setCameraFocusVersion] = useState(0);
  const [selectedCode, setSelectedCode] = useState<string>();
  const [selectionDismissed, setSelectionDismissed] = useState(false);
  const [visibleStationCodes, setVisibleStationCodes] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<NearbySortMode>(defaultNearbySortMode);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const previousSortMode = useRef<NearbySortMode | undefined>(sortMode);
  const [loading, setLoading] = useState(true);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [error, setError] = useState("");
  const [stationNotice, setStationNotice] = useState("");
  const {
    addRecentLocation,
    clearLocationSearch,
    getAddressSessionToken,
    locationError,
    locationQuery,
    locationSearchActive,
    locationSuggestions,
    recentLocations,
    resetAddressSessionToken,
    setLocationError,
    setLocationQuery,
    suggestionsLoading,
    updateLocationQuery,
  } = useNearbyLocationSearch();

  useEffect(() => {
    let active = true;
    getGrantedCurrentMapPoint()
      .then((nextCentre) => {
        if (active) {
          setCurrentLocation(nextCentre);
          setCentre(nextCentre);
          setCameraFocusVersion((current) => current + 1);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setStationNotice("");
    async function loadStations() {
      const response = await getNearbyStations({
        fuel: preferences.fuel,
        centre,
        radiusKm: nearbyRadiusKm,
        limit: stationLimitForRadius(nearbyRadiusKm),
      });
      let notice = stationContextNotice(response.context);
      let priced = response.stations
        .map((station) => stationPriceView(station, preferences.fuel, preferences))
        .filter((item): item is StationViewModel => Boolean(item));
      if (!priced.length && nearbyRadiusKm < emptyMapRetryRadiusKm) {
        const retryResponse = await getNearbyStations({
          fuel: preferences.fuel,
          centre,
          radiusKm: emptyMapRetryRadiusKm,
          limit: stationLimitForRadius(emptyMapRetryRadiusKm),
        });
        notice = stationContextNotice(retryResponse.context) || notice;
        priced = retryResponse.stations
          .map((station) => stationPriceView(station, preferences.fuel, preferences))
          .filter((item): item is StationViewModel => Boolean(item));
      }
      if (!priced.length && !notice) {
        notice = `No ${preferences.fuel} prices found around ${centre.label}.`;
      }
      return { notice, priced };
    }

    loadStations()
      .then(({ notice, priced }) => {
        if (!active) return;
        setStations(priced);
        setStationNotice(notice);
        setSelectedCode(undefined);
        setSelectionDismissed(false);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [centre, nearbyRadiusKm, preferences]);

  const applyLocationSearch = async () => {
    const query = locationQuery.trim();
    if (!query) return;
    setResolvingLocation(true);
    setLocationError("");
    try {
      const location = await geocodeAddress(query, getAddressSessionToken());
      const nextCentre = {
        lat: location.lat,
        lon: location.lon,
        label: shortLocationLabel(query, location.label),
      };
      setCentre(nextCentre);
      setNearbyRadiusKm(defaultNearbyRadiusKm);
      setCameraFocusVersion((current) => current + 1);
      setLocationQuery(nextCentre.label);
      addRecentLocation(nextCentre);
      clearLocationSearch();
      resetAddressSessionToken();
      setSheetExpanded(false);
      setSortMode(defaultNearbySortMode);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : "Could not find that location");
    } finally {
      setResolvingLocation(false);
    }
  };

  const useCurrentLocation = async () => {
    setResolvingLocation(true);
    setLocationError("");
    try {
      const nextCentre = await getCurrentMapPoint();
      setCurrentLocation(nextCentre);
      setCentre(nextCentre);
      setNearbyRadiusKm(defaultNearbyRadiusKm);
      setCameraFocusVersion((current) => current + 1);
      setLocationQuery("");
      clearLocationSearch();
      resetAddressSessionToken();
      setSheetExpanded(false);
      setSortMode(defaultNearbySortMode);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : "Current location is not available.");
    } finally {
      setResolvingLocation(false);
    }
  };

  const handleViewportStationsChange = useCallback((stationCodes: string[]) => {
    setVisibleStationCodes((current) =>
      sameStationCodes(current, stationCodes) ? current : stationCodes,
    );
  }, []);

  const handleMapSearchAreaChange = useCallback((area: MapSearchArea) => {
    const nextRadiusKm = Math.max(
      minMapSearchRadiusKm,
      Math.min(maxMapSearchRadiusKm, Math.ceil(area.radiusKm * 1.15)),
    );
    setCentre((current) => {
      const centreMovedKm = distanceKm(current, area.centre);
      if (centreMovedKm < 0.8) return current;
      return {
        ...area.centre,
        label: "Map area",
      };
    });
    setNearbyRadiusKm((current) =>
      Math.abs(current - nextRadiusKm) < 2 ? current : nextRadiusKm,
    );
    setLocationQuery("");
    clearLocationSearch();
  }, []);

  const selectRecentLocation = (location: MapPoint) => {
    setCentre(location);
    setNearbyRadiusKm(defaultNearbyRadiusKm);
    setCameraFocusVersion((current) => current + 1);
    setLocationQuery(location.label);
    clearLocationSearch();
    setSheetExpanded(false);
    setSortMode(defaultNearbySortMode);
  };

  const selectLocationSuggestion = (location: MapPoint) => {
    const nextCentre = {
      lat: location.lat,
      lon: location.lon,
      label: shortLocationLabel(location.label, location.label),
    };
    setCentre(nextCentre);
    setNearbyRadiusKm(defaultNearbyRadiusKm);
    setCameraFocusVersion((current) => current + 1);
    setLocationQuery(nextCentre.label);
    addRecentLocation(nextCentre);
    clearLocationSearch();
    resetAddressSessionToken();
    setSheetExpanded(false);
    setSortMode(defaultNearbySortMode);
  };

  const visibleStationSet = useMemo(() => new Set(visibleStationCodes), [visibleStationCodes]);

  const listSourceStations = useMemo(() => {
    if (!sortMode || sortMode === "distance" || visibleStationSet.size === 0) return stations;
    const visible = stations.filter((item) => visibleStationSet.has(item.station.stationCode));
    return visible.length ? visible : stations;
  }, [sortMode, stations, visibleStationSet]);

  const sortedStations = useMemo(
    () => (sortMode ? sortStations(listSourceStations, sortMode) : listSourceStations),
    [listSourceStations, sortMode],
  );
  const selected = stations.find((item) => item.station.stationCode === selectedCode);
  const nearbyCameraInsets = useMemo(
    () => ({
      top: 170,
      right: 18,
      bottom: 150,
      left: 18,
    }),
    [],
  );

  const handleSortPress = (nextSortMode: NearbySortMode) => {
    setSortMode(nextSortMode);
    setSheetExpanded(true);
    setSelectionDismissed(false);
  };

  const handleMapStationSelect = useCallback((stationCode: string) => {
    setSelectedCode(stationCode);
    setSelectionDismissed(false);
    setSheetExpanded(false);
  }, []);

  const handleListStationSelect = useCallback((stationCode: string) => {
    setSelectedCode(stationCode);
    setSelectionDismissed(false);
  }, []);

  const handleCloseSelectedStation = useCallback(() => {
    setSelectedCode(undefined);
    setSelectionDismissed(true);
  }, []);

  const handleNavigateToStation = useCallback(async (item: StationViewModel) => {
    const { station } = item;
    const label = encodeURIComponent(station.address || station.name);
    const lat = Number(station.lat);
    const lon = Number(station.lon);
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${lat},${lon}&q=${label}`
        : Platform.OS === "android"
          ? `geo:0,0?q=${lat},${lon}(${label})`
          : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;

    try {
      await Linking.openURL(url);
    } catch {
      setLocationError("Could not open maps for this station.");
    }
  }, []);

  useEffect(() => {
    if (!sortedStations.length) {
      setSelectedCode(undefined);
      return;
    }
    const selectedExists = stations.some((item) => item.station.stationCode === selectedCode);
    if (!sortMode) {
      if (selectedCode && !selectedExists) setSelectedCode(undefined);
      previousSortMode.current = sortMode;
      return;
    }
    if (selectionDismissed && !selectedCode) return;
    const sortChanged = previousSortMode.current !== sortMode;
    previousSortMode.current = sortMode;
    if (
      sortChanged ||
      !selectedCode ||
      !selectedExists
    ) {
      setSelectedCode(sortedStations[0].station.stationCode);
    }
  }, [selectedCode, selectionDismissed, sortMode, sortedStations, stations]);

  return (
    <View style={styles.screen}>
      <View style={styles.mapLayer}>
        <StationMap
          centre={centre}
          stations={stations}
          selectedStationCode={selectedCode}
          onSelect={handleMapStationSelect}
          onViewportStationsChange={handleViewportStationsChange}
          onMapSearchAreaChange={handleMapSearchAreaChange}
          cameraFocusKey={`nearby-${cameraFocusVersion}`}
          showCentreMarker={false}
          userLocation={currentLocation}
          cameraInsets={nearbyCameraInsets}
        />
      </View>

      <View style={styles.topControls}>
        <NearbyLocationSearch
          locationError={locationError}
          locationQuery={locationQuery}
          locationSearchActive={locationSearchActive}
          locationSuggestions={locationSuggestions}
          onApplyLocationSearch={applyLocationSearch}
          onQueryChange={updateLocationQuery}
          onSelectRecentLocation={selectRecentLocation}
          onSelectSuggestion={selectLocationSuggestion}
          onUseCurrentLocation={useCurrentLocation}
          recentLocations={recentLocations}
          resolvingLocation={resolvingLocation}
          suggestionsLoading={suggestionsLoading}
        />
        <FuelSelector value={preferences.fuel} onChange={onFuelChange} />
      </View>

      <NearbyStationSheet
        error={error}
        loading={loading}
        onCloseSelectedStation={handleCloseSelectedStation}
        onNavigateToStation={handleNavigateToStation}
        onSelectStation={handleListStationSelect}
        onSortPress={handleSortPress}
        onToggleExpanded={setSheetExpanded}
        selected={selected}
        selectedCode={selectedCode}
        sheetExpanded={sheetExpanded}
        sortedStations={sortedStations}
        sortMode={sortMode}
        stationNotice={stationNotice}
        stations={stations}
      />
    </View>
  );
}

function sameStationCodes(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function distanceKm(left: MapPoint, right: MapPoint) {
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

function stationLimitForRadius(radiusKm: number) {
  if (radiusKm >= 60) return 420;
  if (radiusKm >= 35) return 320;
  if (radiusKm >= 20) return 240;
  return 160;
}

function shortLocationLabel(query: string, resolvedLabel: string) {
  if (query.length <= 42) return query;
  return resolvedLabel.split(",").slice(0, 3).join(",").trim() || query;
}

function stationContextNotice(context: {
  warning?: string;
  capability?: string;
  regionCapabilities?: Array<{ region: string; capability: string; blocker?: string }>;
}) {
  if (context.warning) return context.warning;
  const limited = context.regionCapabilities?.find((item) =>
    ["limited", "pending_access", "fallback", "unsupported"].includes(item.capability),
  );
  if (!limited) return "";
  if (limited.capability === "pending_access") {
    return `${limited.region} live prices are not enabled yet. ${limited.blocker || ""}`.trim();
  }
  if (limited.capability === "limited") {
    return `${limited.region} live coverage is limited. Confirm freshness before driving.`;
  }
  if (limited.capability === "fallback") {
    return `Using fallback data for ${limited.region}. Do not treat it as a live price recommendation.`;
  }
  return "No live fuel provider covers this area yet.";
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: "hidden",
  },
  mapLayer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  topControls: {
    gap: spacing.sm,
    left: spacing.md,
    position: "absolute",
    right: spacing.md,
    top: spacing.md,
    zIndex: 5,
  },
});

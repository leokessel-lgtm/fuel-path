import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { geocodeAddress, getNearbyStations, searchLocations } from "../api/fuelPathApi";
import { FuelSelector } from "../components/FuelSelector";
import { StationMap } from "../components/StationMap";
import { StationRow } from "../components/StationRow";
import { getCurrentMapPoint, getGrantedCurrentMapPoint } from "../services/currentLocation";
import { colors, radii, shadow, spacing, typeScale } from "../theme";
import { AppPreferences, FuelCode, MapPoint, StationViewModel } from "../types";
import { formatRelativeUpdatedAt, sortStations, stationPriceView } from "../utils/pricing";

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

type SortMode = "distance" | "price" | "value";

const sortOptions: Array<{ key: SortMode; label: string; accessibilityLabel: string }> = [
  { key: "distance", label: "Closest", accessibilityLabel: "Sort by closest station" },
  { key: "price", label: "Cheapest", accessibilityLabel: "Sort by cheapest station in map view" },
  { key: "value", label: "Best value", accessibilityLabel: "Sort by best balance of price and distance" },
];

export function NearbyScreen({
  preferences,
  onFuelChange,
}: {
  preferences: AppPreferences;
  onFuelChange: (fuel: FuelCode) => void;
}) {
  const [stations, setStations] = useState<StationViewModel[]>([]);
  const [centre, setCentre] = useState<MapPoint>(defaultNearbyCentre);
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState(defaultNearbyRadiusKm);
  const [cameraFocusVersion, setCameraFocusVersion] = useState(0);
  const [locationQuery, setLocationQuery] = useState("");
  const [recentLocations, setRecentLocations] = useState<MapPoint[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<MapPoint[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [locationSearchActive, setLocationSearchActive] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string>();
  const [selectionDismissed, setSelectionDismissed] = useState(false);
  const [visibleStationCodes, setVisibleStationCodes] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>();
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const previousSortMode = useRef<SortMode | undefined>(sortMode);
  const [loading, setLoading] = useState(true);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");
  const addressSessionTokenRef = useRef(makeLocationSessionToken());

  useEffect(() => {
    let active = true;
    getGrantedCurrentMapPoint()
      .then((nextCentre) => {
        if (active) {
          setCentre(nextCentre);
          setCameraFocusVersion((current) => current + 1);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const addRecentLocation = useCallback((location: MapPoint) => {
    setRecentLocations((current) => {
      const deduped = current.filter((item) => item.label !== location.label);
      return [location, ...deduped].slice(0, 5);
    });
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    async function loadStations() {
      const response = await getNearbyStations({
        fuel: preferences.fuel,
        centre,
        radiusKm: nearbyRadiusKm,
        limit: stationLimitForRadius(nearbyRadiusKm),
      });
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
        priced = retryResponse.stations
          .map((station) => stationPriceView(station, preferences.fuel, preferences))
          .filter((item): item is StationViewModel => Boolean(item));
      }
      return priced;
    }

    loadStations()
      .then((priced) => {
        if (!active) return;
        setStations(priced);
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

  useEffect(() => {
    if (!locationSearchActive) return;
    const query = locationQuery.trim();
    if (query.length < 3) {
      setLocationSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    let active = true;
    setSuggestionsLoading(true);
    const timer = setTimeout(() => {
      searchLocations(query, 5, addressSessionTokenRef.current)
        .then((suggestions) => {
          if (active) setLocationSuggestions(suggestions);
        })
        .catch((err: Error) => {
          if (!active) return;
          setLocationSuggestions([]);
          setLocationError(err.message);
        })
        .finally(() => {
          if (active) setSuggestionsLoading(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [locationQuery, locationSearchActive]);

  const applyLocationSearch = async () => {
    const query = locationQuery.trim();
    if (!query) return;
    setResolvingLocation(true);
    setLocationError("");
    try {
      const location = await geocodeAddress(query);
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
      setLocationSuggestions([]);
      setLocationSearchActive(false);
      addressSessionTokenRef.current = makeLocationSessionToken();
      setSheetExpanded(false);
      setSortMode(undefined);
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
      setCentre(nextCentre);
      setNearbyRadiusKm(defaultNearbyRadiusKm);
      setCameraFocusVersion((current) => current + 1);
      setLocationQuery("");
      setLocationSuggestions([]);
      setLocationSearchActive(false);
      addressSessionTokenRef.current = makeLocationSessionToken();
      setSheetExpanded(false);
      setSortMode(undefined);
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
    setLocationSuggestions([]);
    setLocationSearchActive(false);
    setLocationError("");
  }, []);

  const selectRecentLocation = (location: MapPoint) => {
    setCentre(location);
    setNearbyRadiusKm(defaultNearbyRadiusKm);
    setCameraFocusVersion((current) => current + 1);
    setLocationQuery(location.label);
    setLocationSuggestions([]);
    setLocationSearchActive(false);
    setLocationError("");
    setSheetExpanded(false);
    setSortMode(undefined);
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
    setLocationSuggestions([]);
    setLocationSearchActive(false);
    setLocationError("");
    addressSessionTokenRef.current = makeLocationSessionToken();
    setSheetExpanded(false);
    setSortMode(undefined);
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
  const selectedMetaLine = selected
    ? [
        selected.station.phone || selected.station.brand,
        formatRelativeUpdatedAt(selected.station.updatedAt),
      ]
        .filter(Boolean)
        .join(" | ")
    : "";
  const nearbyCameraInsets = useMemo(
    () => ({
      top: 170,
      right: 18,
      bottom: sheetExpanded ? 330 : selected ? 285 : 150,
      left: 18,
    }),
    [selected, sheetExpanded],
  );

  const handleSortPress = (nextSortMode: SortMode) => {
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
          showCentreMarker={centre.label === "Current location"}
          cameraInsets={nearbyCameraInsets}
        />
      </View>

      <View style={styles.topControls}>
        <View style={styles.searchControlRow}>
          <View style={styles.locationCard}>
            <View style={styles.locationInputRow}>
              <TextInput
                accessibilityLabel="Nearby location"
                value={locationQuery}
                onChangeText={(value) => {
                  setLocationQuery(value);
                  setLocationError("");
                  setLocationSearchActive(true);
                }}
                onFocus={() => setLocationSearchActive(true)}
                onSubmitEditing={applyLocationSearch}
                placeholder="Search address, suburb or place"
                returnKeyType="search"
                style={styles.locationInput}
              />
              {locationQuery.trim() || resolvingLocation ? (
                <Pressable
                  accessibilityLabel="Find nearby location"
                  onPress={applyLocationSearch}
                  disabled={resolvingLocation}
                  style={[styles.locationButton, resolvingLocation && styles.buttonDisabled]}
                >
                  <Text style={styles.locationButtonText}>
                    {resolvingLocation ? "..." : "Find"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {locationSearchActive && locationQuery.trim().length >= 3 ? (
              <View style={styles.lookupResults}>
                {suggestionsLoading ? (
                  <Text style={styles.lookupLoading}>Searching...</Text>
                ) : null}
                {locationSuggestions.map((location) => (
                  <Pressable
                    accessibilityLabel={`Use suggested location ${location.label}`}
                    key={`${location.lat}:${location.lon}:${location.label}`}
                    onPress={() => selectLocationSuggestion(location)}
                    style={styles.lookupResultRow}
                  >
                    <View style={styles.lookupResultPin} />
                    <View style={styles.lookupResultCopy}>
                      <Text numberOfLines={1} style={styles.lookupResultTitle}>
                        {suggestionTitle(location)}
                      </Text>
                      <Text numberOfLines={1} style={styles.lookupResultMeta}>
                        {suggestionMeta(location)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {locationSearchActive && !locationQuery.trim() && recentLocations.length ? (
              <View style={styles.lookupResults}>
                {recentLocations.map((location) => (
                  <Pressable
                    accessibilityLabel={`Use recent search ${location.label}`}
                    key={`${location.lat}:${location.lon}:${location.label}`}
                    onPress={() => selectRecentLocation(location)}
                    style={styles.lookupResultRow}
                  >
                    <View style={styles.recentSearchDot} />
                    <View style={styles.lookupResultCopy}>
                      <Text numberOfLines={1} style={styles.lookupResultTitle}>
                        {suggestionTitle(location)}
                      </Text>
                      <Text numberOfLines={1} style={styles.lookupResultMeta}>
                        {suggestionMeta(location)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {locationError ? <Text style={styles.locationError}>{locationError}</Text> : null}
          </View>
          <Pressable
            accessibilityLabel="Use current location"
            onPress={useCurrentLocation}
            disabled={resolvingLocation}
            style={({ pressed }) => [
              styles.currentLocationPill,
              pressed && styles.currentLocationPillPressed,
              resolvingLocation && styles.buttonDisabled,
            ]}
          >
            <View style={styles.currentLocationIcon}>
              <View style={styles.currentLocationCrossVertical} />
              <View style={styles.currentLocationCrossHorizontal} />
              <View style={styles.currentLocationRing} />
              <View style={styles.currentLocationDot} />
            </View>
          </Pressable>
        </View>
        <FuelSelector value={preferences.fuel} onChange={onFuelChange} />
      </View>

      <View style={[styles.sheet, sheetExpanded ? styles.sheetExpanded : styles.sheetCollapsed]}>
        <View style={styles.sheetHeader}>
          <Pressable
            accessibilityLabel={sheetExpanded ? "Collapse station list" : "Expand station list"}
            onPress={() => setSheetExpanded((current) => !current)}
            style={styles.grabberTouch}
          >
            <View style={styles.grabber} />
          </Pressable>
          {sheetExpanded ? (
            <Pressable
              accessibilityLabel="Show map"
              onPress={() => setSheetExpanded(false)}
              style={styles.mapButton}
            >
              <Text style={styles.mapButtonText}>Map</Text>
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.muted}>Loading live FuelCheck stations...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Could not load stations</Text>
            <Text style={styles.muted}>{error}</Text>
          </View>
        ) : null}

        {!loading && !error ? (
          <>
            {selected ? (
              <View style={[styles.selectedCard, !sheetExpanded && styles.selectedCardCollapsed]}>
                <View style={styles.selectedHeader}>
                  <View style={styles.selectedCopy}>
                    <Text numberOfLines={1} style={styles.selectedTitle}>
                      {selected.station.name}
                    </Text>
                    {selected.station.address ? (
                      <Text numberOfLines={1} style={styles.selectedDetail}>
                        {selected.station.address}
                      </Text>
                    ) : null}
                    <View style={styles.selectedMetaRow}>
                      <View style={styles.selectedStatus}>
                        <Text numberOfLines={1} style={styles.muted}>
                          {stationOpenLabel(selected.station.openNow)}
                        </Text>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: stationOpenDotColor(selected.station.openNow) },
                          ]}
                        />
                      </View>
                      {selectedMetaLine ? <Text style={styles.metaSeparator}>|</Text> : null}
                      <Text numberOfLines={1} style={styles.selectedMetaRest}>
                        {selectedMetaLine}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    accessibilityLabel="Close selected station"
                    onPress={handleCloseSelectedStation}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>X</Text>
                  </Pressable>
                </View>
                <View style={styles.selectedActions}>
                  <View style={styles.selectedPrice}>
                    <Text style={styles.priceValue}>
                      {selected.adjustedCpl.toFixed(1)}
                      <Text style={styles.priceUnitInline}> c/L</Text>
                    </Text>
                  </View>
                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceBadgeText}>
                      {selected.distanceKm.toFixed(1)} km
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel={`Navigate to ${selected.station.name}`}
                    onPress={() => handleNavigateToStation(selected)}
                    style={styles.navigateButton}
                  >
                    <Text style={styles.navigateButtonText}>Navigate</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            <View style={styles.sortRow}>
              {sortOptions.map((option) => {
                const selectedSort = sortMode === option.key;
                return (
                  <Pressable
                    accessibilityLabel={option.accessibilityLabel}
                    key={option.key}
                    onPress={() => handleSortPress(option.key)}
                    style={[styles.sortButton, selectedSort && styles.sortButtonSelected]}
                  >
                    <Text style={[styles.sortText, selectedSort && styles.sortTextSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {sheetExpanded ? (
              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator
              >
                {sortedStations.slice(0, 18).map((item) => (
                  <StationRow
                    item={item}
                    key={item.station.stationCode}
                    selected={item.station.stationCode === selectedCode}
                    onPress={() => handleListStationSelect(item.station.stationCode)}
                  />
                ))}
              </ScrollView>
            ) : null}
          </>
        ) : null}
      </View>
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

function makeLocationSessionToken() {
  return `nearby-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function suggestionTitle(point: MapPoint) {
  return point.label.split(",")[0]?.trim() || point.label;
}

function suggestionMeta(point: MapPoint) {
  const parts = point.label.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.slice(1, 4).join(", ") || "Australia";
}

function stationOpenLabel(openNow?: boolean) {
  if (openNow === false) return "Closed";
  if (openNow === true) return "Open now";
  return "Hours unknown";
}

function stationOpenDotColor(openNow?: boolean) {
  if (openNow === false) return colors.red;
  if (openNow === true) return colors.green;
  return colors.muted;
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
  searchControlRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
  },
  locationCard: {
    ...shadow.soft,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    flex: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  locationInputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  locationInput: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: typeScale.body,
    fontWeight: "800",
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  locationButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  locationButtonText: {
    color: colors.white,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  lookupResults: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  lookupLoading: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "800",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  lookupResultRow: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  recentSearchDot: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 12,
    width: 12,
  },
  lookupResultPin: {
    backgroundColor: colors.green,
    borderColor: colors.white,
    borderRadius: radii.pill,
    borderBottomLeftRadius: 3,
    borderWidth: 2,
    height: 15,
    transform: [{ rotate: "-45deg" }],
    width: 15,
  },
  lookupResultCopy: {
    flex: 1,
    minWidth: 0,
  },
  lookupResultTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  lookupResultMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 1,
  },
  currentLocationPill: {
    ...shadow.soft,
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 50,
  },
  currentLocationPillPressed: {
    opacity: 0.82,
  },
  currentLocationIcon: {
    alignItems: "center",
    height: 24,
    justifyContent: "center",
    position: "relative",
    width: 24,
  },
  currentLocationCrossVertical: {
    backgroundColor: colors.green,
    borderRadius: radii.pill,
    height: 24,
    position: "absolute",
    width: 2,
  },
  currentLocationCrossHorizontal: {
    backgroundColor: colors.green,
    borderRadius: radii.pill,
    height: 2,
    position: "absolute",
    width: 24,
  },
  currentLocationRing: {
    backgroundColor: colors.white,
    borderColor: colors.green,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 16,
    position: "absolute",
    width: 16,
  },
  currentLocationDot: {
    backgroundColor: colors.green,
    borderRadius: radii.pill,
    height: 6,
    position: "absolute",
    width: 6,
  },
  locationError: {
    color: colors.red,
    fontSize: 11,
    fontWeight: "800",
  },
  sheet: {
    ...shadow.soft,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    gap: spacing.md,
    bottom: spacing.sm,
    left: spacing.md,
    padding: spacing.md,
    position: "absolute",
    right: spacing.md,
    zIndex: 6,
  },
  sheetCollapsed: {
    maxHeight: 305,
  },
  sheetExpanded: {
    height: "66%",
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 20,
  },
  grabberTouch: {
    alignItems: "center",
    flex: 1,
    paddingVertical: spacing.xs,
  },
  mapButton: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    position: "absolute",
    right: 0,
  },
  mapButtonText: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: "900",
  },
  grabber: {
    alignSelf: "center",
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    height: 4,
    width: 44,
  },
  sortRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  sortButton: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: radii.pill,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  sortButtonSelected: {
    backgroundColor: colors.green,
  },
  sortText: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  sortTextSelected: {
    color: colors.white,
  },
  loadingState: {
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  emptyState: {
    backgroundColor: colors.panel,
    borderRadius: radii.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  emptyTitle: {
    color: colors.ink,
    fontWeight: "900",
  },
  muted: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
    lineHeight: 17,
  },
  selectedCard: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  selectedCardCollapsed: {
    paddingVertical: spacing.sm,
  },
  selectedHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
  },
  selectedCopy: {
    flex: 1,
    minWidth: 0,
  },
  selectedTitle: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  selectedDetail: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "700",
    lineHeight: 17,
  },
  selectedMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    minWidth: 0,
  },
  selectedStatus: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  statusDot: {
    borderRadius: radii.pill,
    height: 7,
    width: 7,
  },
  metaSeparator: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  selectedMetaRest: {
    color: colors.muted,
    flex: 1,
    fontSize: typeScale.caption,
    fontWeight: "700",
    lineHeight: 17,
    minWidth: 0,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  closeButtonText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  selectedActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  selectedPrice: {
    alignItems: "flex-start",
    flex: 1,
    minWidth: 0,
  },
  priceValue: {
    color: colors.greenDark,
    fontSize: typeScale.title,
    fontWeight: "900",
  },
  priceUnitInline: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  distanceBadge: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.green,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  distanceBadgeText: {
    color: colors.greenDark,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  navigateButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: radii.pill,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  navigateButtonText: {
    color: colors.white,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
});

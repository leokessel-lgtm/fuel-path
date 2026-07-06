import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { geocodeAddress } from "../api/fuelPathApi";
import { NearbyLocationSearch } from "../components/NearbyLocationSearch";
import { NearbyCombinedPanel } from "../components/NearbyCombinedPanel";
import { NearbyFuelPanel } from "../components/NearbyFuelPanel";
import { NearbySortMode } from "../components/NearbyStationSheet";
import { StationBrandFilterPill } from "../components/StationBrandFilterPill";
import { StationMap } from "../components/StationMap";
import { useNearbyLocationSearch } from "../hooks/useNearbyLocationSearch";
import { useMeasuredControlBoundary } from "../hooks/useMeasuredControlBoundary";
import { useNearbyResults } from "../hooks/useNearbyResults";
import { useStationBrandFilterOverride } from "../hooks/useStationBrandFilterOverride";
import { useVisibleStationCodes } from "../hooks/useVisibleStationCodes";
import { getCurrentMapPoint, getGrantedCurrentMapPoint } from "../services/currentLocation";
import { spacing } from "../theme";
import { AppPreferences, EvCharger, EvConnector, EvPowerMode, FuelCode, MapPoint, NearbySheetSnap, StationViewModel } from "../types";
import { EvChargerPanel, NearbyEnergyChoice, NearbyEnergySelector, NearbyMode } from "../components/NearbyEvControls";
import { sortStations } from "../utils/pricing";
import {
  distanceKm,
  openDirections,
  preferredNearbyMode,
  shortLocationLabel,
  toggleConnectorFilter,
} from "./NearbyScreen.utils";

const defaultNearbyCentre: MapPoint = {
  lat: -31.9523123,
  lon: 115.861309,
  label: "Perth CBD WA 6000",
};
const defaultNearbyRadiusKm = 16;
const minMapSearchRadiusKm = 16;
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
  const [centre, setCentre] = useState<MapPoint>(defaultNearbyCentre);
  const [currentLocation, setCurrentLocation] = useState<MapPoint>();
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState(defaultNearbyRadiusKm);
  const [cameraFocusVersion, setCameraFocusVersion] = useState(0);
  const [selectedCode, setSelectedCode] = useState<string>();
  const [selectedStation, setSelectedStation] = useState<StationViewModel>();
  const [selectionDismissed, setSelectionDismissed] = useState(false);
  const [sortMode, setSortMode] = useState<NearbySortMode | undefined>(undefined);
  const [sheetSnap, setSheetSnap] = useState<NearbySheetSnap>("browse");
  const previousSortMode = useRef<NearbySortMode | undefined>(sortMode);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [nearbyMode, setNearbyMode] = useState<NearbyMode>(() => preferredNearbyMode(preferences));
  const [evConnectors, setEvConnectors] = useState<EvConnector[]>(preferences.evConnectors || []);
  const [evPowerMode, setEvPowerMode] = useState<EvPowerMode>("");
  const [energySelectorOpen, setEnergySelectorOpen] = useState(false);
  const { expandedSheetTop, nearbyCameraInsets, onTopControlsLayout } = useMeasuredControlBoundary();
  const { handleViewportStationsChange, visibleStationCodes } = useVisibleStationCodes();
  const sheetExpanded = sheetSnap === "full";
  const setNearbySheetSnap = (snap: NearbySheetSnap) => {
    setSheetSnap(snap);
    if (snap !== "full") setSortMode(undefined);
  };
  const setSheetExpanded = (expanded: boolean) => setNearbySheetSnap(expanded ? "full" : "browse");
  const setNearbyModeAndBrowse = (mode: NearbyMode) => {
    setNearbyMode(mode);
    setNearbySheetSnap("browse");
  };
  const selectedEnergy: NearbyEnergyChoice = nearbyMode === "ev" ? "EV" : preferences.fuel;
  const changeSelectedEnergy = (value: NearbyEnergyChoice) => {
    setEnergySelectorOpen(false);
    setSelectedCode(undefined);
    setSelectionDismissed(false);
    setNearbySheetSnap("browse");
    if (value === "EV") {
      setNearbyMode("ev");
      return;
    }
    onFuelChange(value);
    setNearbyMode("fuel");
    setSortMode(undefined);
  };
  const locationSearchContext = useMemo(
    () => ({ near: centre, nearRadiusKm: Math.max(nearbyRadiusKm, minMapSearchRadiusKm) }),
    [centre, nearbyRadiusKm],
  );

  useEffect(() => {
    setNearbyMode(preferredNearbyMode(preferences));
    setEvConnectors(preferences.evConnectors || []);
    setSelectedCode(undefined);
    setSelectionDismissed(false);
    setSortMode(undefined);
  }, [preferences.activeVehicleId]);

  const {
    brandFilterActive,
    preferredBrands,
    setShowAllStationBrandsOnce,
    showAllStationBrandsOnce,
    stationBrandFilterLabel,
  } = useStationBrandFilterOverride({ centre, preferences });
  const { chargers, error, evNotice, loading, stationContext, stationNotice, stations } = useNearbyResults({
    centre,
    evConnectors,
    evPowerMode,
    nearbyMode,
    nearbyRadiusKm,
    preferences,
    showAllStationBrandsOnce,
  });
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
  } = useNearbyLocationSearch(locationSearchContext);

  const applyLocationSearch = async () => {
    const query = locationQuery.trim();
    if (!query) return;
    setResolvingLocation(true);
    setLocationError("");
    try {
      const location = await geocodeAddress(query, getAddressSessionToken(), locationSearchContext);
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
      setNearbySheetSnap("browse");
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
      setNearbySheetSnap("browse");
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : "Current location is not available.");
    } finally {
      setResolvingLocation(false);
    }
  };

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
    setNearbySheetSnap("browse");
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
    setNearbySheetSnap("browse");
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
  const selectedForPanel = selectedStation && selectedStation.station.stationCode === selectedCode ? selectedStation : selected;
  const selectedCharger = chargers.find((item) => item.id === selectedCode) || chargers[0];
  const selectedPlaceActive = locationQuery.trim().length > 0 && locationQuery.trim() === centre.label;

  const handleSortPress = (nextSortMode: NearbySortMode) => {
    setSortMode(nextSortMode);
    setNearbySheetSnap("full");
    setSelectionDismissed(false);
  };

  const handleMapStationSelect = useCallback((stationCode: string) => {
    setSelectedCode(stationCode);
    setSortMode(undefined);
    setSelectionDismissed(false);
    setSheetSnap("peek");
  }, []);

  const handleMapChargerSelect = useCallback((chargerId: string) => {
    setSelectedCode(chargerId);
    setSelectionDismissed(false);
    setSheetSnap("peek");
  }, []);

  const handleListStationSelect = useCallback((stationCode: string) => {
    setSelectedCode(stationCode);
    setSelectionDismissed(false);
  }, []);

  const handleCloseSelectedStation = useCallback(() => {
    setSelectedCode(undefined);
    setSelectionDismissed(true);
    setSelectedStation(undefined);
  }, []);

  const handleNavigateToStation = useCallback(async (item: StationViewModel) => {
    const { station } = item;
    try {
      await openDirections(station.lat, station.lon, station.address || station.name);
    } catch {
      setLocationError("Could not open maps for this station.");
    }
  }, []);

  useEffect(() => {
    if (nearbyMode !== "fuel") return;
    if (!sortedStations.length) {
      setSelectedCode(undefined);
      setSelectedStation(undefined);
      return;
    }
    const selectedExists = stations.some((item) => item.station.stationCode === selectedCode);
    if (!sortMode) {
      if (selectedCode && !selectedExists) setSelectedCode(undefined);
      previousSortMode.current = sortMode;
      return;
    }
    if (selectionDismissed && !selectedCode) return;
    previousSortMode.current = sortMode;
  }, [nearbyMode, selectedCode, selectionDismissed, sortMode, sortedStations, stations]);

  useEffect(() => {
    if (!selectedCode) {
      setSelectedStation(undefined);
      return;
    }
    const stationMatch = stations.find((item) => item.station.stationCode === selectedCode);
    if (stationMatch) {
      setSelectedStation(stationMatch);
      return;
    }
    setSelectedStation((current) =>
      current?.station.stationCode === selectedCode ? current : undefined,
    );
  }, [selectedCode, stations]);

  return (
    <View style={styles.screen}>
      <View style={styles.mapLayer}>
        <StationMap
          centre={centre}
          chargers={nearbyMode === "fuel" ? [] : chargers}
          stations={nearbyMode === "ev" ? [] : stations}
          selectedChargerId={nearbyMode === "fuel" ? undefined : selectedCode}
          selectedStationCode={selectedCode}
          onSelect={handleMapStationSelect}
          onSelectCharger={handleMapChargerSelect}
          onViewportStationsChange={handleViewportStationsChange}
          onMapSearchAreaChange={handleMapSearchAreaChange}
          cameraFocusKey={`nearby-${cameraFocusVersion}`}
          showCentreMarker={selectedPlaceActive}
          userLocation={currentLocation}
          cameraInsets={nearbyCameraInsets}
        />
      </View>

      <View onLayout={onTopControlsLayout} style={styles.topControls}>
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
        <NearbyEnergySelector
          onChange={changeSelectedEnergy}
          onToggleOpen={() => setEnergySelectorOpen((current) => !current)}
          open={energySelectorOpen}
          value={selectedEnergy}
        />
      </View>

      {nearbyMode === "fuel" ? (
        <NearbyFuelPanel
          error={error}
          loading={loading}
          onCloseSelectedStation={handleCloseSelectedStation}
          onNavigateToStation={handleNavigateToStation}
          onSelectStation={handleListStationSelect}
          onSortPress={handleSortPress}
          onSnapChange={setNearbySheetSnap}
          onToggleExpanded={setSheetExpanded}
          selected={selectedForPanel}
          selectedCode={selectedCode}
          sheetSnap={sheetSnap}
          sheetExpanded={sheetExpanded}
          expandedSheetTop={expandedSheetTop}
          sortedStations={sortedStations}
          sortMode={sortMode}
          stationContext={stationContext}
          stationNotice={stationNotice}
          stations={stations}
          topControls={
            preferredBrands.length ? (
              <StationBrandFilterPill
                active={brandFilterActive}
                label={stationBrandFilterLabel}
                onPress={() => setShowAllStationBrandsOnce((current) => !current)}
              />
            ) : null
          }
        />
      ) : nearbyMode === "both" ? (
        <NearbyCombinedPanel
          chargers={chargers}
          connectors={evConnectors}
          error={error}
          evNotice={evNotice}
          loading={loading}
          mode={nearbyMode}
          onCloseSelection={handleCloseSelectedStation}
          onExpandSearch={() => setNearbyRadiusKm((current) => Math.min(maxMapSearchRadiusKm, Math.max(current * 2, emptyMapRetryRadiusKm)))}
          onFuelChange={onFuelChange}
          onModeChange={setNearbyModeAndBrowse}
          onNavigateToCharger={(charger) => openDirections(charger.lat, charger.lon, charger.name)}
          onPowerModeChange={setEvPowerMode}
          onSelectCharger={handleMapChargerSelect}
          onSelectStation={handleListStationSelect}
          onToggleConnector={(connector) => setEvConnectors((current) => toggleConnectorFilter(current, connector))}
          onToggleExpanded={setSheetExpanded}
          onSnapChange={setNearbySheetSnap}
          powerMode={evPowerMode}
          preferences={preferences}
          selectedCharger={selectedCharger}
          selectedCode={selectedCode}
          selectedStation={selectedForPanel}
          sheetSnap={sheetSnap}
          sheetExpanded={sheetExpanded}
          expandedSheetTop={expandedSheetTop}
          sortedStations={sortedStations}
          stationContext={stationContext}
          stationNotice={stationNotice}
        />
      ) : (
        <EvChargerPanel
          chargers={chargers}
          connectors={evConnectors}
          error={error}
          loading={loading}
          notice={evNotice}
          onClearConnectorFilters={() => setEvConnectors([])}
          onClearPowerMode={() => setEvPowerMode("")}
          onCloseSelectedCharger={handleCloseSelectedStation}
          onExpandSearch={() => setNearbyRadiusKm((current) => Math.min(maxMapSearchRadiusKm, Math.max(current * 2, emptyMapRetryRadiusKm)))}
          onNavigate={(charger) => openDirections(charger.lat, charger.lon)}
          onSelectCharger={handleMapChargerSelect}
          onToggleExpanded={setSheetExpanded}
          onSnapChange={setNearbySheetSnap}
          selectedCharger={selectedCharger}
          selectedChargerId={selectedCode}
          sheetSnap={sheetSnap}
          sheetExpanded={sheetExpanded}
          expandedSheetTop={expandedSheetTop}
          onPowerModeChange={setEvPowerMode}
          onToggleConnector={(connector) => setEvConnectors((current) => toggleConnectorFilter(current, connector))}
          powerMode={evPowerMode}
          chargingPreference={preferences.evChargingPreference}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: "hidden",
  },
  mapLayer: { bottom: 0,
    left: 0, position: "absolute", right: 0, top: 0,
  },
  topControls: {
    gap: spacing.sm,
    left: spacing.md,
    position: "absolute",
    right: spacing.md,
    top: spacing.md,
    zIndex: 20,
  },
});

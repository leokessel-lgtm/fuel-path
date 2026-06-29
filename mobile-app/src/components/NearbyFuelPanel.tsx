import { NearbySortMode, NearbyStationSheet } from "./NearbyStationSheet";
import { NearbySheetSnap, StationViewModel } from "../types";

export function NearbyFuelPanel({
  error,
  loading,
  onCloseSelectedStation,
  onNavigateToStation,
  onSelectStation,
  onSortPress,
  onSnapChange,
  onToggleExpanded,
  selected,
  selectedCode,
  sheetSnap,
  sheetExpanded,
  sortedStations,
  sortMode,
  stationNotice,
  stations,
}: {
  error: string;
  loading: boolean;
  onCloseSelectedStation: () => void;
  onNavigateToStation: (station: StationViewModel) => void;
  onSelectStation: (stationCode: string) => void;
  onSortPress: (sortMode: NearbySortMode) => void;
  onSnapChange?: (snap: NearbySheetSnap) => void;
  onToggleExpanded: (expanded: boolean) => void;
  selected?: StationViewModel;
  selectedCode?: string;
  sheetSnap: NearbySheetSnap;
  sheetExpanded: boolean;
  sortedStations: StationViewModel[];
  sortMode?: NearbySortMode;
  stationNotice: string;
  stations: StationViewModel[];
}) {
  return (
    <NearbyStationSheet
      error={error}
      loading={loading}
      onCloseSelectedStation={onCloseSelectedStation}
      onNavigateToStation={onNavigateToStation}
      onSelectStation={onSelectStation}
      onSortPress={onSortPress}
      onSnapChange={onSnapChange}
      onToggleExpanded={onToggleExpanded}
      selected={selected}
      selectedCode={selectedCode}
      sheetSnap={sheetSnap}
      sheetExpanded={sheetExpanded}
      sortedStations={sortedStations}
      sortMode={sortMode}
      stationNotice={stationNotice}
      stations={stations}
    />
  );
}

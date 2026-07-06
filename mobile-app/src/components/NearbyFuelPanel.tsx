import { NearbySortMode, NearbyStationSheet } from "./NearbyStationSheet";
import { ReactNode } from "react";
import { NearbyResponse, NearbySheetSnap, StationViewModel } from "../types";

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
  expandedSheetTop,
  sortedStations,
  sortMode,
  stationContext,
  stationNotice,
  stations,
  topControls,
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
  expandedSheetTop: number;
  sortedStations: StationViewModel[];
  sortMode?: NearbySortMode;
  stationContext?: NearbyResponse["context"];
  stationNotice: string;
  stations: StationViewModel[];
  topControls?: ReactNode;
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
      expandedSheetTop={expandedSheetTop}
      sortedStations={sortedStations}
      sortMode={sortMode}
      stationContext={stationContext}
      stationNotice={stationNotice}
      stations={stations}
      topControls={topControls}
    />
  );
}

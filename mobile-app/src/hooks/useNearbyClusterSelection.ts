import { useState } from "react";

export type SelectedCluster = {
  count: number;
  minPrice?: number;
  stationCodes: string[];
};

export function useNearbyClusterSelection() {
  const [selectedCluster, setSelectedCluster] = useState<SelectedCluster>();

  return {
    clearSelectedCluster: () => setSelectedCluster(undefined),
    selectedCluster,
    selectCluster: setSelectedCluster,
  };
}

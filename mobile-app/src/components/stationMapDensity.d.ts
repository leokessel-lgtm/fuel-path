import type { EvCharger } from "../types";

export const maxVisibleEvMarkers: number;
export const minimumEvMarkerSpacingPx: number;

export function prioritiseSelectedChargers(
  chargers: EvCharger[],
  selectedChargerId?: string,
): EvCharger[];

export function spatiallySeparatedEvChargers(
  chargers: EvCharger[],
  selectedChargerId: string | undefined,
  positionForCharger: (charger: EvCharger) => { x: number; y: number } | null,
  options?: { limit?: number; minimumSpacingPx?: number },
): EvCharger[];

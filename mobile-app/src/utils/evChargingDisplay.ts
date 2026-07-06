import { EvChargingPreference, EvConnector, EvPowerMode, FuelCode } from "../types";

export const evPowerOptions: Array<{ label: string; value: EvPowerMode; minPowerKw: number }> = [
  { label: "Any", value: "", minPowerKw: 0 },
  { label: "AC", value: "ac", minPowerKw: 0 },
  { label: "Fast", value: "dc_fast", minPowerKw: 50 },
];

export function evChargingPreferenceLabel(value?: EvChargingPreference) {
  if (value === "cheap") return "cheapest";
  if (value === "fast") return "fastest";
  if (value === "reliable") return "reliable";
  if (value === "nearby") return "closest";
  return "balanced";
}

export function vehicleProfileHint(
  fuel: FuelCode,
  connectors: EvConnector[],
  chargingPreference?: EvChargingPreference,
  energyType?: string,
) {
  const connectorLabel = connectors.length ? connectors.join(" / ") : "all connector types";
  if (energyType === "electric") {
    return `Best for your EV: ${connectorLabel}, ${evChargingPreferenceLabel(chargingPreference)} charging.`;
  }
  return `Best for your vehicle: ${fuel}.`;
}

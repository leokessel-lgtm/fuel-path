import { NearbyResponse, ScoreResponse, StationViewModel } from "../types";

type FuelContext =
  | NearbyResponse["context"]
  | ScoreResponse["context"]
  | undefined;

type FuelMismatchScope = "nearby" | "route";

export function fuelMismatchLine(item?: StationViewModel, options: { scope?: FuelMismatchScope } = {}) {
  if (!item || item.exactFuelMatch !== false) return "";
  const requestedFuel = item.requestedFuel || item.station.requestedFuel;
  const shownFuel = item.fuel || item.station.matchedFuel;
  if (!requestedFuel || !shownFuel || requestedFuel === shownFuel) return "";
  return `${requestedFuel} unavailable ${scopePlace(options.scope)}. Showing ${shownFuel} price instead.`;
}

export function fuelMismatchContextLine(context?: FuelContext, options: { scope?: FuelMismatchScope } = {}) {
  if (!context || context.requestedFuelUnavailable !== true) return "";
  const requestedFuel = context.requestedFuel || context.fuel;
  const alternatives = alternativeFuelCodes(context).join("/");
  if (!requestedFuel && !alternatives) return "";
  if (!alternatives) return `Exact ${requestedFuel} prices are unavailable ${scopePlace(options.scope)}.`;
  return `Exact ${requestedFuel} prices are unavailable ${scopePlace(options.scope)}. Showing ${alternatives} alternatives.`;
}

function scopePlace(scope: FuelMismatchScope = "nearby") {
  return scope === "route" ? "on this route" : "nearby";
}

function alternativeFuelCodes(context: FuelContext) {
  const value = context && "alternativeFuelCodes" in context
    ? context.alternativeFuelCodes
    : undefined;
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const code = String(item || "").trim().toUpperCase();
        return code ? [code] : [];
      })
    : [];
}

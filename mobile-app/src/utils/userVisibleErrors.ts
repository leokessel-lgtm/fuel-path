type ErrorSurface =
  | "address"
  | "alerts"
  | "current_location"
  | "ev_chargers"
  | "maps"
  | "nearby"
  | "route";

export function userVisibleErrorMessage(error: unknown, surface: ErrorSurface) {
  const message = error instanceof Error ? error.message : String(error || "");
  const safeKnownMessage = knownSafeMessage(message);
  if (safeKnownMessage) return safeKnownMessage;

  switch (surface) {
    case "address":
      return addressLookupErrorMessage(message);
    case "alerts":
      return "Route watch could not update. Your saved route is still on this device, so you can try again.";
    case "current_location":
      return currentLocationErrorMessage(message);
    case "ev_chargers":
      return "We could not load charger options right now. Check Nearby EV charging or your charging app before driving.";
    case "maps":
      return "Could not open maps. Search for the station name in your maps app.";
    case "nearby":
      return nearbyFuelErrorMessage(message);
    case "route":
      return routePlanningErrorMessage(message);
    default:
      return "Something went wrong. Try again shortly.";
  }
}

export function routePlanningErrorMessage(message: string) {
  if (/route engine|route provider|directions|routing|route not found|no route|503|timed out|timeout/i.test(message)) {
    return "We could not plan that drive right now. Check the addresses, try again, or use Nearby fuel.";
  }
  if (/no eligible stations|no recommendations|empty results|no fuel stops|no suitable/i.test(message)) {
    return "No useful fuel stop was found on this route. Try a different fuel, widen the trip, or check Nearby fuel.";
  }
  if (/cannot read|undefined|null|points|typeerror|referenceerror|json|html|non-json|internal|stack/i.test(message)) {
    return "Route planning hit a temporary problem. Try again, edit the route, or check Nearby fuel.";
  }
  if (/network|fetch|failed to fetch|load failed|connection|offline/i.test(message)) {
    return "Fuel Path could not connect. Check your connection and try again.";
  }
  return "Could not plan this route right now. Try again or edit the route.";
}

export function nearbyFuelErrorMessage(message: string) {
  if (/unsupported|outside|coverage|no live/i.test(message)) {
    return "Live prices are not available for this area yet. Try another location or check prices before driving.";
  }
  if (/fuel|product|unavailable/i.test(message)) {
    return "Prices for this fuel are not available here right now. Try another fuel or another area.";
  }
  if (/network|fetch|failed to fetch|load failed|connection|offline|timeout|timed out|503/i.test(message)) {
    return "Fuel Path could not refresh nearby prices. Check your connection and try again.";
  }
  return "Nearby prices could not load right now. Try again or search another area.";
}

export function addressLookupErrorMessage(message: string) {
  if (/rate.?limited|cooling down|temporarily unavailable|provider|nominatim|google|mapbox|here|geoapify|addressr|503|timeout|timed out/i.test(message)) {
    return "We could not check that address right now. Add suburb or postcode, or try again shortly.";
  }
  return "We could not find that address. Try a fuller address, suburb or postcode.";
}

export function currentLocationErrorMessage(message: string) {
  if (/permission|denied|blocked|not granted/i.test(message)) {
    return "Location permission is off. Allow location for Fuel Path, or type the address instead.";
  }
  if (/turned off|services/i.test(message)) {
    return "Location services are off. Turn them on, or type the address instead.";
  }
  if (/timeout|timed out|unavailable|position/i.test(message)) {
    return "Current location was not available. Try again near a window, or type the address instead.";
  }
  return "Current location is not available. Type the address instead.";
}

function knownSafeMessage(message: string) {
  const trimmed = message.trim();
  if (!trimmed) return "";
  const safePrefixes = [
    "Add a start location",
    "Add a destination",
    "Choose a suggestion",
    "EV route charging is not available",
    "No useful fuel stop",
    "No suitable fuel stop",
    "We could not",
    "We couldn't",
    "Current location",
    "Location permission",
    "Location services",
    "Live prices",
    "Nearby prices",
    "Prices for this fuel",
    "Route planning",
  ];
  if (safePrefixes.some((prefix) => trimmed.startsWith(prefix))) return trimmed;
  return "";
}

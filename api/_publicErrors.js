function publicErrorMessage(error, surface = "general") {
  const message = error instanceof Error ? error.message : String(error || "");
  if (surface === "address") return publicAddressError(message);
  if (surface === "alerts") return "Route watch could not update. Your saved route is still on this device, so you can try again.";
  if (surface === "chargers") return "Charger options are temporarily unavailable. Check Nearby EV charging or your charging app before driving.";
  if (surface === "nearby") return publicNearbyError(message);
  if (surface === "predictions") return publicPredictionError(message);
  if (surface === "route") return publicRouteError(message);
  return "Fuel Path could not finish that request. Try again shortly.";
}

function publicAddressError(message) {
  if (/q is required|missing/i.test(message)) return "Enter an address, suburb or postcode to search.";
  return "No strong location match found. Try a fuller address, suburb or postcode.";
}

function publicNearbyError(message) {
  if (/fuel|product|unavailable/i.test(message)) {
    return "Prices for this fuel are not available here right now. Try another fuel or another area.";
  }
  if (/unsupported|outside|coverage/i.test(message)) {
    return "Live prices are not available for this area yet. Try another location or check prices before driving.";
  }
  return "Nearby prices are temporarily unavailable. Try again or search another area.";
}

function publicRouteError(message) {
  if (/no eligible stations|no recommendations|empty results|no fuel stops/i.test(message)) {
    return "No useful fuel stop was found on this route. Try a different fuel, widen the trip, or check Nearby fuel.";
  }
  if (/from|to|lat|lon|point|body|json|required/i.test(message)) {
    return "Route details are incomplete. Check the start and destination, then try again.";
  }
  return "Route planning is temporarily unavailable. Check the addresses or choose a saved route.";
}

function publicPredictionError(message) {
  if (/fuel|unsupported|not supported/i.test(message)) {
    return "Fuel-cycle guidance does not support that fuel yet. Price alerts will stay conservative.";
  }
  return "Fuel-cycle guidance is not available yet. Price alerts will stay conservative.";
}

module.exports = {
  publicErrorMessage,
};

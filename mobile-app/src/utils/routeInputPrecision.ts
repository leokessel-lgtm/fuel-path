export function routeInputPrecisionHint(kind: "destination" | "start", query: string) {
  const text = query.trim();
  if (!addressLikeInput(text)) return "";
  if (addressHasNarrowingContext(text)) {
    if (kind === "start") return "Choose a start suggestion to confirm this address.";
    return "Choose a destination suggestion to confirm this address.";
  }
  if (kind === "start") {
    return "Choose a start suggestion, or add suburb or postcode before planning.";
  }
  return "Choose a destination suggestion, or add suburb or postcode before planning.";
}

export function addressLocalityHint(query: string) {
  const text = query.trim();
  if (text.length < 8) return "";
  if (!addressLikeInput(text)) return "";
  if (addressHasNarrowingContext(text)) return "";
  if (/\b(street|st|road|rd|avenue|ave|drive|dr|highway|hwy|terrace|tce|circuit|cct|way|lane|ln|place|pl|court|ct|crescent|cres|boulevard|bvd|blvd|parade|pde|parkway|pkwy|pwy|esplanade|esp|square|sq)\b/i.test(text)) {
    return "Street found. Add suburb or postcode to choose the right area.";
  }
  return "Add suburb or postcode to narrow the address.";
}

function addressLikeInput(query: string) {
  const text = query.trim();
  const hasStreetType = /\b(street|st|road|rd|avenue|ave|drive|dr|highway|hwy|terrace|tce|circuit|cct|way|lane|ln|place|pl|court|ct|crescent|cres|boulevard|bvd|blvd|parade|pde|parkway|pkwy|pwy|esplanade|esp|square|sq)\b/i.test(text);
  const hasLeadingAddressToken = /^(?:unit|apt|apartment|flat|suite|townhouse)?\s*\d+[a-z]?(?:\/\d+[a-z]?)?\s+[a-z]/i.test(text);
  return hasStreetType || hasLeadingAddressToken;
}

function addressHasNarrowingContext(query: string) {
  const text = query.trim();
  if (/\b\d{4}\b/.test(text)) return true;
  return hasAddressLocalityContext(text);
}

function hasAddressLocalityContext(query: string) {
  const withoutState = query
    .replace(/\b(nsw|act|qld|vic|wa|sa|tas|nt)\b/gi, " ")
    .replace(/\b\d+[a-z]?(?:\/\d+[a-z]?)?\b/gi, " ")
    .replace(/\b(unit|apt|apartment|flat|suite|townhouse)\b/gi, " ")
    .replace(/\b(street|st|road|rd|avenue|ave|drive|dr|highway|hwy|terrace|tce|circuit|cct|way|lane|ln|place|pl|court|ct|crescent|cres|boulevard|bvd|blvd|parade|pde|parkway|pkwy|pwy|esplanade|esp|square|sq)\b/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
  const words = withoutState.split(" ").filter((word) => word.length >= 3);
  return words.length >= 2;
}

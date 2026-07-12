function planUnitAddressQuery({
  hasUnitIntent,
  typeaheadReady,
  exactPrefixReady,
  startsWithUnitToken,
  forceTypeahead,
} = {}) {
  if (!hasUnitIntent) return null;
  if (!typeaheadReady && !exactPrefixReady) {
    return { allowed: false, startsWithUnitToken: Boolean(startsWithUnitToken), forceTypeahead: Boolean(forceTypeahead) };
  }
  return {
    allowed: true,
    startsWithUnitToken: Boolean(startsWithUnitToken),
    forceTypeahead: Boolean(forceTypeahead),
    exactPrefixOnly: Boolean(exactPrefixReady && !typeaheadReady),
  };
}

function planTypeaheadAddressQuery({ startsWithNumber, startsWithLot, embeddedAddressCore } = {}) {
  if (startsWithNumber) return { prefix: true, typeaheadFallback: true, prefixNeedle: null };
  if (startsWithLot) return { prefix: true, typeaheadFallback: true, prefixNeedle: null };
  if (embeddedAddressCore) {
    return { prefix: true, typeaheadFallback: true, prefixNeedle: embeddedAddressCore, minPrefixLength: 8 };
  }
  return { prefix: false, typeaheadFallback: true, prefixNeedle: null };
}

function prioritiseHostedAddressNeedles({ rawItem, needles = [], startsWithAddressCore } = {}) {
  const ordered = !startsWithAddressCore && needles.length > 1
    ? [...needles.slice(1), needles[0]]
    : needles;
  return [...ordered, rawItem];
}

module.exports = { planTypeaheadAddressQuery, planUnitAddressQuery, prioritiseHostedAddressNeedles };

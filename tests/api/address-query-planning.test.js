const assert = require("node:assert/strict");
const test = require("node:test");

const { planTypeaheadAddressQuery, planUnitAddressQuery, prioritiseHostedAddressNeedles } = require("../../api/_addressQueryPlanning");

test("unit query planning fails quiet until typeahead or an exact prefix is safe", () => {
  assert.deepEqual(planUnitAddressQuery({ hasUnitIntent: true }), {
    allowed: false,
    startsWithUnitToken: false,
    forceTypeahead: false,
  });
  assert.deepEqual(planUnitAddressQuery({
    hasUnitIntent: true,
    exactPrefixReady: true,
    startsWithUnitToken: true,
  }), {
    allowed: true,
    startsWithUnitToken: true,
    forceTypeahead: false,
    exactPrefixOnly: true,
  });
});

test("unit query planning records when ambiguity requires rebuilt typeahead", () => {
  assert.deepEqual(planUnitAddressQuery({
    hasUnitIntent: true,
    typeaheadReady: true,
    startsWithUnitToken: true,
    forceTypeahead: true,
  }), {
    allowed: true,
    startsWithUnitToken: true,
    forceTypeahead: true,
    exactPrefixOnly: false,
  });
});

test("typeahead planning keeps number, lot and embedded-address prefix lanes distinct", () => {
  assert.deepEqual(planTypeaheadAddressQuery({ startsWithNumber: true }), {
    prefix: true,
    typeaheadFallback: true,
    prefixNeedle: null,
  });
  assert.deepEqual(planTypeaheadAddressQuery({ startsWithLot: true }), {
    prefix: true,
    typeaheadFallback: true,
    prefixNeedle: null,
  });
  assert.deepEqual(planTypeaheadAddressQuery({ embeddedAddressCore: "12 king street" }), {
    prefix: true,
    typeaheadFallback: true,
    prefixNeedle: "12 king street",
    minPrefixLength: 8,
  });
  assert.deepEqual(planTypeaheadAddressQuery({}), {
    prefix: false,
    typeaheadFallback: true,
    prefixNeedle: null,
  });
});

test("hosted query planning prefers derived address cores only for building-first input", () => {
  const primary = { needle: "venue 12 king street", rawQuery: "Venue 12 King Street" };
  const core = { needle: "12 king street", rawQuery: "12 king street" };
  assert.deepEqual(prioritiseHostedAddressNeedles({ rawItem: primary, needles: [primary, core], startsWithAddressCore: false }), [core, primary, primary]);
  assert.deepEqual(prioritiseHostedAddressNeedles({ rawItem: primary, needles: [primary, core], startsWithAddressCore: true }), [primary, core, primary]);
});

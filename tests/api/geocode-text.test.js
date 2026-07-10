const assert = require("node:assert/strict");
const test = require("node:test");

const { broadAreaSuggestionLeavesSpecificQueryTerms } = require("../../api/_geocodeText");

test("broad-area fast path ignores symmetric state and postcode context", () => {
  const sydney = { label: "Sydney NSW 2000", type: "city" };
  assert.equal(broadAreaSuggestionLeavesSpecificQueryTerms("Sydney NSW", sydney), false);
  assert.equal(broadAreaSuggestionLeavesSpecificQueryTerms("Sydney NSW 2000", sydney), false);
});

test("broad-area fast path yields to a more specific building query", () => {
  const karratha = { label: "Karratha WA 6714", type: "regional_town" };
  assert.equal(broadAreaSuggestionLeavesSpecificQueryTerms("Karratha City Plaza", karratha), true);
});

test("broad-area fast path does not discard four-digit building-name tokens", () => {
  const studio = { label: "Sydney NSW 2000", type: "city" };
  assert.equal(broadAreaSuggestionLeavesSpecificQueryTerms("Studio 2000 Sydney NSW", studio), true);
});

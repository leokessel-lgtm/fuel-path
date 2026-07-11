const assert = require("node:assert/strict");
const test = require("node:test");
const { createAddressRanking } = require("../../api/_addressRanking");

const normalise = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

test("address ranking preserves exact, prefix and token-overlap order", () => {
  const ranking = createAddressRanking({ normaliseAddressText: normalise });
  assert.equal(ranking.scoreRecord({ label: "10 King Street Sydney" }, "10 king street sydney").score, 1000);
  assert.equal(ranking.addressIndexRank({ row: { label: "10 King Street Sydney" }, matchType: "address_prefix" }, "10 king"), 960);
  assert.deepEqual(ranking.significantAddressTokens("10 King Street NSW"), ["10", "king"]);
});

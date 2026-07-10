const assert = require("node:assert/strict");
const test = require("node:test");

const { createStationDecorator } = require("../../api/_stationDiscounts");

test("station decorator preserves existing discounts and replaces matching rule IDs", () => {
  const decorate = createStationDecorator({
    today: () => "2026-07-11",
    discountRules: [{
      id: "member-four",
      label: "Member discount",
      discountType: "direct_cpl",
      centsPerLitre: 4,
      nextReviewAt: "2026-08-01",
      expiryDate: "2026-12-31",
      brandIncludes: ["shell"],
    }],
  });

  const station = decorate({
    brand: "Shell",
    name: "Central",
    discounts: [{ id: "existing", label: "Existing" }, { id: "member-four", label: "Old" }],
  });

  assert.deepEqual(station.discounts.map((item) => item.id), ["existing", "member-four"]);
  assert.equal(station.discounts[1].label, "Member discount");
  assert.equal(station.discounts[1].inferred, true);
});

test("station decorator excludes inactive and non-direct rules", () => {
  const base = { brandIncludes: ["shell"], centsPerLitre: 4, discountType: "direct_cpl" };
  const decorate = createStationDecorator({
    today: () => "2026-07-11",
    discountRules: [
      { ...base, id: "expired", nextReviewAt: "2026-08-01", expiryDate: "2026-07-10" },
      { ...base, id: "overdue", nextReviewAt: "2026-07-10" },
      { ...base, id: "points", discountType: "points", nextReviewAt: "2026-08-01" },
      { ...base, id: "zero", centsPerLitre: 0, nextReviewAt: "2026-08-01" },
    ],
  });

  assert.deepEqual(decorate({ brand: "Shell", discounts: [] }).discounts, []);
});

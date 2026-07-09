const assert = require("node:assert/strict");
const test = require("node:test");

const discountRegistry = require("../../shared/discountRegistry.json");
const {
  _discountTermsForTests,
} = require("../../api/_routeScoring");

const TODAY = "2026-07-09";

test("discount registry contains direct c/L offers with enforceable terms", () => {
  assert.equal(discountRegistry.length, 12);
  for (const program of discountRegistry) {
    assert.equal(program.discountType, "direct_cpl", `${program.id} must be direct_cpl`);
    assert.ok(program.centsPerLitre > 0, `${program.id} must have positive c/L`);
    assert.ok(program.maxLitresPerTransaction > 0, `${program.id} must declare litre cap`);
    assert.ok(program.maxTransactionsPer24h > 0, `${program.id} must declare transaction cap`);
    assert.equal(typeof program.requiresBarcode, "boolean", `${program.id} must declare barcode requirement`);
    assert.ok(program.participatingStationScope, `${program.id} must declare station scope`);
    assert.ok(program.sourceUrl?.startsWith("https://"), `${program.id} must declare source URL`);
    assert.ok(program.lastVerifiedAt, `${program.id} must declare verification date`);
    assert.ok(program.nextReviewAt, `${program.id} must declare next review date`);
    assert.ok(program.lastVerifiedAt <= TODAY, `${program.id} verification date cannot be in the future`);
    assert.ok(program.nextReviewAt >= TODAY, `${program.id} needs current review coverage`);
    assert.ok(Array.isArray(program.stationBrands) && program.stationBrands.length, `${program.id} must declare station brands`);
    assert.ok(Array.isArray(program.brandIncludes) && program.brandIncludes.length, `${program.id} must declare backend brand matchers`);
    assert.equal(noExtraInStorePurchaseRule(program), true, `${program.id} must not require extra in-store purchase`);
  }
});

test("expired discount offers stay out of active route pricing", () => {
  const activeDiscountIds = discountRegistry
    .filter(isActiveDirectDiscount)
    .map((program) => program.id);

  assert.equal(activeDiscountIds.length, 11);
  assert.equal(activeDiscountIds.includes("rac_wa_caltex"), false);
  assert.equal(activeDiscountIds.includes("racq_caltex"), true);
});

test("extra in-store purchase discounts are excluded from the pricing registry", () => {
  const discountIds = discountRegistry.map((program) => program.id);
  assert.equal(discountIds.includes("everyday_rewards"), true);
  assert.equal(discountIds.includes("flybuys"), true);
  assert.equal(discountIds.includes("reddy_express_instore"), false);
});

test("discount terms cap effective c/L against evaluated fill volume", () => {
  const capped = _discountTermsForTests.discountForFill({
    id: "test",
    label: "Capped test",
    centsPerLitre: 10,
    maxLitresPerTransaction: 20,
  }, {
    fillLitres: 40,
    fuel: "U91",
  });

  assert.equal(capped.appliedLitres, 20);
  assert.equal(capped.effectiveCentsPerLitre, 5);
});

test("fuel-specific discount values override headline c/L", () => {
  const regular = _discountTermsForTests.discountCentsForFuel({
    centsPerLitre: 5,
    fuelTypeCentsPerLitre: {
      U91: 4,
      P98: 5,
    },
  }, "U91");
  const premium = _discountTermsForTests.discountCentsForFuel({
    centsPerLitre: 5,
    fuelTypeCentsPerLitre: {
      U91: 4,
      P98: 5,
    },
  }, "P98");

  assert.equal(regular, 4);
  assert.equal(premium, 5);
});

test("state-scoped discounts fail closed outside eligible regions", () => {
  const raa = {
    id: "raa_sa_fuel",
    includedStates: ["SA"],
  };
  const wilson = {
    id: "wilson_parking_7eleven",
    excludedStates: ["SA", "TAS"],
  };

  assert.equal(_discountTermsForTests.discountAppliesToStation(raa, { source: "api_sa_fuel_price_reporting" }), true);
  assert.equal(_discountTermsForTests.discountAppliesToStation(raa, { source: "api_wa_fuelwatch" }), false);
  assert.equal(_discountTermsForTests.discountAppliesToStation(wilson, { source: "api_sa_fuel_price_reporting" }), false);
  assert.equal(_discountTermsForTests.discountAppliesToStation(wilson, { source: "api_nsw_fuelcheck" }), true);
});

function isActiveDirectDiscount(program) {
  if (program.discountType !== "direct_cpl") return false;
  if (Number(program.centsPerLitre || 0) <= 0) return false;
  if (program.nextReviewAt < TODAY) return false;
  if (!program.expiryDate) return true;
  return program.expiryDate >= TODAY;
}

function noExtraInStorePurchaseRule(program) {
  const text = [
    program.id,
    program.label,
    program.shortLabel,
    program.participatingStationScope,
  ].join(" ").toLowerCase();
  const excludedTerms = [
    "in-store",
    "instore",
    "eligible spend",
    "eligible purchase",
    "qualifying spend",
    "qualifying purchase",
    "after spend",
    "after purchase",
  ];
  return !excludedTerms.some((term) => text.includes(term));
}

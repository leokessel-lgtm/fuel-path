function createStationDecorator({ discountRules = [], today = () => new Date().toISOString().slice(0, 10) } = {}) {
  return function decorateStation(station) {
    const byId = new Map();
    for (const item of station.discounts || []) {
      if (item?.id) byId.set(String(item.id), { ...item });
    }
    const text = `${station.brand || ""} ${station.name || ""}`.toLowerCase();
    for (const rule of discountRules) {
      if (!isActiveDirectDiscountRule(rule, today())) continue;
      if (rule.brandIncludes.some((needle) => text.includes(needle))) {
        byId.set(rule.id, {
          id: rule.id,
          label: rule.label,
          centsPerLitre: rule.centsPerLitre,
          fuelTypeCentsPerLitre: rule.fuelTypeCentsPerLitre,
          maxLitresPerTransaction: rule.maxLitresPerTransaction,
          maxTransactionsPer24h: rule.maxTransactionsPer24h,
          excludedFuelTypes: rule.excludedFuelTypes,
          excludedStates: rule.excludedStates,
          includedStates: rule.includedStates,
          notStackableWith: rule.notStackableWith,
          requiresBarcode: rule.requiresBarcode,
          participatingStationScope: rule.participatingStationScope,
          sourceUrl: rule.sourceUrl,
          inferred: true,
        });
      }
    }
    return { ...station, discounts: [...byId.values()] };
  };
}

function isActiveDirectDiscountRule(rule, today) {
  if (rule.discountType !== "direct_cpl") return false;
  if (Number(rule.centsPerLitre || 0) <= 0) return false;
  if (rule.nextReviewAt < today) return false;
  if (!rule.expiryDate) return true;
  return rule.expiryDate >= today;
}

module.exports = {
  createStationDecorator,
};

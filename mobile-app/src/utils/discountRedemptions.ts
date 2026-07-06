import { AppPreferences } from "../types";

export function eligibleDiscountIds(preferences: AppPreferences, now = new Date()) {
  return preferences.selectedDiscounts.filter(
    (discountId) => !isDiscountRedeemedToday(preferences, discountId, now),
  );
}

export function isDiscountRedeemedToday(
  preferences: AppPreferences,
  discountId: string,
  now = new Date(),
) {
  const redemption = preferences.discountRedemptions?.[discountId];
  if (redemption?.status !== "redeemed_today") return false;
  return localDateKey(redemption.updatedAt) === localDateKey(now.toISOString());
}

function discountRedemptionLabel(preferences: AppPreferences, discountId: string) {
  return isDiscountRedeemedToday(preferences, discountId) ? "Used today" : "Unused";
}

function localDateKey(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

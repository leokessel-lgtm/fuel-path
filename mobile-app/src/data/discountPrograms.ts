import { DiscountRule } from "../types";
import discountRegistry from "./discountRegistry.generated.json";

export const discountPrograms = discountRegistry as DiscountRule[];

export const activeDirectDiscountPrograms = discountPrograms.filter(isActiveDirectDiscount);

function isActiveDirectDiscount(program: DiscountRule) {
  if (program.discountType !== "direct_cpl") return false;
  if (program.centsPerLitre <= 0) return false;
  if (!program.expiryDate) return true;
  return program.expiryDate >= todayIsoDate();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

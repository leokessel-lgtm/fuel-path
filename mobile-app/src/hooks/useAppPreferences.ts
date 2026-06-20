import { useCallback, useEffect, useState } from "react";

import {
  defaultPreferences,
  loadPreferences,
  persistPreferences,
} from "../services/preferencesStore";
import { AppPreferences, FuelCode, MapPoint } from "../types";
import { isDiscountRedeemedToday } from "../utils/discountRedemptions";

export function useAppPreferences() {
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadPreferences().then((storedPreferences) => {
      if (!active) return;
      setPreferences(storedPreferences);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    persistPreferences(preferences).catch(() => {});
  }, [loaded, preferences]);

  const updateFuel = useCallback((fuel: FuelCode) => {
    setPreferences((current) => ({ ...current, fuel }));
  }, []);

  const updateDecisionRule = useCallback((
    key: "minSavingDollars" | "maxDetourMinutes",
    value: number,
  ) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  }, []);

  const toggleDiscount = useCallback((discountId: string) => {
    setPreferences((current) => {
      const selected = new Set(current.selectedDiscounts);
      if (selected.has(discountId)) {
        selected.delete(discountId);
      } else {
        selected.add(discountId);
      }
      const discountRedemptions = { ...(current.discountRedemptions || {}) };
      if (!selected.has(discountId)) {
        delete discountRedemptions[discountId];
      }
      return {
        ...current,
        selectedDiscounts: Array.from(selected),
        discountRedemptions: Object.keys(discountRedemptions).length
          ? discountRedemptions
          : undefined,
      };
    });
  }, []);

  const toggleDiscountRedemption = useCallback((discountId: string) => {
    setPreferences((current) => {
      if (!current.selectedDiscounts.includes(discountId)) return current;
      const discountRedemptions = { ...(current.discountRedemptions || {}) };
      if (isDiscountRedeemedToday(current, discountId)) {
        discountRedemptions[discountId] = {
          status: "available",
          updatedAt: new Date().toISOString(),
        };
      } else {
        discountRedemptions[discountId] = {
          status: "redeemed_today",
          updatedAt: new Date().toISOString(),
        };
      }
      return {
        ...current,
        discountRedemptions,
      };
    });
  }, []);

  const toggleFuelPolicy = useCallback(() => {
    setPreferences((current) => ({
      ...current,
      fuelPolicyEnabled: !current.fuelPolicyEnabled,
    }));
  }, []);

  const togglePolicyBrand = useCallback((brand: string) => {
    setPreferences((current) => {
      const selected = new Set(current.approvedPolicyBrands);
      if (selected.has(brand)) {
        selected.delete(brand);
      } else {
        selected.add(brand);
      }
      return {
        ...current,
        approvedPolicyBrands: selected.size
          ? Array.from(selected)
          : current.approvedPolicyBrands,
      };
    });
  }, []);

  const saveNamedPlace = useCallback((kind: "home" | "work", point: MapPoint) => {
    setPreferences((current) => ({
      ...current,
      [kind === "home" ? "homeLocation" : "workLocation"]: point,
    }));
  }, []);

  const clearNamedPlace = useCallback((kind: "home" | "work") => {
    setPreferences((current) => ({
      ...current,
      [kind === "home" ? "homeLocation" : "workLocation"]: undefined,
    }));
  }, []);

  return {
    clearNamedPlace,
    loaded,
    preferences,
    saveNamedPlace,
    toggleDiscount,
    toggleDiscountRedemption,
    toggleFuelPolicy,
    togglePolicyBrand,
    updateDecisionRule,
    updateFuel,
  };
}

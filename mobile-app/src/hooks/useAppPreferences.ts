import { useCallback, useEffect, useState } from "react";

import {
  defaultPreferences,
  loadPreferences,
  persistPreferences,
} from "../services/preferencesStore";
import {
  AppPreferences,
  EvConnector,
  FuelCode,
  HomeChargingAccess,
  MapPoint,
  VehicleEnergyType,
} from "../types";
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

  const updateVehicleEnergyType = useCallback((vehicleEnergyType: VehicleEnergyType) => {
    setPreferences((current) => {
      if (vehicleEnergyType === "diesel" && current.fuel !== "DL" && current.fuel !== "PDL") {
        return { ...current, fuel: "DL", vehicleEnergyType };
      }
      if (vehicleEnergyType === "petrol" && (current.fuel === "DL" || current.fuel === "PDL")) {
        return { ...current, fuel: "U91", vehicleEnergyType };
      }
      return { ...current, vehicleEnergyType };
    });
  }, []);

  const toggleEvConnector = useCallback((connector: EvConnector) => {
    setPreferences((current) => {
      const selected = new Set(current.evConnectors || []);
      if (selected.has(connector)) {
        selected.delete(connector);
      } else {
        selected.add(connector);
      }
      return {
        ...current,
        evConnectors: Array.from(selected),
      };
    });
  }, []);

  const updateVehicleProfile = useCallback((
    updates: Partial<Pick<
      AppPreferences,
      "evBatteryKwh" | "evRangeKm" | "fuelTankLitres" | "homeChargingAccess"
        | "evChargingPreference"
    >>,
  ) => {
    setPreferences((current) => ({ ...current, ...updates }));
  }, []);

  const updateHomeChargingAccess = useCallback((homeChargingAccess: HomeChargingAccess) => {
    setPreferences((current) => ({ ...current, homeChargingAccess }));
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
    toggleEvConnector,
    updateDecisionRule,
    updateFuel,
    updateHomeChargingAccess,
    updateVehicleProfile,
    updateVehicleEnergyType,
  };
}

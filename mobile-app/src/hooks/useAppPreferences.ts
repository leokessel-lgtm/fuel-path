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
  NavigationAppPreference,
  StationBrandMode,
  VehicleProfile,
  VehicleEnergyType,
} from "../types";
import { isDiscountRedeemedToday } from "../utils/discountRedemptions";

const maxVehicleProfiles = 5;

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
    setPreferences((current) => ({
      ...current,
      activeVehicleId: "",
      vehicleName: "",
      vehicleRego: "",
      vehicleEnergyType: fuel === "DL" || fuel === "PDL" ? "diesel" : "petrol",
      fuel,
      evConnectors: [],
      fuelTankLitres: defaultPreferences.fuelTankLitres,
      evBatteryKwh: defaultPreferences.evBatteryKwh,
      evRangeKm: defaultPreferences.evRangeKm,
      homeChargingAccess: defaultPreferences.homeChargingAccess,
      evChargingPreference: defaultPreferences.evChargingPreference,
    }));
  }, []);

  const updateVehicleFuel = useCallback((fuel: FuelCode) => {
    setPreferences((current) => updateActiveVehicle(current, {
      fuel,
      vehicleEnergyType: fuel === "DL" || fuel === "PDL" ? "diesel" : "petrol",
    }));
  }, []);

  const updateVehicleEnergyType = useCallback((vehicleEnergyType: VehicleEnergyType) => {
    setPreferences((current) => {
      const updates: Partial<VehicleProfile> = { vehicleEnergyType };
      if (vehicleEnergyType === "diesel" && current.fuel !== "DL" && current.fuel !== "PDL") {
        updates.fuel = "DL";
      }
      if (vehicleEnergyType === "petrol" && (current.fuel === "DL" || current.fuel === "PDL")) {
        updates.fuel = "U91";
      }
      return updateActiveVehicle(current, updates);
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
      return updateActiveVehicle(current, { evConnectors: Array.from(selected) });
    });
  }, []);

  const updateVehicleProfile = useCallback((
    updates: Partial<Pick<
      AppPreferences,
      "evBatteryKwh" | "evRangeKm" | "fuelTankLitres" | "homeChargingAccess"
        | "evChargingPreference" | "vehicleName" | "vehicleRego"
    >>,
  ) => {
    setPreferences((current) => updateActiveVehicle(current, vehicleProfileUpdates(updates)));
  }, []);

  const updateHomeChargingAccess = useCallback((homeChargingAccess: HomeChargingAccess) => {
    setPreferences((current) => updateActiveVehicle(current, { homeChargingAccess }));
  }, []);

  const selectVehicle = useCallback((vehicleId: string) => {
    setPreferences((current) => {
      const vehicle = current.vehicles.find((item) => item.id === vehicleId);
      if (!vehicle) return current;
      return applyActiveVehicle({ ...current, activeVehicleId: vehicle.id, vehicles: current.vehicles }, vehicle);
    });
  }, []);

  const addVehicle = useCallback((vehicleEnergyType: VehicleEnergyType = "petrol") => {
    setPreferences((current) => {
      if (current.vehicles.length >= maxVehicleProfiles) return current;
      const vehicle = createVehicleProfile(vehicleEnergyType);
      return applyActiveVehicle({
        ...current,
        activeVehicleId: vehicle.id,
        vehicles: [...current.vehicles, vehicle],
      }, vehicle);
    });
  }, []);

  const removeVehicle = useCallback((vehicleId: string) => {
    setPreferences((current) => {
      if (current.vehicles.length <= 1) return current;
      const vehicles = current.vehicles.filter((vehicle) => vehicle.id !== vehicleId);
      const activeVehicle = vehicles.find((vehicle) => vehicle.id === current.activeVehicleId) || vehicles[0];
      return applyActiveVehicle({
        ...current,
        activeVehicleId: activeVehicle.id,
        vehicles,
      }, activeVehicle);
    });
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

  const setStationBrandMode = useCallback((stationBrandMode: StationBrandMode) => {
    setPreferences((current) => ({ ...current, stationBrandMode }));
  }, []);

  const togglePreferredStationBrand = useCallback((brand: string) => {
    setPreferences((current) => {
      const selected = new Set(current.preferredStationBrands);
      if (selected.has(brand)) {
        selected.delete(brand);
      } else {
        selected.add(brand);
      }
      return {
        ...current,
        preferredStationBrands: Array.from(selected),
        stationBrandMode: selected.size ? current.stationBrandMode : "all",
      };
    });
  }, []);

  const setPreferredStationBrands = useCallback((brands: string[]) => {
    setPreferences((current) => ({
      ...current,
      preferredStationBrands: brands,
      stationBrandMode: brands.length ? current.stationBrandMode : "all",
    }));
  }, []);

  const updateNavigationApp = useCallback((navigationApp: NavigationAppPreference) => {
    setPreferences((current) => ({ ...current, navigationApp }));
  }, []);

  return {
    clearNamedPlace,
    loaded,
    preferences,
    addVehicle,
    removeVehicle,
    saveNamedPlace,
    selectVehicle,
    setPreferredStationBrands,
    setStationBrandMode,
    toggleDiscount,
    toggleDiscountRedemption,
    toggleEvConnector,
    togglePreferredStationBrand,
    updateDecisionRule,
    updateFuel,
    updateVehicleFuel,
    updateHomeChargingAccess,
    updateNavigationApp,
    updateVehicleProfile,
    updateVehicleEnergyType,
  };
}

function updateActiveVehicle(
  preferences: AppPreferences,
  updates: Partial<VehicleProfile>,
) {
  const activeVehicle = preferences.vehicles.find((vehicle) => vehicle.id === preferences.activeVehicleId)
    || preferences.vehicles[0];
  if (!activeVehicle) return preferences;
  const nextVehicle = { ...activeVehicle, ...updates };
  const vehicles = preferences.vehicles.map((vehicle) =>
    vehicle.id === activeVehicle.id ? nextVehicle : vehicle,
  );
  return applyActiveVehicle({
    ...preferences,
    activeVehicleId: nextVehicle.id,
    vehicles,
  }, nextVehicle);
}

function applyActiveVehicle(preferences: AppPreferences, vehicle: VehicleProfile): AppPreferences {
  return {
    ...preferences,
    activeVehicleId: vehicle.id,
    vehicleName: vehicle.name,
    vehicleRego: vehicle.rego,
    vehicleEnergyType: vehicle.vehicleEnergyType,
    fuel: vehicle.fuel,
    evConnectors: vehicle.evConnectors,
    fuelTankLitres: vehicle.fuelTankLitres,
    evBatteryKwh: vehicle.evBatteryKwh,
    evRangeKm: vehicle.evRangeKm,
    homeChargingAccess: vehicle.homeChargingAccess,
    evChargingPreference: vehicle.evChargingPreference,
  };
}

function vehicleProfileUpdates(
  updates: Partial<Pick<
    AppPreferences,
    "evBatteryKwh" | "evRangeKm" | "fuelTankLitres" | "homeChargingAccess"
      | "evChargingPreference" | "vehicleName" | "vehicleRego"
  >>,
) {
  const next: Partial<VehicleProfile> = {
    evBatteryKwh: updates.evBatteryKwh,
    evRangeKm: updates.evRangeKm,
    fuelTankLitres: updates.fuelTankLitres,
    homeChargingAccess: updates.homeChargingAccess,
    evChargingPreference: updates.evChargingPreference,
  };
  if (updates.vehicleName !== undefined) next.name = updates.vehicleName;
  if (updates.vehicleRego !== undefined) next.rego = updates.vehicleRego;
  return Object.fromEntries(
    Object.entries(next).filter(([, value]) => value !== undefined),
  ) as Partial<VehicleProfile>;
}

function createVehicleProfile(vehicleEnergyType: VehicleEnergyType): VehicleProfile {
  return {
    id: `vehicle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    rego: "",
    vehicleEnergyType,
    fuel: vehicleEnergyType === "diesel" ? "DL" : "U91",
    evConnectors: [],
    fuelTankLitres: 55,
    evBatteryKwh: 75,
    evRangeKm: 400,
    homeChargingAccess: "unknown",
    evChargingPreference: "balanced",
  };
}

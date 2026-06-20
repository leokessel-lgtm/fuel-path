import { MapPoint } from "../types";

export type LocationEvidenceLevel =
  | "exact"
  | "area"
  | "external"
  | "limited"
  | "street"
  | "unconfirmed"
  | "unknown";

export type LocationEvidence = {
  detail: string;
  label: string;
  level: LocationEvidenceLevel;
};

export function locationEvidence(point: MapPoint): LocationEvidence {
  if (point.lookupStatus === "degraded") {
    return {
      detail: "Provider busy. Using the best local result.",
      label: "Lookup limited",
      level: "limited",
    };
  }

  if (point.provider === "fuel_path_gnaf") {
    if (point.matchType === "exact_address") {
      return {
        detail: "Matched the address index.",
        label: "Exact address",
        level: "exact",
      };
    }
    return {
      detail: "Matched an indexed address candidate.",
      label: "Address match",
      level: "exact",
    };
  }

  if (point.provider === "fuel_path_hint" || point.provider === "fuel_path_regional_gazetteer") {
    if (point.sourceLabel === "Street/area only") {
      return {
        detail: "Not an exact address. Use only if this street or area is enough.",
        label: "Street/area only",
        level: "street",
      };
    }
    if (["poi", "station", "airport"].includes(String(point.type || ""))) {
      return {
        detail: "Matched a known place.",
        label: "Place match",
        level: "area",
      };
    }
    return {
      detail: "Matched a suburb, town or street area.",
      label: "Approx. area",
      level: "area",
    };
  }

  if (point.provider === "fuel_path") {
    return {
      detail: "Matched a known fuel station.",
      label: "Station match",
      level: "area",
    };
  }

  if (point.provider === "google" || point.provider === "addressr") {
    return {
      detail: "Matched by an external location provider.",
      label: "External lookup",
      level: "external",
    };
  }

  if (point.provider === "nominatim") {
    if (point.sourceLabel === "Needs confirmation") {
      return {
        detail: "Not an exact address match. Confirm this row before planning.",
        label: "Needs confirmation",
        level: "unconfirmed",
      };
    }
    return {
      detail: "Validation lookup result.",
      label: "Validation lookup",
      level: "external",
    };
  }

  return {
    detail: "Location confidence is not available.",
    label: point.sourceLabel || "Location match",
    level: "unknown",
  };
}

export function locationEvidenceSummary(point: MapPoint) {
  const evidence = locationEvidence(point);
  return `${evidence.label} | ${evidence.detail}`;
}
